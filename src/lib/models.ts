// ─── AI Model Catalog ───────────────────────────────────────────────────────
export interface AIModel {
  id: string; name: string; provider: "OpenAI" | "Anthropic" | "Google" | "Meta" | "Mistral" | "DeepSeek" | "Qwen" | "xAI";
  context: string; contextTokens: number;
  inputPer1M: number; outputPer1M: number;
  speed: 1 | 2 | 3 | 4 | 5; quality: 1 | 2 | 3 | 4 | 5;
  bestFor: string[]; capabilities: string[];
  recommended?: string; // agent role recommendation
}

export const AI_MODELS: AIModel[] = [
  { id: "gpt-4.1", name: "GPT-4.1", provider: "OpenAI", context: "1M tokens", contextTokens: 1000000, inputPer1M: 2.0, outputPer1M: 8.0, speed: 3, quality: 5, bestFor: ["Orchestration", "Architecture", "Complex reasoning"], capabilities: ["Tool calling", "Structured output", "Vision"], recommended: "orchestrator" },
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", provider: "OpenAI", context: "1M tokens", contextTokens: 1000000, inputPer1M: 0.4, outputPer1M: 1.6, speed: 5, quality: 4, bestFor: ["Code generation", "High-volume tasks"], capabilities: ["Tool calling", "Structured output"], recommended: "backend" },
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", context: "128K tokens", contextTokens: 128000, inputPer1M: 2.5, outputPer1M: 10.0, speed: 4, quality: 5, bestFor: ["Multimodal builds", "UI generation"], capabilities: ["Tool calling", "Vision", "Audio"] },
  { id: "claude-sonnet-4", name: "Claude Sonnet 4", provider: "Anthropic", context: "200K tokens", contextTokens: 200000, inputPer1M: 3.0, outputPer1M: 15.0, speed: 3, quality: 5, bestFor: ["Long refactors", "Careful code review"], capabilities: ["Tool calling", "Artifacts", "Vision"], recommended: "frontend" },
  { id: "claude-haiku-4", name: "Claude Haiku 4", provider: "Anthropic", context: "200K tokens", contextTokens: 200000, inputPer1M: 0.8, outputPer1M: 4.0, speed: 5, quality: 4, bestFor: ["Fast edits", "Tests", "Docs"], capabilities: ["Tool calling", "Vision"] },
  { id: "gemini-2-flash", name: "Gemini 2.0 Flash", provider: "Google", context: "1M tokens", contextTokens: 1000000, inputPer1M: 0.1, outputPer1M: 0.4, speed: 5, quality: 4, bestFor: ["Budget runs", "Bulk generation"], capabilities: ["Tool calling", "Vision", "Grounding"] },
  { id: "grok-3", name: "Grok 3", provider: "xAI", context: "1M tokens", contextTokens: 1000000, inputPer1M: 3.0, outputPer1M: 15.0, speed: 3, quality: 4, bestFor: ["Reasoning-heavy plans"], capabilities: ["Tool calling", "Live search"] },
  { id: "llama-3-3-70b", name: "Llama 3.3 70B", provider: "Meta", context: "128K tokens", contextTokens: 128000, inputPer1M: 0.35, outputPer1M: 0.4, speed: 4, quality: 4, bestFor: ["Self-hosted", "Private code"], capabilities: ["Tool calling", "Open weights"] },
  { id: "mistral-large-2", name: "Mistral Large 2", provider: "Mistral", context: "128K tokens", contextTokens: 128000, inputPer1M: 2.0, outputPer1M: 6.0, speed: 4, quality: 4, bestFor: ["EU hosting", "Multilingual"], capabilities: ["Tool calling", "Structured output"] },
  { id: "deepseek-v3", name: "DeepSeek V3", provider: "DeepSeek", context: "64K tokens", contextTokens: 64000, inputPer1M: 0.27, outputPer1M: 1.1, speed: 4, quality: 4, bestFor: ["Cheap reasoning", "Math/logic"], capabilities: ["Tool calling", "Open weights"], recommended: "testing" },
  { id: "qwen-2-5-coder-32b", name: "Qwen 2.5 Coder 32B", provider: "Qwen", context: "128K tokens", contextTokens: 128000, inputPer1M: 0.3, outputPer1M: 0.9, speed: 4, quality: 4, bestFor: ["Code completion", "Self-hosted"], capabilities: ["Tool calling", "Open weights", "Fill-in-middle"] },
  { id: "devstral-2", name: "Devstral 2", provider: "Mistral", context: "256K tokens", contextTokens: 256000, inputPer1M: 0.6, outputPer1M: 1.8, speed: 4, quality: 4, bestFor: ["Agentic coding loops"], capabilities: ["Tool calling", "Long context"] },
];

export const PROVIDERS = ["All", "OpenAI", "Anthropic", "Google", "Meta", "Mistral", "DeepSeek", "Qwen", "xAI"] as const;

export function costMicrosFor(modelId: string, inTok: number, outTok: number): number {
  const m = AI_MODELS.find((x) => x.id === modelId) ?? AI_MODELS[1];
  return Math.round(inTok * m.inputPer1M + outTok * m.outputPer1M);
}

export function formatCost(micros: number): string {
  const usd = micros / 1_000_000;
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
