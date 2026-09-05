import "server-only";
import { generateText, stepCountIs, type ModelMessage } from "ai";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { agents, environmentVariables, hitlCheckpoints, projects, tasks, type Architecture, type PlanStep, type Project, type Task } from "@/db/schema";
import { AGENTS, type AgentRole } from "@/lib/types";
import { costMicrosFor, findModel } from "@/lib/models";
import * as repo from "./repo";
import { buildLanguageModel, describeError, isNonRetryable, modelForRole, resolveAiConfig, type ResolvedAiConfig } from "./ai";
import { createAgentTools, createStepContext, STEP_SPECS, systemPromptFor, tablesCount, userPromptFor, type StepContext } from "./agent-runtime";
import { runSimulatedStep } from "./simulation";
import { analyzeWorkspace, formatDiagnostics, ownerRoleFor, type Diagnostic } from "./quality";

// ─── Run registry (survives HMR via globalThis) ─────────────────────────────

interface RunHandle { runId: string; controller: AbortController; startedAt: number; single: boolean; }
const g = globalThis as typeof globalThis & { __forgeRuns?: Map<string, RunHandle> };
const runs = (g.__forgeRuns ??= new Map<string, RunHandle>());

const HEARTBEAT_MS = 8_000;
const STALE_MS = 45_000;
const STEP_TIMEOUT_MS = 300_000;
const RUNNING: Project["status"][] = ["planning", "generating", "building", "testing", "deploying"];

export function isRunActive(pid: string): boolean {
  const h = runs.get(pid);
  return !!h && !h.controller.signal.aborted;
}

export type StartResult = { ok: true; runId: string; engineMode: "llm" | "simulation" } | { ok: false; reason: string; code: "not_found" | "completed" | "already_running" | "waiting_approval" | "locked" };

/** Start (or resume) the pipeline loop for a project. Runs in-process; returns immediately. */
export async function startRun(pid: string, opts: { single?: boolean } = {}): Promise<StartResult> {
  const p = await repo.getProject(pid);
  if (!p) return { ok: false, reason: "Project not found", code: "not_found" };
  if (p.currentStep >= p.totalSteps || p.status === "completed") return { ok: false, reason: "Pipeline already complete", code: "completed" };
  if (isRunActive(pid)) return { ok: false, reason: "Pipeline is already running", code: "already_running" };
  const [pending] = await db.select({ id: hitlCheckpoints.id }).from(hitlCheckpoints)
    .where(and(eq(hitlCheckpoints.projectId, pid), eq(hitlCheckpoints.status, "pending"))).limit(1);
  if (pending) return { ok: false, reason: "A checkpoint is awaiting review", code: "waiting_approval" };

  const cfg = await resolveAiConfig();
  const engineMode: "llm" | "simulation" = cfg ? "llm" : "simulation";
  const runId = `run_${nanoid(10)}`;
  const staleBefore = new Date(Date.now() - STALE_MS);
  const locked = await db.update(projects).set({
    runId, runHeartbeatAt: new Date(), pauseRequested: false, engineMode, errorMessage: null,
    status: p.status === "draft" || p.status === "paused" || p.status === "failed" || p.status === "waiting_approval" ? statusForStep(p) : p.status,
    startedAt: p.startedAt ?? new Date(), updatedAt: new Date(),
  }).where(and(eq(projects.id, pid), or(isNull(projects.runId), lt(projects.runHeartbeatAt, staleBefore), isNull(projects.runHeartbeatAt))))
    .returning({ id: projects.id });
  if (!locked.length) return { ok: false, reason: "Another worker holds the run lock; retry in a few seconds", code: "locked" };

  const controller = new AbortController();
  runs.set(pid, { runId, controller, startedAt: Date.now(), single: !!opts.single });
  await repo.logMessage(pid, "orchestrator", "info", opts.single ? "Executing a single step." : `Pipeline ${p.status === "draft" ? "started" : "resumed"} — engine: ${engineMode === "llm" ? `LLM agents via ${cfg!.provider}` : "deterministic simulation (no provider configured)"}.`);
  void runLoop(pid, runId, controller.signal, !!opts.single, cfg).catch(async (err) => {
    await repo.logMessage(pid, "orchestrator", "error", `Run loop crashed: ${describeError(err)}`).catch(() => undefined);
  });
  return { ok: true, runId, engineMode };
}

/** Ask the loop to stop after the current step (also aborts in-flight LLM/tool work). */
export async function pauseRun(pid: string): Promise<boolean> {
  await db.update(projects).set({ pauseRequested: true, updatedAt: new Date() }).where(eq(projects.id, pid));
  const h = runs.get(pid);
  if (h) { h.controller.abort(new DOMException("Paused by user", "AbortError")); return true; }
  // No in-process loop (e.g. after restart): reconcile status directly.
  const p = await repo.getProject(pid);
  if (p && RUNNING.includes(p.status)) {
    await db.update(projects).set({ status: "paused", runId: null, runHeartbeatAt: null, pauseRequested: false }).where(eq(projects.id, pid));
    await repo.logMessage(pid, "orchestrator", "warning", "Pipeline paused.");
  }
  return false;
}

export function abortRun(pid: string) {
  const h = runs.get(pid);
  if (h) h.controller.abort(new DOMException("Aborted", "AbortError"));
}

function statusForStep(p: Project): Project["status"] {
  const step = (p.plan ?? [])[p.currentStep];
  const spec = step ? STEP_SPECS[step.key] : undefined;
  if (!step) return "completed";
  if (step.index === 0) return "planning";
  return spec?.statusAfter === "completed" ? "deploying" : spec?.statusAfter ?? "building";
}

// ─── Main loop ──────────────────────────────────────────────────────────────

async function runLoop(pid: string, runId: string, signal: AbortSignal, single: boolean, initialCfg: ResolvedAiConfig | null) {
  const heartbeat = setInterval(() => {
    db.update(projects).set({ runHeartbeatAt: new Date() }).where(and(eq(projects.id, pid), eq(projects.runId, runId))).catch(() => undefined);
  }, HEARTBEAT_MS);
  let cfg = initialCfg;
  let exitStatus: "paused" | "waiting" | "failed" | "completed" | "idle" = "idle";
  try {
    for (;;) {
      const p = await repo.getProject(pid);
      if (!p || p.runId !== runId) break; // deleted or lock stolen
      if (signal.aborted || p.pauseRequested) { exitStatus = "paused"; break; }
      if (p.currentStep >= p.totalSteps) { await finalizeComplete(p); exitStatus = "completed"; break; }
      const budget = p.settings?.budgetMicros ?? cfg?.budgetMicros ?? Number.MAX_SAFE_INTEGER;
      if (p.costMicros >= budget) {
        await repo.logMessage(pid, "orchestrator", "warning", `Budget of $${(budget / 1e6).toFixed(2)} reached ($${(p.costMicros / 1e6).toFixed(2)} spent). Pipeline paused — raise the budget in Settings to continue.`);
        exitStatus = "paused"; break;
      }
      // Refresh config each step so Settings changes apply mid-run.
      cfg = await resolveAiConfig();
      const outcome = await executeStep(p, cfg, signal);
      if (outcome === "waiting") { exitStatus = "waiting"; break; }
      if (outcome === "failed") { exitStatus = "failed"; break; }
      if (outcome === "paused") { exitStatus = "paused"; break; }
      if (single) { exitStatus = "idle"; break; }
    }
  } finally {
    clearInterval(heartbeat);
    runs.delete(pid);
    const p = await repo.getProject(pid).catch(() => undefined);
    if (p && p.runId === runId) {
      const patch: Partial<typeof projects.$inferInsert> = { runId: null, runHeartbeatAt: null, pauseRequested: false, updatedAt: new Date() };
      if (exitStatus === "paused" && RUNNING.includes(p.status)) {
        patch.status = "paused";
        await repo.logMessage(pid, "orchestrator", "warning", "Pipeline paused.").catch(() => undefined);
        await db.update(agents).set({ status: "idle", currentTask: null }).where(and(eq(agents.projectId, pid), eq(agents.status, "working")));
        await db.update(tasks).set({ status: "pending" }).where(and(eq(tasks.projectId, pid), eq(tasks.status, "in_progress")));
      }
      await db.update(projects).set(patch).where(eq(projects.id, pid));
    }
  }
}

// ─── Step execution ─────────────────────────────────────────────────────────

type Outcome = "continue" | "waiting" | "failed" | "paused";

async function executeStep(p: Project, cfg: ResolvedAiConfig | null, signal: AbortSignal): Promise<Outcome> {
  const step = (p.plan ?? [])[p.currentStep];
  if (!step) return "continue";
  const spec = STEP_SPECS[step.key];
  const [task] = await db.select().from(tasks).where(and(eq(tasks.projectId, p.id), eq(tasks.order, step.index)));
  if (!task) { await repo.logMessage(p.id, "orchestrator", "error", `Task row missing for step ${step.index}`); return "failed"; }
  const role = step.agent as AgentRole;
  const useLlm = !!cfg && p.engineMode === "llm";
  const maxRetries = p.settings?.maxRetries ?? cfg?.maxRetries ?? 2;
  const startedAt = Date.now();

  await db.transaction(async (tx) => {
    await tx.update(tasks).set({ status: "in_progress", startedAt: new Date(), attempts: sql`${tasks.attempts} + 1`, error: null }).where(eq(tasks.id, task.id));
    await tx.update(agents).set({ status: "working", currentTask: step.title, startedAt: sql`COALESCE(${agents.startedAt}, now())`, progress: agentProgress(p, role, false) })
      .where(and(eq(agents.projectId, p.id), eq(agents.role, role)));
    await tx.update(projects).set({ status: p.status === "draft" ? "planning" : p.status, updatedAt: new Date() }).where(eq(projects.id, p.id));
  });
  await repo.logMessage(p.id, role, "info", `▶ Step ${step.index + 1}/${p.totalSteps}: **${step.title}**${useLlm ? ` · ${modelForRole(cfg!, role, p.settings).modelId}` : ""}`);

  const ctx = createStepContext(p, step, task.id, signal);
  let feedback: string | undefined;
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal.aborted) return "paused";
    try {
      if (useLlm) await runLlmStep(ctx, cfg!, feedback);
      else await runSimulatedStep(ctx);
      // The quality gate owns the lint/tsc/test commands and the repair loop for this step.
      if (step.key === "run-tests") await qualityGate(ctx, cfg, useLlm);

      const problems = await verify(ctx, spec);
      if (!problems.length) { lastError = undefined; break; }

      if (attempt < maxRetries) {
        feedback = problems.map((x) => `- ${x}`).join("\n");
        await repo.logMessage(p.id, role, "warning", `Verification failed (attempt ${attempt + 1}/${maxRetries + 1}):\n${feedback}`);
        continue;
      }
      if (useLlm) {
        await repo.logMessage(p.id, role, "warning", `Agent could not satisfy acceptance criteria after ${maxRetries + 1} attempts — falling back to the deterministic generator for this step.`);
        await runSimulatedStep(ctx);
        const again = await verify(ctx, spec);
        if (!again.length) { lastError = undefined; break; }
        lastError = again.join("; ");
      } else {
        lastError = problems.join("; ");
      }
    } catch (err) {
      if (signal.aborted || (err instanceof Error && err.name === "AbortError")) return "paused";
      lastError = describeError(err);
      await repo.logMessage(p.id, role, "error", `Step failed (attempt ${attempt + 1}/${maxRetries + 1}): ${lastError}`);
      if (isNonRetryable(err)) {
        await repo.logMessage(p.id, role, "warning", "This error will not resolve by retrying — check the provider key, model id and base URL in Settings.");
        break;
      }
      if (attempt < maxRetries) {
        feedback = `The previous attempt crashed with: ${lastError}`;
        await sleep(Math.min(8000, 1000 * 2 ** attempt), signal).catch(() => undefined);
        continue;
      }
    }
  }

  if (lastError) {
    await db.transaction(async (tx) => {
      await tx.update(tasks).set({ status: "failed", error: lastError, completedAt: new Date(), durationMs: Date.now() - startedAt }).where(eq(tasks.id, task.id));
      await tx.update(agents).set({ status: "failed", currentTask: null }).where(and(eq(agents.projectId, p.id), eq(agents.role, role)));
      await tx.update(projects).set({ status: "failed", errorMessage: `${step.title}: ${lastError}`.slice(0, 1000), updatedAt: new Date() }).where(eq(projects.id, p.id));
    });
    await repo.logMessage(p.id, "orchestrator", "error", `Pipeline halted at "${step.title}". Fix the cause (or adjust settings) and press Resume to retry this step.`);
    return "failed";
  }

  // Human-in-the-loop gate
  const req = ctx.stats.checkpointRequested;
  if (req) {
    if (p.autoApprove) {
      await repo.createCheckpoint(p.id, role, step.index, req, "approved", "Auto-approved (auto-approve enabled)");
      await repo.logMessage(p.id, role, "success", `Auto-approved: ${req.title}`);
    } else {
      await repo.createCheckpoint(p.id, role, step.index, req, "pending");
      await db.transaction(async (tx) => {
        await tx.update(tasks).set({ status: "waiting_approval", output: ctx.stats.taskSummary ?? null, durationMs: Date.now() - startedAt }).where(eq(tasks.id, task.id));
        await tx.update(agents).set({ status: "waiting", currentTask: `Waiting: ${req.title}` }).where(and(eq(agents.projectId, p.id), eq(agents.role, role)));
        await tx.update(projects).set({ status: "waiting_approval", updatedAt: new Date() }).where(eq(projects.id, p.id));
      });
      await repo.logMessage(p.id, role, "warning", `⏸ Waiting for human approval: **${req.title}** (${req.riskLevel} risk)`);
      return "waiting";
    }
  }

  await completeStep(p.id, step, task.id, ctx.stats.taskSummary ?? `${step.title} completed.`, Date.now() - startedAt);
  return "continue";
}

async function verify(ctx: StepContext, spec: typeof STEP_SPECS[string] | undefined): Promise<string[]> {
  if (!spec) return [];
  const [files, tables, env] = await Promise.all([
    repo.listFiles(ctx.project.id),
    tablesCount(ctx.project.id),
    db.select({ n: sql<number>`count(*)::int` }).from(environmentVariables).where(eq(environmentVariables.projectId, ctx.project.id)).then((r) => r[0]?.n ?? 0),
  ]);
  return spec.verify({ files, tables, env, commands: ctx.stats.commandList, arch: ctx.arch });
}

/** Mark a step done and advance the project. Shared by the loop and checkpoint approval. */
export async function completeStep(pid: string, step: PlanStep, taskId: string, summary: string, durationMs?: number) {
  const spec = STEP_SPECS[step.key];
  const role = step.agent as AgentRole;
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(projects).where(eq(projects.id, pid));
    if (!p) return;
    const nextStep = p.currentStep + 1;
    await tx.update(tasks).set({ status: "completed", completedAt: new Date(), output: summary.slice(0, 2000), durationMs: durationMs ?? sql`${tasks.durationMs}` }).where(eq(tasks.id, taskId));
    const done = nextStep >= p.totalSteps;
    await tx.update(projects).set({
      currentStep: nextStep, completedTasks: sql`${projects.completedTasks} + 1`,
      status: done ? "completed" : spec?.statusAfter === "completed" ? "deploying" : spec?.statusAfter ?? p.status,
      completedAt: done ? new Date() : null, updatedAt: new Date(),
    }).where(eq(projects.id, pid));
    const remaining = (p.plan ?? []).filter((s) => s.agent === role && s.index >= nextStep).length;
    await tx.update(agents).set(remaining === 0
      ? { status: "completed", progress: 100, currentTask: null, completedAt: new Date() }
      : { status: "idle", progress: agentProgress({ ...p, currentStep: nextStep }, role, true), currentTask: null })
      .where(and(eq(agents.projectId, pid), eq(agents.role, role)));
  });
  await repo.logMessage(pid, role, "success", `✔ ${step.title} — ${summary.slice(0, 300)}`);
  const p = await repo.getProject(pid);
  if (p && p.currentStep >= p.totalSteps) await finalizeComplete(p);
}

function agentProgress(p: Project, role: AgentRole, afterComplete: boolean): number {
  const steps = (p.plan ?? []).filter((s) => s.agent === role);
  if (!steps.length) return 0;
  const done = steps.filter((s) => s.index < p.currentStep).length;
  return Math.round(((afterComplete ? done : done) / steps.length) * 100);
}

async function finalizeComplete(p: Project) {
  if (p.status === "completed" && p.completedAt) return;
  await db.transaction(async (tx) => {
    await tx.update(projects).set({ status: "completed", completedAt: p.completedAt ?? new Date(), errorMessage: null, updatedAt: new Date() }).where(eq(projects.id, p.id));
    await tx.update(agents).set({ status: "completed", progress: 100, currentTask: null, completedAt: sql`COALESCE(${agents.completedAt}, now())` })
      .where(and(eq(agents.projectId, p.id), sql`${agents.status} <> 'failed'`));
  });
  const fresh = await repo.getProject(p.id);
  await repo.logMessage(p.id, "orchestrator", "success", `🎉 Pipeline complete — ${fresh?.generatedFiles ?? p.generatedFiles} files, ${fresh?.llmCalls ?? p.llmCalls} LLM calls, $${((fresh?.costMicros ?? p.costMicros) / 1e6).toFixed(3)} total. Download the bundle from the ⋯ menu.`);
}

// ─── LLM step ───────────────────────────────────────────────────────────────

async function runLlmStep(ctx: StepContext, cfg: ResolvedAiConfig, feedback?: string) {
  const spec = STEP_SPECS[ctx.step.key];
  if (!spec) throw new Error(`Unknown step ${ctx.step.key}`);
  const { modelId, fallbackReason } = modelForRole(cfg, ctx.role, ctx.project.settings);
  if (fallbackReason) await ctx.log("warning", fallbackReason);
  const model = buildLanguageModel(cfg, modelId);
  const catalog = findModel(modelId);
  const reasoningOpenAI = (cfg.provider === "openai" || cfg.provider === "azure") && !!catalog?.capabilities.includes("reasoning");

  const [fileTree, priorTasks] = await Promise.all([
    repo.listFiles(ctx.project.id),
    db.select({ title: tasks.title, output: tasks.output }).from(tasks).where(and(eq(tasks.projectId, ctx.project.id), eq(tasks.status, "completed"))).orderBy(tasks.order),
  ]);
  const contextFiles: Array<{ path: string; content: string }> = [];
  for (const p of spec.contextFiles ?? []) {
    const f = await repo.readFile(ctx.project.id, p);
    if (f) contextFiles.push({ path: f.path, content: f.content });
  }
  const messages: ModelMessage[] = [{
    role: "user",
    content: userPromptFor(ctx, spec, { fileTree: fileTree.map((f) => f.path), contextFiles, feedback, priorSummaries: priorTasks.map((t) => `${t.title}: ${t.output ?? "done"}`) }),
  }];

  let lastAt = Date.now();
  let llmSteps = 0;
  const maxSteps = ctx.project.settings?.maxStepsPerTask ?? cfg.maxStepsPerTask;
  const result = await generateText({
    model,
    system: systemPromptFor(ctx, modelId),
    messages,
    tools: createAgentTools(ctx),
    stopWhen: stepCountIs(maxSteps),
    maxRetries: 2,
    ...(reasoningOpenAI ? {} : { temperature: cfg.temperature / 100 }),
    abortSignal: AbortSignal.any([ctx.signal, AbortSignal.timeout(STEP_TIMEOUT_MS)]),
    onStepFinish: async (s) => {
      llmSteps += 1;
      const inTok = s.usage.inputTokens ?? 0;
      const outTok = s.usage.outputTokens ?? 0;
      const now = Date.now();
      await repo.recordLlmCall(ctx.project.id, ctx.role, {
        model: modelId, provider: cfg.provider, promptTokens: inTok, completionTokens: outTok,
        costMicros: costMicrosFor(modelId, inTok, outTok), toolCalls: s.toolCalls.length, durationMs: now - lastAt,
        purpose: `${ctx.step.key}#${llmSteps}`, finishReason: s.finishReason, taskId: ctx.taskId,
      }).catch(() => undefined);
      lastAt = now;
      if (s.text && s.text.trim() && !s.toolCalls.length) {
        await ctx.log("info", s.text.trim().slice(0, 1500));
      }
    },
  });

  if (result.finishReason === "length") await ctx.log("warning", "Model hit the output token limit; output may be truncated.");
  if (llmSteps >= maxSteps && !ctx.stats.taskSummary) await ctx.log("warning", `Agent reached the ${maxSteps}-step limit for this task before calling complete_task.`);
  if (!ctx.stats.taskSummary) ctx.stats.taskSummary = result.text.trim().slice(0, 400) || `${ctx.stats.filesWritten} files written, ${ctx.stats.toolCalls} tool calls.`;
}

// ─── Quality gate + repair loop ─────────────────────────────────────────────

async function qualityGate(ctx: StepContext, cfg: ResolvedAiConfig | null, useLlm: boolean) {
  const pid = ctx.project.id;
  const maxRepair = ctx.project.settings?.maxRepairIterations ?? cfg?.maxRepairIterations ?? 2;
  let finalErrors: Diagnostic[] = [];
  let warningsCount = 0;
  for (let iter = 0; iter <= maxRepair; iter++) {
    if (ctx.signal.aborted) throw new DOMException("Aborted", "AbortError");
    const lint = await ctx.runCommand("npm run lint");
    const tsc = await ctx.runCommand("npx tsc --noEmit");
    const test = await ctx.runCommand("npm test");
    const files = await repo.allFilesWithContent(pid);
    const report = analyzeWorkspace(files.map((f) => ({ path: f.path, content: f.content })));
    finalErrors = report.errors;
    warningsCount = report.warnings.length;
    await ctx.log("tool", `Quality gate pass ${iter + 1}: lint exit ${lint.exitCode} · tsc exit ${tsc.exitCode} · tests exit ${test.exitCode} · ${report.errors.length} error(s), ${report.warnings.length} warning(s) across ${report.filesChecked} files`, { tool: "quality_gate", errors: report.errors.length, warnings: report.warnings.length });
    if (!report.errors.length) break;
    if (iter === maxRepair) break;

    await db.update(projects).set({ repairIterations: sql`${projects.repairIterations} + 1` }).where(eq(projects.id, pid));
    const groups = new Map<AgentRole, Diagnostic[]>();
    for (const e of report.errors) {
      const owner = ownerRoleFor(e.path) as AgentRole;
      groups.set(owner, [...(groups.get(owner) ?? []), e]);
    }
    for (const [owner, diags] of groups) {
      if (ctx.signal.aborted) throw new DOMException("Aborted", "AbortError");
      await repo.logMessage(pid, "testing", "warning", `Routing ${diags.length} issue(s) in ${new Set(diags.map((d) => d.path)).size} file(s) to ${AGENTS[owner].name} for repair (round ${iter + 1}/${maxRepair}).`);
      if (useLlm && cfg) {
        try { await runRepair(ctx, cfg, owner, diags); } catch (err) {
          if (ctx.signal.aborted) throw err;
          await repo.logMessage(pid, owner, "error", `Repair attempt failed: ${describeError(err)}`);
        }
      } else {
        await deterministicRepair(ctx, owner, diags);
      }
    }
  }
  if (finalErrors.length) {
    await ctx.log("warning", `Quality gate finished with ${finalErrors.length} unresolved error(s):\n${formatDiagnostics(finalErrors, 12)}`);
    ctx.stats.taskSummary = `Quality gate: ${finalErrors.length} unresolved error(s), ${warningsCount} warning(s) after ${maxRepair} repair round(s).`;
  } else {
    await ctx.log("success", `Quality gate passed — 0 errors, ${warningsCount} warning(s).`);
    ctx.stats.taskSummary = `Quality gate green (${warningsCount} warning(s)).`;
  }
}

async function runRepair(ctx: StepContext, cfg: ResolvedAiConfig, owner: AgentRole, diags: Diagnostic[]) {
  const { modelId } = modelForRole(cfg, owner, ctx.project.settings);
  const model = buildLanguageModel(cfg, modelId);
  const paths = [...new Set(diags.map((d) => d.path))].slice(0, 8);
  const contents: string[] = [];
  for (const p of paths) {
    const f = await repo.readFile(ctx.project.id, p);
    if (f) contents.push(`### ${p}\n\`\`\`\n${f.content.slice(0, 12_000)}\n\`\`\``);
  }
  const repairCtx: StepContext = { ...ctx, role: owner, log: (k, c, m) => repo.logMessage(ctx.project.id, owner, k, c, m) };
  const catalog = findModel(modelId);
  const reasoningOpenAI = (cfg.provider === "openai" || cfg.provider === "azure") && !!catalog?.capabilities.includes("reasoning");
  let lastAt = Date.now();
  await generateText({
    model,
    system: systemPromptFor(repairCtx, modelId),
    prompt: `The quality gate found errors in files you own. Fix every diagnostic below by rewriting the affected files completely with write_file (create any missing imported files). Do not touch unrelated files. Run "npx tsc --noEmit" to confirm, then call complete_task.\n\n# Diagnostics\n${formatDiagnostics(diags, 40)}\n\n# Current file contents\n${contents.join("\n\n")}`,
    tools: createAgentTools(repairCtx),
    stopWhen: stepCountIs(8),
    maxRetries: 2,
    ...(reasoningOpenAI ? {} : { temperature: Math.min(cfg.temperature / 100, 0.2) }),
    abortSignal: AbortSignal.any([ctx.signal, AbortSignal.timeout(STEP_TIMEOUT_MS)]),
    onStepFinish: async (s) => {
      const inTok = s.usage.inputTokens ?? 0; const outTok = s.usage.outputTokens ?? 0; const now = Date.now();
      await repo.recordLlmCall(ctx.project.id, owner, { model: modelId, provider: cfg.provider, promptTokens: inTok, completionTokens: outTok, costMicros: costMicrosFor(modelId, inTok, outTok), toolCalls: s.toolCalls.length, durationMs: now - lastAt, purpose: "repair", finishReason: s.finishReason, taskId: ctx.taskId }).catch(() => undefined);
      lastAt = now;
    },
  });
}

/** Without an LLM we can still fix the mechanical classes of error. */
async function deterministicRepair(ctx: StepContext, owner: AgentRole, diags: Diagnostic[]) {
  const byPath = new Map<string, Diagnostic[]>();
  for (const d of diags) byPath.set(d.path, [...(byPath.get(d.path) ?? []), d]);
  for (const [path, list] of byPath) {
    const f = await repo.readFile(ctx.project.id, path);
    if (!f) continue;
    let content = f.content;
    let changed = false;
    if (list.some((d) => d.message.includes("code fence"))) {
      content = content.replace(/^\s*```[a-z]*\s*$/gm, ""); changed = true;
    }
    for (const d of list.filter((d) => d.rule === "import")) {
      const m = d.message.match(/import "([^"]+)"/);
      if (!m) continue;
      // Remove the unresolved import line so the rest of the module still parses.
      const re = new RegExp(`^.*from\\s+["']${m[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'];?\\s*$`, "m");
      if (re.test(content)) { content = content.replace(re, `// removed unresolved import: ${m[1]}`); changed = true; }
    }
    if (changed) {
      await repo.upsertFile(ctx.project.id, owner, path, content);
      await repo.logMessage(ctx.project.id, owner, "file", `Auto-repaired \`${path}\``);
    }
  }
}

// ─── Checkpoints ────────────────────────────────────────────────────────────

export async function resolveCheckpoint(pid: string, cpId: string, decision: "approved" | "rejected", note?: string): Promise<{ ok: boolean; reason?: string; resumed?: boolean }> {
  const [cp] = await db.select().from(hitlCheckpoints).where(and(eq(hitlCheckpoints.id, cpId), eq(hitlCheckpoints.projectId, pid)));
  if (!cp) return { ok: false, reason: "Checkpoint not found" };
  if (cp.status !== "pending") return { ok: false, reason: "Checkpoint already resolved" };
  const p = await repo.getProject(pid);
  if (!p) return { ok: false, reason: "Project not found" };
  await db.update(hitlCheckpoints).set({ status: decision, resolutionNote: note?.trim() || null, resolvedAt: new Date() }).where(eq(hitlCheckpoints.id, cpId));

  const step = (p.plan ?? [])[cp.stepIndex];
  const [task] = await db.select().from(tasks).where(and(eq(tasks.projectId, pid), eq(tasks.order, cp.stepIndex)));
  if (step && task && task.status === "waiting_approval") {
    if (decision === "approved") {
      await repo.logMessage(pid, "user", "user", `Approved: ${cp.title}${note ? ` — "${note}"` : ""}`);
      await completeStep(pid, step, task.id, task.output ?? `${step.title} approved and completed.`);
    } else {
      await repo.logMessage(pid, "user", "user", `Rejected: ${cp.title}${note ? ` — "${note}"` : ""}`);
      await skipStep(p, step, task, cp.type === "deploy" ? "Deploy skipped by reviewer." : `Skipped after rejection${note ? `: ${note}` : ""}.`);
    }
  }

  const fresh = await repo.getProject(pid);
  if (fresh && fresh.status !== "completed" && fresh.currentStep < fresh.totalSteps) {
    const r = await startRun(pid);
    return { ok: true, resumed: r.ok };
  }
  return { ok: true, resumed: false };
}

async function skipStep(p: Project, step: PlanStep, task: Task, reason: string) {
  const role = step.agent as AgentRole;
  await db.transaction(async (tx) => {
    const nextStep = p.currentStep + 1;
    const done = nextStep >= p.totalSteps;
    await tx.update(tasks).set({ status: "skipped", completedAt: new Date(), output: reason }).where(eq(tasks.id, task.id));
    await tx.update(projects).set({ currentStep: nextStep, status: done ? "completed" : "building", completedAt: done ? new Date() : null, updatedAt: new Date() }).where(eq(projects.id, p.id));
    const remaining = (p.plan ?? []).filter((s) => s.agent === role && s.index >= nextStep).length;
    await tx.update(agents).set(remaining === 0 ? { status: "completed", progress: 100, currentTask: null, completedAt: new Date() } : { status: "idle", currentTask: null })
      .where(and(eq(agents.projectId, p.id), eq(agents.role, role)));
  });
  await repo.logMessage(p.id, role, "warning", `Step skipped — ${reason}`);
  const fresh = await repo.getProject(p.id);
  if (fresh && fresh.currentStep >= fresh.totalSteps) await finalizeComplete(fresh);
}

// ─── Startup reconciliation ─────────────────────────────────────────────────

/** Clear locks left behind by a previous process (called lazily from API routes). */
let reconciled = false;
export async function reconcileStaleRuns() {
  if (reconciled) return;
  reconciled = true;
  try {
    const stale = await db.update(projects).set({ runId: null, runHeartbeatAt: null, pauseRequested: false, status: "paused" })
      .where(and(sql`${projects.runId} IS NOT NULL`, or(isNull(projects.runHeartbeatAt), lt(projects.runHeartbeatAt, new Date(Date.now() - STALE_MS)))))
      .returning({ id: projects.id });
    for (const s of stale) {
      await db.update(agents).set({ status: "idle", currentTask: null }).where(and(eq(agents.projectId, s.id), eq(agents.status, "working")));
      await db.update(tasks).set({ status: "pending" }).where(and(eq(tasks.projectId, s.id), eq(tasks.status, "in_progress")));
      await repo.logMessage(s.id, "orchestrator", "warning", "Server restarted while the pipeline was running — run paused. Press Resume to continue from the current step.");
    }
  } catch {
    reconciled = false;
  }
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { clearTimeout(t); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
  });
}

export type { Architecture };
