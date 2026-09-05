import { NextRequest, NextResponse } from "next/server";
import { resetProject } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  await resetProject(id);
  return NextResponse.json({ ok: true });
}
