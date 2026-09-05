import { NextResponse } from "next/server";
import { PRESETS } from "@/lib/domain";
import { AGENTS } from "@/lib/agents";

export async function GET() {
  return NextResponse.json({ presets: PRESETS, agents: Object.values(AGENTS) });
}
