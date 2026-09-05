import { handler, json } from "@/lib/server/http";
import { AI_MODELS } from "@/lib/models";
import { isModelCompatible, resolveAiConfig } from "@/lib/server/ai";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const cfg = await resolveAiConfig();
  return json({
    provider: cfg?.provider ?? null,
    configured: !!cfg,
    models: AI_MODELS.map((m) => ({ ...m, available: cfg ? isModelCompatible(m.id, cfg.provider) : false })),
  });
});
