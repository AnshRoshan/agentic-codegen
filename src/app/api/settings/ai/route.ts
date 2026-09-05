import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { aiSettings } from "@/db/schema";

export const dynamic = "force-dynamic";

function mask(key: string | null) {
  if (!key) return null;
  return key.length <= 8 ? "••••" : `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
}

async function getOrCreate() {
  const [row] = await db.select().from(aiSettings).where(eq(aiSettings.id, "default"));
  if (row) return row;
  const [created] = await db.insert(aiSettings).values({ id: "default" }).returning();
  return created;
}

export async function GET() {
  const row = await getOrCreate();
  return NextResponse.json({ ...row, apiKey: undefined, apiKeyMasked: mask(row.apiKey), hasKey: !!row.apiKey, envKeyPresent: !!process.env.OPENAI_API_KEY });
}

export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { provider?: string; apiKey?: string; baseUrl?: string; model?: string; temperature?: number };
  const current = await getOrCreate();
  const provider = ["openai", "azure", "anthropic", "custom"].includes(body.provider ?? "") ? (body.provider as typeof current.provider) : current.provider;
  const apiKey = typeof body.apiKey === "string" && body.apiKey.trim() ? body.apiKey.trim() : current.apiKey;
  const [row] = await db
    .update(aiSettings)
    .set({
      provider,
      apiKey,
      baseUrl: typeof body.baseUrl === "string" ? body.baseUrl.trim() || null : current.baseUrl,
      model: typeof body.model === "string" && body.model.trim() ? body.model.trim() : current.model,
      temperature: typeof body.temperature === "number" ? Math.round(Math.max(0, Math.min(2, body.temperature)) * 100) : current.temperature,
      isConfigured: !!apiKey,
      updatedAt: new Date(),
    })
    .where(eq(aiSettings.id, "default"))
    .returning();
  return NextResponse.json({ ...row, apiKey: undefined, apiKeyMasked: mask(row.apiKey), hasKey: !!row.apiKey, envKeyPresent: !!process.env.OPENAI_API_KEY });
}

export async function DELETE() {
  const [row] = await db
    .update(aiSettings)
    .set({ apiKey: null, isConfigured: false, lastTestStatus: null, lastTestMessage: null, updatedAt: new Date() })
    .where(eq(aiSettings.id, "default"))
    .returning();
  return NextResponse.json({ ...row, apiKey: undefined, apiKeyMasked: null, hasKey: false });
}
