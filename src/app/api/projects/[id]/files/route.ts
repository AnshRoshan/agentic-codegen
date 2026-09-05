import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { fileNodes } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { fileId, content } = body as { fileId: string; content: string };

  if (!fileId || content === undefined) {
    return NextResponse.json({ error: "fileId and content are required" }, { status: 400 });
  }

  const [updated] = await db
    .update(fileNodes)
    .set({
      content,
      size: Buffer.byteLength(content, "utf8"),
      isModified: true,
      updatedAt: new Date(),
    })
    .where(and(eq(fileNodes.id, fileId), eq(fileNodes.projectId, id)))
    .returning();

  if (!updated) return NextResponse.json({ error: "File not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { path, content, language, type } = body as {
    path: string;
    content?: string;
    language?: string;
    type: "file" | "directory";
  };

  if (!path?.trim()) return NextResponse.json({ error: "Path is required" }, { status: 400 });

  const name = path.split("/").pop() ?? path;
  const parentPath = path.split("/").slice(0, -1).join("/");
  let parentId: string | null = null;

  if (parentPath) {
    const parentRows = await db
      .select()
      .from(fileNodes)
      .where(and(eq(fileNodes.projectId, id), eq(fileNodes.path, parentPath)));
    parentId = parentRows[0]?.id ?? null;
  }

  const [created] = await db
    .insert(fileNodes)
    .values({
      id: nanoid(12),
      projectId: id,
      agentId: null,
      parentId,
      name,
      path,
      type,
      content: content ?? null,
      language: language ?? null,
      size: content ? Buffer.byteLength(content, "utf8") : null,
      isGenerated: false,
      isModified: false,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const fileId = searchParams.get("fileId");

  if (!fileId) return NextResponse.json({ error: "fileId required" }, { status: 400 });

  await db
    .delete(fileNodes)
    .where(and(eq(fileNodes.id, fileId), eq(fileNodes.projectId, id)));

  return NextResponse.json({ success: true });
}
