import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { aiSettings } from "@/db/schema";
import { handler, json, parseBody } from "@/lib/server/http";
import { getSettingsRow, resolveAiConfig } from "@/lib/server/ai";

export const dynamic = "force-dynamic";

function publicSettings(row: Awaited<ReturnType<typeof getSettingsRow>>, envConfigured: boolean, envProvider: string | null) {
  const { apiKey, ...rest } = row;
  return {
    ...rest,
    hasApiKey: !!apiKey,
    apiKeyHint: apiKey ? `${apiKey.slice(0, 3)}…${apiKey.slice(-4)}` : null,
    envConfigured,
    envProvider,
    agentModels: row.agentModels ?? {},
    lastTestedAt: row.lastTestedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const GET = handler(async () => {
  const row = await getSettingsRow();
  const cfg = await resolveAiConfig();
  return json({ settings: publicSettings(row, cfg?.source === "environment", cfg?.source === "environment" ? cfg.provider : null) });
});

const schema = z.object({
  provider: z.enum(["openai", "anthropic", "google", "azure", "custom"]).optional(),
  apiKey: z.string().max(500).optional(), // "" clears the key
  baseUrl: z.string().max(500).nullable().optional(),
  model: z.string().trim().min(1).max(120).optional(),
  plannerModel: z.string().trim().max(120).nullable().optional(),
  agentModels: z.record(z.string(), z.string().max(120)).optional(),
  azureResourceName: z.string().max(200).nullable().optional(),
  azureApiVersion: z.string().max(50).nullable().optional(),
  temperature: z.number().int().min(0).max(200).optional(),
  maxStepsPerTask: z.number().int().min(2).max(40).optional(),
  maxRetries: z.number().int().min(0).max(5).optional(),
  maxRepairIterations: z.number().int().min(0).max(5).optional(),
  budgetMicros: z.number().int().min(0).max(1_000_000_000).optional(),
  autoApproveDefault: z.boolean().optional(),
});

export const PUT = handler(async (req) => {
  const body = await parseBody(req, schema);
  const current = await getSettingsRow();
  const apiKey = body.apiKey === undefined ? current.apiKey : body.apiKey.trim() || null;
  const provider = body.provider ?? current.provider;
  const baseUrl = body.baseUrl === undefined ? current.baseUrl : body.baseUrl?.trim() || null;
  if (provider === "custom" && apiKey && !baseUrl) {
    return json({ error: "Custom provider requires a base URL" }, { status: 400 });
  }
  const agentModels = body.agentModels
    ? Object.fromEntries(Object.entries(body.agentModels).filter(([, v]) => v && v.trim()))
    : current.agentModels;
  const [row] = await db.update(aiSettings).set({
    provider, apiKey, baseUrl,
    model: body.model ?? current.model,
    plannerModel: body.plannerModel === undefined ? current.plannerModel : body.plannerModel || null,
    agentModels,
    azureResourceName: body.azureResourceName === undefined ? current.azureResourceName : body.azureResourceName,
    azureApiVersion: body.azureApiVersion === undefined ? current.azureApiVersion : body.azureApiVersion,
    temperature: body.temperature ?? current.temperature,
    maxStepsPerTask: body.maxStepsPerTask ?? current.maxStepsPerTask,
    maxRetries: body.maxRetries ?? current.maxRetries,
    maxRepairIterations: body.maxRepairIterations ?? current.maxRepairIterations,
    budgetMicros: body.budgetMicros ?? current.budgetMicros,
    autoApproveDefault: body.autoApproveDefault ?? current.autoApproveDefault,
    isConfigured: !!apiKey,
    // Credentials changed → previous test result is no longer meaningful.
    ...(body.apiKey !== undefined || body.provider !== undefined || body.baseUrl !== undefined ? { lastTestStatus: null, lastTestMessage: null, lastTestedAt: null } : {}),
    updatedAt: new Date(),
  }).where(eq(aiSettings.id, "default")).returning();
  const cfg = await resolveAiConfig();
  return json({ settings: publicSettings(row, cfg?.source === "environment", cfg?.source === "environment" ? cfg.provider : null) });
});
