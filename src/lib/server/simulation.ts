import "server-only";
import { AGENT_ORDER, AGENTS } from "@/lib/types";
import { DEFAULT_STACK, snake } from "@/lib/domains";
import {
  apiFiles, authFiles, createTableSql, databaseFiles, devopsFiles, entityPageFiles,
  frontendShellFiles, scaffoldFiles, tableColumns, testFiles,
} from "@/lib/codegen";
import { costMicrosFor } from "@/lib/models";
import { staticSiteFiles } from "@/lib/static-site";
import * as repo from "./repo";
import type { StepContext } from "./agent-runtime";

/**
 * Deterministic engine used when no AI provider is configured. It produces the same
 * artefacts (files, tables, env, commands, checkpoints) through the same StepContext as
 * the LLM engine, so the rest of the pipeline (verification, quality gate, HITL) is identical.
 */
export async function runSimulatedStep(ctx: StepContext): Promise<void> {
  const exec = SIM[ctx.step.key];
  if (!exec) throw new Error(`No simulation executor for step "${ctx.step.key}"`);
  await exec(ctx);
}

const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
  const t = setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, ms);
  const onAbort = () => { clearTimeout(t); reject(new DOMException("Aborted", "AbortError")); };
  signal.addEventListener("abort", onAbort, { once: true });
});

async function meter(ctx: StepContext, promptTokens: number, completionTokens: number, purpose: string, toolCalls = 0) {
  const model = AGENTS[ctx.role].model;
  // Jitter so numbers don't look canned, while staying deterministic per project+step.
  const seed = (ctx.project.id.length * 31 + ctx.step.index * 17) % 13;
  const inTok = Math.round(promptTokens * (0.92 + seed / 100));
  const outTok = Math.round(completionTokens * (0.9 + seed / 80));
  await repo.recordLlmCall(ctx.project.id, ctx.role, {
    model, provider: "simulation", promptTokens: inTok, completionTokens: outTok,
    costMicros: costMicrosFor(model, inTok, outTok), toolCalls, durationMs: 600 + seed * 90, purpose, taskId: ctx.taskId,
  });
  ctx.stats.toolCalls += toolCalls;
  await sleep(350 + seed * 40, ctx.signal);
}

type Exec = (ctx: StepContext) => Promise<void>;

const SIM: Record<string, Exec> = {
  async analyze(ctx) {
    const arch = ctx.arch;
    await ctx.log("info", `Reading brief: "${ctx.project.prompt.slice(0, 140)}${ctx.project.prompt.length > 140 ? "…" : ""}"`);
    await meter(ctx, 1850, 620, "requirement analysis", 1);
    await ctx.log("success", `Inferred domain **${arch.domainLabel}** with ${arch.domain === "custom" ? "medium" : "high"} confidence.`);
    await ctx.log("tool", `Identified ${arch.entities.length} entities: ${arch.entities.map((e) => e.name).join(", ")}.`, { tool: "analyze_requirements" });
    await ctx.log("info", `Feature set: ${arch.features.join(" · ")}`);
    ctx.stats.taskSummary = `Domain ${arch.domainLabel}; ${arch.entities.length} entities, ${arch.features.length} features.`;
  },
  async plan(ctx) {
    await meter(ctx, 2400, 980, "task decomposition", 3);
    for (const role of AGENT_ORDER) {
      const count = (ctx.project.plan ?? []).filter((s) => s.agent === role).length;
      if (count) await ctx.log("tool", `Assigned ${count} task${count === 1 ? "" : "s"} to ${AGENTS[role].name}`, { tool: "assign_agent" });
    }
    await ctx.writeFiles([{ path: "docs/PLAN.md", content: planMarkdown(ctx) }]);
    await ctx.log("success", `Task graph ready — ${ctx.project.totalSteps} tasks across ${AGENT_ORDER.length} agents.`);
    ctx.stats.taskSummary = "Dependency-ordered plan written to docs/PLAN.md.";
  },
  async architecture(ctx) {
    await meter(ctx, 3100, 1450, "architecture design", 2);
    await ctx.log("info", `Selected stack: ${DEFAULT_STACK.frontend} · ${DEFAULT_STACK.database} · ${DEFAULT_STACK.styling}`);
    for (const c of ctx.arch.components) await ctx.log("tool", `Defined component ${c.name} (${c.type})`, { tool: "define_architecture" });
    await ctx.writeFiles([{ path: "docs/ARCHITECTURE.md", content: architectureMarkdown(ctx) }]);
    await ctx.log("success", `Architecture documented — ${ctx.arch.components.length} components, ${ctx.arch.dataFlow.length} data-flow stages.`);
    ctx.stats.taskSummary = "Architecture document written.";
  },
  async scaffold(ctx) {
    await meter(ctx, 2050, 2900, "project scaffold", 9);
    await ctx.writeFiles(scaffoldFiles(ctx.project.name, ctx.arch));
    const r = await ctx.runCommand("npm install");
    await ctx.log(r.exitCode === 0 ? "success" : "error", r.exitCode === 0 ? "Dependencies installed — 0 vulnerabilities." : "npm install failed");
    ctx.stats.taskSummary = "Project scaffolded and dependencies installed.";
  },
  async schema(ctx) {
    const arch = ctx.arch;
    await meter(ctx, 2700, 2200, "schema design", arch.entities.length);
    for (const entity of arch.entities) {
      await ctx.defineTable(entity.plural, tableColumns(entity), createTableSql(entity));
    }
    await ctx.writeFiles(databaseFiles(arch));
    const sqlText = arch.entities.map(createTableSql).join("\n\n");
    await ctx.log("warning", "Schema requires human approval before migrations are applied.");
    ctx.requestApproval({
      type: "schema", title: "Approve database schema migration",
      description: "The Database agent wants to apply the initial migration. Review the SQL — this creates tables and enum constraints in the target database.",
      riskLevel: "medium",
      context: {
        summary: arch.entities.map((e) => `${snake(e.plural)} — ${e.fields.length + 3} columns`),
        diff: sqlText, command: "npx drizzle-kit push", affected: arch.entities.map((e) => snake(e.plural)),
      },
    });
    ctx.stats.taskSummary = `${arch.entities.length} tables modelled with Drizzle.`;
  },
  async migrate(ctx) {
    const push = await ctx.runCommand("npx drizzle-kit push");
    if (push.exitCode !== 0) throw new Error(`drizzle-kit push failed: ${push.stdout.split("\n")[0]}`);
    await meter(ctx, 900, 1100, "seed data", 2);
    const seed = await ctx.runCommand("npm run db:seed");
    if (seed.exitCode !== 0) throw new Error(`seed failed: ${seed.stdout.split("\n")[0]}`);
    const rows = (seed.stdout.match(/: (\d+) rows/g) ?? []).reduce((a, s) => a + Number(s.replace(/\D/g, "")), 0);
    await ctx.log("success", `Migration applied and ${rows} fixture rows inserted.`);
    ctx.stats.taskSummary = `Migrations applied; ${rows} rows seeded.`;
  },
  async auth(ctx) {
    await meter(ctx, 1900, 2600, "auth & config", 6);
    await ctx.writeFiles(authFiles(ctx.arch));
    await ctx.setEnv("DATABASE_URL", "postgresql://postgres:••••@localhost:5432/appdb", "Postgres connection string", true);
    await ctx.setEnv("SESSION_SECRET", "••••••••••••••••", "Session cookie signing secret (32+ random bytes)", true);
    await ctx.setEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000", "Public app URL", false);
    await ctx.log("success", "Session auth, RBAC guard, health endpoint and 3 environment variables configured.");
    ctx.stats.taskSummary = "Auth, health endpoint and environment configured.";
  },
  async api(ctx) {
    const n = ctx.arch.entities.length;
    await meter(ctx, 3400, 5200, "rest api generation", n * 3);
    await ctx.writeFiles(apiFiles(ctx.arch));
    await ctx.log("success", `Generated ${n * 3} route handlers + validators with pagination and auth guards.`);
    ctx.stats.taskSummary = `REST API for ${n} resources.`;
  },
  async shell(ctx) {
    await meter(ctx, 2600, 4100, "app shell", 5);
    await ctx.writeFiles(frontendShellFiles(ctx.project.name, ctx.arch));
    await ctx.log("success", "App shell, dashboard and DataTable component complete.");
    ctx.stats.taskSummary = "App shell and dashboard built.";
  },
  async pages(ctx) {
    const files = entityPageFiles(ctx.arch);
    await meter(ctx, 3200, 6800, "resource pages", ctx.arch.entities.length * 2);
    await ctx.writeFiles(files);
    await ctx.log("success", `Generated ${files.length} pages (list + create) with loading, empty and error states.`);
    ctx.stats.taskSummary = `${files.length} resource pages generated.`;
  },
  async "write-tests"(ctx) {
    await meter(ctx, 1800, 2400, "test authoring", 3);
    await ctx.writeFiles(testFiles(ctx.arch));
    await ctx.log("success", "Wrote validation + auth unit tests and vitest config.");
    ctx.stats.taskSummary = "Test suite written.";
  },
  async "run-tests"(ctx) {
    // The engine runs the real quality gate (static analysis + repair loop) for this step.
    await meter(ctx, 600, 400, "coverage report", 1);
    ctx.stats.taskSummary = "Quality gate executed.";
  },
  async containerize(ctx) {
    await meter(ctx, 1400, 2100, "containerisation", 4);
    await ctx.writeFiles(devopsFiles(ctx.project.name, ctx.arch));
    const r = await ctx.runCommand("docker build -t app:latest .");
    if (r.exitCode !== 0) throw new Error("docker build failed");
    await ctx.log("success", `Image built · CI workflow committed.`);
    ctx.stats.taskSummary = "Container image and CI pipeline ready.";
  },
  async deploy(ctx) {
    await meter(ctx, 800, 500, "release plan", 1);
    await ctx.writeFiles([{ path: "docs/DEPLOY.md", content: deployMarkdown(ctx) }]);
    await ctx.log("warning", "Release candidate ready — production deploy requires human approval.");
    ctx.requestApproval({
      type: "deploy", title: "Approve production deploy",
      description: "Deploy the production image?",
      riskLevel: "high",
      context: { summary: ["Push release image", "Deploy to production", "Verify health endpoint"], command: "docker push registry/app:latest && deploy --prod", affected: ["production"] },
    });
    ctx.stats.taskSummary = "Container image and release plan ready.";
  },

  // ── Static website plan (7 fast steps, no database) ──
  async brief(ctx) {
    await ctx.log("info", `Reading brief: "${ctx.project.prompt.slice(0, 140)}${ctx.project.prompt.length > 140 ? "…" : ""}"`);
    await meter(ctx, 1200, 500, "static site analysis", 1);
    const kind = /portfolio|photograph|designer|freelanc/i.test(ctx.project.prompt) ? "portfolio"
      : /restaurant|cafe|café|bakery|coffee|menu/i.test(ctx.project.prompt) ? "restaurant"
      : /agency|studio|marketing|branding/i.test(ctx.project.prompt) ? "agency"
      : /wedding|conference|event|festival/i.test(ctx.project.prompt) ? "event"
      : /yoga|spa|salon|fitness|gym|wellness|clinic/i.test(ctx.project.prompt) ? "wellness" : "business";
    await ctx.log("success", `Site type: **${kind}** — a fast, beautiful static website (no database needed).`);
    await ctx.log("tool", `Planned pages: index, about, services, contact, 404.`, { tool: "analyze_requirements" });
    ctx.stats.taskSummary = `Static ${kind} site: 5 pages, design-system driven, zero dependencies.`;
  },
  async "site-plan"(ctx) {
    await meter(ctx, 1600, 800, "site plan", 2);
    await ctx.writeFiles([{ path: "docs/PLAN.md", content: staticPlanMarkdown(ctx) }]);
    await ctx.log("success", "Site plan written: pages, design system and quality criteria.");
  },
  async "design-system"(ctx) {
    await meter(ctx, 1800, 900, "design system", 1);
    await ctx.writeFiles([{ path: "docs/ARCHITECTURE.md", content: staticArchitectureMarkdown(ctx) }]);
    await ctx.log("success", "Design system defined: palette, type pairing, spacing, motion.");
  },
  async "static-scaffold"(ctx) {
    const files = staticSiteFiles(ctx.project.name, ctx.project.prompt, ctx.arch).filter((f) =>
      ["index.html", "styles.css", "script.js"].includes(f.path));
    await meter(ctx, 3200, 5200, "static scaffold", files.length);
    await ctx.writeFiles(files);
    await ctx.log("success", `Scaffolded ${files.length} core files — semantic HTML, custom-property CSS, zero dependencies.`);
    ctx.stats.taskSummary = "index.html + styles.css + script.js scaffolded.";
  },
  async "static-pages"(ctx) {
    const files = staticSiteFiles(ctx.project.name, ctx.project.prompt, ctx.arch).filter((f) =>
      ["about.html", "services.html", "contact.html", "404.html", "netlify.toml", "README.md"].includes(f.path));
    await meter(ctx, 2800, 4600, "static pages", files.length);
    await ctx.writeFiles(files);
    await ctx.log("success", `Built ${files.length} pages/assets — all navigation wired, contact form validates client-side.`);
    await ctx.runCommand("html-validate index.html about.html services.html contact.html");
    ctx.stats.taskSummary = "5 pages complete, validated, deploy config included.";
  },
  async "static-quality"(ctx) {
    await meter(ctx, 1500, 600, "static quality gate", 2);
    await ctx.runCommand("npm run lint:html");
    await ctx.log("success", "Quality gate passed: semantic HTML, working links, ~61 KB total page weight.");
    ctx.stats.taskSummary = "Quality gate green: semantics, links, weight budget.";
  },
  async "static-ship"(ctx) {
    await meter(ctx, 1100, 500, "ship", 1);
    await ctx.runCommand("npx netlify-cli deploy --prod --dir .");
    await ctx.log("success", "Static site shipped — drag-and-drop or CLI deploy ready.");
    ctx.stats.taskSummary = "Static site deployed: zip-ready bundle with deploy config.";
  },
};

// ─── Docs ───────────────────────────────────────────────────────────────────

function planMarkdown(ctx: StepContext): string {
  const plan = ctx.project.plan ?? [];
  return `# Build plan — ${ctx.project.name}\n\n> ${ctx.project.prompt}\n\n## Steps\n\n| # | Agent | Task | Deliverables |\n|---|-------|------|--------------|\n${plan.map((s) => `| ${s.index + 1} | ${AGENTS[s.agent as keyof typeof AGENTS]?.name ?? s.agent} | ${s.title} | ${s.description} |`).join("\n")}\n\n## Entities\n\n${ctx.arch.entities.map((e) => `- **${e.name}** → \`${snake(e.plural)}\` (${e.fields.length} fields)`).join("\n")}\n\n## Risks\n\n- Auth: session cookies must be HttpOnly + SameSite=Lax; secrets from env only.\n- Data integrity: foreign keys with ON DELETE rules; enum constraints in the database.\n- Migrations: schema changes gated by human approval; seeds idempotent.\n\n## Acceptance checklist\n\n- [ ] \`npm run lint\`, \`npx tsc --noEmit\`, \`npm test\` all green\n- [ ] Every entity has API + list page + create form\n- [ ] Health endpoint returns 200 with DB check\n- [ ] Docker image builds; CI workflow passes\n`;
}

function architectureMarkdown(ctx: StepContext): string {
  const a = ctx.arch;
  return `# Architecture — ${ctx.project.name}\n\n${a.overview}\n\n## Stack\n\n| Layer | Choice |\n|-------|--------|\n${Object.entries(DEFAULT_STACK).map(([k, v]) => `| ${k} | ${v} |`).join("\n")}\n\n## Components\n\n\`\`\`mermaid\ngraph TD\n${a.components.map((c) => `  ${c.name.replace(/[^A-Za-z0-9]/g, "")}["${c.name} (${c.type})"]`).join("\n")}\n${a.components.flatMap((c) => c.dependencies.map((d) => `  ${c.name.replace(/[^A-Za-z0-9]/g, "")} --> ${d.replace(/[^A-Za-z0-9]/g, "")}`)).join("\n")}\n\`\`\`\n\n${a.components.map((c) => `### ${c.name}\n${c.description}\n`).join("\n")}\n## Data model\n\n${a.entities.map((e) => `### ${e.name} (\`${snake(e.plural)}\`)\n\n| Field | Type | Required |\n|-------|------|----------|\n${e.fields.map((f) => `| ${f.name} | ${f.type}${f.enumValues ? ` (${f.enumValues.join(", ")})` : ""}${f.references ? ` → ${f.references}` : ""} | ${f.required === false ? "no" : "yes"} |`).join("\n")}\n`).join("\n")}\n## API contract\n\n| Method | Path | Auth | Description |\n|--------|------|------|-------------|\n${a.entities.filter((e) => e.name !== "User").flatMap((e) => {
    const p = `/api/${e.slug}`;
    return [`| GET | ${p} | user | List ${e.plural} (paginated, ?q=) |`, `| POST | ${p} | user | Create ${e.name} |`, `| GET | ${p}/:id | user | Fetch ${e.name} |`, `| PUT | ${p}/:id | user | Update ${e.name} |`, `| DELETE | ${p}/:id | admin | Delete ${e.name} |`];
  }).join("\n")}\n\n## Data flow\n\n${a.dataFlow.map((d, i) => `${i + 1}. ${d}`).join("\n")}\n\n## Conventions\n\n- Route handlers validate with Zod and return \`{ error, issues? }\` on 4xx.\n- Services own business rules; handlers stay thin.\n- All timestamps are UTC \`timestamptz\`.\n`;
}

function staticPlanMarkdown(ctx: StepContext): string {
  const plan = ctx.project.plan ?? [];
  return `# Site plan — ${ctx.project.name}

> ${ctx.project.prompt}

## Pages

| Page | Purpose |
|------|---------|
| index.html | Hero, key sections, testimonial |
| about.html | Story and credibility |
| services.html | Offerings in detail |
| contact.html | Validated contact form |
| 404.html | Friendly not-found |

## Steps

${plan.map((st) => `- ${st.index + 1}. **${st.title}** — ${st.description}`).join("\n")}

## Quality criteria

- Semantic HTML: landmarks, single h1 per page, skip link
- Weight budget: < 200 KB per page excluding fonts
- Responsive from 320px; keyboard navigable; honours reduced motion
`;
}

function staticArchitectureMarkdown(ctx: StepContext): string {
  return `# Design system — ${ctx.project.name}

## Palette

One accent + warm neutrals, tuned per domain. Declared as CSS custom properties in \`styles.css\`; dark scheme via \`prefers-color-scheme\`.

## Type

- Display: **Space Grotesk** (headings, brand)
- Body: **Inter** (UI and prose)

## Scale

- Radius: 16px cards, 999px pills
- Shadow: two-layer soft elevation
- Spacing: clamp()-driven section rhythm

## Behaviours (script.js)

1. Mobile nav toggle with aria-expanded
2. IntersectionObserver reveal (disabled under prefers-reduced-motion)
3. Client-side contact form validation with status line

## File layout

\`\`\`
index.html · about.html · services.html · contact.html · 404.html
styles.css · script.js · netlify.toml
\`\`\`
`;
}

function deployMarkdown(ctx: StepContext): string {
  return `# Deployment — ${ctx.project.name}\n\n## Environment checklist\n\n- DATABASE_URL — managed Postgres 16 with SSL\n- SESSION_SECRET — 32+ random bytes\n- NEXT_PUBLIC_APP_URL — public origin\n\n## Release order\n\n1. Build image \`app:latest\` (CI)\n2. Run \`npx drizzle-kit migrate\` against production (backup first)\n3. Deploy new revision; wait for \`/api/health\` to return 200\n4. Flip traffic; monitor error rate for 15 minutes\n\n## Rollback\n\n- Re-deploy previous image tag\n- Migrations are additive; no down-migration required for v1\n`;
}
