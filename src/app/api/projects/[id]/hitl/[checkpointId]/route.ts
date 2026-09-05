import { NextRequest, NextResponse } from "next/server";
import { resolveCheckpoint } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; checkpointId: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id, checkpointId } = await params;
  const body = (await req.json().catch(() => ({}))) as { decision?: "approved" | "rejected"; note?: string };
  if (body.decision !== "approved" && body.decision !== "rejected") {
    return NextResponse.json({ error: "decision must be approved or rejected" }, { status: 422 });
  }
  const result = await resolveCheckpoint(id, checkpointId, body.decision, body.note?.trim() || undefined);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
