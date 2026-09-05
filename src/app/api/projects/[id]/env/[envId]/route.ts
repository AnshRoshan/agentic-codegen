import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { environmentVariables } from "@/db/schema";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; envId: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id, envId } = await params;
  const body = (await req.json().catch(() => ({}))) as { value?: string; description?: string; isSecret?: boolean; isRequired?: boolean };
  const patch: Partial<typeof environmentVariables.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.value === "string") patch.value = body.value;
  if (typeof body.description === "string") patch.description = body.description;
  if (typeof body.isSecret === "boolean") patch.isSecret = body.isSecret;
  if (typeof body.isRequired === "boolean") patch.isRequired = body.isRequired;
  const [row] = await db
    .update(environmentVariables)
    .set(patch)
    .where(and(eq(environmentVariables.id, envId), eq(environmentVariables.projectId, id)))
    .returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id, envId } = await params;
  const [row] = await db
    .delete(environmentVariables)
    .where(and(eq(environmentVariables.id, envId), eq(environmentVariables.projectId, id)))
    .returning({ id: environmentVariables.id });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
