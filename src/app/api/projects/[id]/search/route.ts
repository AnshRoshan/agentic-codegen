import { and, eq, ilike, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { fileNodes } from "@/db/schema";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Full-text-ish search across generated files: returns matching lines with context. */
export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });
  const rows = await db
    .select({ path: fileNodes.path, content: fileNodes.content, language: fileNodes.language })
    .from(fileNodes)
    .where(and(eq(fileNodes.projectId, id), or(ilike(fileNodes.content, `%${q}%`), ilike(fileNodes.path, `%${q}%`))))
    .limit(40);
  const needle = q.toLowerCase();
  const results = rows.map((r) => {
    const lines = r.content.split("\n");
    const matches: Array<{ line: number; text: string }> = [];
    lines.forEach((text, i) => {
      if (text.toLowerCase().includes(needle) && matches.length < 5) matches.push({ line: i + 1, text: text.trim().slice(0, 160) });
    });
    return { path: r.path, language: r.language, matches };
  });
  return NextResponse.json({ results });
}
