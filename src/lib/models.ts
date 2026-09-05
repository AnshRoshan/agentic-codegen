// ─── AI Model Catalog ───────────────────────────────────────────────────────
// Shared by the server-side cost meter and the Models page. Prices are USD per
// 1M tokens (list price, no caching discounts). `providerKey` maps a catalog
// entry to the provider setting that can actually serve it.

export type ProviderVendor =
  | "OpenAI" | "Anthropic" | "Google" | "Meta" | "Mistral" | "DeepSeek" | "Qwen" | "xAI" | "Moonshot" | "Zhipu";

export type ProviderKey = "openai" | "anthropic" | "google" | "azure" | "custom";

export type Capability =
  | "tools" | "structured" | "reasoning" | "vision" | "audio" | "open-weights" | "long-context" | "fim" | "cache";

export type ModelTier = "frontier" | "balanced" | "fast" | "reasoning" | "coder";

export interface AIModel {
  id: string;
  name: string;
  provider: ProviderVendor;
  /** Which configured provider keys can route to this model. */
  servedBy: ProviderKey[];
  family: string;
  tier: ModelTier;
  released: string; // YYYY-MM
  contextTokens: number;
  maxOutputTokens: number;
  inputPer1M: number;
  outputPer1M: number;
  cachedInputPer1M?: number;
  speed: 1 | 2 | 3 | 4 | 5;
  quality: 1 | 2 | 3 | 4 | 5;
  coding: 1 | 2 | 3 | 4 | 5;
  capabilities: Capability[];
  bestFor: string[];
  recommendedRoles?: string[];
  notes?: string;
}

const OPENAI_COMPAT: ProviderKey[] = ["custom"];

export const AI_MODELS: AIModel[] = [
  // ── OpenAI ────────────────────────────────────────────────────────────────
  { id: "gpt-5", name: "GPT-5", provider: "OpenAI", servedBy: ["openai", "azure", "custom"], family: "GPT-5", tier: "frontier", released: "2025-08", contextTokens: 400_000, maxOutputTokens: 128_000, inputPer1M: 1.25, outputPer1M: 10, cachedInputPer1M: 0.125, speed: 3, quality: 5, coding: 5, capabilities: ["tools", "structured", "reasoning", "vision", "long-context", "cache"], bestFor: ["Orchestration", "Architecture", "Hard refactors"], recommendedRoles: ["orchestrator", "architect"], notes: "Best default planner. Reasoning effort is configurable." },
  { id: "gpt-5-mini", name: "GPT-5 mini", provider: "OpenAI", servedBy: ["openai", "azure", "custom"], family: "GPT-5", tier: "balanced", released: "2025-08", contextTokens: 400_000, maxOutputTokens: 128_000, inputPer1M: 0.25, outputPer1M: 2, cachedInputPer1M: 0.025, speed: 4, quality: 4, coding: 4, capabilities: ["tools", "structured", "reasoning", "vision", "long-context", "cache"], bestFor: ["Code generation", "Tests", "High-volume tool loops"], recommendedRoles: ["backend", "frontend", "testing"] },
  { id: "gpt-5-nano", name: "GPT-5 nano", provider: "OpenAI", servedBy: ["openai", "azure", "custom"], family: "GPT-5", tier: "fast", released: "2025-08", contextTokens: 400_000, maxOutputTokens: 128_000, inputPer1M: 0.05, outputPer1M: 0.4, cachedInputPer1M: 0.005, speed: 5, quality: 3, coding: 3, capabilities: ["tools", "structured", "reasoning", "long-context", "cache"], bestFor: ["Cheap classification", "Docs", "Boilerplate"], recommendedRoles: ["devops"] },
  { id: "gpt-4.1", name: "GPT-4.1", provider: "OpenAI", servedBy: ["openai", "azure", "custom"], family: "GPT-4.1", tier: "frontier", released: "2025-04", contextTokens: 1_047_576, maxOutputTokens: 32_768, inputPer1M: 2, outputPer1M: 8, cachedInputPer1M: 0.5, speed: 3, quality: 4, coding: 4, capabilities: ["tools", "structured", "vision", "long-context", "cache"], bestFor: ["Large-codebase context", "Instruction following"], recommendedRoles: ["architect"] },
  { id: "gpt-4.1-mini", name: "GPT-4.1 mini", provider: "OpenAI", servedBy: ["openai", "azure", "custom"], family: "GPT-4.1", tier: "balanced", released: "2025-04", contextTokens: 1_047_576, maxOutputTokens: 32_768, inputPer1M: 0.4, outputPer1M: 1.6, cachedInputPer1M: 0.1, speed: 5, quality: 4, coding: 4, capabilities: ["tools", "structured", "vision", "long-context", "cache"], bestFor: ["Default worker", "CRUD generation"], recommendedRoles: ["backend", "frontend", "database"] },
  { id: "gpt-4.1-nano", name: "GPT-4.1 nano", provider: "OpenAI", servedBy: ["openai", "azure", "custom"], family: "GPT-4.1", tier: "fast", released: "2025-04", contextTokens: 1_047_576, maxOutputTokens: 32_768, inputPer1M: 0.1, outputPer1M: 0.4, cachedInputPer1M: 0.025, speed: 5, quality: 3, coding: 3, capabilities: ["tools", "structured", "long-context", "cache"], bestFor: ["Budget runs", "Config files"] },
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", servedBy: ["openai", "azure", "custom"], family: "GPT-4o", tier: "balanced", released: "2024-05", contextTokens: 128_000, maxOutputTokens: 16_384, inputPer1M: 2.5, outputPer1M: 10, cachedInputPer1M: 1.25, speed: 4, quality: 4, coding: 3, capabilities: ["tools", "structured", "vision", "audio", "cache"], bestFor: ["Multimodal", "Legacy compatibility"] },
  { id: "o3", name: "o3", provider: "OpenAI", servedBy: ["openai", "azure"], family: "o-series", tier: "reasoning", released: "2025-04", contextTokens: 200_000, maxOutputTokens: 100_000, inputPer1M: 2, outputPer1M: 8, cachedInputPer1M: 0.5, speed: 2, quality: 5, coding: 5, capabilities: ["tools", "structured", "reasoning", "vision", "cache"], bestFor: ["Deep debugging", "Schema design reasoning"], recommendedRoles: ["architect"] },
  { id: "o4-mini", name: "o4-mini", provider: "OpenAI", servedBy: ["openai", "azure"], family: "o-series", tier: "reasoning", released: "2025-04", contextTokens: 200_000, maxOutputTokens: 100_000, inputPer1M: 1.1, outputPer1M: 4.4, cachedInputPer1M: 0.275, speed: 3, quality: 4, coding: 4, capabilities: ["tools", "structured", "reasoning", "vision", "cache"], bestFor: ["Cost-effective reasoning", "Test design"], recommendedRoles: ["testing"] },

  // ── Anthropic ─────────────────────────────────────────────────────────────
  { id: "claude-opus-4-1", name: "Claude Opus 4.1", provider: "Anthropic", servedBy: ["anthropic"], family: "Claude 4", tier: "frontier", released: "2025-08", contextTokens: 200_000, maxOutputTokens: 32_000, inputPer1M: 15, outputPer1M: 75, cachedInputPer1M: 1.5, speed: 2, quality: 5, coding: 5, capabilities: ["tools", "structured", "reasoning", "vision", "cache"], bestFor: ["Complex agentic coding", "Long autonomous runs"], recommendedRoles: ["orchestrator"], notes: "Highest quality, highest cost. Use for planning only." },
  { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", provider: "Anthropic", servedBy: ["anthropic"], family: "Claude 4", tier: "frontier", released: "2025-09", contextTokens: 200_000, maxOutputTokens: 64_000, inputPer1M: 3, outputPer1M: 15, cachedInputPer1M: 0.3, speed: 3, quality: 5, coding: 5, capabilities: ["tools", "structured", "reasoning", "vision", "long-context", "cache"], bestFor: ["Agentic coding", "Careful refactors", "UI generation"], recommendedRoles: ["architect", "backend", "frontend"], notes: "Best price/quality for code as of late 2025." },
  { id: "claude-sonnet-4", name: "Claude Sonnet 4", provider: "Anthropic", servedBy: ["anthropic"], family: "Claude 4", tier: "balanced", released: "2025-05", contextTokens: 200_000, maxOutputTokens: 64_000, inputPer1M: 3, outputPer1M: 15, cachedInputPer1M: 0.3, speed: 3, quality: 4, coding: 5, capabilities: ["tools", "structured", "reasoning", "vision", "cache"], bestFor: ["Code review", "Refactors"] },
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", provider: "Anthropic", servedBy: ["anthropic"], family: "Claude 4", tier: "fast", released: "2025-10", contextTokens: 200_000, maxOutputTokens: 64_000, inputPer1M: 1, outputPer1M: 5, cachedInputPer1M: 0.1, speed: 5, quality: 4, coding: 4, capabilities: ["tools", "structured", "reasoning", "vision", "cache"], bestFor: ["Fast edits", "Tests", "Sub-agents"], recommendedRoles: ["testing", "devops"] },

  // ── Google ────────────────────────────────────────────────────────────────
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "Google", servedBy: ["google"], family: "Gemini 2.5", tier: "frontier", released: "2025-06", contextTokens: 1_048_576, maxOutputTokens: 65_536, inputPer1M: 1.25, outputPer1M: 10, cachedInputPer1M: 0.31, speed: 3, quality: 5, coding: 4, capabilities: ["tools", "structured", "reasoning", "vision", "audio", "long-context", "cache"], bestFor: ["Whole-repo context", "Architecture"], recommendedRoles: ["architect"] },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "Google", servedBy: ["google"], family: "Gemini 2.5", tier: "balanced", released: "2025-06", contextTokens: 1_048_576, maxOutputTokens: 65_536, inputPer1M: 0.3, outputPer1M: 2.5, cachedInputPer1M: 0.075, speed: 5, quality: 4, coding: 4, capabilities: ["tools", "structured", "reasoning", "vision", "audio", "long-context", "cache"], bestFor: ["Budget agent loops", "Bulk generation"], recommendedRoles: ["backend", "frontend", "database"] },
  { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash-Lite", provider: "Google", servedBy: ["google"], family: "Gemini 2.5", tier: "fast", released: "2025-07", contextTokens: 1_048_576, maxOutputTokens: 65_536, inputPer1M: 0.1, outputPer1M: 0.4, speed: 5, quality: 3, coding: 3, capabilities: ["tools", "structured", "vision", "long-context"], bestFor: ["Cheapest tool-capable model", "Docs & configs"], recommendedRoles: ["devops"] },

  // ── xAI ───────────────────────────────────────────────────────────────────
  { id: "grok-4", name: "Grok 4", provider: "xAI", servedBy: OPENAI_COMPAT, family: "Grok 4", tier: "reasoning", released: "2025-07", contextTokens: 256_000, maxOutputTokens: 32_000, inputPer1M: 3, outputPer1M: 15, cachedInputPer1M: 0.75, speed: 2, quality: 5, coding: 4, capabilities: ["tools", "structured", "reasoning", "vision", "cache"], bestFor: ["Reasoning-heavy plans"], notes: "Route via custom endpoint https://api.x.ai/v1" },
  { id: "grok-code-fast-1", name: "Grok Code Fast 1", provider: "xAI", servedBy: OPENAI_COMPAT, family: "Grok Code", tier: "coder", released: "2025-08", contextTokens: 256_000, maxOutputTokens: 32_000, inputPer1M: 0.2, outputPer1M: 1.5, cachedInputPer1M: 0.02, speed: 5, quality: 4, coding: 4, capabilities: ["tools", "structured", "reasoning", "cache"], bestFor: ["Fast agentic coding", "Cheap tool loops"], recommendedRoles: ["backend", "frontend"] },

  // ── DeepSeek ──────────────────────────────────────────────────────────────
  { id: "deepseek-chat", name: "DeepSeek V3.1", provider: "DeepSeek", servedBy: OPENAI_COMPAT, family: "DeepSeek V3", tier: "balanced", released: "2025-08", contextTokens: 128_000, maxOutputTokens: 8_192, inputPer1M: 0.27, outputPer1M: 1.1, cachedInputPer1M: 0.07, speed: 4, quality: 4, coding: 4, capabilities: ["tools", "structured", "open-weights", "cache"], bestFor: ["Cheap reasoning", "Self-hosting"], notes: "Route via https://api.deepseek.com" },
  { id: "deepseek-reasoner", name: "DeepSeek R1", provider: "DeepSeek", servedBy: OPENAI_COMPAT, family: "DeepSeek R1", tier: "reasoning", released: "2025-05", contextTokens: 128_000, maxOutputTokens: 64_000, inputPer1M: 0.55, outputPer1M: 2.19, cachedInputPer1M: 0.14, speed: 2, quality: 4, coding: 4, capabilities: ["reasoning", "open-weights", "cache"], bestFor: ["Math/logic", "Planning"], notes: "No native tool calling — use for planning steps only." },

  // ── Qwen / Moonshot / Zhipu ───────────────────────────────────────────────
  { id: "qwen3-coder-480b-a35b-instruct", name: "Qwen3 Coder 480B", provider: "Qwen", servedBy: OPENAI_COMPAT, family: "Qwen3", tier: "coder", released: "2025-07", contextTokens: 262_144, maxOutputTokens: 65_536, inputPer1M: 0.4, outputPer1M: 1.6, speed: 4, quality: 4, coding: 5, capabilities: ["tools", "structured", "open-weights", "long-context", "fim"], bestFor: ["Agentic coding", "Repo-scale edits"], recommendedRoles: ["backend"] },
  { id: "qwen3-235b-a22b-instruct", name: "Qwen3 235B", provider: "Qwen", servedBy: OPENAI_COMPAT, family: "Qwen3", tier: "balanced", released: "2025-07", contextTokens: 262_144, maxOutputTokens: 32_768, inputPer1M: 0.2, outputPer1M: 0.6, speed: 4, quality: 4, coding: 4, capabilities: ["tools", "structured", "open-weights", "long-context"], bestFor: ["Open-weight generalist"] },
  { id: "kimi-k2-0905", name: "Kimi K2", provider: "Moonshot", servedBy: OPENAI_COMPAT, family: "Kimi K2", tier: "balanced", released: "2025-09", contextTokens: 262_144, maxOutputTokens: 32_768, inputPer1M: 0.6, outputPer1M: 2.5, cachedInputPer1M: 0.15, speed: 3, quality: 4, coding: 4, capabilities: ["tools", "structured", "open-weights", "long-context", "cache"], bestFor: ["Agentic tool use", "Open weights"] },
  { id: "glm-4.5", name: "GLM-4.5", provider: "Zhipu", servedBy: OPENAI_COMPAT, family: "GLM-4.5", tier: "balanced", released: "2025-07", contextTokens: 128_000, maxOutputTokens: 96_000, inputPer1M: 0.6, outputPer1M: 2.2, speed: 4, quality: 4, coding: 4, capabilities: ["tools", "structured", "reasoning", "open-weights"], bestFor: ["Agentic workflows", "Hybrid thinking"] },

  // ── Meta / Mistral ────────────────────────────────────────────────────────
  { id: "llama-4-maverick", name: "Llama 4 Maverick", provider: "Meta", servedBy: OPENAI_COMPAT, family: "Llama 4", tier: "balanced", released: "2025-04", contextTokens: 1_000_000, maxOutputTokens: 16_384, inputPer1M: 0.2, outputPer1M: 0.6, speed: 4, quality: 3, coding: 3, capabilities: ["tools", "vision", "open-weights", "long-context"], bestFor: ["Self-hosted", "Private code"] },
  { id: "mistral-medium-2508", name: "Mistral Medium 3.1", provider: "Mistral", servedBy: OPENAI_COMPAT, family: "Mistral Medium", tier: "balanced", released: "2025-08", contextTokens: 128_000, maxOutputTokens: 32_000, inputPer1M: 0.4, outputPer1M: 2, speed: 4, quality: 4, coding: 4, capabilities: ["tools", "structured", "vision"], bestFor: ["EU hosting", "Multilingual"] },
  { id: "devstral-medium-2507", name: "Devstral Medium", provider: "Mistral", servedBy: OPENAI_COMPAT, family: "Devstral", tier: "coder", released: "2025-07", contextTokens: 128_000, maxOutputTokens: 32_000, inputPer1M: 0.4, outputPer1M: 2, speed: 4, quality: 4, coding: 4, capabilities: ["tools", "structured"], bestFor: ["Agentic coding loops", "Multi-file edits"], recommendedRoles: ["frontend"] },
  { id: "codestral-2508", name: "Codestral 25.08", provider: "Mistral", servedBy: OPENAI_COMPAT, family: "Codestral", tier: "coder", released: "2025-08", contextTokens: 256_000, maxOutputTokens: 32_000, inputPer1M: 0.3, outputPer1M: 0.9, speed: 5, quality: 3, coding: 4, capabilities: ["tools", "fim"], bestFor: ["Completion", "Fill-in-the-middle"] },
];

export const PROVIDERS = ["All", "OpenAI", "Anthropic", "Google", "xAI", "DeepSeek", "Qwen", "Moonshot", "Zhipu", "Meta", "Mistral"] as const;

export const PROVIDER_KEY_LABELS: Record<ProviderKey, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google AI",
  azure: "Azure OpenAI",
  custom: "OpenAI-compatible",
};

/** Typical token usage per plan step, measured from real runs (in/out). */
export const ROLE_STEP_TOKENS: Record<string, { in: number; out: number; steps: number }> = {
  orchestrator: { in: 4_000, out: 1_600, steps: 2 },
  architect: { in: 7_000, out: 5_500, steps: 2 },
  database: { in: 8_000, out: 5_000, steps: 2 },
  backend: { in: 14_000, out: 9_000, steps: 2 },
  frontend: { in: 14_000, out: 10_000, steps: 2 },
  testing: { in: 9_000, out: 4_000, steps: 2 },
  devops: { in: 5_000, out: 3_000, steps: 2 },
};

export function findModel(id: string | null | undefined): AIModel | undefined {
  if (!id) return undefined;
  const exact = AI_MODELS.find((m) => m.id === id);
  if (exact) return exact;
  // Loose match for dated/deployment ids like "gpt-4.1-mini-2025-04-14" or "my-gpt-5-deployment"
  const lower = id.toLowerCase();
  return [...AI_MODELS].sort((a, b) => b.id.length - a.id.length).find((m) => lower.includes(m.id));
}

export function costMicrosFor(modelId: string, inTok: number, outTok: number): number {
  const m = findModel(modelId);
  const inRate = m?.inputPer1M ?? 1;
  const outRate = m?.outputPer1M ?? 4;
  return Math.round(inTok * inRate + outTok * outRate);
}

/** Estimate a full 14-step run cost for a single model, in USD. */
export function estimateRunCostUsd(m: AIModel): number {
  let micros = 0;
  for (const role of Object.keys(ROLE_STEP_TOKENS)) {
    const t = ROLE_STEP_TOKENS[role];
    micros += (t.in * t.steps) * m.inputPer1M + (t.out * t.steps) * m.outputPer1M;
  }
  return micros / 1_000_000;
}

/** Estimate a run cost for a routing table (role -> model id), in USD. */
export function estimateRoutedRunCostUsd(routing: Record<string, string>, fallback: string): number {
  let micros = 0;
  for (const role of Object.keys(ROLE_STEP_TOKENS)) {
    const t = ROLE_STEP_TOKENS[role];
    const m = findModel(routing[role] ?? fallback) ?? findModel(fallback);
    const inRate = m?.inputPer1M ?? 1;
    const outRate = m?.outputPer1M ?? 4;
    micros += (t.in * t.steps) * inRate + (t.out * t.steps) * outRate;
  }
  return micros / 1_000_000;
}

export function formatContext(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`;
  return `${Math.round(tokens / 1000)}K`;
}

export function formatCost(micros: number): string {
  const usd = micros / 1_000_000;
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
