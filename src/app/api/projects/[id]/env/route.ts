import { and, asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { agentMessages, environmentVariables } from "@/db/schema";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const rows = await db.select().from(environmentVariables).where(eq(environmentVariables.projectId, id)).orderBy(asc(environmentVariables.key));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { key?: string; value?: string; description?: string; isSecret?: boolean; isRequired?: boolean };
  const key = body.key?.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  if (!key) return NextResponse.json({ error: "Key is required" }, { status: 422 });
  const [existing] = await db.select().from(environmentVariables).where(and(eq(environmentVariables.projectId, id), eq(environmentVariables.key, key)));
  if (existing) return NextResponse.json({ error: `${key} already exists` }, { status: 409 });
  const [row] = await db
    .insert(environmentVariables)
    .values({
      id: nanoid(),
      projectId: id,
      key,
      value: body.value ?? "",
      description: body.description ?? null,
      isSecret: !!body.isSecret,
      isRequired: body.isRequired ?? true,
      source: "user",
    })
    .returning();
  await db.insert(agentMessages).values({ id: nanoid(), projectId: id, kind: "user", content: `Added environment variable ${key}` });
  return NextResponse.json(row, { status: 201 });
}
