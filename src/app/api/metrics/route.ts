import { desc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { fileNodes, hitlCheckpoints, llmCalls, projects } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const [[totals], [files], [pendingCp], byModel, recent] = await Promise.all([
    db
      .select({
        projects: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${projects.status} = 'completed')::int`,
        running: sql<number>`count(*) filter (where ${projects.status} in ('planning','generating','building','testing','deploying'))::int`,
        waiting: sql<number>`count(*) filter (where ${projects.status} = 'waiting_approval')::int`,
        tokensIn: sql<number>`coalesce(sum(${projects.tokensIn}),0)::int`,
        tokensOut: sql<number>`coalesce(sum(${projects.tokensOut}),0)::int`,
        costMicros: sql<number>`coalesce(sum(${projects.costMicros}),0)::int`,
        llmCalls: sql<number>`coalesce(sum(${projects.llmCalls}),0)::int`,
        toolCalls: sql<number>`coalesce(sum(${projects.toolCalls}),0)::int`,
      })
      .from(projects),
    db.select({ files: sql<number>`count(*)::int`, bytes: sql<number>`coalesce(sum(${fileNodes.size}),0)::int` }).from(fileNodes),
    db.select({ n: sql<number>`count(*)::int` }).from(hitlCheckpoints).where(sql`${hitlCheckpoints.status} = 'pending'`),
    db
      .select({
        model: llmCalls.model,
        calls: sql<number>`count(*)::int`,
        tokens: sql<number>`coalesce(sum(${llmCalls.promptTokens} + ${llmCalls.completionTokens}),0)::int`,
        costMicros: sql<number>`coalesce(sum(${llmCalls.costMicros}),0)::int`,
      })
      .from(llmCalls)
      .groupBy(llmCalls.model),
    db
      .select({ id: projects.id, name: projects.name, status: projects.status, emoji: projects.emoji, updatedAt: projects.updatedAt, currentStep: projects.currentStep, totalSteps: projects.totalSteps })
      .from(projects)
      .orderBy(desc(projects.updatedAt))
      .limit(6),
  ]);

  return NextResponse.json({ ...totals, ...files, pendingCheckpoints: pendingCp.n, byModel, recent });
}
