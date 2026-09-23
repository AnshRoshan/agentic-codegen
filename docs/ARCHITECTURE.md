# Forge — Architecture

Agentic full-stack code generation: describe a product in plain English, seven
specialist AI agents plan, build, verify and ship a complete Next.js + PostgreSQL
codebase, with human approval on the risky steps. Works fully offline through a
deterministic simulation engine; plugs into real LLMs when an API key is set.

---

## 1. High-level architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│  Browser (React 19, Next.js 16 App Router)                             │
│                                                                        │
│  Two UI generations, both live and API-backed:                         │
│                                                                        │
│  A. SPA shell  (route "/", src/components/App.tsx)                     │
│     LandingPage → AppShell (sidebar nav) → DashboardPage /             │
│     WorkspacePage (top tabs + bottom run dock) / ModelsPage /          │
│     SkillsPage / SettingsPage. State in a React context store          │
│     (src/lib/store.tsx) that polls the REST API.                       │
│                                                                        │
│  B. Route pages (src/app/dashboard, /projects/[id], /settings)         │
│     Dashboard, Workspace (Workspace.tsx + workspace/* tabs +           │
│     RunDock bottom dock), SettingsPanel.                               │
│                                                                        │
│  Shared primitives: ui.tsx (Modal, Progress, Stat, EmptyState…),       │
│  AppShell (hideTopBar option), CodeView (prism-react-renderer).        │
└───────────────┬────────────────────────────────────────────────────────┘
                │ fetch /api/*  (JSON, 1–6 s polling)
┌───────────────▼────────────────────────────────────────────────────────┐
│  Next.js API routes (src/app/api/**) — thin controllers                │
│  projects · run · reset · duplicate · files · env · checkpoints ·      │
│  hitl · search · stats · download · activity · metrics · presets ·     │
│  models · settings · health                                            │
└───────────────┬────────────────────────────────────────────────────────┘
                │ repo.* data access + engine.* orchestration
┌───────────────▼────────────────────────────────────────────────────────┐
│  Server engine (src/lib/server/)                                       │
│  engine.ts   run lock, 14-step loop, HITL, budgets, abort              │
│  agent-runtime.ts  StepContext + tool definitions + STEP_SPECS         │
│  ai.ts       provider resolution, model routing, error classes         │
│  simulation.ts  deterministic offline step executor                    │
│  quality.ts  real static analysis of the virtual workspace             │
│  repo.ts     transactional DB helpers                                  │
└───────────────┬────────────────────────────────────────────────────────┘
                │ drizzle-orm (node-postgres)
┌───────────────▼────────────────────────────────────────────────────────┐
│  PostgreSQL  (schema: src/db/schema.ts)                                │
│  projects · agents · tasks · file_nodes · db_tables ·                  │
│  environment_variables · agent_messages · command_executions ·         │
│  hitl_checkpoints · llm_calls · ai_settings                            │
└────────────────────────────────────────────────────────────────────────┘
```

### The dual-engine principle

Every pipeline step executes through the **same `StepContext`** regardless of
whether an LLM is configured:

- **LLM engine** — `generateText` with tool definitions
  (Vercel AI SDK, `stopWhen: stepCountIs(maxSteps)`), per-role model routing,
  per-call usage/cost metering into `llm_calls`.
- **Simulation engine** (`simulation.ts` + `lib/codegen.ts` templates) — a
  deterministic generator that writes realistic files through the identical
  tool calls, so the whole product (UI, quality gates, HITL, budget) is
  exercisable with zero API keys.

---

## 2. The pipeline (14 steps)

Defined in `src/lib/server/agent-runtime.ts` (`STEP_SPECS`) and executed by
`engine.ts`. Each step has machine-checked acceptance criteria (`verify`) and a
fallback simulation.

| # | Step key | Owner | Output | Verification |
|---|----------|-------|--------|--------------|
| 1 | `analyze` | Orchestrator | Refined `Architecture` (entities, features) via `update_architecture` | ≥ 2 entities |
| 2 | `plan` | Orchestrator | `docs/PLAN.md` (14-step deliverable map + risks) | file exists |
| 3 | `architecture` | Architect | `docs/ARCHITECTURE.md` (diagrams, API contract) | file exists |
| 4 | `scaffold` | Architect | Full Next.js + TS + Tailwind + Drizzle scaffold, `npm install` | key files + command |
| 5 | `schema` | Database | Drizzle schema + `drizzle.config.ts`; **HITL checkpoint (migration)** | tables registered |
| 6 | `db-push` | Database | `drizzle-kit push` in the virtual shell; seed script | command + status |
| 7 | `auth` | Backend | Session auth (HMAC cookies, RBAC), env var registration | files + env vars |
| 8 | `api` | Backend | Typed REST routes w/ Zod validation for every entity | entity files |
| 9 | `shell` | Frontend | App shell: sidebar nav, dashboard, layout | files exist |
| 10 | `pages` | Frontend | List + create pages per entity, empty/loading/error states | files exist |
| 11 | `write-tests` | QA | Vitest unit + Playwright e2e specs | test files |
| 12 | `run-tests` | QA | **Quality gate**: lint / tsc / test against real static analysis | diagnostics ≤ budget |
| 13 | `containerize` | DevOps | Dockerfile, docker-compose, GitHub Actions CI | files exist |
| 14 | `deploy` | DevOps | Release plan; **HITL checkpoint (deploy)**, deploy log | checkpoint resolved |

### Step execution contract

```
runProject(action)                  engine.ts
 ├─ acquireRunLock()                DB row lock (run_id + heartbeat),
 │                                  stale locks reclaimed after 45 s,
 │                                  reconciled on server restart
 ├─ loop steps[currentStep..]
 │   ├─ build StepContext           tools: write_file, read_file, list_files,
 │   │                              delete_file, run_command (sandboxed virtual
 │   │                              shell), define_table, set_env_var,
 │   │                              update_architecture, request_approval,
 │   │                              complete_task
 │   ├─ LLM path  or  runSimulatedStep()
 │   ├─ verify(ctx)                 acceptance criteria
 │   │    └─ fail → re-prompt with feedback (maxRetries)
 │   │         └─ still fail → deterministic fallback, pipeline always completes
 │   ├─ non-retryable errors (bad key/model) → halt with actionable message
 │   ├─ budget check                per-project micro-dollar budget → pause
 │   ├─ pauseRequested?             honoured between AND inside steps
 │   └─ completeStepTransactional() step + project cursor in one txn
```

### Quality gate (`quality.ts`)

Real analysis of the virtual workspace using the TypeScript compiler API:
syntax errors, invalid JSON, unresolved imports, lint heuristics (console.log,
TODO/FIXME, long lines). Diagnostics are routed to the **owning agent** (by file
attribution) for repair — an LLM repair call when configured, mechanical repair
offline — for up to `maxRepairIterations` rounds.

### Human-in-the-loop (`hitl/[checkpointId]`, `engine.resolveCheckpoint`)

Schema migration and production deploy raise `hitl_checkpoints` rows unless the
project is auto-approve. Approve → step completes and the run resumes
automatically; reject → the dependent step is marked skipped and the pipeline
continues. Every resolution is logged to `agent_messages`.

---

## 3. Data model (src/db/schema.ts)

| Table | Purpose | Notable columns |
|-------|---------|-----------------|
| `projects` | Root aggregate | status enum (draft→completed/failed/paused…), `plan` jsonb (14 PlanSteps), `architecture` jsonb, run lock (`run_id`, `run_heartbeat_at`), budget, engine mode, token/cost aggregates |
| `agents` | 7 per project | role enum, status, progress, tokens, files written |
| `tasks` | 14 per project | step_key unique per project, status, attempts, duration |
| `file_nodes` | Virtual filesystem | unique `(project, path)`, content, language, version, is_modified |
| `db_tables` | Designed schema | name, columns jsonb, sql, status (defined→seeded), row_count |
| `environment_variables` | Env registry | unique `(project, key)`, is_secret, source |
| `agent_messages` | Activity feed | kind (info/tool/file/success/warning/error/user), seq |
| `command_executions` | Virtual shell log | command, output, exit_code, duration |
| `hitl_checkpoints` | Approval gates | type (schema/deployment), risk level, context jsonb, resolution |
| `llm_calls` | Metering | agent role, model, tokens in/out, cost_micros, latency, finish reason |
| `ai_settings` | Provider config | provider enum, encrypted-at-rest key hint, per-role model routing |

Enums are Postgres-native (`pgEnum`) for status/role/type columns.

---

## 4. API surface

All routes under `src/app/api`, all `dynamic = "force-dynamic"`.

| Route | Methods | Notes |
|-------|---------|-------|
| `/api/projects` | GET, POST | list (with pending-checkpoint counts), create (infers domain) |
| `/api/projects/:id` | GET/PATCH/DELETE | snapshot (`?filesSince=` incremental files) |
| `/api/projects/:id/run` | POST | `{action: start\|step\|pause\|resume}` |
| `/api/projects/:id/reset` | POST | back to draft, wipes artefacts |
| `/api/projects/:id/duplicate` | POST | deep copy |
| `/api/projects/:id/files` | GET/PUT/DELETE | read/write/delete virtual files (versions bumped) |
| `/api/projects/:id/env` + `/env/:envId` | GET/POST/DELETE | env registry |
| `/api/projects/:id/checkpoints/:cpId` | GET/POST | resolve checkpoint (approve/reject + note) |
| `/api/projects/:id/hitl/:checkpointId` | POST | alias resolution endpoint (engine) |
| `/api/projects/:id/search` | GET | code search across `file_nodes` |
| `/api/projects/:id/stats` | GET | aggregate stats (files/tasks/agents/db/env/hitl/commands) |
| `/api/projects/:id/download` | GET | zip of workspace (JSZip) |
| `/api/activity`, `/api/metrics` | GET | cross-project feed and aggregates |
| `/api/presets` | GET | six domain presets |
| `/api/models` | GET | 12-model catalog + availability |
| `/api/settings`, `/api/settings/ai`, `/api/settings/test` | GET/PUT/DELETE/POST | app + AI provider settings, connection test |
| `/api/health` | GET | liveness + DB check |

---

## 5. Frontend architecture

### SPA shell (generation A — `/`)

- `src/lib/store.tsx` — single React context store: projects, per-project
  workspace snapshots (`files, tables, env, messages, commands, checkpoints,
  llmCalls`), actions (create/start/pause/step/approve/file-edit/env/settings),
  UI persistence in `localStorage` (`forge-v3-ui`). Polls the API (1.1 s in an
  active workspace, 6 s on the dashboard).
- `src/components/WorkspacePage.tsx` — single compact header, **horizontal tab
  bar** (Overview, Pipeline, Files, Database, Environment, Approvals, Terminal,
  Insights), and a **bottom run dock** (`BottomDock`): always-visible run stats
  + progress + live status, expandable into the full live feed with unread
  badge; pending approvals surface as an action button when expanded.
- `src/components/AppShell.tsx` — sidebar nav + global ⌘K palette;
  `hideTopBar` lets full-bleed pages (workspace) suppress the generic top bar.

### Route pages (generation B)

- `/dashboard` — `Dashboard.tsx` (metrics, project cards, activity rail).
- `/projects/[id]` — `workspace/Workspace.tsx` with the same tab structure and
  `workspace/RunDock.tsx` bottom dock (Timeline / Model-calls views, per-agent
  filters).
- `/settings` — `SettingsPanel.tsx` provider configuration.

### Shared UI

`ui.tsx` (StatusBadge, Progress, Spinner, Toggle, Empty, EmptyState, Stat,
SectionCard, Modal, Logo, Meter), `CodeView.tsx` (Prism), `globals.css`
(design tokens: ink/brand/mint palette, glass panels, reveal-on-scroll).

---

## 6. Local development

```bash
npm install

# Option A: isolated embedded PostgreSQL (no setup, port 5434)
node scripts/embedded-db.cjs        # terminal 1 (creates app_db, UTF-8)
npx drizzle-kit push                # apply schema

# Option B: your own PostgreSQL
#   set DATABASE_URL in .env, then: npx drizzle-kit push

npm run dev                         # http://localhost:3000
# or: npm run build && npm start
```

`.env` needs only `DATABASE_URL`. AI providers are optional; configure in
Settings → AI or via env (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,
`GOOGLE_GENERATIVE_AI_API_KEY`, Azure, or any OpenAI-compatible endpoint).

Scripts: `dev`, `build`, `start`, `lint`, `typecheck`.

---

## 7. Work log (this rebuild)

Everything that was done to finish and fix the project:

### Dead code removal (35 files)
The repo mixed two generations: a dead Vite prototype and the live Next.js app.
Removed `vite.config.ts`, `src/main.tsx`, `src/App.tsx` (Vite root),
`src/components/landing|motion` (unused hero variants), 14 unused components
(AgentCard, AgentGraph, ArchitectureView, CommandPalette, DatabaseViewer,
FileExplorer, HitlCheckpoints, ProjectDashboard, ProjectStats, SettingsModal,
Terminal, ui/index, ActivityFeed, CodeWorkspace, EnvironmentVariables), and the
orphaned engine chain `/api/projects/:id/simulate` → `agent-engine.ts` →
`context-engine.ts`, plus stale `pipeline.ts` and `ai-provider.ts`. The HITL
route was repointed to `server/engine.resolveCheckpoint`.

### Type system repair (~200 errors → 0)
- Installed missing runtime deps used by live code: `sonner`,
  `prism-react-renderer`, plus `embedded-postgres` (dev).
- Extended shared UI to serve both generations: `EmptyState`, `Stat`,
  ReactNode-titled `Modal` with `width`, `Progress color`, `AppShell` named
  export + `right` + `hideTopBar` props.
- Fixed `/api/projects/:id/stats` to match the real schema (no `type` /
  `vault_ref` columns; directory count derived from paths).

### Runtime fixes
- `/settings` SSR crash: `StoreProvider` moved to the root layout.
- Single header on the workspace (both generations): `hideTopBar` on the SPA
  workspace view and on `/projects/[id]`; "Search code" moved into the project
  header.
- `/projects/[id]`: agents sidebar → "Pipeline" tab; stats strip + Activity tab
  replaced by the `RunDock` bottom dock (Timeline / Model calls, per-agent
  filters, unread badge).
- SPA workspace: icon rail → top tab bar; right inspector → `BottomDock`
  (run stats + expandable live feed + approval shortcut); Activity tab removed.

### Tooling
- ESLint: registered `eslint-plugin-react-hooks` in flat config, downgraded the
  new `react-hooks/set-state-in-effect` rule to a warning (the app
  intentionally polls in mount effects); fixed unescaped entity.
- `scripts/embedded-db.cjs`: embedded PostgreSQL 18 on port 5434,
  `postgres/postgres`, creates `app_db` with **UTF-8** encoding (the schema
  contains emoji; the WIN1252 default cluster breaks `drizzle-kit push`).
- `.env` points `DATABASE_URL` at the embedded instance.

### Landing page (design-skill pass)
Hero tightened to a single line of subtext, hero checklist removed, workspace
section re-laid out as a two-column hairline list, section eyebrows cut from 7
to 3, CTA labels unified ("Start building"), workspace copy updated to match
the new tabs/dock UI, em-dashes removed from all copy.

### Run quality score (eval)
Every completed run is scored by a deterministic 9-check rubric
(`src/lib/server/eval.ts`, stored in `projects.eval_score`, shown on the
Insights tab): static analysis, schema/API/page coverage per entity (plural
kebab-case aware), test gate, auth env, docs, infra, pipeline integrity.
Scored automatically in `finalizeComplete`; reset clears it. Verified 100/100
grade A on a full simulated run.

### Live SSE run stream
`GET /api/projects/:id/events` pushes status / incremental agent messages /
checkpoint frames every second (heartbeats every 15 s, clean close when idle).
The store subscribes on workspace open and merges frames instantly; polling
drops back to slow reconciliation and resumes on stream error.

### Static website mode (fast + beautiful)
New project mode `"static"`: a 7-step plan (brief, site plan, design system,
scaffold, pages, quality gate, ship) that generates a complete, zero-dependency
static website in ~15 seconds: 5 semantic HTML pages, a custom-property CSS
design system (per-domain accent palette, Space Grotesk + Inter, dark mode,
reduced-motion, responsive from 320px), vanilla JS behaviours (mobile nav,
scroll reveal, validated contact form), netlify.toml and deploy docs. Content
is derived from the brief itself (site kind, tagline, section items). The eval
rubric adapts (N/A checks become passes; quality gate replaces the test suite;
netlify.toml replaces Docker). Selected via the new "Static" option in the
create-project modal; verified 100/100 grade A and visually inspected.

### Verification performed
`tsc --noEmit` clean · `next build` green · ESLint 0 errors · full pipeline run
end-to-end offline (14/14 steps, 53 files, schema + deploy checkpoints
auto-approved, 33 KB zip download) · every page and API route returns 200 ·
browser-verified single header, top tabs, expandable bottom dock.

---

## 8. Research: next techniques worth implementing

See `docs/ROADMAP.md` for the researched, prioritised list of techniques
(streaming events, sandboxed execution, graph-based planning, eval harness…).
