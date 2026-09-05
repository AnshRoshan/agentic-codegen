import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { environmentVariables } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; envId: string }> }
) {
  const { id, envId } = await params;
  const body = await req.json();
  const { key, value, type, description, isSecret, isRequired } = body as {
    key?: string;
    value?: string;
    type?: "plain" | "secret" | "vault_ref";
    description?: string;
    isSecret?: boolean;
    isRequired?: boolean;
  };

  const [updated] = await db
    .update(environmentVariables)
    .set({
      ...(key !== undefined && { key }),
      ...(value !== undefined && { value }),
      ...(type !== undefined && { type }),
      ...(description !== undefined && { description }),
      ...(isSecret !== undefined && { isSecret }),
      ...(isRequired !== undefined && { isRequired }),
      updatedAt: new Date(),
    })
    .where(and(eq(environmentVariables.id, envId), eq(environmentVariables.projectId, id)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; envId: string }> }
) {
  const { id, envId } = await params;
  await db
    .delete(environmentVariables)
    .where(and(eq(environmentVariables.id, envId), eq(environmentVariables.projectId, id)));
  return NextResponse.json({ success: true });
}
