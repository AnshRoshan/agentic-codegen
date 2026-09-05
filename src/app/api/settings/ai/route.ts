import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { aiSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const [row] = await db
      .select()
      .from(aiSettings)
      .where(eq(aiSettings.id, "default"));

    if (!row) {
      return NextResponse.json({
        provider: "openai",
        apiKey: null,
        baseUrl: null,
        model: "gpt-4o-mini",
        azureResourceName: null,
        azureApiVersion: "2025-01-01-preview",
        isConfigured: false,
        hasApiKey: false,
        lastTestStatus: null,
        lastTestMessage: null,
      });
    }

    // Never send the raw API key back to the client — mask it
    return NextResponse.json({
      provider: row.provider,
      apiKey: null,
      hasApiKey: Boolean(row.apiKey),
      apiKeyMasked: row.apiKey ? `${row.apiKey.slice(0, 4)}${"•".repeat(20)}` : null,
      baseUrl: row.baseUrl,
      model: row.model,
      azureResourceName: row.azureResourceName,
      azureApiVersion: row.azureApiVersion,
      isConfigured: row.isConfigured,
      lastTestStatus: row.lastTestStatus,
      lastTestMessage: row.lastTestMessage,
      lastTestedAt: row.lastTestedAt,
    });
  } catch (error) {
    console.error("Failed to fetch AI settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      provider,
      apiKey,
      baseUrl,
      model,
      azureResourceName,
      azureApiVersion,
    } = body as {
      provider: "openai" | "azure" | "custom";
      apiKey?: string;
      baseUrl?: string;
      model?: string;
      azureResourceName?: string;
      azureApiVersion?: string;
    };

    const [existing] = await db
      .select()
      .from(aiSettings)
      .where(eq(aiSettings.id, "default"));

    const values = {
      provider,
      // Only overwrite the stored key if a new one was provided (avoid clobbering with empty string)
      apiKey: apiKey && apiKey.trim() ? apiKey.trim() : existing?.apiKey ?? null,
      baseUrl: baseUrl?.trim() || null,
      model: model?.trim() || "gpt-4o-mini",
      azureResourceName: azureResourceName?.trim() || null,
      azureApiVersion: azureApiVersion?.trim() || "2025-01-01-preview",
      isConfigured: Boolean((apiKey && apiKey.trim()) || existing?.apiKey),
      updatedAt: new Date(),
    };

    if (existing) {
      await db.update(aiSettings).set(values).where(eq(aiSettings.id, "default"));
    } else {
      await db.insert(aiSettings).values({ id: "default", ...values });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save AI settings:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await db
      .update(aiSettings)
      .set({
        apiKey: null,
        isConfigured: false,
        lastTestStatus: null,
        lastTestMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(aiSettings.id, "default"));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to clear AI settings:", error);
    return NextResponse.json({ error: "Failed to clear settings" }, { status: 500 });
  }
}
