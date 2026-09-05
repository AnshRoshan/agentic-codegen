import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { hitlCheckpoints, agents, projects, tasks } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; checkpointId: string }> }
) {
  try {
    const { id, checkpointId } = await params;
    const body = await req.json();
    const { action, reason, modifications } = body as {
      action: "approve" | "reject" | "modify";
      reason?: string;
      modifications?: string;
    };

    const [checkpoint] = await db
      .select()
      .from(hitlCheckpoints)
      .where(eq(hitlCheckpoints.id, checkpointId));

    if (!checkpoint) {
      return NextResponse.json(
        { error: "Checkpoint not found" },
        { status: 404 }
      );
    }

    if (checkpoint.status !== "pending") {
      return NextResponse.json(
        { error: "Checkpoint already resolved" },
        { status: 400 }
      );
    }

    const now = new Date();

    // Update checkpoint status
    await db
      .update(hitlCheckpoints)
      .set({
        status:
          action === "approve"
            ? "approved"
            : action === "reject"
            ? "rejected"
            : "modified",
        approvedBy: action !== "reject" ? "user" : null,
        approvedAt: action !== "reject" ? now : null,
        rejectionReason: action === "reject" ? reason : null,
        modifications: action === "modify" ? modifications : null,
        updatedAt: now,
      })
      .where(eq(hitlCheckpoints.id, checkpointId));

    // If approved, update related task and agent
    if (action === "approve" || action === "modify") {
      if (checkpoint.taskId) {
        await db
          .update(tasks)
          .set({
            status: "completed",
            completedAt: now,
          })
          .where(eq(tasks.id, checkpoint.taskId));
      }

      if (checkpoint.agentId) {
        await db
          .update(agents)
          .set({
            status: "working",
            currentTask: null,
          })
          .where(eq(agents.id, checkpoint.agentId));
      }
    } else {
      // Rejected - mark task as failed
      if (checkpoint.taskId) {
        await db
          .update(tasks)
          .set({
            status: "failed",
            errorMessage: reason ?? "Rejected by user",
            completedAt: now,
          })
          .where(eq(tasks.id, checkpoint.taskId));
      }
    }

    // Check if all HITL checkpoints are resolved
    const pendingHitl = await db
      .select()
      .from(hitlCheckpoints)
      .where(eq(hitlCheckpoints.projectId, id))
      .then((rows) => rows.filter((r) => r.status === "pending"));

    if (pendingHitl.length === 0) {
      await db
        .update(projects)
        .set({
          status: "generating",
          updatedAt: now,
        })
        .where(eq(projects.id, id));
    }

    return NextResponse.json({
      success: true,
      action,
      checkpointId,
      remainingPending: pendingHitl.length,
    });
  } catch (error) {
    console.error("Failed to process HITL decision:", error);
    return NextResponse.json(
      { error: "Failed to process decision" },
      { status: 500 }
    );
  }
}
