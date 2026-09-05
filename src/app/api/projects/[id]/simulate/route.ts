import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  projects,
  agents,
  tasks,
  commandExecutions,
  agentMessages,
  fileNodes,
  hitlCheckpoints,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { AGENT_DEFINITIONS, type AgentRoleId } from "@/lib/agents";
import { getAiConfig } from "@/lib/ai-provider";
import { runAgentTask } from "@/lib/agent-engine";

// Advance the agent pipeline by one task step.
// Uses real LLM tool-calling when an AI provider is configured, otherwise
// falls back to a deterministic simulation so the app remains usable without keys.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // If project is blocked on a pending, task-scoped HITL checkpoint, do not advance.
    // Illustrative/example checkpoints (isBlocking: false) are shown in the HITL tab
    // but do not gate the pipeline — only checkpoints raised live by an agent do.
    const allPendingHitl = await db
      .select()
      .from(hitlCheckpoints)
      .where(and(eq(hitlCheckpoints.projectId, id), eq(hitlCheckpoints.status, "pending")));
    const pendingHitl = allPendingHitl.filter((h) => h.isBlocking);

    if (pendingHitl.length > 0) {
      await db
        .update(projects)
        .set({ status: "waiting_approval", updatedAt: new Date() })
        .where(eq(projects.id, id));
      return NextResponse.json({
        status: "waiting_approval",
        message: "Project paused — resolve pending human approval checkpoints to continue.",
        pendingCheckpoints: pendingHitl.length,
      });
    }

    const projectTasks = await db.select().from(tasks).where(eq(tasks.projectId, id));
    const projectAgents = await db.select().from(agents).where(eq(agents.projectId, id));

    const pendingTasks = projectTasks
      .filter((t) => t.status === "pending")
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

    if (pendingTasks.length === 0) {
      await db
        .update(projects)
        .set({ status: "completed", completedTasks: projectTasks.length, updatedAt: new Date() })
        .where(eq(projects.id, id));

      for (const agent of projectAgents) {
        if (agent.status !== "completed") {
          await db
            .update(agents)
            .set({ status: "completed", completedAt: new Date(), progress: 100 })
            .where(eq(agents.id, agent.id));
        }
      }

      await db.insert(agentMessages).values({
        id: nanoid(12),
        projectId: id,
        agentId: null,
        role: "system",
        content: "✅ All tasks completed! The codebase is ready for review, download, and deployment.",
        metadata: { phase: "completed" },
      });

      return NextResponse.json({ status: "completed", remaining: 0 });
    }

    const nextTask = pendingTasks[0];
    const taskAgent = projectAgents.find((a) => a.id === nextTask.agentId);
    const aiConfig = await getAiConfig();

    // Mark task in progress + agent working
    await db
      .update(tasks)
      .set({ status: "in_progress", startedAt: new Date() })
      .where(eq(tasks.id, nextTask.id));

    if (taskAgent) {
      const agentDef = AGENT_DEFINITIONS[taskAgent.role as AgentRoleId];
      await db
        .update(agents)
        .set({
          status: "working",
          currentTask: nextTask.title,
          startedAt: taskAgent.startedAt ?? new Date(),
        })
        .where(eq(agents.id, taskAgent.id));

      await db.insert(agentMessages).values({
        id: nanoid(12),
        projectId: id,
        agentId: taskAgent.id,
        role: "agent",
        content: `${agentDef.emoji} **${agentDef.name}**: Starting "${nextTask.title}"${aiConfig ? " (live model)" : " (simulated)"}...`,
        metadata: { taskId: nextTask.id },
      });
    }

    let requiresApproval = false;
    let resultSummary = "";

    if (aiConfig && taskAgent) {
      // ── Real LLM-driven execution ──────────────────────────────────────
      try {
        const existingFiles = await db
          .select({
            path: fileNodes.path,
            type: fileNodes.type,
            content: fileNodes.content,
            language: fileNodes.language,
          })
          .from(fileNodes)
          .where(eq(fileNodes.projectId, id));

        // Collect prior agent summaries for context chaining
        const priorMessages = await db
          .select()
          .from(agentMessages)
          .where(and(eq(agentMessages.projectId, id), eq(agentMessages.role, "agent")));
        const priorOutputs = priorMessages
          .filter((m) => m.agentId !== taskAgent.id)
          .slice(-6)
          .map((m) => ({ agent: m.agentId ?? "unknown", summary: m.content.slice(0, 300) }));

        const result = await runAgentTask(aiConfig, {
          projectId: id,
          agentId: taskAgent.id,
          agentRole: taskAgent.role as AgentRoleId,
          taskId: nextTask.id,
          taskTitle: nextTask.title,
          taskDescription: nextTask.description ?? "",
          projectName: project.name,
          projectPrompt: project.prompt,
          techStack: project.techStack ?? null,
          mode: project.mode,
          existingFiles: existingFiles.map((f) => ({
            path: f.path,
            content: f.content,
            language: f.language,
            type: f.type,
          })),
          priorAgentOutputs: priorOutputs,
        });

        requiresApproval = result.requiresApproval;
        resultSummary = result.summary;

        const agentDef = AGENT_DEFINITIONS[taskAgent.role as AgentRoleId];
        const parts: string[] = [];
        if (result.filesWritten.length) parts.push(`${result.filesWritten.length} file(s)`);
        if (result.tablesCreated.length) parts.push(`${result.tablesCreated.length} table(s)`);
        if (result.commandsRun.length) parts.push(`${result.commandsRun.length} command(s)`);

        await db.insert(agentMessages).values({
          id: nanoid(12),
          projectId: id,
          agentId: taskAgent.id,
          role: "agent",
          content: `${agentDef.emoji} **${agentDef.name}**: ${resultSummary}${
            parts.length ? `\n\n_Generated: ${parts.join(", ")}_` : ""
          }`,
          metadata: { taskId: nextTask.id, live: true },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        await db
          .update(tasks)
          .set({ status: "failed", errorMessage: message, completedAt: new Date() })
          .where(eq(tasks.id, nextTask.id));

        if (taskAgent) {
          await db
            .update(agents)
            .set({ status: "failed", errorMessage: message })
            .where(eq(agents.id, taskAgent.id));
        }

        await db.insert(agentMessages).values({
          id: nanoid(12),
          projectId: id,
          agentId: taskAgent?.id ?? null,
          role: "system",
          content: `⚠️ Agent execution failed: ${message}`,
          metadata: { taskId: nextTask.id, error: true },
        });

        return NextResponse.json({ status: "failed", error: message }, { status: 200 });
      }
    } else if (taskAgent) {
      // ── Deterministic simulation fallback (no AI key configured) ───────
      const cmds = await db
        .select()
        .from(commandExecutions)
        .where(
          and(
            eq(commandExecutions.projectId, id),
            eq(commandExecutions.agentId, taskAgent.id),
            eq(commandExecutions.status, "queued")
          )
        );
      if (cmds.length > 0) {
        await db
          .update(commandExecutions)
          .set({
            status: "completed",
            exitCode: 0,
            stdout: "✓ Command executed successfully",
            startedAt: new Date(),
            completedAt: new Date(),
            durationMs: Math.floor(Math.random() * 3000) + 500,
          })
          .where(eq(commandExecutions.id, cmds[0].id));
      }

      const agentDef = AGENT_DEFINITIONS[taskAgent.role as AgentRoleId];
      await db.insert(agentMessages).values({
        id: nanoid(12),
        projectId: id,
        agentId: taskAgent.id,
        role: "agent",
        content: `${agentDef.emoji} **${agentDef.name}**: Completed "${nextTask.title}" — ${nextTask.description ?? ""}`,
        metadata: { taskId: nextTask.id },
      });
    }

    // Finalize task status
    if (requiresApproval) {
      await db
        .update(tasks)
        .set({ status: "waiting_approval" })
        .where(eq(tasks.id, nextTask.id));

      if (taskAgent) {
        await db
          .update(agents)
          .set({ status: "hitl_paused" })
          .where(eq(agents.id, taskAgent.id));
      }

      await db
        .update(projects)
        .set({ status: "waiting_approval", updatedAt: new Date() })
        .where(eq(projects.id, id));

      return NextResponse.json({
        status: "waiting_approval",
        message: "Agent requested human approval before continuing.",
      });
    }

    await db
      .update(tasks)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(tasks.id, nextTask.id));

    if (taskAgent) {
      const remainingForAgent = pendingTasks.filter(
        (t) => t.agentId === taskAgent.id && t.id !== nextTask.id
      );
      const agentTasksTotal = projectTasks.filter((t) => t.agentId === taskAgent.id).length;
      const agentTasksCompleted =
        projectTasks.filter((t) => t.agentId === taskAgent.id && t.status === "completed").length + 1;
      const progress = agentTasksTotal
        ? Math.round((agentTasksCompleted / agentTasksTotal) * 100)
        : 100;

      if (remainingForAgent.length === 0) {
        await db
          .update(agents)
          .set({ status: "completed", currentTask: null, progress: 100, completedAt: new Date() })
          .where(eq(agents.id, taskAgent.id));
      } else {
        await db
          .update(agents)
          .set({ progress: Math.min(progress, 95) })
          .where(eq(agents.id, taskAgent.id));
      }
    }

    const completedCount = projectTasks.filter((t) => t.status === "completed").length + 1;
    const generatedFilesCount = await db
      .select({ path: fileNodes.path })
      .from(fileNodes)
      .where(and(eq(fileNodes.projectId, id), eq(fileNodes.type, "file")));

    let newStatus: typeof project.status = "generating";
    if (completedCount >= projectTasks.length) {
      newStatus = "completed";
    }

    await db
      .update(projects)
      .set({
        status: newStatus,
        completedTasks: completedCount,
        generatedFiles: generatedFilesCount.length,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id));

    return NextResponse.json({
      status: "advanced",
      completedTask: nextTask.title,
      remaining: pendingTasks.length - 1,
      progress: Math.round((completedCount / projectTasks.length) * 100),
      live: Boolean(aiConfig),
    });
  } catch (error) {
    console.error("Failed to simulate:", error);
    return NextResponse.json({ error: "Failed to simulate step" }, { status: 500 });
  }
}
