// Model pricing table (USD per 1M tokens, as of mid-2026)
// Updated: add new models as needed.

export interface ModelPricing {
  input: number;   // per 1M input tokens
  output: number;  // per 1M output tokens
  cachedInput?: number; // per 1M cached input tokens (if supported)
}

const PRICING: Record<string, ModelPricing> = {
  // OpenAI
  "gpt-4o":          { input: 2.50,  output: 10.00,  cachedInput: 1.25 },
  "gpt-4o-mini":     { input: 0.15,  output: 0.60,   cachedInput: 0.075 },
  "gpt-4-turbo":     { input: 10.00, output: 30.00 },
  "gpt-4":           { input: 30.00, output: 60.00 },
  "gpt-3.5-turbo":   { input: 0.50,  output: 1.50 },
  "o1":              { input: 15.00, output: 60.00 },
  "o1-mini":         { input: 3.00,  output: 12.00 },
  "o3-mini":         { input: 1.10,  output: 4.40 },
  // Claude via OpenAI-compatible
  "claude-sonnet-4-20250514": { input: 3.00, output: 15.00 },
  "claude-3-5-sonnet":        { input: 3.00, output: 15.00 },
  "claude-3-haiku":           { input: 0.25, output: 1.25 },
  "claude-opus-4":            { input: 15.00, output: 75.00 },
  // Groq / open models
  "llama-3.3-70b-versatile":  { input: 0.59, output: 0.79 },
  "mixtral-8x7b":             { input: 0.24, output: 0.24 },
  "gemma2-9b-it":             { input: 0.20, output: 0.20 },
  // Gemini via compatible
  "gemini-2.0-flash":         { input: 0.10, output: 0.40 },
  "gemini-1.5-pro":           { input: 1.25, output: 5.00 },
  // DeepSeek
  "deepseek-chat":            { input: 0.14, output: 0.28 },
  "deepseek-coder":           { input: 0.14, output: 0.28 },
};

// Fuzzy match: "gpt-4o-mini-2024-07-18" → "gpt-4o-mini"
function findPricing(model: string): ModelPricing {
  const lower = model.toLowerCase();
  // Exact match
  if (PRICING[lower]) return PRICING[lower];
  // Prefix match (longest first)
  const sorted = Object.keys(PRICING).sort((a, b) => b.length - a.length);
  for (const key of sorted) {
    if (lower.startsWith(key) || lower.includes(key)) return PRICING[key];
  }
  // Fallback: gpt-4o-mini pricing
  return { input: 0.15, output: 0.60 };
}

export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
  cached = false
): { costUsd: number; pricing: ModelPricing } {
  const pricing = findPricing(model);
  const inputRate = cached && pricing.cachedInput ? pricing.cachedInput : pricing.input;
  const costUsd =
    (promptTokens * inputRate) / 1_000_000 +
    (completionTokens * pricing.output) / 1_000_000;
  return { costUsd, pricing };
}

export function formatCost(usd: number): string {
  if (usd < 0.001) return `$${(usd * 100).toFixed(4)}¢`;
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

export function formatTokens(tokens: number): string {
  if (tokens < 1000) return String(tokens);
  if (tokens < 1_000_000) return `${(tokens / 1000).toFixed(1)}k`;
  return `${(tokens / 1_000_000).toFixed(2)}M`;
}
