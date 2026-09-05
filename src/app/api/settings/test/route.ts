import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { aiSettings } from "@/db/schema";
import { handler, json, parseBody } from "@/lib/server/http";
import { resolveAiConfig, testConnection } from "@/lib/server/ai";

export const dynamic = "force-dynamic";

const schema = z.object({ model: z.string().trim().max(120).optional() });

export const POST = handler(async (req) => {
  const { model } = await parseBody(req, schema);
  const cfg = await resolveAiConfig();
  if (!cfg) return json({ ok: false, message: "No provider configured — save an API key first (or set OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY in the environment)." }, { status: 400 });
  const result = await testConnection(cfg, model || undefined);
  await db.update(aiSettings).set({ lastTestedAt: new Date(), lastTestStatus: result.ok ? "ok" : "error", lastTestMessage: result.message.slice(0, 500) })
    .where(eq(aiSettings.id, "default")).catch(() => undefined);
  return json(result, { status: result.ok ? 200 : 502 });
});
