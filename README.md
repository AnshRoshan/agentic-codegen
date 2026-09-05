# Forge — Agentic Full-Stack Code Generation

Describe a product; seven specialist agents (Orchestrator, Architect, Database, Backend, Frontend, QA, DevOps) plan, build, verify and ship a Next.js + PostgreSQL codebase — with human approval on the risky steps.

## Stack

- **Next.js 16 (App Router)** — UI + API routes in one process
- **PostgreSQL + Drizzle ORM** — projects, virtual filesystem, tables, env vars, checkpoints, command log, LLM call log
- **Vercel AI SDK v7** (`ai`, `@ai-sdk/openai|anthropic|google|azure|openai-compatible`) — real tool-calling agents
- **TypeScript compiler API** — real static analysis of generated code (syntax, JSON, import resolution, lint heuristics)

## How a run works (`src/lib/server/engine.ts`)

1. `POST /api/projects/:id/run {action:start|step|pause}` acquires a **DB run lock** (`run_id` + heartbeat; stale locks are reclaimed after 45 s, and reconciled on server restart).
2. The loop executes the 14-step plan. Each step gets a `StepContext` with tools: `write_file`, `read_file`, `list_files`, `delete_file`, `run_command` (sandboxed virtual shell), `define_table`, `set_env_var`, `update_architecture`, `request_approval`, `complete_task`.
3. **LLM engine** (when a provider is configured): `generateText` with tools, `stopWhen: stepCountIs(maxStepsPerTask)`, per-role model routing, per-call usage/cost metering (`llm_calls`), 5-minute step timeout, abort on pause.
4. **Verification**: every step has machine-checked acceptance criteria (files that must exist, tables registered, commands run…). Failures re-prompt the agent with feedback (`maxRetries`), then fall back to the deterministic generator so the pipeline always completes. Non-retryable errors (bad key/model) halt immediately with an actionable message.
5. **Quality gate** (`run-tests`): runs virtual `lint`, `tsc`, `test` backed by real analysis of the workspace; diagnostics are routed to the **owning agent** for repair (LLM repair call, or mechanical repair offline) for `maxRepairIterations` rounds.
6. **HITL**: schema migration and production deploy raise checkpoints (unless auto-approve). Approve → step completes and the run resumes automatically; reject → step skipped.
7. **Guard-rails**: per-project budget (pauses when reached), pause requested flag honoured between and inside steps, transactional step completion, unique `(project, path)` file index.

Without an API key the same engine runs a **deterministic simulation** through the identical context, so the UI, gates and quality checks are exercised end-to-end offline.

## Configuration

Settings UI (stored in `ai_settings`) or environment variables:

| Provider | Env vars |
|----------|----------|
| OpenAI | `OPENAI_API_KEY`, optional `AI_MODEL`, `OPENAI_BASE_URL` |
| Anthropic | `ANTHROPIC_API_KEY` |
| Google | `GOOGLE_GENERATIVE_AI_API_KEY` |
| Azure OpenAI | `AZURE_API_KEY`, `AZURE_RESOURCE_NAME` or `AZURE_BASE_URL`, `AZURE_DEPLOYMENT_NAME` |
| OpenAI-compatible | `AI_API_KEY` + `AI_BASE_URL` (OpenRouter, Groq, DeepSeek, xAI, LiteLLM, vLLM…) |

`DATABASE_URL` is read from `.env`. Apply the schema with `npx drizzle-kit push`.

## API

`/api/projects` (GET, POST) · `/api/projects/:id` (GET snapshot with `?filesSince=`, PATCH, DELETE) · `/run` · `/reset` · `/duplicate` · `/files` (GET/PUT/DELETE) · `/env` · `/env/:envId` · `/checkpoints/:cpId` · `/download` (zip) · `/api/settings` (GET/PUT) · `/api/settings/test` · `/api/models` · `/api/health`
