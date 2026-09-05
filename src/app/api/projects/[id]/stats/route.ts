import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  projects,
  agents,
  tasks,
  fileNodes,
  commandExecutions,
  agentMessages,
  dbTables,
  environmentVariables,
  hitlCheckpoints,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [project] = await db.select().from(projects).where(eq(projects.id, id));
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [allAgents, allTasks, allFiles, allCmds, allMsgs, allTables, allEnvVars, allHitl] =
    await Promise.all([
      db.select().from(agents).where(eq(agents.projectId, id)),
      db.select().from(tasks).where(eq(tasks.projectId, id)),
      db.select().from(fileNodes).where(eq(fileNodes.projectId, id)),
      db.select().from(commandExecutions).where(eq(commandExecutions.projectId, id)),
      db.select().from(agentMessages).where(eq(agentMessages.projectId, id)),
      db.select().from(dbTables).where(eq(dbTables.projectId, id)),
      db.select().from(environmentVariables).where(eq(environmentVariables.projectId, id)),
      db.select().from(hitlCheckpoints).where(eq(hitlCheckpoints.projectId, id)),
    ]);

  const filesOnly = allFiles.filter((f) => f.type === "file");
  const totalBytes = filesOnly.reduce((sum, f) => sum + (f.size ?? 0), 0);

  // Language breakdown
  const languageMap: Record<string, number> = {};
  for (const f of filesOnly) {
    const lang = f.language ?? "other";
    languageMap[lang] = (languageMap[lang] ?? 0) + 1;
  }
  const languages = Object.entries(languageMap)
    .sort((a, b) => b[1] - a[1])
    .map(([lang, count]) => ({ lang, count, pct: Math.round((count / filesOnly.length) * 100) }));

  // Task breakdown by agent role
  const agentTaskMap: Record<string, { done: number; total: number; role: string }> = {};
  for (const agent of allAgents) {
    const agentTasks = allTasks.filter((t) => t.agentId === agent.id);
    agentTaskMap[agent.role] = {
      role: agent.role,
      total: agentTasks.length,
      done: agentTasks.filter((t) => t.status === "completed").length,
    };
  }

  // Commands
  const cmdStats = {
    total: allCmds.length,
    completed: allCmds.filter((c) => c.status === "completed").length,
    failed: allCmds.filter((c) => c.status === "failed").length,
    avgDuration: allCmds.length
      ? Math.round(
          allCmds.reduce((s, c) => s + (c.durationMs ?? 0), 0) / allCmds.length
        )
      : 0,
  };

  const progress = allTasks.length
    ? Math.round((allTasks.filter((t) => t.status === "completed").length / allTasks.length) * 100)
    : 0;

  return NextResponse.json({
    overview: {
      status: project.status,
      mode: project.mode,
      progress,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
    files: {
      total: filesOnly.length,
      directories: allFiles.filter((f) => f.type === "directory").length,
      totalBytes,
      totalKb: Math.round(totalBytes / 1024),
      languages,
    },
    tasks: {
      total: allTasks.length,
      completed: allTasks.filter((t) => t.status === "completed").length,
      pending: allTasks.filter((t) => t.status === "pending").length,
      inProgress: allTasks.filter((t) => t.status === "in_progress").length,
      failed: allTasks.filter((t) => t.status === "failed").length,
      byAgent: Object.values(agentTaskMap),
    },
    agents: {
      total: allAgents.length,
      completed: allAgents.filter((a) => a.status === "completed").length,
      working: allAgents.filter((a) => a.status === "working").length,
    },
    database: {
      tables: allTables.length,
      totalColumns: allTables.reduce((s, t) => s + (t.columns?.length ?? 0), 0),
    },
    env: {
      total: allEnvVars.length,
      secrets: allEnvVars.filter((e) => e.isSecret).length,
      vaultRefs: allEnvVars.filter((e) => e.type === "vault_ref").length,
    },
    hitl: {
      total: allHitl.length,
      pending: allHitl.filter((h) => h.status === "pending").length,
      approved: allHitl.filter((h) => h.status === "approved").length,
      rejected: allHitl.filter((h) => h.status === "rejected").length,
    },
    commands: cmdStats,
    messages: { total: allMsgs.length },
  });
}
