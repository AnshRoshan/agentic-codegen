import "server-only";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { dbTables, projects, type Architecture, type DbColumn, type PlanStep, type Project } from "@/db/schema";
import { AGENTS, type AgentRole } from "@/lib/types";
import { snake } from "@/lib/domains";
import * as repo from "./repo";
import { analyzeWorkspace, renderLintOutput, renderTestOutput, renderTscOutput, type QualityReport } from "./quality";

// ─── Step context ───────────────────────────────────────────────────────────

export interface StepContext {
  project: Project;
  arch: Architecture;
  step: PlanStep;
  role: AgentRole;
  taskId: string;
  signal: AbortSignal;
  /** Mutable counters for this step (persisted by the engine). */
  stats: { toolCalls: number; filesWritten: number; commands: number; commandList: string[]; checkpointRequested?: CheckpointRequest; taskSummary?: string };
  log: (kind: repo.MessageKind, content: string, metadata?: Record<string, unknown>) => Promise<void>;
  writeFile: (path: string, content: string) => Promise<{ created: boolean; path: string; version: number }>;
  writeFiles: (files: Array<{ path: string; content: string }>) => Promise<void>;
  readFile: (path: string) => Promise<string | null>;
  listFiles: () => Promise<Array<{ path: string; size: number; language: string | null }>>;
  runCommand: (command: string) => Promise<CommandResult>;
  defineTable: (name: string, columns: DbColumn[], sqlText: string | null) => Promise<void>;
  setEnv: (key: string, value: string, description: string, isSecret: boolean) => Promise<void>;
  updateArchitecture: (patch: Partial<Architecture>) => Promise<Architecture>;
  requestApproval: (req: CheckpointRequest) => void;
}

export interface CheckpointRequest {
  type: string;
  title: string;
  description: string;
  riskLevel: "low" | "medium" | "high";
  context: { summary?: string[]; diff?: string; command?: string; affected?: string[] };
}

export interface CommandResult { stdout: string; exitCode: number; durationMs: number; }

export function createStepContext(project: Project, step: PlanStep, taskId: string, signal: AbortSignal): StepContext {
  const pid = project.id;
  const role = step.agent as AgentRole;
  const arch = project.architecture as Architecture;
  const stats: StepContext["stats"] = { toolCalls: 0, filesWritten: 0, commands: 0, commandList: [] };

  const ctx: StepContext = {
    project, arch, step, role, taskId, signal, stats,
    async log(kind, content, metadata) { await repo.logMessage(pid, role, kind, content, metadata); },
    async writeFile(path, content) {
      const r = await repo.upsertFile(pid, role, path, content);
      stats.filesWritten += 1;
      return r;
    },
    async writeFiles(files) {
      const written: string[] = [];
      for (const f of files) {
        if (signal.aborted) break;
        const r = await repo.upsertFile(pid, role, f.path, f.content);
        stats.filesWritten += 1;
        written.push(r.path);
      }
      if (written.length) {
        await ctx.log("file", `Wrote ${written.length} file${written.length === 1 ? "" : "s"}: ${written.slice(0, 4).map((p) => `\`${p}\``).join(", ")}${written.length > 4 ? ` +${written.length - 4} more` : ""}`, { count: written.length, paths: written });
      }
    },
    async readFile(path) {
      const f = await repo.readFile(pid, path);
      return f ? f.content : null;
    },
    async listFiles() { return repo.listFiles(pid); },
    async runCommand(command) {
      stats.commands += 1;
      stats.commandList.push(command);
      const result = await runVirtualCommand(pid, role, command);
      await repo.recordCommand(pid, role, command, result.stdout, result.exitCode, result.durationMs);
      return result;
    },
    async defineTable(name, columns, sqlText) {
      await repo.upsertTable(pid, snake(name), columns, sqlText, "defined");
      await ctx.log("tool", `Defined table ${snake(name)} (${columns.length} columns)`, { tool: "define_table" });
    },
    async setEnv(key, value, description, isSecret) {
      const r = await repo.setEnvVar(pid, key, value, description, isSecret, "agent");
      await ctx.log("tool", `${r.created ? "Added" : "Updated"} environment variable ${r.key}`, { tool: "set_env_var" });
    },
    async updateArchitecture(patch) {
      const [row] = await db.select({ architecture: projects.architecture }).from(projects).where(eq(projects.id, pid));
      const current = (row?.architecture ?? arch) as Architecture;
      const next: Architecture = {
        ...current,
        ...patch,
        entities: (patch.entities ?? current.entities).filter((e) => e && e.name && Array.isArray(e.fields)).map((e) => ({
          name: e.name, plural: e.plural || `${e.name}s`, slug: e.slug || snake(e.plural || `${e.name}s`).replace(/_/g, "-"),
          fields: e.fields.map((f) => ({ name: f.name, type: f.type || "string", required: f.required ?? true, enumValues: f.enumValues, references: f.references })),
        })),
      };
      await db.update(projects).set({ architecture: next, domainLabel: next.domainLabel, updatedAt: new Date() }).where(eq(projects.id, pid));
      ctx.arch = next;
      return next;
    },
    requestApproval(req) { stats.checkpointRequested = req; },
  };
  return ctx;
}

// ─── Virtual sandbox commands ───────────────────────────────────────────────

const ALLOWED_HINT = "Allowed: npm install, npm run lint, npx tsc --noEmit, npm test, npm run build, npx drizzle-kit push, npm run db:seed, docker build, ls, cat <path>.";

export async function runVirtualCommand(pid: string, role: string, rawCommand: string): Promise<CommandResult> {
  const started = Date.now();
  const command = rawCommand.trim().replace(/\s+/g, " ");
  const files = await repo.allFilesWithContent(pid);
  const vfiles = files.map((f) => ({ path: f.path, content: f.content }));
  const done = (stdout: string, exitCode = 0, syntheticMs = 0): CommandResult => ({ stdout, exitCode, durationMs: Date.now() - started + syntheticMs });
  const has = (p: string) => files.some((f) => f.path === p);

  if (/^(npm|pnpm|yarn|bun) (install|ci|i)\b/.test(command)) {
    const pkg = files.find((f) => f.path === "package.json");
    if (!pkg) return done("npm ERR! code ENOENT\nnpm ERR! Could not read package.json — scaffold the project first.", 1);
    try {
      const json = JSON.parse(pkg.content) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
      const n = Object.keys(json.dependencies ?? {}).length + Object.keys(json.devDependencies ?? {}).length;
      const total = 180 + n * 23;
      return done(`added ${total} packages, and audited ${total + 1} packages in ${(3 + n * 0.4).toFixed(0)}s\n\n${Math.round(total / 5)} packages are looking for funding\n\nfound 0 vulnerabilities`, 0, 4000);
    } catch (e) {
      return done(`npm ERR! JSON.parse ${(e as Error).message}\nnpm ERR! Failed to parse package.json`, 1);
    }
  }
  if (/\b(eslint|npm run lint|lint)\b/.test(command)) {
    const r = renderLintOutput(analyzeWorkspace(vfiles));
    return done(r.stdout, r.exitCode, 1800);
  }
  if (/\btsc\b|npm run typecheck|typecheck/.test(command)) {
    const r = renderTscOutput(analyzeWorkspace(vfiles));
    return done(r.stdout, r.exitCode, 3200);
  }
  if (/\b(vitest|jest|npm test|npm run test)\b/.test(command)) {
    const r = renderTestOutput(analyzeWorkspace(vfiles), vfiles);
    return done(r.stdout, r.exitCode, 2400);
  }
  if (/\b(next build|npm run build)\b/.test(command)) {
    const report = analyzeWorkspace(vfiles);
    if (report.errors.length) {
      return done(`> next build\n\n${report.errors.slice(0, 15).map((e) => `./${e.path}:${e.line}\n${e.message}`).join("\n\n")}\n\nFailed to compile.`, 1, 6000);
    }
    const routes = files.filter((f) => /^src\/app\/.*(page|route)\.tsx?$/.test(f.path)).map((f) => "/" + f.path.replace(/^src\/app\//, "").replace(/\/?(page|route)\.tsx?$/, "").replace(/\/$/, ""));
    return done(`> next build\n\n ✓ Compiled successfully\n ✓ Linting and checking validity of types\n ✓ Collecting page data\n ✓ Generating static pages\n\nRoute (app)\n${routes.map((r) => `  ƒ ${r || "/"}`).join("\n")}\n\n○  (Static)  ƒ  (Dynamic)`, 0, 18000);
  }
  if (/drizzle-kit (push|generate|migrate)/.test(command)) {
    if (!has("src/db/schema.ts")) return done("Error: schema file 'src/db/schema.ts' not found. Define the schema before migrating.", 1);
    const tables = await db.select().from(dbTables).where(eq(dbTables.projectId, pid));
    if (!tables.length) return done("No tables defined. Use define_table to register tables before pushing.", 1);
    await db.update(dbTables).set({ status: "created", updatedAt: new Date() }).where(and(eq(dbTables.projectId, pid), eq(dbTables.status, "defined")));
    return done(`Reading config file 'drizzle.config.ts'\nPulling schema from database...\n${tables.map((t) => `[✓] CREATE TABLE "${t.name}"`).join("\n")}\n\n[✓] Changes applied`, 0, 3100);
  }
  if (/db:seed|seed\.ts|tsx .*seed/.test(command)) {
    const tables = await db.select().from(dbTables).where(eq(dbTables.projectId, pid));
    if (!tables.length) return done("Nothing to seed — no tables have been created.", 1);
    const lines: string[] = [];
    for (const [i, t] of tables.entries()) {
      const rows = 3 + ((i * 7 + pid.length) % 12);
      await db.update(dbTables).set({ status: "seeded", rowCount: rows, updatedAt: new Date() }).where(eq(dbTables.id, t.id));
      lines.push(`  ✔ ${t.name}: ${rows} rows`);
    }
    return done(`> tsx src/db/seed.ts\n\n${lines.join("\n")}\n\n✔ Seeded ${tables.length} tables`, 0, 1400);
  }
  if (/^docker build/.test(command)) {
    if (!has("Dockerfile")) return done("ERROR: failed to solve: failed to read dockerfile: open Dockerfile: no such file or directory", 1);
    const size = 120 + Math.round(files.reduce((a, f) => a + f.size, 0) / 4096);
    return done(`[+] Building 24.1s (14/14) FINISHED\n => [internal] load build definition from Dockerfile\n => [deps 1/3] COPY package.json package-lock.json ./\n => [deps 2/3] RUN npm ci\n => [builder 2/3] RUN npm run build\n => [runner 3/3] COPY --from=builder /app/.next/standalone ./\n => exporting to image\n\nIMAGE       SIZE\napp:latest  ${size} MB`, 0, 24000);
  }
  if (/^ls\b/.test(command) || /^find\b/.test(command) || /^tree\b/.test(command)) {
    return done(files.map((f) => f.path).join("\n") || "(empty workspace)");
  }
  if (/^cat /.test(command)) {
    const p = repo.normalizePath(command.slice(4));
    const f = files.find((x) => x.path === p);
    return f ? done(f.content.slice(0, 12000)) : done(`cat: ${p}: No such file or directory`, 1);
  }
  if (/^(git|mkdir|touch|echo|chmod|cd)\b/.test(command)) {
    return done(""); // harmless no-ops in the virtual workspace
  }
  return done(`sh: ${command.split(" ")[0]}: command not available in the sandbox. ${ALLOWED_HINT}`, 127);
}

// ─── Tools exposed to LLM agents ────────────────────────────────────────────

const columnSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1).describe("Postgres type, e.g. text, integer, numeric(12,2), boolean, timestamptz, jsonb"),
  nullable: z.boolean().default(false),
  isPrimary: z.boolean().optional(),
  references: z.string().optional().describe("table.column this column references, if a foreign key"),
  defaultValue: z.string().optional(),
});

export function createAgentTools(ctx: StepContext): ToolSet {
  const count = () => { ctx.stats.toolCalls += 1; };
  const tools: ToolSet = {
    write_file: tool({
      description: "Create or overwrite a file in the project workspace. Always write COMPLETE file contents (no placeholders, no markdown fences). Paths are relative to the repo root, e.g. src/app/api/items/route.ts",
      inputSchema: z.object({ path: z.string().min(1), content: z.string() }),
      execute: async ({ path, content }) => {
        count();
        if (/^\s*```/.test(content)) content = content.replace(/^\s*```[a-z]*\n/, "").replace(/\n```\s*$/, "");
        const r = await ctx.writeFile(path, content);
        return { ok: true, path: r.path, version: r.version, bytes: Buffer.byteLength(content, "utf8"), created: r.created };
      },
    }),
    read_file: tool({
      description: "Read a file from the workspace. Use before modifying an existing file.",
      inputSchema: z.object({ path: z.string().min(1) }),
      execute: async ({ path }) => {
        count();
        const content = await ctx.readFile(path);
        if (content === null) return { ok: false, error: `File not found: ${path}` };
        return { ok: true, path, content: content.length > 30_000 ? content.slice(0, 30_000) + "\n… (truncated)" : content };
      },
    }),
    list_files: tool({
      description: "List all files currently in the workspace, optionally filtered by a path prefix.",
      inputSchema: z.object({ prefix: z.string().optional() }),
      execute: async ({ prefix }) => {
        count();
        const files = await ctx.listFiles();
        const list = prefix ? files.filter((f) => f.path.startsWith(prefix)) : files;
        return { ok: true, count: list.length, files: list.slice(0, 400).map((f) => `${f.path} (${f.size}b)`) };
      },
    }),
    delete_file: tool({
      description: "Delete a file from the workspace.",
      inputSchema: z.object({ path: z.string().min(1) }),
      execute: async ({ path }) => {
        count();
        const ok = await repo.deleteFile(ctx.project.id, path);
        await ctx.log("tool", `Deleted ${path}`, { tool: "delete_file" });
        return { ok };
      },
    }),
    run_command: tool({
      description: `Run a shell command in the sandboxed workspace and get its output. ${ALLOWED_HINT}`,
      inputSchema: z.object({ command: z.string().min(1) }),
      execute: async ({ command }) => {
        count();
        const r = await ctx.runCommand(command);
        await ctx.log("tool", `$ ${command} → exit ${r.exitCode}`, { tool: "run_command", exitCode: r.exitCode });
        return { exitCode: r.exitCode, stdout: r.stdout.slice(0, 8000) };
      },
    }),
    define_table: tool({
      description: "Register a database table (name + columns + CREATE TABLE SQL) so it appears in the Database tab and can be migrated. Call once per table.",
      inputSchema: z.object({ name: z.string().min(1).describe("snake_case table name"), columns: z.array(columnSchema).min(1), sql: z.string().optional() }),
      execute: async ({ name, columns, sql: sqlText }) => {
        count();
        await ctx.defineTable(name, columns, sqlText ?? null);
        return { ok: true, table: snake(name), columns: columns.length };
      },
    }),
    set_env_var: tool({
      description: "Declare an environment variable the generated app needs (with a safe placeholder value for secrets).",
      inputSchema: z.object({ key: z.string().min(1), value: z.string(), description: z.string(), isSecret: z.boolean().default(false) }),
      execute: async ({ key, value, description, isSecret }) => {
        count();
        await ctx.setEnv(key, isSecret ? maskSecret(value) : value, description, isSecret);
        return { ok: true };
      },
    }),
    complete_task: tool({
      description: "Call this exactly once when the task is finished, with a short summary of what was done. Do not call before acceptance criteria are met.",
      inputSchema: z.object({ summary: z.string().min(1) }),
      execute: async ({ summary }) => {
        count();
        ctx.stats.taskSummary = summary;
        return { ok: true };
      },
    }),
  };

  if (ctx.role === "orchestrator" || ctx.role === "architect") {
    tools.update_architecture = tool({
      description: "Refine the project architecture: entities (with typed fields), features, components, data flow, overview and domain label. Replaces the provided sections wholesale.",
      inputSchema: z.object({
        overview: z.string().optional(),
        domainLabel: z.string().optional(),
        features: z.array(z.string()).optional(),
        entities: z.array(z.object({
          name: z.string().describe("Singular PascalCase, e.g. Invoice"),
          plural: z.string().optional(),
          slug: z.string().optional(),
          fields: z.array(z.object({
            name: z.string(), type: z.string().describe("string | text | int | decimal | boolean | date | datetime | enum | reference | json"),
            required: z.boolean().optional(), enumValues: z.array(z.string()).optional(), references: z.string().optional(),
          })),
        })).optional(),
        components: z.array(z.object({ name: z.string(), type: z.string(), description: z.string(), dependencies: z.array(z.string()) })).optional(),
        dataFlow: z.array(z.string()).optional(),
      }),
      execute: async (patch) => {
        count();
        const next = await ctx.updateArchitecture(patch as Partial<Architecture>);
        await ctx.log("tool", `Architecture updated — ${next.entities.length} entities, ${next.features.length} features`, { tool: "update_architecture" });
        return { ok: true, entities: next.entities.map((e) => e.name) };
      },
    });
  }
  if (ctx.role === "database" || ctx.role === "devops") {
    tools.request_approval = tool({
      description: "Request human approval for a risky action (schema migration, production deploy). The pipeline pauses until a human decides.",
      inputSchema: z.object({
        type: z.enum(["schema", "deploy", "secrets", "destructive"]),
        title: z.string(), description: z.string(), riskLevel: z.enum(["low", "medium", "high"]),
        summary: z.array(z.string()).optional(), command: z.string().optional(), affected: z.array(z.string()).optional(), diff: z.string().optional(),
      }),
      execute: async ({ type, title, description, riskLevel, summary, command, affected, diff }) => {
        count();
        ctx.requestApproval({ type, title, description, riskLevel, context: { summary, command, affected, diff } });
        return { ok: true, note: "Approval request recorded; it will be raised when the task completes." };
      },
    });
  }
  return tools;
}

function maskSecret(v: string): string {
  if (!v) return "••••••••";
  if (/^(sk-|pk_|whsec_|ghp_|xox)/.test(v) || v.length > 24) return v.slice(0, 4) + "••••••••";
  return v;
}

// ─── Prompts ────────────────────────────────────────────────────────────────

export interface StepSpec {
  /** Detailed instructions for the LLM. */
  instructions: string;
  /** Machine-checked acceptance criteria evaluated after the agent finishes. */
  verify: (v: { files: Array<{ path: string }>; tables: number; env: number; commands: string[]; arch: Architecture }) => string[];
  /** Project status after this step. */
  statusAfter: Project["status"];
  contextFiles?: string[];
}

export const STEP_SPECS: Record<string, StepSpec> = {
  analyze: {
    statusAfter: "planning",
    instructions: `Read the product brief carefully. Produce a refined architecture using update_architecture: 4-8 entities with realistic typed fields (include status enums, foreign keys via "reference" type + references, money as decimal, timestamps as datetime), 5-8 concrete features, and a 2-3 sentence overview. Every entity must include a "User" entity if the app has accounts. Then call complete_task with a summary of the domain and key decisions.`,
    verify: ({ arch }) => (arch.entities.length >= 2 ? [] : ["architecture must define at least 2 entities"]),
  },
  plan: {
    statusAfter: "generating",
    instructions: `Write docs/PLAN.md: a dependency-ordered build plan mapping each of the 14 pipeline steps to concrete deliverables (file paths, tables, endpoints, pages) for THIS product. Include a risk section (auth, data integrity, migrations) and an acceptance checklist. Then call complete_task.`,
    verify: ({ files }) => (files.some((f) => f.path === "docs/PLAN.md") ? [] : ["docs/PLAN.md must exist"]),
  },
  architecture: {
    statusAfter: "building",
    instructions: `Write docs/ARCHITECTURE.md covering: system context, component diagram (mermaid), folder layout, data model (all entities and relations), REST API contract table (method, path, body, response, auth), auth & RBAC strategy, and error-handling conventions. Optionally refine components/dataFlow via update_architecture. Then call complete_task.`,
    verify: ({ files }) => (files.some((f) => f.path === "docs/ARCHITECTURE.md") ? [] : ["docs/ARCHITECTURE.md must exist"]),
  },
  scaffold: {
    statusAfter: "building",
    instructions: `Scaffold a production Next.js 15 (App Router) + TypeScript + Tailwind v4 + Drizzle/PostgreSQL project. Write: package.json (scripts: dev, build, start, lint, typecheck, test, db:push, db:seed; deps: next, react, react-dom, drizzle-orm, pg, zod, bcryptjs; devDeps: typescript, @types/*, drizzle-kit, tailwindcss, @tailwindcss/postcss, postcss, vitest, eslint), tsconfig.json (paths @/* -> src/*), next.config.ts, postcss.config.mjs, drizzle.config.ts, .env.example, .gitignore, README.md, src/app/globals.css, src/app/layout.tsx, src/app/page.tsx (redirect to /dashboard), src/lib/utils.ts. Then run "npm install" and call complete_task.`,
    verify: ({ files, commands }) => {
      const need = ["package.json", "src/app/layout.tsx", "tsconfig.json"];
      const missing = need.filter((p) => !files.some((f) => f.path === p)).map((p) => `${p} must exist`);
      if (!commands.some((c) => /npm (install|ci|i)\b/.test(c))) missing.push("run `npm install` after writing package.json");
      return missing;
    },
  },
  schema: {
    statusAfter: "building",
    instructions: `Design the PostgreSQL schema for ALL entities in the architecture. Write src/db/index.ts (pg Pool + drizzle), src/db/schema.ts (pgTable per entity with id text primary key, timestamps, pgEnum for enum fields, foreign keys with references(), and $inferSelect types) and src/db/seed.ts (realistic fixtures, idempotent). For EVERY table call define_table with its columns and CREATE TABLE SQL. Finally call request_approval (type "schema", riskLevel "medium") with the SQL diff and affected tables, then complete_task.`,
    verify: ({ files, tables, arch }) => {
      const out: string[] = [];
      if (!files.some((f) => f.path === "src/db/schema.ts")) out.push("src/db/schema.ts must exist");
      if (tables < Math.min(2, arch.entities.length)) out.push(`define_table must be called for each entity (${tables}/${arch.entities.length} registered)`);
      return out;
    },
    contextFiles: ["docs/ARCHITECTURE.md"],
  },
  migrate: {
    statusAfter: "building",
    instructions: `Apply the schema: run "npx drizzle-kit push", then "npm run db:seed". If either fails, fix the cause (schema file or seed) and re-run. Then call complete_task with the row counts.`,
    verify: ({ commands }) => {
      const out: string[] = [];
      if (!commands.some((c) => /drizzle-kit push/.test(c))) out.push("must run `npx drizzle-kit push`");
      if (!commands.some((c) => /db:seed|seed/.test(c))) out.push("must run `npm run db:seed`");
      return out;
    },
    contextFiles: ["src/db/schema.ts"],
  },
  auth: {
    statusAfter: "building",
    instructions: `Implement authentication and configuration: src/lib/auth.ts (bcryptjs password hashing, HMAC-signed session cookie via next/headers, getSession(), requireRole()), src/app/api/auth/login/route.ts, src/app/api/auth/logout/route.ts, src/app/api/health/route.ts (checks DB with SELECT 1), src/middleware.ts protecting /dashboard and /api except auth/health. Declare env vars with set_env_var: DATABASE_URL, SESSION_SECRET (secret), NEXT_PUBLIC_APP_URL, plus any integration keys the features require. Then complete_task.`,
    verify: ({ files, env }) => {
      const out: string[] = [];
      if (!files.some((f) => f.path === "src/lib/auth.ts")) out.push("src/lib/auth.ts must exist");
      if (!files.some((f) => f.path.startsWith("src/app/api/health/"))) out.push("src/app/api/health/route.ts must exist");
      if (env < 2) out.push("declare at least DATABASE_URL and SESSION_SECRET via set_env_var");
      return out;
    },
    contextFiles: ["src/db/schema.ts"],
  },
  api: {
    statusAfter: "building",
    instructions: `Generate the REST API for every non-User entity: src/lib/validators/<entity>.ts (zod create/update schemas), src/app/api/<plural>/route.ts (GET list with ?page&pageSize&q filters + POST create) and src/app/api/<plural>/[id]/route.ts (GET, PATCH, DELETE). Use requireRole for auth, return consistent JSON errors { error, issues? }, 404 on missing rows, and paginate via { data, page, pageSize, total }. Import the db and schema from @/db and @/db/schema — read src/db/schema.ts first to use exact export names. Then complete_task.`,
    verify: ({ files, arch }) => {
      const routes = files.filter((f) => /^src\/app\/api\/.+\/route\.ts$/.test(f.path) && !f.path.includes("/auth/") && !f.path.includes("/health/"));
      const needed = Math.max(1, arch.entities.filter((e) => e.name !== "User").length);
      return routes.length >= needed ? [] : [`expected at least ${needed} resource route files under src/app/api (found ${routes.length})`];
    },
    contextFiles: ["src/db/schema.ts", "src/lib/auth.ts"],
  },
  shell: {
    statusAfter: "building",
    instructions: `Build the application shell: src/components/AppShell.tsx (sidebar nav with one link per entity + dashboard, top bar with user menu), src/components/DataTable.tsx (generic typed table with empty state), src/components/StatCard.tsx, src/app/dashboard/layout.tsx wrapping AppShell, and src/app/dashboard/page.tsx (KPI cards computed from the DB via drizzle count queries + recent items). Server components by default; add "use client" only where hooks are used. Then complete_task.`,
    verify: ({ files }) => {
      const out: string[] = [];
      if (!files.some((f) => /^src\/components\/AppShell\.tsx$/.test(f.path))) out.push("src/components/AppShell.tsx must exist");
      if (!files.some((f) => f.path === "src/app/dashboard/page.tsx")) out.push("src/app/dashboard/page.tsx must exist");
      return out;
    },
    contextFiles: ["src/db/schema.ts", "src/app/layout.tsx"],
  },
  pages: {
    statusAfter: "testing",
    instructions: `For every non-User entity create src/app/dashboard/<plural>/page.tsx (server component: list with DataTable, search param q, pagination, link to new) and src/app/dashboard/<plural>/new/page.tsx (client form posting to the API with loading/error states and field validation messages). Read the validators to mirror fields. Then complete_task.`,
    verify: ({ files, arch }) => {
      const pages = files.filter((f) => /^src\/app\/dashboard\/[^/]+\/page\.tsx$/.test(f.path));
      const needed = Math.max(1, arch.entities.filter((e) => e.name !== "User").length);
      return pages.length >= needed ? [] : [`expected at least ${needed} resource list pages under src/app/dashboard/*/page.tsx (found ${pages.length})`];
    },
    contextFiles: ["src/components/DataTable.tsx", "src/db/schema.ts"],
  },
  "write-tests": {
    statusAfter: "testing",
    instructions: `Write vitest.config.ts and unit tests: one src/lib/validators/<entity>.test.ts per validator (valid + invalid payloads), src/lib/auth.test.ts (hash/verify + session sign/verify), and src/app/api/health/route.test.ts (mock db). Use describe/it/expect from vitest. Then complete_task.`,
    verify: ({ files }) => (files.filter((f) => /\.test\.tsx?$/.test(f.path)).length >= 2 ? [] : ["write at least two *.test.ts files"]),
    contextFiles: ["src/lib/auth.ts"],
  },
  "run-tests": {
    statusAfter: "deploying",
    instructions: `Run the quality gate: "npm run lint", "npx tsc --noEmit", "npm test". If anything fails, read the offending files, fix them with write_file and re-run until green (max 4 rounds). Then complete_task with the pass/fail summary.`,
    verify: ({ commands }) => (commands.some((c) => /tsc|lint|test/.test(c)) ? [] : ["must run lint/tsc/test commands"]),
  },
  containerize: {
    statusAfter: "deploying",
    instructions: `Write Dockerfile (multi-stage, node:20-alpine, standalone output, non-root user, HEALTHCHECK on /api/health), .dockerignore, docker-compose.yml (app + postgres 16 with healthcheck and volume) and .github/workflows/ci.yml (install, lint, typecheck, test, build with a postgres service). Then run "docker build -t app:latest ." and complete_task.`,
    verify: ({ files, commands }) => {
      const out: string[] = [];
      if (!files.some((f) => f.path === "Dockerfile")) out.push("Dockerfile must exist");
      if (!files.some((f) => f.path.startsWith(".github/workflows/"))) out.push(".github/workflows/ci.yml must exist");
      if (!commands.some((c) => /^docker build/.test(c))) out.push("run `docker build -t app:latest .`");
      return out;
    },
  },
  deploy: {
    statusAfter: "completed",
    instructions: `Prepare the release: write docs/DEPLOY.md (env checklist, migration order, rollback plan) and call request_approval with type "deploy", riskLevel "high", a summary of the exact actions (push image, run migrations, flip traffic) and affected systems. Then complete_task.`,
    verify: ({ files }) => (files.some((f) => f.path === "docs/DEPLOY.md") ? [] : ["docs/DEPLOY.md must exist"]),
  },
};

export function systemPromptFor(ctx: StepContext, modelId: string): string {
  const a = AGENTS[ctx.role];
  return [
    `You are ${a.name} (${a.emoji}), a specialist agent in Forge — an autonomous multi-agent system that generates production-grade full-stack applications.`,
    `Role: ${a.tagline}. ${a.description}`,
    `You are running as model ${modelId}. You work inside a virtual workspace via tools; you cannot access the network.`,
    ``,
    `# Engineering standards`,
    `- Stack: Next.js 15 App Router, TypeScript strict, Tailwind CSS v4, Drizzle ORM + PostgreSQL, Zod validation, vitest.`,
    `- Write complete, compilable files. Never emit markdown fences or placeholders like "// ..." inside files.`,
    `- Keep imports consistent: alias "@/..." maps to "src/...". Only import files that exist (use list_files/read_file to check).`,
    `- Prefer small, focused files. Use server components by default; add "use client" only when hooks/events are needed.`,
    `- Handle errors explicitly; validate all external input with Zod; never leak secrets.`,
    `- When done, call complete_task exactly once. Do not narrate; act with tools.`,
  ].join("\n");
}

export function userPromptFor(ctx: StepContext, spec: StepSpec, extra: { fileTree: string[]; contextFiles: Array<{ path: string; content: string }>; feedback?: string; priorSummaries: string[] }): string {
  const arch = ctx.arch;
  const entities = arch.entities.map((e) => `- ${e.name} (${e.plural}): ${e.fields.map((f) => `${f.name}:${f.type}${f.required === false ? "?" : ""}${f.enumValues ? `[${f.enumValues.join("|")}]` : ""}${f.references ? `→${f.references}` : ""}`).join(", ")}`).join("\n");
  const parts = [
    `# Product brief`,
    ctx.project.prompt,
    ``,
    `# Project`,
    `Name: ${ctx.project.name} · Mode: ${ctx.project.mode} · Domain: ${arch.domainLabel}`,
    `Overview: ${arch.overview}`,
    `Features: ${arch.features.join("; ")}`,
    `Entities:\n${entities}`,
    ``,
    `# Current task (step ${ctx.step.index + 1}/${ctx.project.totalSteps}): ${ctx.step.title}`,
    ctx.step.description,
    ``,
    `# Instructions`,
    spec.instructions,
  ];
  if (extra.priorSummaries.length) parts.push(``, `# Completed so far`, ...extra.priorSummaries.map((s) => `- ${s}`));
  parts.push(``, `# Workspace files (${extra.fileTree.length})`, extra.fileTree.length ? extra.fileTree.slice(0, 250).join("\n") : "(empty)");
  for (const f of extra.contextFiles) {
    parts.push(``, `# Reference: ${f.path}`, "```", f.content.length > 14_000 ? f.content.slice(0, 14_000) + "\n… (truncated — use read_file for the rest)" : f.content, "```");
  }
  if (extra.feedback) parts.push(``, `# ⚠️ Previous attempt was rejected by verification`, extra.feedback, `Fix these issues now; do not repeat work that already satisfied the criteria.`);
  return parts.join("\n");
}

export async function tablesCount(pid: string): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(dbTables).where(eq(dbTables.projectId, pid));
  return r?.n ?? 0;
}
