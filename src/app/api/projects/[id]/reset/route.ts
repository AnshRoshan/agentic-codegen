import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, agents, tasks, agentMessages, commandExecutions, hitlCheckpoints, fileNodes as fileNodesTable } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";

/** Reset a project back to "planning" status so the pipeline can be re-run.
 *  Clears agent progress, task states, messages, and command logs.
 *  Preserves the file tree and DB schema (those are template-seeded).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Reset agents
    await db.update(agents).set({
      status: "idle",
      currentTask: null,
      progress: 0,
      output: null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
    }).where(eq(agents.projectId, id));

    // Reset tasks
    await db.update(tasks).set({
      status: "pending",
      output: null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
    }).where(eq(tasks.projectId, id));

    // Clear messages, commands, and blocking hitl checkpoints
    await db.delete(agentMessages).where(eq(agentMessages.projectId, id));
    await db.update(commandExecutions).set({ status: "queued", stdout: null, stderr: null, exitCode: null, durationMs: null, startedAt: null, completedAt: null }).where(eq(commandExecutions.projectId, id));

    // Only clear blocking hitl (illustrative ones stay)
    const allHitl = await db.select().from(hitlCheckpoints).where(eq(hitlCheckpoints.projectId, id));
    for (const cp of allHitl.filter((h) => h.isBlocking)) {
      await db.delete(hitlCheckpoints).where(eq(hitlCheckpoints.id, cp.id));
    }

    // Reset project counters and status
    await db.update(projects).set({
      status: "planning",
      completedTasks: 0,
      updatedAt: new Date(),
    }).where(eq(projects.id, id));

    // Re-add the initial orchestrator message
    const [orch] = await db.select().from(agents).where(and(eq(agents.projectId, id), eq(agents.role, "orchestrator")));
    if (orch) {
      await db.insert(agentMessages).values({
        id: "msg-reset-" + Date.now(),
        projectId: id,
        agentId: orch.id,
        role: "system",
        content: `🔄 Project reset. Pipeline starting fresh in ${project.mode} mode.`,
        metadata: { phase: "reset" },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to reset project:", error);
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }
}
