import "server-only";
import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import {
  agentMessages, agents, commandExecutions, dbTables, environmentVariables, fileNodes,
  hitlCheckpoints, llmCalls, projects, tasks,
  type Architecture, type CheckpointContext, type DbColumn, type PlanStep, type Project, type ProjectSettings,
} from "@/db/schema";
import { AGENT_ORDER, AGENTS, type AgentRole } from "@/lib/types";
import { buildArchitecture, DEFAULT_STACK, inferDomain } from "@/lib/domains";
import { languageFor } from "@/lib/codegen";

export const id = (prefix: string) => `${prefix}_${nanoid(12)}`;

// ─── Plan ───────────────────────────────────────────────────────────────────

export function buildPlan(arch: Architecture): PlanStep[] {
  const n = arch.entities.length;
  const steps: Omit<PlanStep, "index">[] = [
    { agent: "orchestrator", key: "analyze", title: "Analyse requirements", description: "Read the brief, infer the product domain, entities and feature set; refine the architecture." },
    { agent: "orchestrator", key: "plan", title: "Create task graph", description: "Decompose the build into dependency-ordered tasks and brief each specialist." },
    { agent: "architect", key: "architecture", title: "Design system architecture", description: "Define components, data flow, API contracts and folder layout in docs/ARCHITECTURE.md." },
    { agent: "architect", key: "scaffold", title: "Scaffold project", description: "package.json, Next.js config, Tailwind, root layout and shared utilities." },
    { agent: "database", key: "schema", title: "Model database schema", description: `Design ${n} tables with relations, enums and indexes using Drizzle ORM.` },
    { agent: "database", key: "migrate", title: "Run migrations & seed", description: "Apply SQL migrations and insert development fixtures." },
    { agent: "backend", key: "auth", title: "Implement auth & configuration", description: "Session auth, RBAC guard, health endpoint and environment variables." },
    { agent: "backend", key: "api", title: "Generate REST API", description: `CRUD route handlers, Zod validation and services for ${n} resources.` },
    { agent: "frontend", key: "shell", title: "Build app shell & dashboard", description: "Navigation, layout, reusable data table and the overview dashboard." },
    { agent: "frontend", key: "pages", title: "Generate resource pages", description: `List views and create forms for ${arch.entities.filter((e) => e.name !== "User").length} resources.` },
    { agent: "testing", key: "write-tests", title: "Write test suite", description: "Unit tests for validators, auth helpers and API handlers." },
    { agent: "testing", key: "run-tests", title: "Run quality gate", description: "Static analysis, typecheck, lint and tests — with automatic repair loop." },
    { agent: "devops", key: "containerize", title: "Containerise & CI", description: "Dockerfile, compose stack and GitHub Actions workflow." },
    { agent: "devops", key: "deploy", title: "Build image & deploy", description: "Production build behind a human approval gate." },
  ];
  return steps.map((s, index) => ({ ...s, index }));
}

// ─── Bootstrap / lifecycle ──────────────────────────────────────────────────

export interface CreateProjectInput {
  name: string;
  prompt: string;
  mode?: "greenfield" | "brownfield";
  emoji?: string;
  autoApprove?: boolean;
  engineMode: "llm" | "simulation";
  settings?: ProjectSettings;
  id?: string;
  createdAt?: Date;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const pid = input.id ?? id("prj");
  const pack = inferDomain(input.prompt);
  const arch = buildArchitecture(input.prompt, pack);
  const plan = buildPlan(arch);
  const now = new Date();

  return db.transaction(async (tx) => {
    const [project] = await tx.insert(projects).values({
      id: pid,
      name: input.name.trim() || "Untitled project",
      description: input.prompt.slice(0, 160),
      prompt: input.prompt,
      mode: input.mode ?? "greenfield",
      status: "draft",
      domain: pack.id,
      domainLabel: pack.label,
      emoji: input.emoji?.trim() || pack.emoji,
      techStack: DEFAULT_STACK,
      architecture: arch,
      plan,
      settings: input.settings ?? {},
      engineMode: input.engineMode,
      currentStep: 0,
      totalSteps: plan.length,
      totalTasks: plan.length,
      autoApprove: !!input.autoApprove,
      createdAt: input.createdAt ?? now,
      updatedAt: now,
    }).returning();

    const agentRows = AGENT_ORDER.map((role) => ({
      id: id("agt"), projectId: pid, role, name: AGENTS[role].name, status: "idle" as const,
    }));
    await tx.insert(agents).values(agentRows);
    await tx.insert(tasks).values(plan.map((s) => ({
      id: id("tsk"), projectId: pid,
      agentId: agentRows.find((a) => a.role === s.agent)?.id ?? null,
      agentRole: s.agent, stepKey: s.key, title: s.title, description: s.description,
      status: "pending" as const, order: s.index,
    })));
    await tx.insert(agentMessages).values({
      id: id("msg"), projectId: pid, agentRole: "orchestrator", kind: "info", seq: 1,
      content: `Project created. Inferred domain **${pack.label}** — ${arch.entities.length} entities, ${arch.features.length} features. Engine: **${input.engineMode === "llm" ? "LLM agents" : "deterministic simulation"}**. Press **Start pipeline** to begin.`,
    });
    return project;
  });
}

export async function getProject(pid: string): Promise<Project | undefined> {
  const [p] = await db.select().from(projects).where(eq(projects.id, pid));
  return p;
}

/** Wipe all generated artefacts and return the project to draft (keeps id, name, prompt, settings). */
export async function resetProject(pid: string): Promise<Project | undefined> {
  const p = await getProject(pid);
  if (!p) return undefined;
  const arch = p.architecture ?? buildArchitecture(p.prompt, inferDomain(p.prompt));
  const plan = buildPlan(arch);
  return db.transaction(async (tx) => {
    await tx.delete(fileNodes).where(eq(fileNodes.projectId, pid));
    await tx.delete(dbTables).where(eq(dbTables.projectId, pid));
    await tx.delete(environmentVariables).where(eq(environmentVariables.projectId, pid));
    await tx.delete(hitlCheckpoints).where(eq(hitlCheckpoints.projectId, pid));
    await tx.delete(commandExecutions).where(eq(commandExecutions.projectId, pid));
    await tx.delete(agentMessages).where(eq(agentMessages.projectId, pid));
    await tx.delete(llmCalls).where(eq(llmCalls.projectId, pid));
    await tx.delete(tasks).where(eq(tasks.projectId, pid));
    await tx.update(agents).set({
      status: "idle", currentTask: null, progress: 0, tokensIn: 0, tokensOut: 0,
      llmCalls: 0, toolCalls: 0, filesWritten: 0, startedAt: null, completedAt: null,
    }).where(eq(agents.projectId, pid));
    const agentRows = await tx.select().from(agents).where(eq(agents.projectId, pid));
    await tx.insert(tasks).values(plan.map((s) => ({
      id: id("tsk"), projectId: pid,
      agentId: agentRows.find((a) => a.role === s.agent)?.id ?? null,
      agentRole: s.agent, stepKey: s.key, title: s.title, description: s.description,
      status: "pending" as const, order: s.index,
    })));
    await tx.insert(agentMessages).values({
      id: id("msg"), projectId: pid, agentRole: "orchestrator", kind: "info", seq: 1,
      content: "Project reset to draft. All generated files, tables, logs and checkpoints were removed.",
    });
    const [updated] = await tx.update(projects).set({
      status: "draft", plan, architecture: arch, currentStep: 0, totalSteps: plan.length, totalTasks: plan.length,
      completedTasks: 0, generatedFiles: 0, tokensIn: 0, tokensOut: 0, costMicros: 0, llmCalls: 0, toolCalls: 0,
      repairIterations: 0, errorMessage: null, runId: null, runHeartbeatAt: null, pauseRequested: false,
      startedAt: null, completedAt: null, updatedAt: new Date(),
    }).where(eq(projects.id, pid)).returning();
    return updated;
  });
}

export async function duplicateProject(pid: string): Promise<Project | undefined> {
  const p = await getProject(pid);
  if (!p) return undefined;
  const copyId = id("prj");
  const now = new Date();
  return db.transaction(async (tx) => {
    const [copy] = await tx.insert(projects).values({
      ...p, id: copyId, name: `${p.name} (copy)`, runId: null, runHeartbeatAt: null, pauseRequested: false,
      createdAt: now, updatedAt: now,
    }).returning();
    const srcAgents = await tx.select().from(agents).where(eq(agents.projectId, pid));
    const agentIdMap = new Map<string, string>();
    for (const a of srcAgents) agentIdMap.set(a.id, id("agt"));
    if (srcAgents.length) await tx.insert(agents).values(srcAgents.map((a) => ({ ...a, id: agentIdMap.get(a.id)!, projectId: copyId })));

    const copyRows = async <T extends { id: string; projectId: string }>(table: Parameters<typeof tx.insert>[0], rows: T[], prefix: string, extra?: (r: T) => Partial<T>) => {
      if (!rows.length) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (tx.insert(table as any) as any).values(rows.map((r) => ({ ...r, ...(extra?.(r) ?? {}), id: id(prefix), projectId: copyId })));
    };
    await copyRows(tasks, await tx.select().from(tasks).where(eq(tasks.projectId, pid)), "tsk", (r) => ({ agentId: r.agentId ? agentIdMap.get(r.agentId) ?? null : null }));
    await copyRows(fileNodes, await tx.select().from(fileNodes).where(eq(fileNodes.projectId, pid)), "file");
    await copyRows(dbTables, await tx.select().from(dbTables).where(eq(dbTables.projectId, pid)), "tbl");
    await copyRows(environmentVariables, await tx.select().from(environmentVariables).where(eq(environmentVariables.projectId, pid)), "env");
    await copyRows(hitlCheckpoints, await tx.select().from(hitlCheckpoints).where(eq(hitlCheckpoints.projectId, pid)), "hitl");
    await copyRows(commandExecutions, await tx.select().from(commandExecutions).where(eq(commandExecutions.projectId, pid)), "cmd");
    await copyRows(agentMessages, await tx.select().from(agentMessages).where(eq(agentMessages.projectId, pid)), "msg");
    await copyRows(llmCalls, await tx.select().from(llmCalls).where(eq(llmCalls.projectId, pid)), "llm");
    return copy;
  });
}

// ─── Logging & artefact helpers (used by the engine's tools) ────────────────

export type MessageKind = "info" | "tool" | "file" | "success" | "warning" | "error" | "user";

export async function logMessage(pid: string, role: string | null, kind: MessageKind, content: string, metadata?: Record<string, unknown>) {
  await db.insert(agentMessages).values({
    id: id("msg"), projectId: pid, agentRole: role, kind, content: content.slice(0, 4000), metadata,
    seq: sql`(SELECT COALESCE(MAX(${agentMessages.seq}), 0) + 1 FROM ${agentMessages} WHERE ${agentMessages.projectId} = ${pid})`,
  });
}

export function normalizePath(p: string): string {
  let out = p.trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "").replace(/\/{2,}/g, "/");
  const parts: string[] = [];
  for (const seg of out.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") { parts.pop(); continue; }
    parts.push(seg);
  }
  out = parts.join("/");
  return out;
}

export async function upsertFile(pid: string, role: string | null, rawPath: string, content: string, opts?: { userEdit?: boolean }): Promise<{ created: boolean; path: string; version: number }> {
  const path = normalizePath(rawPath);
  if (!path) throw new Error("Empty file path");
  if (path.length > 300) throw new Error("File path too long");
  if (content.length > 400_000) throw new Error("File content exceeds 400KB limit");
  const name = path.split("/").pop() ?? path;
  const language = languageFor(path);
  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: fileNodes.id, version: fileNodes.version }).from(fileNodes)
      .where(and(eq(fileNodes.projectId, pid), eq(fileNodes.path, path)));
    if (existing) {
      const version = existing.version + 1;
      await tx.update(fileNodes).set({
        content, language, size: Buffer.byteLength(content, "utf8"), version, agentRole: role ?? undefined,
        isModified: !!opts?.userEdit, updatedAt: new Date(),
      }).where(eq(fileNodes.id, existing.id));
      return { created: false, path, version };
    }
    await tx.insert(fileNodes).values({
      id: id("file"), projectId: pid, agentRole: role, path, name, content, language,
      size: Buffer.byteLength(content, "utf8"), version: 1, isModified: !!opts?.userEdit,
    });
    await tx.update(projects).set({ generatedFiles: sql`${projects.generatedFiles} + 1`, updatedAt: new Date() }).where(eq(projects.id, pid));
    if (role && (AGENT_ORDER as string[]).includes(role)) {
      await tx.update(agents).set({ filesWritten: sql`${agents.filesWritten} + 1` }).where(and(eq(agents.projectId, pid), eq(agents.role, role as AgentRole)));
    }
    return { created: true, path, version: 1 };
  });
}

export async function deleteFile(pid: string, rawPath: string): Promise<boolean> {
  const path = normalizePath(rawPath);
  const deleted = await db.delete(fileNodes).where(and(eq(fileNodes.projectId, pid), eq(fileNodes.path, path))).returning({ id: fileNodes.id });
  if (deleted.length) {
    await db.update(projects).set({ generatedFiles: sql`GREATEST(${projects.generatedFiles} - 1, 0)`, updatedAt: new Date() }).where(eq(projects.id, pid));
  }
  return deleted.length > 0;
}

export async function readFile(pid: string, rawPath: string) {
  const path = normalizePath(rawPath);
  const [f] = await db.select().from(fileNodes).where(and(eq(fileNodes.projectId, pid), eq(fileNodes.path, path)));
  return f;
}

export async function listFiles(pid: string) {
  return db.select({ path: fileNodes.path, size: fileNodes.size, language: fileNodes.language, agentRole: fileNodes.agentRole, version: fileNodes.version })
    .from(fileNodes).where(eq(fileNodes.projectId, pid)).orderBy(asc(fileNodes.path));
}

export async function allFilesWithContent(pid: string) {
  return db.select().from(fileNodes).where(eq(fileNodes.projectId, pid)).orderBy(asc(fileNodes.path));
}

export async function recordCommand(pid: string, role: string | null, command: string, stdout: string, exitCode: number, durationMs: number, stderr = "") {
  await db.insert(commandExecutions).values({
    id: id("cmd"), projectId: pid, agentRole: role, command: command.slice(0, 500),
    stdout: stdout.slice(0, 20_000), stderr: stderr.slice(0, 5_000), exitCode, durationMs,
    status: exitCode === 0 ? "completed" : "failed",
  });
}

export async function upsertTable(pid: string, name: string, columns: DbColumn[], sqlText: string | null, status: "defined" | "migrating" | "created" | "seeded" = "defined") {
  const [existing] = await db.select({ id: dbTables.id }).from(dbTables).where(and(eq(dbTables.projectId, pid), eq(dbTables.name, name)));
  if (existing) {
    await db.update(dbTables).set({ columns, sql: sqlText ?? undefined, status, updatedAt: new Date() }).where(eq(dbTables.id, existing.id));
    return { created: false };
  }
  await db.insert(dbTables).values({ id: id("tbl"), projectId: pid, name, columns, sql: sqlText, status });
  return { created: true };
}

export async function setEnvVar(pid: string, key: string, value: string, description: string | null, isSecret: boolean, source: "agent" | "user", isRequired = true) {
  const k = key.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  if (!k) throw new Error("Invalid env key");
  const [existing] = await db.select({ id: environmentVariables.id }).from(environmentVariables)
    .where(and(eq(environmentVariables.projectId, pid), eq(environmentVariables.key, k)));
  if (existing) {
    await db.update(environmentVariables).set({ value, description: description ?? undefined, isSecret, isRequired, updatedAt: new Date() }).where(eq(environmentVariables.id, existing.id));
    return { key: k, created: false, id: existing.id };
  }
  const newId = id("env");
  await db.insert(environmentVariables).values({ id: newId, projectId: pid, key: k, value, description, isSecret, isRequired, source });
  return { key: k, created: true, id: newId };
}

export async function createCheckpoint(pid: string, role: string, stepIndex: number, input: {
  type: string; title: string; description: string; riskLevel: "low" | "medium" | "high"; context: CheckpointContext;
}, status: "pending" | "approved" = "pending", note?: string) {
  const cpId = id("hitl");
  await db.insert(hitlCheckpoints).values({
    id: cpId, projectId: pid, agentRole: role, stepIndex, type: input.type, title: input.title,
    description: input.description, riskLevel: input.riskLevel, context: input.context, status,
    resolutionNote: note ?? null, resolvedAt: status === "approved" ? new Date() : null,
  });
  return cpId;
}

export async function recordLlmCall(pid: string, role: string, input: {
  model: string; provider: string; promptTokens: number; completionTokens: number; costMicros: number;
  toolCalls: number; durationMs: number; purpose: string; status?: "ok" | "error"; finishReason?: string; error?: string; taskId?: string;
}) {
  await db.transaction(async (tx) => {
    await tx.insert(llmCalls).values({
      id: id("llm"), projectId: pid, agentRole: role, model: input.model, provider: input.provider,
      promptTokens: input.promptTokens, completionTokens: input.completionTokens, costMicros: input.costMicros,
      toolCalls: input.toolCalls, durationMs: input.durationMs, purpose: input.purpose,
      status: input.status ?? "ok", finishReason: input.finishReason ?? null, error: input.error ?? null,
    });
    await tx.update(projects).set({
      tokensIn: sql`${projects.tokensIn} + ${input.promptTokens}`,
      tokensOut: sql`${projects.tokensOut} + ${input.completionTokens}`,
      costMicros: sql`${projects.costMicros} + ${input.costMicros}`,
      llmCalls: sql`${projects.llmCalls} + 1`,
      toolCalls: sql`${projects.toolCalls} + ${input.toolCalls}`,
      updatedAt: new Date(),
    }).where(eq(projects.id, pid));
    await tx.update(agents).set({
      tokensIn: sql`${agents.tokensIn} + ${input.promptTokens}`,
      tokensOut: sql`${agents.tokensOut} + ${input.completionTokens}`,
      llmCalls: sql`${agents.llmCalls} + 1`,
      toolCalls: sql`${agents.toolCalls} + ${input.toolCalls}`,
    }).where(and(eq(agents.projectId, pid), eq(agents.role, role as AgentRole)));
    if (input.taskId) {
      await tx.update(tasks).set({
        tokensIn: sql`${tasks.tokensIn} + ${input.promptTokens}`,
        tokensOut: sql`${tasks.tokensOut} + ${input.completionTokens}`,
      }).where(eq(tasks.id, input.taskId));
    }
  });
}

// ─── Snapshot (what the client polls) ───────────────────────────────────────

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export async function loadSnapshot(pid: string, opts?: { filesSince?: Date | null; messageLimit?: number }) {
  const project = await getProject(pid);
  if (!project) return null;
  const messageLimit = opts?.messageLimit ?? 400;
  const [agentRows, taskRows, tableRows, envRows, cpRows, cmdRows, msgRows, llmRows, filePaths, fileRows] = await Promise.all([
    db.select().from(agents).where(eq(agents.projectId, pid)),
    db.select().from(tasks).where(eq(tasks.projectId, pid)).orderBy(asc(tasks.order)),
    db.select().from(dbTables).where(eq(dbTables.projectId, pid)).orderBy(asc(dbTables.createdAt)),
    db.select().from(environmentVariables).where(eq(environmentVariables.projectId, pid)).orderBy(asc(environmentVariables.createdAt)),
    db.select().from(hitlCheckpoints).where(eq(hitlCheckpoints.projectId, pid)).orderBy(asc(hitlCheckpoints.createdAt)),
    db.select().from(commandExecutions).where(eq(commandExecutions.projectId, pid)).orderBy(asc(commandExecutions.createdAt)),
    db.select().from(agentMessages).where(eq(agentMessages.projectId, pid)).orderBy(desc(agentMessages.seq), desc(agentMessages.createdAt)).limit(messageLimit),
    db.select().from(llmCalls).where(eq(llmCalls.projectId, pid)).orderBy(asc(llmCalls.createdAt)),
    db.select({ path: fileNodes.path }).from(fileNodes).where(eq(fileNodes.projectId, pid)),
    opts?.filesSince
      ? db.select().from(fileNodes).where(and(eq(fileNodes.projectId, pid), gt(fileNodes.updatedAt, opts.filesSince))).orderBy(asc(fileNodes.path))
      : db.select().from(fileNodes).where(eq(fileNodes.projectId, pid)).orderBy(asc(fileNodes.path)),
  ]);

  const roleOrder = new Map(AGENT_ORDER.map((r, i) => [r, i]));
  return {
    project: serializeProject(project),
    agents: agentRows.sort((a, b) => (roleOrder.get(a.role) ?? 0) - (roleOrder.get(b.role) ?? 0)).map((a) => ({
      ...a, startedAt: iso(a.startedAt), completedAt: iso(a.completedAt), createdAt: a.createdAt.toISOString(),
    })),
    tasks: taskRows.map((t) => ({ ...t, description: t.description ?? "", startedAt: iso(t.startedAt), completedAt: iso(t.completedAt), createdAt: t.createdAt.toISOString() })),
    files: fileRows.map((f) => ({ ...f, createdAt: f.createdAt.toISOString(), updatedAt: f.updatedAt.toISOString() })),
    filePaths: filePaths.map((f) => f.path),
    filesDelta: !!opts?.filesSince,
    tables: tableRows.map((t) => ({ ...t, columns: t.columns ?? [], createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString() })),
    env: envRows.map((e) => ({ ...e, description: e.description ?? "", source: e.source as "agent" | "user", createdAt: e.createdAt.toISOString(), updatedAt: e.updatedAt.toISOString() })),
    checkpoints: cpRows.map((c) => ({
      id: c.id, projectId: c.projectId, agentRole: c.agentRole, stepIndex: c.stepIndex, type: c.type, title: c.title,
      description: c.description ?? "", riskLevel: c.riskLevel as "low" | "medium" | "high", status: c.status,
      context: c.context ?? {}, note: c.resolutionNote, createdAt: c.createdAt.toISOString(), resolvedAt: iso(c.resolvedAt),
    })),
    commands: cmdRows.map((c) => ({ ...c, stdout: c.stdout ?? "", stderr: c.stderr ?? "", exitCode: c.exitCode ?? 0, durationMs: c.durationMs ?? 0, createdAt: c.createdAt.toISOString() })),
    messages: msgRows.reverse().map((m) => ({ ...m, metadata: m.metadata ?? undefined, createdAt: m.createdAt.toISOString() })),
    llmCalls: llmRows.map((l) => ({ ...l, purpose: l.purpose ?? "", createdAt: l.createdAt.toISOString() })),
    serverTime: new Date().toISOString(),
  };
}

export function serializeProject(p: Project) {
  const stale = p.runId && p.runHeartbeatAt && Date.now() - p.runHeartbeatAt.getTime() > 45_000;
  return {
    ...p,
    description: p.description ?? "",
    domain: p.domain ?? "custom",
    domainLabel: p.domainLabel ?? "Custom App",
    emoji: p.emoji ?? "✨",
    techStack: p.techStack ?? DEFAULT_STACK,
    plan: p.plan ?? [],
    settings: p.settings ?? {},
    isRunning: !!p.runId && !stale,
    startedAt: iso(p.startedAt),
    completedAt: iso(p.completedAt),
    runHeartbeatAt: iso(p.runHeartbeatAt),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export type SerializedProject = ReturnType<typeof serializeProject>;
export type Snapshot = NonNullable<Awaited<ReturnType<typeof loadSnapshot>>>;

/** List projects with lightweight summary counts for the dashboard/sidebar. */
export async function listProjects() {
  const rows = await db.select().from(projects).orderBy(desc(projects.updatedAt));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const pending = await db.select({ projectId: hitlCheckpoints.projectId, count: sql<number>`count(*)::int` })
    .from(hitlCheckpoints).where(and(inArray(hitlCheckpoints.projectId, ids), eq(hitlCheckpoints.status, "pending")))
    .groupBy(hitlCheckpoints.projectId);
  const pendingMap = new Map(pending.map((p) => [p.projectId, p.count]));
  return rows.map((p) => ({ ...serializeProject(p), pendingCheckpoints: pendingMap.get(p.id) ?? 0 }));
}
