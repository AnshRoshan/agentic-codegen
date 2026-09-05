import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { initializeProject } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const [source] = await db.select().from(projects).where(eq(projects.id, id));
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const newId = await initializeProject({
    name: `${source.name} (copy)`,
    prompt: source.prompt,
    mode: source.mode,
    autoApprove: source.autoApprove,
  });
  const [row] = await db.select().from(projects).where(eq(projects.id, newId));
  return NextResponse.json(row, { status: 201 });
}
