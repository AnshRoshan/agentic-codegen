import "server-only";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAzure } from "@ai-sdk/azure";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, type LanguageModel } from "ai";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { aiSettings, type AiSettings, type ProjectSettings } from "@/db/schema";
import { findModel, type ProviderKey } from "@/lib/models";

export interface ResolvedAiConfig {
  provider: ProviderKey;
  apiKey: string;
  baseUrl: string | null;
  model: string;
  plannerModel: string | null;
  agentModels: Record<string, string>;
  azureResourceName: string | null;
  azureApiVersion: string | null;
  temperature: number;
  maxStepsPerTask: number;
  maxRetries: number;
  maxRepairIterations: number;
  budgetMicros: number;
  source: "database" | "environment";
}

const PLANNER_ROLES = new Set(["orchestrator", "architect"]);

export const DEFAULT_SETTINGS = {
  provider: "openai" as ProviderKey,
  model: "gpt-4.1-mini",
  temperature: 20,
  maxStepsPerTask: 12,
  maxRetries: 2,
  maxRepairIterations: 2,
  budgetMicros: 5_000_000,
  autoApproveDefault: false,
};

/** Ensure the singleton settings row exists and return it. */
export async function getSettingsRow(): Promise<AiSettings> {
  const [row] = await db.select().from(aiSettings).where(eq(aiSettings.id, "default"));
  if (row) return row;
  const [created] = await db
    .insert(aiSettings)
    .values({ id: "default" })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [again] = await db.select().from(aiSettings).where(eq(aiSettings.id, "default"));
  return again;
}

function envConfig(): ResolvedAiConfig | null {
  const base = {
    plannerModel: process.env.AI_PLANNER_MODEL ?? null,
    agentModels: {},
    azureResourceName: null,
    azureApiVersion: null,
    temperature: DEFAULT_SETTINGS.temperature,
    maxStepsPerTask: DEFAULT_SETTINGS.maxStepsPerTask,
    maxRetries: DEFAULT_SETTINGS.maxRetries,
    maxRepairIterations: DEFAULT_SETTINGS.maxRepairIterations,
    budgetMicros: DEFAULT_SETTINGS.budgetMicros,
    source: "environment" as const,
  };
  if (process.env.AZURE_API_KEY) {
    return {
      ...base,
      provider: "azure",
      apiKey: process.env.AZURE_API_KEY,
      baseUrl: process.env.AZURE_BASE_URL ?? null,
      model: process.env.AZURE_DEPLOYMENT_NAME ?? process.env.AI_MODEL ?? "gpt-4.1-mini",
      azureResourceName: process.env.AZURE_RESOURCE_NAME ?? null,
      azureApiVersion: process.env.AZURE_API_VERSION ?? null,
    };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { ...base, provider: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY, baseUrl: process.env.ANTHROPIC_BASE_URL ?? null, model: process.env.AI_MODEL ?? "claude-sonnet-4-5" };
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return { ...base, provider: "google", apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY, baseUrl: null, model: process.env.AI_MODEL ?? "gemini-2.5-flash" };
  }
  const key = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  if (key) {
    const baseUrl = process.env.AI_BASE_URL ?? process.env.OPENAI_BASE_URL ?? null;
    return { ...base, provider: baseUrl && !baseUrl.includes("api.openai.com") ? "custom" : "openai", apiKey: key, baseUrl, model: process.env.AI_MODEL ?? "gpt-4.1-mini" };
  }
  return null;
}

/**
 * Resolve the effective AI configuration.
 * Priority: Settings UI (DB) → environment variables → null (deterministic simulation engine).
 */
export async function resolveAiConfig(): Promise<ResolvedAiConfig | null> {
  try {
    const row = await getSettingsRow();
    if (row.isConfigured && row.apiKey) {
      return {
        provider: row.provider,
        apiKey: row.apiKey,
        baseUrl: row.baseUrl,
        model: row.model,
        plannerModel: row.plannerModel,
        agentModels: row.agentModels ?? {},
        azureResourceName: row.azureResourceName,
        azureApiVersion: row.azureApiVersion,
        temperature: row.temperature,
        maxStepsPerTask: row.maxStepsPerTask,
        maxRetries: row.maxRetries,
        maxRepairIterations: row.maxRepairIterations,
        budgetMicros: row.budgetMicros,
        source: "database",
      };
    }
    const env = envConfig();
    if (env) {
      // Even when the key comes from the environment, honour tuning knobs from the DB row.
      return {
        ...env,
        agentModels: row.agentModels ?? {},
        plannerModel: env.plannerModel ?? row.plannerModel,
        temperature: row.temperature,
        maxStepsPerTask: row.maxStepsPerTask,
        maxRetries: row.maxRetries,
        maxRepairIterations: row.maxRepairIterations,
        budgetMicros: row.budgetMicros,
      };
    }
    return null;
  } catch {
    return envConfig();
  }
}

/** Is a catalog model routable through the given provider? Unknown ids are allowed (custom deployments). */
export function isModelCompatible(modelId: string, provider: ProviderKey): boolean {
  const m = findModel(modelId);
  if (!m) return true;
  if (provider === "custom") return true; // any OpenAI-compatible gateway may proxy anything
  if (provider === "azure") return m.provider === "OpenAI";
  return m.servedBy.includes(provider);
}

/** Choose the model id for an agent role, honouring project → global → planner → default precedence. */
export function modelForRole(cfg: ResolvedAiConfig, role: string, projectSettings?: ProjectSettings | null): { modelId: string; fallbackReason?: string } {
  const candidates = [
    projectSettings?.agentModels?.[role],
    cfg.agentModels[role],
    PLANNER_ROLES.has(role) ? cfg.plannerModel ?? undefined : undefined,
    cfg.model,
  ].filter((x): x is string => !!x && x.trim().length > 0);

  for (const c of candidates) {
    if (isModelCompatible(c, cfg.provider)) {
      return { modelId: c };
    }
  }
  return { modelId: cfg.model, fallbackReason: `No compatible model override for ${role}; using ${cfg.model}` };
}

export function buildLanguageModel(cfg: ResolvedAiConfig, modelId: string): LanguageModel {
  switch (cfg.provider) {
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey: cfg.apiKey, baseURL: cfg.baseUrl ?? undefined });
      return anthropic(modelId);
    }
    case "google": {
      const google = createGoogleGenerativeAI({ apiKey: cfg.apiKey, baseURL: cfg.baseUrl ?? undefined });
      return google(modelId);
    }
    case "azure": {
      const azure = createAzure({
        apiKey: cfg.apiKey,
        resourceName: cfg.azureResourceName ?? undefined,
        baseURL: cfg.baseUrl ?? undefined,
        apiVersion: cfg.azureApiVersion ?? undefined,
      });
      return azure(modelId);
    }
    case "custom": {
      if (!cfg.baseUrl) throw new Error("Custom provider requires a base URL");
      const compat = createOpenAICompatible({ name: "custom", baseURL: cfg.baseUrl, apiKey: cfg.apiKey, includeUsage: true });
      return compat.chatModel(modelId);
    }
    case "openai":
    default: {
      const openai = createOpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseUrl ?? undefined });
      return openai(modelId);
    }
  }
}

export interface ConnectionTestResult {
  ok: boolean;
  latencyMs: number;
  model: string;
  provider: ProviderKey;
  message: string;
  usage?: { inputTokens: number; outputTokens: number };
}

/** Make a tiny real call to verify credentials, endpoint and model availability. */
export async function testConnection(cfg: ResolvedAiConfig, modelId?: string): Promise<ConnectionTestResult> {
  const model = modelId ?? cfg.model;
  const started = Date.now();
  try {
    const result = await generateText({
      model: buildLanguageModel(cfg, model),
      prompt: "Reply with the single word OK.",
      maxOutputTokens: 8,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(20_000),
    });
    const latencyMs = Date.now() - started;
    return {
      ok: true,
      latencyMs,
      model,
      provider: cfg.provider,
      message: `Connected in ${latencyMs}ms · ${model} responded "${result.text.trim().slice(0, 24) || "(empty)"}"`,
      usage: { inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0 },
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      model,
      provider: cfg.provider,
      message: describeError(err),
    };
  }
}

/** Errors where retrying the same request cannot help (bad credentials, unknown model, bad request shape). */
export function isNonRetryable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const status = (err as Error & { statusCode?: number }).statusCode;
  if (status && [400, 401, 403, 404, 422].includes(status)) return true;
  return /incorrect api key|invalid api key|authentication|model_not_found|does not exist|unsupported parameter/i.test(err.message);
}

export function describeError(err: unknown): string {
  if (err instanceof Error) {
    const anyErr = err as Error & { statusCode?: number; responseBody?: string; data?: unknown };
    const status = anyErr.statusCode ? ` (HTTP ${anyErr.statusCode})` : "";
    let body = "";
    if (typeof anyErr.responseBody === "string") {
      try {
        const parsed = JSON.parse(anyErr.responseBody) as { error?: { message?: string } | string };
        const msg = typeof parsed.error === "string" ? parsed.error : parsed.error?.message;
        if (msg && !err.message.includes(msg)) body = ` — ${msg}`;
      } catch {
        body = ` — ${anyErr.responseBody.slice(0, 200)}`;
      }
    }
    if (err.name === "TimeoutError" || err.name === "AbortError") return "Request timed out or was aborted";
    return `${err.message}${status}${body}`.slice(0, 600);
  }
  return String(err);
}
