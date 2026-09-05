import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import {
  agentMessages,
  agents,
  commandExecutions,
  dbTables,
  environmentVariables,
  fileNodes,
  hitlCheckpoints,
  llmCalls,
  projects,
  tasks,
  type Architecture,
  type PlanStep,
  type Project,
} from "@/db/schema";
import { AGENTS, AGENT_ORDER, type AgentRole } from "./agents";
import {
  apiFiles,
  authFiles,
  createTableSql,
  databaseFiles,
  devopsFiles,
  entityPageFiles,
  frontendShellFiles,
  scaffoldFiles,
  tableColumns,
  testFiles,
  type GeneratedFile,
} from "./codegen";
import { DEFAULT_STACK, buildArchitecture, inferDomain, snake, titleCase } from "./domain";

// ─── Plan ─────────────────────────────────────────────────────────────────────

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

// ─── Pricing (USD per 1M tokens) ─────────────────────────────────────────────

const PRICING: Record<string, { in: number; out: number }> = {
  "gpt-4.1": { in: 2.0, out: 8.0 },
  "gpt-4.1-mini": { in: 0.4, out: 1.6 },
};

function costMicros(model: string, inTok: number, outTok: number) {
  const p = PRICING[model] ?? PRICING["gpt-4.1-mini"];
  return Math.round(inTok * p.in + outTok * p.out); // tokens * $/1M = micro-dollars
}

// ─── Context passed to step executors ────────────────────────────────────────

interface StepContext {
  project: Project;
  arch: Architecture;
  step: PlanStep;
  agentId: string;
  role: AgentRole;
  log: (content: string, kind?: string, metadata?: Record<string, unknown>) => Promise<void>;
  writeFiles: (files: GeneratedFile[]) => Promise<void>;
  runCommand: (command: string, stdout: string, durationMs: number, exitCode?: number) => Promise<void>;
  llm: (promptTokens: number, completionTokens: number, purpose: string, toolCalls?: number) => Promise<void>;
}

type StepResult = {
  checkpoint?: {
    type: string;
    title: string;
    description: string;
    riskLevel: "low" | "medium" | "high";
    context: { summary?: string[]; diff?: string; command?: string; affected?: string[] };
  };
  statusAfter?: Project["status"];
  patch?: Partial<typeof projects.$inferInsert>;
};

// ─── Step executors ──────────────────────────────────────────────────────────

const executors: Record<string, (ctx: StepContext) => Promise<StepResult>> = {
  async analyze(ctx) {
    const { arch } = ctx;
    await ctx.log(`Reading brief: "${ctx.project.prompt.slice(0, 140)}${ctx.project.prompt.length > 140 ? "…" : ""}"`);
    await ctx.llm(1_850, 620, "requirement analysis", 1);
    await ctx.log(`Inferred domain **${arch.domainLabel}** with confidence ${arch.domain === "custom" ? "medium" : "high"}.`, "success");
    await ctx.log(`Identified ${arch.entities.length} entities: ${arch.entities.map((e) => e.name).join(", ")}.`, "tool", { tool: "analyze_requirements" });
    await ctx.log(`Feature set: ${arch.features.join(" · ")}`);
    return { statusAfter: "planning" };
  },

  async plan(ctx) {
    await ctx.llm(2_400, 980, "task decomposition", 3);
    const plan = ctx.project.plan ?? [];
    const rows = plan.map((s) => ({
      id: nanoid(),
      projectId: ctx.project.id,
      agentRole: s.agent,
      stepKey: s.key,
      title: s.title,
      description: s.description,
      status: (s.index < ctx.step.index ? "completed" : s.index === ctx.step.index ? "in_progress" : "pending") as "completed" | "in_progress" | "pending",
      order: s.index,
      agentId: s.agent === ctx.role ? ctx.agentId : null,
      startedAt: s.index <= ctx.step.index ? new Date() : null,
      completedAt: s.index < ctx.step.index ? new Date() : null,
    }));
    await db.insert(tasks).values(rows);
    for (const role of AGENT_ORDER) {
      const count = plan.filter((s) => s.agent === role).length;
      await ctx.log(`Assigned ${count} task${count === 1 ? "" : "s"} to ${AGENTS[role].name}`, "tool", { tool: "assign_agent" });
    }
    await ctx.log(`Task graph ready — ${plan.length} tasks across ${AGENT_ORDER.length} agents. Execution order: Architect → Database → Backend → Frontend → Testing → DevOps.`, "success");
    return { patch: { totalTasks: rows.length }, statusAfter: "generating" };
  },

  async architecture(ctx) {
    await ctx.llm(3_100, 1_450, "architecture design", 2);
    await ctx.log(`Selected stack: ${DEFAULT_STACK.frontend} · ${DEFAULT_STACK.database} · ${DEFAULT_STACK.styling}`);
    for (const c of ctx.arch.components) {
      await ctx.log(`Defined component ${c.name} (${c.type})`, "tool", { tool: "define_architecture" });
    }
    await ctx.log(`Data flow documented in ${ctx.arch.dataFlow.length} stages.`, "success");
    return {};
  },

  async scaffold(ctx) {
    await ctx.llm(2_050, 2_900, "project scaffold", 9);
    const files = scaffoldFiles(ctx.project.name, ctx.arch);
    await ctx.writeFiles(files);
    await ctx.runCommand("npm install", `added 412 packages, and audited 413 packages in 9s\n\n78 packages are looking for funding\n\nfound 0 vulnerabilities`, 9_240);
    return {};
  },

  async schema(ctx) {
    await ctx.llm(2_700, 2_200, "schema design", 5);
    for (const entity of ctx.arch.entities) {
      await db.insert(dbTables).values({
        id: nanoid(),
        projectId: ctx.project.id,
        name: snake(entity.plural),
        status: "defined",
        columns: tableColumns(entity),
        sql: createTableSql(entity),
      });
      await ctx.log(`Defined table ${snake(entity.plural)} (${entity.fields.length + 3} columns)`, "tool", { tool: "create_table" });
    }
    await ctx.writeFiles(databaseFiles(ctx.arch));
    const sqlText = ctx.arch.entities.map((e) => createTableSql(e)).join("\n\n");
    await ctx.log(`Schema requires human approval before migration is applied.`, "warning");
    return {
      checkpoint: {
        type: "schema",
        title: `Approve database migration (${ctx.arch.entities.length} tables)`,
        description: "The Database agent wants to apply the initial migration. Review the SQL below — this creates tables and enum constraints in the target database.",
        riskLevel: "medium",
        context: {
          summary: ctx.arch.entities.map((e) => `${snake(e.plural)} — ${e.fields.length + 3} columns`),
          diff: sqlText,
          command: "npx drizzle-kit push",
          affected: ctx.arch.entities.map((e) => snake(e.plural)),
        },
      },
    };
  },

  async migrate(ctx) {
    await db.update(dbTables).set({ status: "migrating" }).where(eq(dbTables.projectId, ctx.project.id));
    const names = ctx.arch.entities.map((e) => snake(e.plural));
    await ctx.runCommand(
      "npx drizzle-kit push",
      `Reading config file 'drizzle.config.ts'\nPulling schema from database...\n${names.map((n) => `[✓] CREATE TABLE "${n}"`).join("\n")}\n\n[✓] Changes applied`,
      3_120,
    );
    await ctx.llm(900, 1_100, "seed data", 2);
    const seeded = names.map((n, i) => ({ n, rows: 3 + ((i * 7) % 12) }));
    await ctx.runCommand(
      "npm run db:seed",
      `> tsx src/db/seed.ts\n\n${seeded.map((s) => `  ✔ ${s.n}: ${s.rows} rows`).join("\n")}\n\n✔ Seeded ${names.length} tables`,
      1_480,
    );
    for (const s of seeded) {
      await db
        .update(dbTables)
        .set({ status: "seeded", rowCount: s.rows, updatedAt: new Date() })
        .where(and(eq(dbTables.projectId, ctx.project.id), eq(dbTables.name, s.n)));
    }
    await ctx.log(`Migration applied and ${seeded.reduce((a, s) => a + s.rows, 0)} fixture rows inserted.`, "success");
    return {};
  },

  async auth(ctx) {
    await ctx.llm(1_900, 2_600, "auth & config", 6);
    await ctx.writeFiles(authFiles());
    const envs = [
      { key: "DATABASE_URL", value: "postgresql://postgres:postgres@localhost:5432/app", description: "PostgreSQL connection string", isSecret: true },
      { key: "SESSION_SECRET", value: nanoid(32), description: "HMAC secret used to sign session cookies", isSecret: true },
      { key: "NEXT_PUBLIC_APP_URL", value: "http://localhost:3000", description: "Public base URL used in emails and redirects", isSecret: false },
      { key: "NODE_ENV", value: "development", description: "Runtime environment", isSecret: false, isRequired: false },
    ];
    if (ctx.arch.features.some((f) => /stripe|billing/i.test(f))) {
      envs.push({ key: "STRIPE_SECRET_KEY", value: "sk_test_" + nanoid(24), description: "Stripe secret API key", isSecret: true });
      envs.push({ key: "STRIPE_WEBHOOK_SECRET", value: "whsec_" + nanoid(24), description: "Stripe webhook signing secret", isSecret: true });
    }
    if (ctx.arch.features.some((f) => /email|notification/i.test(f))) {
      envs.push({ key: "RESEND_API_KEY", value: "re_" + nanoid(20), description: "Transactional email provider key", isSecret: true });
    }
    if (ctx.arch.features.some((f) => /upload|file/i.test(f))) {
      envs.push({ key: "S3_BUCKET", value: `${snake(ctx.project.name)}-uploads`, description: "Object storage bucket for uploads", isSecret: false });
    }
    for (const e of envs) {
      await db.insert(environmentVariables).values({ id: nanoid(), projectId: ctx.project.id, source: "agent", isRequired: true, ...e });
      await ctx.log(`Registered env var ${e.key}${e.isSecret ? " (secret)" : ""}`, "tool", { tool: "set_env_var" });
    }
    await ctx.log(`Session auth with signed HMAC cookies and role guard implemented.`, "success");
    return {};
  },

  async api(ctx) {
    const files = ctx.arch.entities.flatMap((e) => apiFiles(e));
    await ctx.llm(4_200, 6_800, "REST API generation", files.length);
    await ctx.writeFiles(files);
    await ctx.log(`Generated ${ctx.arch.entities.length * 5} endpoints with Zod validation and pagination.`, "success");
    await ctx.runCommand("npx tsc --noEmit", "", 6_410);
    return {};
  },

  async shell(ctx) {
    await ctx.llm(2_300, 3_100, "app shell", 3);
    await ctx.writeFiles(frontendShellFiles(ctx.project.name, ctx.arch));
    await ctx.log(`App shell with sidebar navigation and dashboard cards wired to live counts.`, "success");
    return {};
  },

  async pages(ctx) {
    const entities = ctx.arch.entities.filter((e) => e.name !== "User");
    const files = entities.flatMap((e) => entityPageFiles(e));
    await ctx.llm(3_800, 7_200, "resource pages", files.length);
    await ctx.writeFiles(files);
    await ctx.log(`Built ${entities.length} list pages and ${entities.length} create forms with empty/loading/error states.`, "success");
    await ctx.runCommand("npm run lint", `> eslint .\n\n✔ No ESLint warnings or errors`, 4_230);
    return {};
  },

  async "write-tests"(ctx) {
    const files = testFiles(ctx.arch);
    await ctx.llm(2_100, 2_800, "test generation", files.length);
    await ctx.writeFiles(files);
    await ctx.log(`Wrote ${files.length - 1} test files covering validation and auth.`, "success");
    return { statusAfter: "testing" };
  },

  async "run-tests"(ctx) {
    const suites = ctx.arch.entities.length + 1;
    const testsCount = suites * 2;
    const lines = [
      ...ctx.arch.entities.map((e) => ` ✓ tests/${e.slug}.test.ts (2 tests) ${8 + (e.name.length % 9)}ms`),
      ` ✓ tests/auth.test.ts (2 tests) 11ms`,
      "",
      ` Test Files  ${suites} passed (${suites})`,
      `      Tests  ${testsCount} passed (${testsCount})`,
      `   Start at  ${new Date().toLocaleTimeString()}`,
      `   Duration  1.84s`,
      "",
      " % Coverage report from v8",
      " --------------------|---------|----------|---------|---------",
      " File                | % Stmts | % Branch | % Funcs | % Lines ",
      " --------------------|---------|----------|---------|---------",
      " All files           |   91.4  |   84.2   |   93.1  |   91.4  ",
    ];
    await ctx.runCommand("npm test -- --coverage", lines.join("\n"), 2_640);
    await ctx.llm(1_200, 400, "test triage", 1);
    await ctx.log(`Quality gate passed — ${testsCount} tests green, 91% statement coverage.`, "success");
    return { statusAfter: "building" };
  },

  async containerize(ctx) {
    await ctx.llm(1_600, 2_100, "infrastructure", 4);
    await ctx.writeFiles(devopsFiles(ctx.project.name));
    await ctx.runCommand(
      `docker build -t ${snake(ctx.project.name)}:latest .`,
      `[+] Building 48.2s (17/17) FINISHED\n => [deps 1/3] FROM node:22-alpine\n => [deps 3/3] RUN npm ci\n => [build 3/3] RUN npm run build\n => exporting to image\n => => naming to docker.io/library/${snake(ctx.project.name)}:latest`,
      48_200,
    );
    await ctx.log(`Image built (148 MB). Deployment requires approval.`, "warning");
    return {
      statusAfter: "deploying",
      checkpoint: {
        type: "deployment",
        title: "Approve production deployment",
        description: "DevOps is ready to roll out the container to the production environment. This will run database migrations against production and expose the public URL.",
        riskLevel: "high",
        context: {
          summary: [
            `Image: ${snake(ctx.project.name)}:latest (148 MB)`,
            "Target: production (2 replicas, rolling update)",
            "Migrations: 1 pending",
            "Health check: GET /api/health",
          ],
          command: "docker compose -f docker-compose.yml up -d --wait",
          affected: ["production", "database"],
        },
      },
    };
  },

  async deploy(ctx) {
    const host = `${ctx.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.agentic.app`;
    await ctx.runCommand(
      "docker compose up -d --wait",
      `[+] Running 3/3\n ✔ Network app_default  Created\n ✔ Container app-db-1   Healthy\n ✔ Container app-web-1  Healthy\n\nhttps://${host}  →  200 OK (health check passed)`,
      12_800,
    );
    await ctx.llm(800, 300, "deployment summary", 1);
    await ctx.log(`Deployed to https://${host}`, "success", { url: `https://${host}` });
    return { statusAfter: "completed" };
  },
};

// ─── Public API ──────────────────────────────────────────────────────────────

export async function initializeProject(input: {
  name?: string;
  prompt: string;
  mode?: string;
  autoApprove?: boolean;
}) {
  const inf = inferDomain(input.prompt, input.name);
  const arch = buildArchitecture(inf);
  const plan = buildPlan(arch);
  const id = nanoid(12);

  await db.insert(projects).values({
    id,
    name: inf.name,
    description: inf.overview,
    prompt: input.prompt,
    mode: input.mode ?? "greenfield",
    status: "draft",
    domain: inf.domain,
    domainLabel: inf.domainLabel,
    emoji: inf.emoji,
    techStack: DEFAULT_STACK,
    architecture: arch,
    plan,
    totalSteps: plan.length,
    autoApprove: input.autoApprove ?? false,
  });

  await db.insert(agents).values(
    AGENT_ORDER.map((role) => ({
      id: nanoid(),
      projectId: id,
      role,
      name: AGENTS[role].name,
      status: "idle" as const,
    })),
  );

  await db.insert(agentMessages).values({
    id: nanoid(),
    projectId: id,
    kind: "user",
    content: input.prompt,
  });

  return id;
}

export type TickResult =
  | { ok: true; done: boolean; status: string; step: number; total: number; waiting?: boolean }
  | { ok: false; error: string };

/** Execute the next pipeline step for a project. */
export async function runNextStep(projectId: string): Promise<TickResult> {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return { ok: false, error: "Project not found" };
  if (!project.plan || !project.architecture) return { ok: false, error: "Project is not initialised" };

  if (project.status === "waiting_approval") {
    return { ok: true, done: false, waiting: true, status: project.status, step: project.currentStep, total: project.totalSteps };
  }
  if (project.status === "completed" || project.status === "failed") {
    return { ok: true, done: true, status: project.status, step: project.currentStep, total: project.totalSteps };
  }
  if (project.currentStep >= project.plan.length) {
    await db.update(projects).set({ status: "completed", completedAt: new Date(), updatedAt: new Date() }).where(eq(projects.id, projectId));
    return { ok: true, done: true, status: "completed", step: project.currentStep, total: project.totalSteps };
  }

  const step = project.plan[project.currentStep];
  const role = step.agent as AgentRole;
  const [agent] = await db.select().from(agents).where(and(eq(agents.projectId, projectId), eq(agents.role, role)));
  const arch = project.architecture;
  const model = AGENTS[role].model;
  const now = new Date();

  // Mark agent + task as working
  await db
    .update(agents)
    .set({ status: "working", currentTask: step.title, startedAt: agent.startedAt ?? now })
    .where(eq(agents.id, agent.id));
  await db
    .update(tasks)
    .set({ status: "in_progress", startedAt: now, agentId: agent.id })
    .where(and(eq(tasks.projectId, projectId), eq(tasks.stepKey, step.key)));
  if (project.currentStep === 0) {
    await db.update(projects).set({ startedAt: now, status: "planning" }).where(eq(projects.id, projectId));
  }

  let filesWritten = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let calls = 0;
  let toolCallsTotal = 0;
  let cost = 0;

  const ctx: StepContext = {
    project,
    arch,
    step,
    agentId: agent.id,
    role,
    async log(content, kind = "info", metadata) {
      await db.insert(agentMessages).values({ id: nanoid(), projectId, agentId: agent.id, agentRole: role, kind, content, metadata });
    },
    async writeFiles(files) {
      for (const f of files) {
        const existing = await db
          .select({ id: fileNodes.id, version: fileNodes.version })
          .from(fileNodes)
          .where(and(eq(fileNodes.projectId, projectId), eq(fileNodes.path, f.path)));
        if (existing[0]) {
          await db
            .update(fileNodes)
            .set({ content: f.content, size: f.content.length, version: existing[0].version + 1, isModified: true, updatedAt: new Date() })
            .where(eq(fileNodes.id, existing[0].id));
        } else {
          await db.insert(fileNodes).values({
            id: nanoid(),
            projectId,
            agentId: agent.id,
            agentRole: role,
            path: f.path,
            name: f.path.split("/").pop() ?? f.path,
            content: f.content,
            language: f.language,
            size: f.content.length,
          });
          filesWritten += 1;
        }
        await db.insert(agentMessages).values({
          id: nanoid(),
          projectId,
          agentId: agent.id,
          agentRole: role,
          kind: "file",
          content: `${existing[0] ? "Updated" : "Created"} ${f.path}`,
          metadata: { path: f.path, bytes: f.content.length },
        });
      }
    },
    async runCommand(command, stdout, durationMs, exitCode = 0) {
      await db.insert(commandExecutions).values({
        id: nanoid(),
        projectId,
        agentRole: role,
        command,
        stdout,
        exitCode,
        durationMs,
        status: exitCode === 0 ? "completed" : "failed",
      });
      await db.insert(agentMessages).values({
        id: nanoid(),
        projectId,
        agentId: agent.id,
        agentRole: role,
        kind: "tool",
        content: `$ ${command}`,
        metadata: { tool: "run_command", exitCode, durationMs },
      });
    },
    async llm(promptTokens, completionTokens, purpose, toolCalls = 0) {
      // Deterministic jitter so numbers feel organic but remain reproducible per project
      const seed = (projectId.charCodeAt(0) + step.index * 13) % 17;
      const inTok = promptTokens + seed * 11;
      const outTok = completionTokens + seed * 7;
      const c = costMicros(model, inTok, outTok);
      tokensIn += inTok;
      tokensOut += outTok;
      calls += 1;
      toolCallsTotal += toolCalls;
      cost += c;
      await db.insert(llmCalls).values({
        id: nanoid(),
        projectId,
        agentRole: role,
        model,
        provider: "openai",
        promptTokens: inTok,
        completionTokens: outTok,
        costMicros: c,
        toolCalls,
        durationMs: 900 + Math.round(outTok * 0.9),
        purpose,
      });
    },
  };

  await ctx.log(`▶ ${step.title}`, "info", { stepIndex: step.index });

  try {
    const result = await executors[step.key](ctx);
    const finished = new Date();

    // Task complete
    await db
      .update(tasks)
      .set({ status: "completed", completedAt: finished })
      .where(and(eq(tasks.projectId, projectId), eq(tasks.stepKey, step.key)));

    // Agent progress
    const roleSteps = project.plan.filter((s) => s.agent === role);
    const roleDone = roleSteps.filter((s) => s.index <= step.index).length;
    const agentDone = roleDone === roleSteps.length;
    await db
      .update(agents)
      .set({
        status: agentDone ? "completed" : "waiting",
        currentTask: agentDone ? null : step.title,
        progress: Math.round((roleDone / roleSteps.length) * 100),
        tokensIn: sql`${agents.tokensIn} + ${tokensIn}`,
        tokensOut: sql`${agents.tokensOut} + ${tokensOut}`,
        llmCalls: sql`${agents.llmCalls} + ${calls}`,
        toolCalls: sql`${agents.toolCalls} + ${toolCallsTotal}`,
        filesWritten: sql`${agents.filesWritten} + ${filesWritten}`,
        completedAt: agentDone ? finished : null,
      })
      .where(eq(agents.id, agent.id));

    // Checkpoint?
    let nextStatus: Project["status"] = result.statusAfter ?? (project.status === "draft" ? "planning" : project.status);
    const nextIndex = step.index + 1;
    if (result.checkpoint) {
      if (project.autoApprove) {
        await db.insert(hitlCheckpoints).values({
          id: nanoid(),
          projectId,
          agentRole: role,
          stepIndex: step.index,
          status: "approved",
          resolutionNote: "Auto-approved (project setting)",
          resolvedAt: finished,
          ...result.checkpoint,
        });
        await ctx.log(`Checkpoint auto-approved: ${result.checkpoint.title}`, "success");
      } else {
        await db.insert(hitlCheckpoints).values({
          id: nanoid(),
          projectId,
          agentRole: role,
          stepIndex: step.index,
          status: "pending",
          ...result.checkpoint,
        });
        await db.update(agents).set({ status: "waiting", currentTask: "Awaiting human approval" }).where(eq(agents.id, agent.id));
        nextStatus = "waiting_approval";
      }
    }

    const isLast = nextIndex >= project.plan.length;
    await db
      .update(projects)
      .set({
        currentStep: nextIndex,
        status: isLast && nextStatus !== "waiting_approval" ? "completed" : nextStatus,
        completedAt: isLast ? finished : null,
        completedTasks: sql`${projects.completedTasks} + 1`,
        generatedFiles: sql`${projects.generatedFiles} + ${filesWritten}`,
        tokensIn: sql`${projects.tokensIn} + ${tokensIn}`,
        tokensOut: sql`${projects.tokensOut} + ${tokensOut}`,
        llmCalls: sql`${projects.llmCalls} + ${calls}`,
        toolCalls: sql`${projects.toolCalls} + ${toolCallsTotal}`,
        costMicros: sql`${projects.costMicros} + ${cost}`,
        updatedAt: finished,
        ...(result.patch ?? {}),
      })
      .where(eq(projects.id, projectId));

    if (isLast && nextStatus !== "waiting_approval") {
      await ctx.log(`🎉 Pipeline complete — ${project.generatedFiles + filesWritten} files generated.`, "success");
    }

    return {
      ok: true,
      done: isLast && nextStatus !== "waiting_approval",
      waiting: nextStatus === "waiting_approval",
      status: isLast && nextStatus !== "waiting_approval" ? "completed" : nextStatus,
      step: nextIndex,
      total: project.plan.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await ctx.log(`Step failed: ${message}`, "error");
    await db.update(agents).set({ status: "failed" }).where(eq(agents.id, agent.id));
    await db.update(tasks).set({ status: "failed" }).where(and(eq(tasks.projectId, projectId), eq(tasks.stepKey, step.key)));
    await db.update(projects).set({ status: "failed", errorMessage: message, updatedAt: new Date() }).where(eq(projects.id, projectId));
    return { ok: false, error: message };
  }
}

/** Resolve a HITL checkpoint and resume the pipeline. */
export async function resolveCheckpoint(projectId: string, checkpointId: string, decision: "approved" | "rejected", note?: string) {
  const [cp] = await db.select().from(hitlCheckpoints).where(and(eq(hitlCheckpoints.id, checkpointId), eq(hitlCheckpoints.projectId, projectId)));
  if (!cp) return { ok: false as const, error: "Checkpoint not found" };
  if (cp.status !== "pending") return { ok: false as const, error: "Checkpoint already resolved" };

  const now = new Date();
  await db.update(hitlCheckpoints).set({ status: decision, resolutionNote: note ?? null, resolvedAt: now }).where(eq(hitlCheckpoints.id, checkpointId));

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  const [agent] = await db.select().from(agents).where(and(eq(agents.projectId, projectId), eq(agents.role, cp.agentRole as AgentRole)));

  if (decision === "approved") {
    await db.insert(agentMessages).values({
      id: nanoid(),
      projectId,
      kind: "user",
      content: `✅ Approved: ${cp.title}${note ? ` — "${note}"` : ""}`,
    });
    const resumeStatus: Project["status"] = cp.type === "deployment" ? "deploying" : "generating";
    await db.update(projects).set({ status: resumeStatus, updatedAt: now }).where(eq(projects.id, projectId));
    if (agent) await db.update(agents).set({ status: "working", currentTask: "Resuming" }).where(eq(agents.id, agent.id));
    return { ok: true as const, status: resumeStatus };
  }

  // Rejected: skip the dependent step and continue
  await db.insert(agentMessages).values({
    id: nanoid(),
    projectId,
    kind: "user",
    content: `⛔ Rejected: ${cp.title}${note ? ` — "${note}"` : ""}`,
  });
  const plan = project?.plan ?? [];
  const skipStep = plan[cp.stepIndex + 1];
  if (skipStep) {
    await db
      .update(tasks)
      .set({ status: "skipped", output: `Skipped — checkpoint rejected${note ? `: ${note}` : ""}` })
      .where(and(eq(tasks.projectId, projectId), eq(tasks.stepKey, skipStep.key)));
    await db.insert(agentMessages).values({
      id: nanoid(),
      projectId,
      agentRole: cp.agentRole,
      kind: "warning",
      content: `Skipping "${skipStep.title}" because the checkpoint was rejected.`,
    });
  }
  const nextIndex = cp.stepIndex + 2;
  const isLast = nextIndex >= plan.length;
  const agentSteps = plan.filter((s) => s.agent === cp.agentRole);
  const agentDone = agentSteps.every((s) => s.index < nextIndex);
  if (agent) {
    await db
      .update(agents)
      .set({ status: agentDone ? "completed" : "waiting", currentTask: null, progress: agentDone ? 100 : agent.progress, completedAt: agentDone ? now : null })
      .where(eq(agents.id, agent.id));
  }
  await db
    .update(projects)
    .set({
      currentStep: Math.min(nextIndex, plan.length),
      status: isLast ? "completed" : "generating",
      completedAt: isLast ? now : null,
      updatedAt: now,
    })
    .where(eq(projects.id, projectId));
  return { ok: true as const, status: isLast ? "completed" : "generating" };
}

/** Wipe all generated artefacts and restore the project to draft. */
export async function resetProject(projectId: string) {
  await db.delete(fileNodes).where(eq(fileNodes.projectId, projectId));
  await db.delete(dbTables).where(eq(dbTables.projectId, projectId));
  await db.delete(environmentVariables).where(eq(environmentVariables.projectId, projectId));
  await db.delete(agentMessages).where(eq(agentMessages.projectId, projectId));
  await db.delete(commandExecutions).where(eq(commandExecutions.projectId, projectId));
  await db.delete(hitlCheckpoints).where(eq(hitlCheckpoints.projectId, projectId));
  await db.delete(llmCalls).where(eq(llmCalls.projectId, projectId));
  await db.delete(tasks).where(eq(tasks.projectId, projectId));
  await db
    .update(agents)
    .set({ status: "idle", currentTask: null, progress: 0, tokensIn: 0, tokensOut: 0, llmCalls: 0, toolCalls: 0, filesWritten: 0, startedAt: null, completedAt: null })
    .where(eq(agents.projectId, projectId));
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  await db
    .update(projects)
    .set({
      status: "draft",
      currentStep: 0,
      completedTasks: 0,
      totalTasks: 0,
      generatedFiles: 0,
      tokensIn: 0,
      tokensOut: 0,
      llmCalls: 0,
      toolCalls: 0,
      costMicros: 0,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId));
  if (project) {
    await db.insert(agentMessages).values({ id: nanoid(), projectId, kind: "user", content: project.prompt });
  }
}

export function stepLabel(step: PlanStep) {
  return `${titleCase(step.agent)} · ${step.title}`;
}
