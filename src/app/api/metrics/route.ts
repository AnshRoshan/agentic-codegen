import { NextResponse } from "next/server";
import { db } from "@/db";
import { projects, agents, tasks, fileNodes, commandExecutions, llmCalls } from "@/db/schema";

export const dynamic = "force-dynamic";

/**
 * Studio-wide metrics: totals across every project.
 */
export async function GET() {
  try {
    const [allProjects, allAgents, allTasks, allFiles, allCmds, allLlm] = await Promise.all([
      db.select().from(projects),
      db.select().from(agents),
      db.select().from(tasks),
      db.select().from(fileNodes),
      db.select().from(commandExecutions),
      db.select().from(llmCalls),
    ]);

    const files = allFiles.filter((f) => f.type === "file");
    const totalCostUsd = allProjects.reduce((s, p) => s + Number(p.totalCostUsd ?? 0), 0);
    const totalTokensIn = allProjects.reduce((s, p) => s + (p.totalTokensIn ?? 0), 0);
    const totalTokensOut = allProjects.reduce((s, p) => s + (p.totalTokensOut ?? 0), 0);

    return NextResponse.json({
      projects: {
        total: allProjects.length,
        completed: allProjects.filter((p) => p.status === "completed").length,
        running: allProjects.filter((p) => ["planning", "generating", "building", "testing"].includes(p.status)).length,
        failed: allProjects.filter((p) => p.status === "failed").length,
        awaiting: allProjects.filter((p) => p.status === "waiting_approval").length,
      },
      agents: {
        total: allAgents.length,
        working: allAgents.filter((a) => a.status === "working").length,
      },
      tasks: {
        total: allTasks.length,
        completed: allTasks.filter((t) => t.status === "completed").length,
      },
      files: {
        total: files.length,
        totalBytes: files.reduce((s, f) => s + (f.size ?? 0), 0),
      },
      commands: {
        total: allCmds.length,
        completed: allCmds.filter((c) => c.status === "completed").length,
      },
      llm: {
        totalCalls: allLlm.length,
        totalTokensIn,
        totalTokensOut,
        totalTokens: totalTokensIn + totalTokensOut,
        totalCostUsd,
        cacheHits: allLlm.filter((c) => c.cached).length,
      },
    });
  } catch (error) {
    console.error("Metrics failed:", error);
    return NextResponse.json({ error: "Metrics unavailable" }, { status: 500 });
  }
}
