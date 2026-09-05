import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { fileNodes } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.toLowerCase() ?? "";

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const allFiles = await db
    .select()
    .from(fileNodes)
    .where(and(eq(fileNodes.projectId, id), eq(fileNodes.type, "file")));

  const results: Array<{
    fileId: string;
    path: string;
    language: string | null;
    matches: Array<{ line: number; text: string }>;
  }> = [];

  for (const file of allFiles) {
    const content = file.content ?? "";
    if (!content) continue;

    const lines = content.split("\n");
    const matches: Array<{ line: number; text: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(query)) {
        matches.push({ line: i + 1, text: lines[i].trim().slice(0, 200) });
        if (matches.length >= 5) break; // max 5 matches per file
      }
    }

    if (matches.length > 0 || file.path.toLowerCase().includes(query)) {
      results.push({
        fileId: file.id,
        path: file.path,
        language: file.language,
        matches: matches.length > 0 ? matches : [{ line: 0, text: "filename match" }],
      });
      if (results.length >= 50) break;
    }
  }

  return NextResponse.json({ results, query });
}
