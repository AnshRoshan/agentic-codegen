import { NextResponse } from "next/server";
import { db } from "@/db";
import { agentMessages, projects } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Global activity feed across all projects. Returns the latest N messages
 * enriched with the project name / mode so the UI can render project origin.
 */
export async function GET() {
  try {
    const messages = await db
      .select()
      .from(agentMessages)
      .orderBy(desc(agentMessages.createdAt))
      .limit(50);

    const projectIds = [...new Set(messages.map((m) => m.projectId))];
    const projectRows = await Promise.all(
      projectIds.map(async (id) => {
        const [p] = await db.select().from(projects).where(eq(projects.id, id));
        return p;
      })
    );
    const pMap = new Map(projectRows.filter(Boolean).map((p) => [p!.id, p!]));

    const feed = messages.map((m) => ({
      id: m.id,
      projectId: m.projectId,
      projectName: pMap.get(m.projectId)?.name ?? "(deleted)",
      projectMode: pMap.get(m.projectId)?.mode ?? null,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    }));

    return NextResponse.json({ feed });
  } catch (error) {
    console.error("Activity feed failed:", error);
    return NextResponse.json({ feed: [] }, { status: 200 });
  }
}
