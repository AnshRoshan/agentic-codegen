import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { agentMessages, projects } from "@/db/schema";

export const dynamic = "force-dynamic";

/** Global activity feed across all projects. */
export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 30), 100);
  const rows = await db
    .select({
      id: agentMessages.id,
      projectId: agentMessages.projectId,
      projectName: projects.name,
      projectEmoji: projects.emoji,
      agentRole: agentMessages.agentRole,
      kind: agentMessages.kind,
      content: agentMessages.content,
      createdAt: agentMessages.createdAt,
    })
    .from(agentMessages)
    .innerJoin(projects, eq(projects.id, agentMessages.projectId))
    .orderBy(desc(agentMessages.createdAt))
    .limit(limit);
  return NextResponse.json(rows);
}
