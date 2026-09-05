import { desc, ilike, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { initializeProject } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const where = q ? or(ilike(projects.name, `%${q}%`), ilike(projects.prompt, `%${q}%`), ilike(projects.domainLabel, `%${q}%`)) : undefined;
  const rows = await db.select().from(projects).where(where).orderBy(desc(projects.updatedAt));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { name?: string; prompt?: string; mode?: string; autoApprove?: boolean };
  const prompt = body.prompt?.trim();
  if (!prompt || prompt.length < 12) {
    return NextResponse.json({ error: "Please describe what you want to build (at least 12 characters)." }, { status: 422 });
  }
  const id = await initializeProject({
    name: body.name,
    prompt,
    mode: body.mode === "brownfield" ? "brownfield" : "greenfield",
    autoApprove: !!body.autoApprove,
  });
  const [project] = await db.select().from(projects).where(ilike(projects.id, id));
  return NextResponse.json(project, { status: 201 });
}
