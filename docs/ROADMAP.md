# Forge — Research Roadmap

Researched techniques (September 2026) that can be implemented next, prioritised
by impact versus effort for this codebase. Sources listed at the bottom.

## Implemented during this pass

### 1. Server-Sent Events for live run updates (DONE)
**Before:** every open workspace polled `GET /api/projects/:id` every 1.1 s and
re-rendered from full snapshots — wasteful and laggy.
**Now:** `GET /api/projects/:id/events` is a streaming SSE endpoint. It pushes
`status` (project progress/state), `message` (new agent activity, incrementally
by `seq`), and `checkpoint` (pending approvals) frames every second, plus
heartbeats every 15 s to keep proxies from closing the stream. The store
subscribes via `EventSource` when a workspace is open and merges frames into
its cache in place; the old polling loop remains but drops back to a slow
6 s reconciliation tick, and automatically resumes fast polling if the stream
errors (proxies, sleep). Result: sub-second live feed in the bottom dock at a
fraction of the request volume.

## Next, in priority order

### 2. Stream agent output token-by-token (`streamText` + `onChunk`)
The engine uses blocking `generateText`. Moving to `streamText` with
`onChunk`/`onFinish` lets each `write_file` argument and assistant narration
stream into `agent_messages` as it is produced, turning the live feed into a
true teleprompter. AI SDK ≥ v6 unifies `generateObject`/`generateText` so the
final structured `Architecture` can be produced in the same tool loop.

### 3. Native tool-approval instead of custom HITL rows
AI SDK ships first-class human-in-the-loop (`toolApproval` on agent loops, and
the Next.js HITL cookbook recipe). Refactoring `request_approval` onto the
SDK-native mechanism would remove hand-rolled checkpoint plumbing while keeping
the DB audit trail.

### 4. Real sandboxed command execution
`run_command` is currently a simulated virtual shell. The researched options:
- **E2B / Modal / Beam** — managed firecracker sandboxes, best DX, per-second
  billing; ideal for actually running `npm install`, `tsc`, `vitest` on the
  generated workspace so the quality gate tests *real* code.
- **Firecracker microVMs (self-hosted, Northflank-style)** — strongest
  isolation, highest ops cost.
- **WebAssembly (wasmtime/WASI, Cosmonic-style)** — sub-millisecond cold
  starts, cheapest, but no native npm/node fidelity yet.
Recommended: E2B first (drop-in: replace `run_command` internals; keep the
virtual FS as the sync source), self-hosted Firecracker if data control matters.

### 5. Eval harness with LLM-as-judge (continuous evals)
**Deterministic half DONE:** every completed run is now scored by
`src/lib/server/eval.ts` — a 9-check weighted rubric (static analysis, schema
coverage, API/page coverage per entity, test gate, auth env, docs, infra,
pipeline integrity) stored in `projects.eval_score` and rendered on the
Insights tab. What remains is the LLM-judge layer on top.
Anthropic's eval guidance and the SWE-bench line of work both converge on:
fixed scenario briefs + automatic scoring of each run. Concretely for Forge:
- Seed 5–10 golden briefs (helpdesk, CRM, marketplace…) as fixtures.
- Add an LLM judge rubric (schema sanity, UX completeness) on top of the
  deterministic score, and chart scores per model/role over time — this turns
  model routing changes into measurable experiments. Judges should
  *complement* execution-based checks, not replace them (judge-only scoring is
  a known reliability trap).

### 6. Graph-based step planning
The 14 steps are a fixed linear plan. An entity-DAG planner (generate API routes
per entity in parallel steps) would shorten runs and exercise the lock/heartbeat
logic properly. Requires making `completeStep` cursor handling DAG-aware.

### 7. Prompt caching + provider budgets
`prompt-cache.ts` exists but is unused; wiring Anthropic/OpenAI prompt caching
on the (large, stable) system prompts would cut 20–40% of token cost per run.
Combine with the existing per-project micro-dollar budget to add a soft warning
at 80%.

### 8. `ToolLoopAgent`-style refactor
AI SDK 6's agent loop with `stopWhen` conditions maps 1:1 onto
`engine.runStepWithRetries`; adopting it removes custom retry plumbing and gets
structured-output-at-loop-end for free.

## Sources
- [Modal — Best code execution sandboxes for tool-calling agents](https://modal.com/resources/best-code-execution-sandboxes-tool-calling-ai-agents)
- [Cosmonic — Complete guide to sandboxing AI agents](https://cosmonic.com/blog/ai-sandbox-guide/)
- [Northflank — Best code execution sandbox for AI agents](https://northflank.com/blog/best-code-execution-sandbox-for-ai-agents)
- [Beam — Best stateful sandboxes for code execution 2026](https://www.beam.cloud/blog/best-stateful-sandbox-code-execution-2026)
- [Blaxel — How do AI agents execute code?](https://blaxel.ai/blog/how-do-ai-agents-execute-code)
- [AI SDK docs](https://ai-sdk.dev/docs/introduction) · [AI SDK 6 announcement](https://vercel.com/blog/ai-sdk-6) · [Tool calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling) · [HITL cookbook](https://ai-sdk.dev/cookbook/next/human-in-the-loop)
- [Anthropic — Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- [Snorkel — Senior SWE-Bench: evaluating coding agents like senior engineers](https://snorkel.ai/blog/senior-swe-bench-evaluating-coding-agents-like-senior-engineers/)
- [ISO-Bench (arXiv) — LLM judges for code](https://arxiv.org/html/2602.19594v1)
- [Awesome LLMs-as-Judges](https://github.com/CSHaitao/Awesome-LLMs-as-Judges)
