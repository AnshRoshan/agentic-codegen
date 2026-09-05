import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { runNextStep } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Advance the agent pipeline by one step. Clients poll this while the project is running. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { action?: "start" | "step" | "pause" | "resume" };

  if (body.action === "pause") {
    const [row] = await db.update(projects).set({ status: "paused", updatedAt: new Date() }).where(eq(projects.id, id)).returning();
    return NextResponse.json({ ok: true, status: row?.status ?? "paused" });
  }
  if (body.action === "resume" || body.action === "start") {
    const [current] = await db.select().from(projects).where(eq(projects.id, id));
    if (!current) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    if (current.status === "paused" || current.status === "draft") {
      const status = current.currentStep === 0 ? "planning" : current.currentStep >= current.totalSteps ? "completed" : "generating";
      await db.update(projects).set({ status, updatedAt: new Date() }).where(eq(projects.id, id));
    }
  }

  const result = await runNextStep(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
