import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { agentMessages, fileNodes } from "@/db/schema";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** GET ?path=src/app/page.tsx → file with content */
export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const path = req.nextUrl.searchParams.get("path");
  if (!path) return NextResponse.json({ error: "path is required" }, { status: 422 });
  const [row] = await db.select().from(fileNodes).where(and(eq(fileNodes.projectId, id), eq(fileNodes.path, path)));
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

/** PUT { path, content } → save user edits to a file */
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { path?: string; content?: string };
  if (!body.path || typeof body.content !== "string") return NextResponse.json({ error: "path and content are required" }, { status: 422 });
  const [existing] = await db.select().from(fileNodes).where(and(eq(fileNodes.projectId, id), eq(fileNodes.path, body.path)));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [row] = await db
    .update(fileNodes)
    .set({ content: body.content, size: body.content.length, version: existing.version + 1, isModified: true, updatedAt: new Date() })
    .where(eq(fileNodes.id, existing.id))
    .returning();
  await db.insert(agentMessages).values({ id: nanoid(), projectId: id, kind: "user", content: `Edited ${body.path} (v${row.version})`, metadata: { path: body.path } });
  return NextResponse.json(row);
}
