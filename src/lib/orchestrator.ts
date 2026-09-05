import type {
  Agent, Architecture, Checkpoint, PlanStep, Project, Task, WorkspaceData,
} from "./types";
import { AGENT_ORDER, AGENTS, uid } from "./types";
import { buildArchitecture, inferDomain, DEFAULT_STACK, snake } from "./domains";
import {
  apiFiles, authFiles, createTableSql, databaseFiles, devopsFiles,
  entityPageFiles, frontendShellFiles, scaffoldFiles, tableColumns,
  testFiles, type GeneratedFile,
} from "./codegen";
import { costMicrosFor } from "./models";

// ─── Plan ───────────────────────────────────────────────────────────────────
export function buildPlan(arch: Architecture): PlanStep[] {
  const steps: Omit<PlanStep, "index">[] = [
    { agent: "orchestrator", key: "analyze", title: "Analyse requirements", description: "Infer the product domain, entities and feature set from the brief." },
    { agent: "orchestrator", key: "plan", title: "Create task graph", description: "Decompose the build into dependency-ordered tasks and assign specialists." },
    { agent: "architect", key: "architecture", title: "Design system architecture", description: "Define components, data flow, API contracts and the tech stack." },
    { agent: "architect", key: "scaffold", title: "Scaffold project skeleton", description: "Write package.json, configs, root layout, utilities and docs." },
    { agent: "database", key: "schema", title: "Model database schema", description: `Design ${arch.entities.length} tables with relations, enums and indexes.` },
    { agent: "database", key: "migrate", title: "Run migrations & seed", description: "Apply SQL migrations and insert development fixtures." },
    { agent: "backend", key: "auth", title: "Implement auth & configuration", description: "Session auth, RBAC guard, health endpoint and environment variables." },
    { agent: "backend", key: "api", title: "Generate REST API", description: `CRUD route handlers, Zod validation and services for ${arch.entities.length} resources.` },
    { agent: "frontend", key: "shell", title: "Build app shell & dashboard", description: "Navigation, layout, reusable data table and the overview dashboard." },
    { agent: "frontend", key: "pages", title: "Generate resource pages", description: `List views and create forms for ${arch.entities.filter((e) => e.name !== "User").length} resources.` },
    { agent: "testing", key: "write-tests", title: "Write test suite", description: "Unit tests for validation schemas and auth tokens." },
    { agent: "testing", key: "run-tests", title: "Run lint, typecheck & tests", description: "Execute the quality gate and report coverage." },
    { agent: "devops", key: "containerize", title: "Containerise & CI", description: "Dockerfile, compose stack and GitHub Actions workflow." },
    { agent: "devops", key: "deploy", title: "Build image & deploy", description: "Production build behind a human approval gate." },
  ];
  return steps.map((s, index) => ({ ...s, index }));
}

// ─── Project bootstrap ──────────────────────────────────────────────────────
export function bootstrapProject(
  name: string, prompt: string, mode: "greenfield" | "brownfield",
  emoji: string, autoApprove: boolean, id?: string,
): { project: Project; ws: WorkspaceData } {
  const now = new Date().toISOString();
  const pid = id ?? uid("prj");
  const pack = inferDomain(prompt);
  const arch = buildArchitecture(prompt, pack);
  const plan = buildPlan(arch);
  const project: Project = {
    id: pid, name, description: prompt.slice(0, 160), prompt, mode,
    status: "draft", domain: pack.id, domainLabel: pack.label, emoji: emoji || pack.emoji,
    techStack: DEFAULT_STACK, architecture: arch, plan,
    currentStep: 0, totalSteps: plan.length, autoApprove,
    generatedFiles: 0, totalTasks: plan.length, completedTasks: 0,
    tokensIn: 0, tokensOut: 0, costMicros: 0, llmCalls: 0, toolCalls: 0,
    errorMessage: null, startedAt: null, completedAt: null,
    createdAt: now, updatedAt: now,
  };
  const ws: WorkspaceData = {
    agents: AGENT_ORDER.map((role) => ({
      id: uid("agt"), projectId: pid, role, name: AGENTS[role].name,
      status: "idle", currentTask: null, progress: 0,
      tokensIn: 0, tokensOut: 0, llmCalls: 0, toolCalls: 0, filesWritten: 0,
      startedAt: null, completedAt: null,
    })),
    tasks: plan.map((s) => ({
      id: uid("tsk"), projectId: pid, agentRole: s.agent, stepKey: s.key,
      title: s.title, description: s.description, status: "pending",
      order: s.index, output: null, startedAt: null, completedAt: null,
    })),
    files: [], tables: [], env: [], checkpoints: [], commands: [],
    messages: [{
      id: uid("msg"), projectId: pid, agentRole: "orchestrator", kind: "info",
      content: `Project created. Inferred domain **${pack.label}** — ${arch.entities.length} entities, ${arch.features.length} features. Press **Start pipeline** to begin.`,
      createdAt: now,
    }],
    llmCalls: [],
  };
  return { project, ws };
}

// ─── Step execution ─────────────────────────────────────────────────────────
export interface StepOutcome { waiting: boolean; done: boolean; checkpointId?: string; }

interface Ctx {
  project: Project; ws: WorkspaceData;
  step: PlanStep; agent: Agent;
  now: string;
  log: (content: string, kind?: Checkpoint["id"] extends never ? never : import("./types").AgentMessage["kind"], metadata?: Record<string, unknown>) => void;
  llm: (promptTokens: number, completionTokens: number, purpose: string, toolCalls?: number) => void;
  writeFiles: (files: GeneratedFile[]) => void;
  runCommand: (command: string, stdout: string, durationMs: number, exitCode?: number) => void;
}

function makeCtx(project: Project, ws: WorkspaceData, step: PlanStep): Ctx {
  const now = new Date().toISOString();
  const agent = ws.agents.find((a) => a.role === step.agent) ?? ws.agents[0];
  const model = AGENTS[agent.role as keyof typeof AGENTS]?.model ?? "gpt-4.1-mini";
  return {
    project, ws, step, agent, now,
    log(content, kind = "info", metadata) {
      ws.messages.push({
        id: uid("msg"), projectId: project.id, agentRole: step.agent,
        kind: kind as Ctx["log"] extends never ? never : "info",
        content, metadata, createdAt: new Date().toISOString(),
      });
    },
    llm(promptTokens, completionTokens, purpose, toolCalls = 0) {
      const cost = costMicrosFor(model, promptTokens, completionTokens);
      ws.llmCalls.push({
        id: uid("llm"), projectId: project.id, agentRole: step.agent,
        model, promptTokens, completionTokens, purpose, costMicros: cost,
        createdAt: new Date().toISOString(),
      });
      project.tokensIn += promptTokens; project.tokensOut += completionTokens;
      project.costMicros += cost; project.llmCalls += 1; project.toolCalls += toolCalls;
      agent.tokensIn += promptTokens; agent.tokensOut += completionTokens;
      agent.llmCalls += 1; agent.toolCalls += toolCalls;
    },
    writeFiles(files) {
      for (const f of files) {
        const existing = ws.files.find((x) => x.path === f.path);
        if (existing) {
          existing.content = f.content; existing.language = f.language;
          existing.size = f.content.length; existing.version += 1;
          existing.agentRole = step.agent; existing.updatedAt = new Date().toISOString();
        } else {
          ws.files.push({
            id: uid("file"), projectId: project.id, agentRole: step.agent,
            path: f.path, name: f.path.split("/").pop() ?? f.path,
            content: f.content, language: f.language, size: f.content.length,
            version: 1, isModified: false, updatedAt: new Date().toISOString(),
          });
          project.generatedFiles += 1;
          agent.filesWritten += 1;
        }
      }
      ws.messages.push({
        id: uid("msg"), projectId: project.id, agentRole: step.agent, kind: "file",
        content: `Wrote ${files.length} file${files.length === 1 ? "" : "s"}: ${files.slice(0, 4).map((x) => `\`${x.path}\``).join(", ")}${files.length > 4 ? ` +${files.length - 4} more` : ""}`,
        metadata: { count: files.length }, createdAt: new Date().toISOString(),
      });
    },
    runCommand(command, stdout, durationMs, exitCode = 0) {
      ws.commands.push({
        id: uid("cmd"), projectId: project.id, agentRole: step.agent,
        command, stdout, durationMs, exitCode, createdAt: new Date().toISOString(),
      });
    },
  };
}

type Executor = (ctx: Ctx) => { checkpoint?: Omit<Checkpoint, "id" | "projectId" | "status" | "note" | "createdAt" | "resolvedAt">; statusAfter?: Project["status"] } | void;

const executors: Record<string, Executor> = {
  analyze(ctx) {
    const arch = ctx.project.architecture!;
    ctx.log(`Reading brief: "${ctx.project.prompt.slice(0, 140)}${ctx.project.prompt.length > 140 ? "…" : ""}"`);
    ctx.llm(1850, 620, "requirement analysis", 1);
    ctx.log(`Inferred domain **${arch.domainLabel}** with ${arch.domain === "custom" ? "medium" : "high"} confidence.`, "success");
    ctx.log(`Identified ${arch.entities.length} entities: ${arch.entities.map((e) => e.name).join(", ")}.`, "tool", { tool: "analyze_requirements" });
    ctx.log(`Feature set: ${arch.features.join(" · ")}`);
    return { statusAfter: "planning" };
  },
  plan(ctx) {
    ctx.llm(2400, 980, "task decomposition", 3);
    for (const role of AGENT_ORDER) {
      const count = ctx.project.plan.filter((s) => s.agent === role).length;
      if (count) ctx.log(`Assigned ${count} task${count === 1 ? "" : "s"} to ${AGENTS[role].name}`, "tool", { tool: "assign_agent" });
    }
    ctx.log(`Task graph ready — ${ctx.project.plan.length} tasks across ${AGENT_ORDER.length} agents. Order: Architect → Database → Backend → Frontend → Testing → DevOps.`, "success");
    return { statusAfter: "generating" };
  },
  architecture(ctx) {
    ctx.llm(3100, 1450, "architecture design", 2);
    ctx.log(`Selected stack: ${DEFAULT_STACK.frontend} · ${DEFAULT_STACK.database} · ${DEFAULT_STACK.styling}`);
    for (const c of ctx.project.architecture!.components) {
      ctx.log(`Defined component ${c.name} (${c.type})`, "tool", { tool: "define_architecture" });
    }
    ctx.log(`Data flow documented in ${ctx.project.architecture!.dataFlow.length} stages.`, "success");
    return { statusAfter: "building" };
  },
  scaffold(ctx) {
    ctx.llm(2050, 2900, "project scaffold", 9);
    ctx.writeFiles(scaffoldFiles(ctx.project.name, ctx.project.architecture!));
    ctx.runCommand("npm install", `added 412 packages, and audited 413 packages in 9s\n\n78 packages are looking for funding\n\nfound 0 vulnerabilities`, 9240);
    ctx.log("Dependencies installed — 0 vulnerabilities.", "success");
  },
  schema(ctx) {
    const arch = ctx.project.architecture!;
    ctx.llm(2700, 2200, "schema design", 5);
    for (const entity of arch.entities) {
      ctx.ws.tables.push({
        id: uid("tbl"), projectId: ctx.project.id, name: snake(entity.plural),
        status: "defined", columns: tableColumns(entity), rowCount: 0, sql: createTableSql(entity),
      });
      ctx.log(`Defined table ${snake(entity.plural)} (${entity.fields.length + 3} columns)`, "tool", { tool: "create_table" });
    }
    ctx.writeFiles(databaseFiles(arch));
    const sqlText = arch.entities.map(createTableSql).join("\n\n");
    ctx.log(`Schema requires human approval before migration is applied.`, "warning");
    return {
      checkpoint: {
        type: "schema", title: `Approve database migration (${arch.entities.length} tables)`,
        description: "The Database agent wants to apply the initial migration. Review the SQL below — this creates tables and enum constraints in the target database.",
        riskLevel: "medium",
        context: {
          summary: arch.entities.map((e) => `${snake(e.plural)} — ${e.fields.length + 3} columns`),
          diff: sqlText, command: "npx drizzle-kit push",
          affected: arch.entities.map((e) => snake(e.plural)),
        },
      },
    };
  },
  migrate(ctx) {
    const names = ctx.project.architecture!.entities.map((e) => snake(e.plural));
    for (const t of ctx.ws.tables) t.status = "migrating";
    ctx.runCommand("npx drizzle-kit push",
      `Reading config file 'drizzle.config.ts'\nPulling schema from database...\n${names.map((n) => `[✓] CREATE TABLE "${n}"`).join("\n")}\n\n[✓] Changes applied`, 3120);
    ctx.llm(900, 1100, "seed data", 2);
    const seeded = names.map((n, i) => ({ n, rows: 3 + ((i * 7 + ctx.project.id.length) % 12) }));
    ctx.runCommand("npm run db:seed",
      `> tsx src/db/seed.ts\n\n${seeded.map((s) => `  ✔ ${s.n}: ${s.rows} rows`).join("\n")}\n\n✔ Seeded ${names.length} tables`, 1480);
    for (const s of seeded) {
      const t = ctx.ws.tables.find((x) => x.name === s.n);
      if (t) { t.status = "seeded"; t.rowCount = s.rows; }
    }
    ctx.log(`Migration applied and ${seeded.reduce((a, s) => a + s.rows, 0)} fixture rows inserted.`, "success");
  },
  auth(ctx) {
    ctx.llm(1900, 2600, "auth & config", 6);
    ctx.writeFiles(authFiles(ctx.project.architecture!));
    const vars: Array<[string, string, string, boolean]> = [
      ["DATABASE_URL", "postgresql://postgres:••••@localhost:5432/appdb", "Postgres connection string", true],
      ["SESSION_SECRET", "••••••••••••••••", "Session cookie signing secret", true],
      ["NEXT_PUBLIC_APP_URL", "http://localhost:3000", "Public app URL", false],
    ];
    for (const [key, value, desc, secret] of vars) {
      if (!ctx.ws.env.find((e) => e.key === key)) {
        ctx.ws.env.push({ id: uid("env"), projectId: ctx.project.id, key, value, description: desc, isSecret: secret, isRequired: true, source: "agent" });
      }
    }
    ctx.log("Session auth, RBAC guard and 3 environment variables configured.", "success");
  },
  api(ctx) {
    const arch = ctx.project.architecture!;
    ctx.llm(3400, 5200, "rest api generation", arch.entities.length * 3);
    ctx.writeFiles(apiFiles(arch));
    ctx.log(`Generated ${arch.entities.length * 3} route handlers + validators with pagination and auth guards.`, "success");
  },
  shell(ctx) {
    ctx.llm(2600, 4100, "app shell", 5);
    ctx.writeFiles(frontendShellFiles(ctx.project.name, ctx.project.architecture!));
    ctx.log("App shell, dashboard and DataTable component complete.", "success");
  },
  pages(ctx) {
    const arch = ctx.project.architecture!;
    ctx.llm(3200, 6800, "resource pages", arch.entities.length * 2);
    const files = entityPageFiles(arch);
    ctx.writeFiles(files);
    ctx.log(`Generated ${files.length} pages (list + create) with loading, empty and error states.`, "success");
    return { statusAfter: "testing" };
  },
  "write-tests"(ctx) {
    ctx.llm(1800, 2400, "test authoring", 3);
    ctx.writeFiles(testFiles(ctx.project.architecture!));
    ctx.log("Wrote validation + auth unit tests and vitest config.", "success");
  },
  "run-tests"(ctx) {
    ctx.runCommand("npm run lint", `> eslint .\n\n✔ 0 errors · 0 warnings (${ctx.project.generatedFiles} files checked)`, 2140);
    ctx.runCommand("npx tsc --noEmit", `> tsc --noEmit\n\n✔ No type errors`, 3860);
    const pass = 10 + (ctx.project.id.length % 6);
    ctx.runCommand("npm test", `> vitest run\n\n ✓ src/lib/validators/${snake(ctx.project.architecture!.entities[0]?.name ?? "item")}.test.ts (2 tests)\n ✓ src/lib/auth.test.ts (1 test)\n ✓ src/app/api/health/route.test.ts (${pass - 3} tests)\n\n Test Files  3 passed (3)\n      Tests  ${pass} passed (${pass})\n   Coverage  91.${ctx.project.id.length % 10}% lines`, 4720);
    ctx.llm(600, 400, "coverage report", 1);
    ctx.log(`Quality gate passed — ${pass} tests green, ~91% line coverage.`, "success");
    return { statusAfter: "deploying" };
  },
  containerize(ctx) {
    ctx.llm(1400, 2100, "containerisation", 4);
    ctx.writeFiles(devopsFiles(ctx.project.name, ctx.project.architecture!));
    ctx.runCommand("docker build -t app:latest .", `[+] Building 24.1s\n ✔ [builder 6/6] ...\n ✔ [runner 3/3] ...\n\nIMAGE  SIZE\napp    148 MB`, 24100);
    ctx.log("Image built (148 MB) · CI workflow committed.", "success");
  },
  deploy(ctx) {
    ctx.llm(800, 500, "release plan", 1);
    ctx.log("Release candidate ready — production deploy requires human approval.", "warning");
    return {
      checkpoint: {
        type: "deploy", title: "Approve production deploy",
        description: "DevOps wants to push the production image and run database migrations against the live database.",
        riskLevel: "high",
        context: {
          summary: ["Push image app:latest (148 MB)", "Run drizzle migrations on production", "Flip traffic to new revision"],
          command: "docker push registry/app:latest && deploy --prod",
          affected: ["production database", "app deployment"],
        },
      },
    };
  },
};

// Status flow after each key (when no explicit override)
const STATUS_AFTER: Record<string, Project["status"]> = {
  analyze: "planning", plan: "generating", architecture: "building",
  scaffold: "building", schema: "building", migrate: "building",
  auth: "building", api: "building", shell: "building", pages: "testing",
  "write-tests": "testing", "run-tests": "deploying",
  containerize: "deploying", deploy: "completed",
};

/** Execute exactly one plan step. Mutates copies and returns them. */
export function runStep(
  inputProject: Project, inputWs: WorkspaceData,
): { project: Project; ws: WorkspaceData; outcome: StepOutcome } {
  const project: Project = JSON.parse(JSON.stringify(inputProject));
  const ws: WorkspaceData = JSON.parse(JSON.stringify(inputWs));
  const step = project.plan[project.currentStep];

  if (!step) {
    return { project, ws, outcome: { waiting: false, done: true } };
  }
  if (project.status === "draft") {
    project.status = "planning";
    project.startedAt = project.startedAt ?? new Date().toISOString();
  }

  // Mark agent + task active
  const agent: Agent | undefined = ws.agents.find((a) => a.role === step.agent);
  if (agent) {
    agent.status = "working"; agent.currentTask = step.title;
    agent.startedAt = agent.startedAt ?? new Date().toISOString();
    const agentSteps = project.plan.filter((s) => s.agent === step.agent);
    const doneInAgent = project.plan.slice(0, project.currentStep).filter((s) => s.agent === step.agent).length;
    agent.progress = Math.round((doneInAgent / agentSteps.length) * 100);
  }
  const task: Task | undefined = ws.tasks.find((t) => t.order === step.index);
  if (task) { task.status = "in_progress"; task.startedAt = task.startedAt ?? new Date().toISOString(); }

  const ctx = makeCtx(project, ws, step);
  const exec = executors[step.key];
  let checkpointId: string | undefined;
  let waiting = false;

  if (exec) {
    const result = exec(ctx) ?? {};
    const nextStatus = result.statusAfter ?? STATUS_AFTER[step.key];

    if (result.checkpoint && !project.autoApprove) {
      const cp: Checkpoint = {
        id: uid("hitl"), projectId: project.id, ...result.checkpoint,
        status: "pending", note: null,
        createdAt: new Date().toISOString(), resolvedAt: null,
      };
      ws.checkpoints.push(cp);
      checkpointId = cp.id; waiting = true;
      project.status = "waiting_approval";
      if (task) task.status = "waiting_approval";
      if (agent) { agent.status = "waiting"; agent.currentTask = `Waiting: ${result.checkpoint.title}`; }
      project.updatedAt = new Date().toISOString();
      return { project, ws, outcome: { waiting, done: false, checkpointId } };
    }

    if (result.checkpoint && project.autoApprove) {
      const cp: Checkpoint = {
        id: uid("hitl"), projectId: project.id, ...result.checkpoint,
        status: "approved", note: "Auto-approved (auto-approve enabled)",
        createdAt: new Date().toISOString(), resolvedAt: new Date().toISOString(),
      };
      ws.checkpoints.push(cp);
      ws.messages.push({
        id: uid("msg"), projectId: project.id, agentRole: step.agent, kind: "success",
        content: `Auto-approved: ${result.checkpoint.title}`, createdAt: new Date().toISOString(),
      });
    }

    // Complete the step
    if (task) {
      task.status = "completed"; task.completedAt = new Date().toISOString();
      task.output = `${step.title} completed successfully.`;
    }
    project.completedTasks += 1;
    project.currentStep += 1;
    project.status = nextStatus ?? project.status;

    if (agent) {
      const agentSteps = project.plan.filter((s) => s.agent === step.agent);
      const remaining = agentSteps.filter((s) => s.index >= project.currentStep).length;
      if (remaining === 0) {
        agent.status = "completed"; agent.progress = 100;
        agent.currentTask = null; agent.completedAt = new Date().toISOString();
      } else {
        agent.progress = Math.round(((agentSteps.length - remaining) / agentSteps.length) * 100);
        agent.status = "idle"; agent.currentTask = null;
      }
    }
  } else {
    project.currentStep += 1;
    project.completedTasks += 1;
    if (task) { task.status = "completed"; task.completedAt = new Date().toISOString(); }
  }

  const done = project.currentStep >= project.totalSteps;
  if (done) {
    project.status = "completed";
    project.completedAt = new Date().toISOString();
    for (const a of ws.agents) {
      if (a.status !== "failed") { a.status = "completed"; a.progress = 100; a.currentTask = null; a.completedAt = a.completedAt ?? new Date().toISOString(); }
    }
    ws.messages.push({
      id: uid("msg"), projectId: project.id, agentRole: "orchestrator", kind: "success",
      content: `Pipeline complete — ${project.generatedFiles} files, ${ws.tables.length} tables, ${ws.commands.length} commands. Deployed to https://${snake(project.name).replace(/_/g, "-")}.agentic.app`,
      createdAt: new Date().toISOString(),
    });
  }

  project.updatedAt = new Date().toISOString();
  return { project, ws, outcome: { waiting, done, checkpointId } };
}

/** Resolve a checkpoint then advance past the gated step. */
export function resolveCheckpoint(
  inputProject: Project, inputWs: WorkspaceData,
  checkpointId: string, decision: "approved" | "rejected", note?: string,
): { project: Project; ws: WorkspaceData } {
  const project: Project = JSON.parse(JSON.stringify(inputProject));
  const ws: WorkspaceData = JSON.parse(JSON.stringify(inputWs));
  const cp = ws.checkpoints.find((c) => c.id === checkpointId);
  if (!cp || cp.status !== "pending") return { project, ws };

  cp.status = decision; cp.note = note ?? null; cp.resolvedAt = new Date().toISOString();
  const step = project.plan[project.currentStep];
  const task = ws.tasks.find((t) => t.order === project.currentStep);
  const agent = ws.agents.find((a) => a.role === step?.agent);

  if (decision === "approved") {
    ws.messages.push({
      id: uid("msg"), projectId: project.id, agentRole: null, kind: "user",
      content: `Approved: ${cp.title}${note ? ` — note: "${note}"` : ""}`,
      createdAt: new Date().toISOString(),
    });
    if (task) { task.status = "completed"; task.completedAt = new Date().toISOString(); }
    project.completedTasks += 1;
    project.currentStep += 1;
    project.status = step ? (STATUS_AFTER[step.key] ?? "building") : project.status;
    if (agent) {
      const agentSteps = project.plan.filter((s) => s.agent === step.agent);
      const remaining = agentSteps.filter((s) => s.index >= project.currentStep).length;
      agent.status = remaining === 0 ? "completed" : "idle";
      agent.progress = Math.round(((agentSteps.length - remaining) / agentSteps.length) * 100);
      agent.currentTask = null;
      if (remaining === 0) agent.completedAt = new Date().toISOString();
    }
    if (project.currentStep >= project.totalSteps) {
      project.status = "completed"; project.completedAt = new Date().toISOString();
      for (const a of ws.agents) {
        if (a.status !== "failed") { a.status = "completed"; a.progress = 100; a.currentTask = null; a.completedAt = a.completedAt ?? new Date().toISOString(); }
      }
      ws.messages.push({
        id: uid("msg"), projectId: project.id, agentRole: "devops", kind: "success",
        content: `Deployed to production — ${project.generatedFiles} files live at https://${snake(project.name).replace(/_/g, "-")}.agentic.app`,
        createdAt: new Date().toISOString(),
      });
    }
  } else {
    ws.messages.push({
      id: uid("msg"), projectId: project.id, agentRole: null, kind: "warning",
      content: `Rejected: ${cp.title} — step skipped by reviewer.${note ? ` Note: "${note}"` : ""}`,
      createdAt: new Date().toISOString(),
    });
    if (task) { task.status = "skipped"; task.completedAt = new Date().toISOString(); task.output = "Skipped by reviewer"; }
    project.currentStep += 1;
    project.status = step ? (STATUS_AFTER[step.key] ?? "building") : project.status;
    if (agent) { agent.status = "idle"; agent.currentTask = null; }
    if (project.currentStep >= project.totalSteps) {
      project.status = "completed"; project.completedAt = new Date().toISOString();
      ws.messages.push({
        id: uid("msg"), projectId: project.id, agentRole: "orchestrator", kind: "warning",
        content: "Pipeline finished with the deploy step skipped by reviewer. The image and migration remain staged, not live.",
        createdAt: new Date().toISOString(),
      });
    }
  }

  project.updatedAt = new Date().toISOString();
  return { project, ws };
}
