import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { environmentVariables, projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const vars = await db
    .select()
    .from(environmentVariables)
    .where(eq(environmentVariables.projectId, id));
  return NextResponse.json(vars);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { key, value, type, description, isSecret, isRequired } = body as {
    key: string;
    value?: string;
    type: "plain" | "secret" | "vault_ref";
    description?: string;
    isSecret?: boolean;
    isRequired?: boolean;
  };

  if (!key?.trim()) return NextResponse.json({ error: "Key is required" }, { status: 400 });

  // Check project exists
  const [project] = await db.select().from(projects).where(eq(projects.id, id));
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Upsert by key
  const existing = await db
    .select()
    .from(environmentVariables)
    .where(and(eq(environmentVariables.projectId, id), eq(environmentVariables.key, key)));

  if (existing.length > 0) {
    const [updated] = await db
      .update(environmentVariables)
      .set({
        value: value ?? null,
        type,
        description: description ?? null,
        isSecret: isSecret ?? type !== "plain",
        isRequired: isRequired ?? true,
        updatedAt: new Date(),
      })
      .where(eq(environmentVariables.id, existing[0].id))
      .returning();
    return NextResponse.json(updated);
  }

  const [created] = await db
    .insert(environmentVariables)
    .values({
      id: nanoid(12),
      projectId: id,
      key,
      value: value ?? null,
      type,
      description: description ?? null,
      isSecret: isSecret ?? type !== "plain",
      isRequired: isRequired ?? true,
      source: "user",
    })
    .returning();
  return NextResponse.json(created, { status: 201 });
}
