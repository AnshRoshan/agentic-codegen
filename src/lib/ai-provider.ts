import { createOpenAI } from "@ai-sdk/openai";
import { createAzure } from "@ai-sdk/azure";
import type { LanguageModel } from "ai";
import { db } from "@/db";
import { aiSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface ResolvedAiConfig {
  provider: "openai" | "azure" | "custom";
  apiKey: string;
  baseUrl: string | null;
  model: string;
  azureResourceName: string | null;
  azureApiVersion: string | null;
}

/**
 * Resolve AI provider configuration.
 * Priority: DB-stored settings (configured via Settings UI) -> environment variables -> null (simulation mode)
 */
export async function getAiConfig(): Promise<ResolvedAiConfig | null> {
  try {
    const [row] = await db
      .select()
      .from(aiSettings)
      .where(eq(aiSettings.id, "default"));

    if (row && row.isConfigured && row.apiKey) {
      return {
        provider: row.provider,
        apiKey: row.apiKey,
        baseUrl: row.baseUrl,
        model: row.model ?? "gpt-4o-mini",
        azureResourceName: row.azureResourceName,
        azureApiVersion: row.azureApiVersion,
      };
    }
  } catch {
    // table might not exist yet or db error - fall through to env vars
  }

  // Fallback to environment variables (server-side only)
  const envKey =
    process.env.OPENAI_API_KEY ||
    process.env.AZURE_API_KEY ||
    process.env.AI_API_KEY;

  if (envKey) {
    if (process.env.AZURE_API_KEY) {
      return {
        provider: "azure",
        apiKey: process.env.AZURE_API_KEY,
        baseUrl: process.env.AZURE_BASE_URL ?? null,
        model: process.env.AZURE_DEPLOYMENT_NAME ?? "gpt-4o-mini",
        azureResourceName: process.env.AZURE_RESOURCE_NAME ?? null,
        azureApiVersion: process.env.AZURE_API_VERSION ?? "2025-01-01-preview",
      };
    }
    return {
      provider: process.env.AI_BASE_URL ? "custom" : "openai",
      apiKey: envKey,
      baseUrl: process.env.AI_BASE_URL ?? null,
      model: process.env.AI_MODEL ?? "gpt-4o-mini",
      azureResourceName: null,
      azureApiVersion: null,
    };
  }

  return null;
}

/**
 * Build a Vercel AI SDK LanguageModel instance from resolved configuration.
 */
export function buildLanguageModel(config: ResolvedAiConfig): LanguageModel {
  if (config.provider === "azure") {
    const azure = createAzure({
      apiKey: config.apiKey,
      resourceName: config.azureResourceName ?? undefined,
      baseURL: config.baseUrl ?? undefined,
      apiVersion: config.azureApiVersion ?? "2025-01-01-preview",
    });
    return azure(config.model);
  }

  // openai + custom (OpenAI-compatible) both use createOpenAI with optional baseURL override
  const openai = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl ?? undefined,
  });
  return openai(config.model);
}

export async function isAiConfigured(): Promise<boolean> {
  const config = await getAiConfig();
  return config !== null;
}
