import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { aiSettings } from "@/db/schema";

export const dynamic = "force-dynamic";

/** Verifies the configured provider credentials by listing models. */
export async function POST() {
  const [row] = await db.select().from(aiSettings).where(eq(aiSettings.id, "default"));
  const apiKey = row?.apiKey ?? process.env.OPENAI_API_KEY ?? null;
  const provider = row?.provider ?? "openai";
  let status = "failure";
  let message = "";

  if (!apiKey) {
    message = "No API key configured. Add a key or set OPENAI_API_KEY in the environment.";
  } else {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 8000);
      let url = "https://api.openai.com/v1/models";
      const headers: Record<string, string> = {};
      if (provider === "anthropic") {
        url = "https://api.anthropic.com/v1/models";
        headers["x-api-key"] = apiKey;
        headers["anthropic-version"] = "2023-06-01";
      } else if (provider === "azure") {
        url = `${(row?.baseUrl ?? "").replace(/\/$/, "")}/openai/models?api-version=2024-10-21`;
        headers["api-key"] = apiKey;
      } else {
        url = `${(row?.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "")}/models`;
        headers.Authorization = `Bearer ${apiKey}`;
      }
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(t);
      if (res.ok) {
        const json = (await res.json().catch(() => ({}))) as { data?: unknown[] };
        status = "success";
        message = `Connected to ${provider}. ${Array.isArray(json.data) ? `${json.data.length} models available.` : "Credentials accepted."}`;
      } else {
        message = `${provider} responded with HTTP ${res.status}. Check the key, base URL and model name.`;
      }
    } catch (err) {
      message = `Could not reach ${provider}: ${err instanceof Error ? err.message : "network error"}`;
    }
  }

  if (row) {
    await db.update(aiSettings).set({ lastTestedAt: new Date(), lastTestStatus: status, lastTestMessage: message }).where(eq(aiSettings.id, "default"));
  }
  return NextResponse.json({ status, message }, { status: status === "success" ? 200 : 400 });
}
