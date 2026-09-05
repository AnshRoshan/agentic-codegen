import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { db } from "@/db";
import { aiSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { buildLanguageModel, type ResolvedAiConfig } from "@/lib/ai-provider";

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

    // Use provided key, or fall back to stored key if the field was left masked/blank
    let effectiveKey = apiKey?.trim();
    if (!effectiveKey) {
      const [existing] = await db
        .select()
        .from(aiSettings)
        .where(eq(aiSettings.id, "default"));
      effectiveKey = existing?.apiKey ?? undefined;
    }

    if (!effectiveKey) {
      return NextResponse.json(
        { success: false, message: "No API key provided" },
        { status: 400 }
      );
    }

    const config: ResolvedAiConfig = {
      provider,
      apiKey: effectiveKey,
      baseUrl: baseUrl?.trim() || null,
      model: model?.trim() || "gpt-4o-mini",
      azureResourceName: azureResourceName?.trim() || null,
      azureApiVersion: azureApiVersion?.trim() || "2025-01-01-preview",
    };

    const languageModel = buildLanguageModel(config);

    const result = await generateText({
      model: languageModel,
      prompt: "Reply with exactly the word: OK",
      maxOutputTokens: 10,
    });

    const success = result.text.trim().length > 0;

    await db
      .update(aiSettings)
      .set({
        lastTestedAt: new Date(),
        lastTestStatus: success ? "success" : "failure",
        lastTestMessage: success
          ? `Connected successfully. Model responded: "${result.text.trim().slice(0, 50)}"`
          : "Model returned an empty response.",
        updatedAt: new Date(),
      })
      .where(eq(aiSettings.id, "default"));

    return NextResponse.json({
      success,
      message: success
        ? `Connection successful. Response: "${result.text.trim().slice(0, 80)}"`
        : "Model returned an empty response.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    try {
      await db
        .update(aiSettings)
        .set({
          lastTestedAt: new Date(),
          lastTestStatus: "failure",
          lastTestMessage: message.slice(0, 300),
          updatedAt: new Date(),
        })
        .where(eq(aiSettings.id, "default"));
    } catch {
      // ignore secondary failure
    }
    console.error("AI connection test failed:", error);
    return NextResponse.json(
      { success: false, message: message.slice(0, 300) },
      { status: 200 }
    );
  }
}
