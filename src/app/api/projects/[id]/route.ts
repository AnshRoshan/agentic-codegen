import { and, asc, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  agentMessages,
  agents,
  commandExecutions,
  dbTables,
  environmentVariables,
  fileNodes,
  hitlCheckpoints,
  llmCalls,
  projects,
  tasks,
} from "@/db/schema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const [project] = await db.select().from(projects).where(eq(projects.id, id));
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [agentRows, taskRows, fileRows, tableRows, envRows, checkpointRows, commandRows, messageRows, llmRows] = await Promise.all([
    db.select().from(agents).where(eq(agents.projectId, id)),
    db.select().from(tasks).where(eq(tasks.projectId, id)).orderBy(asc(tasks.order)),
    db
      .select({
        id: fileNodes.id,
        path: fileNodes.path,
        name: fileNodes.name,
        language: fileNodes.language,
        size: fileNodes.size,
        version: fileNodes.version,
        agentRole: fileNodes.agentRole,
        isModified: fileNodes.isModified,
        updatedAt: fileNodes.updatedAt,
      })
      .from(fileNodes)
      .where(eq(fileNodes.projectId, id))
      .orderBy(asc(fileNodes.path)),
    db.select().from(dbTables).where(eq(dbTables.projectId, id)).orderBy(asc(dbTables.name)),
    db.select().from(environmentVariables).where(eq(environmentVariables.projectId, id)).orderBy(asc(environmentVariables.key)),
    db.select().from(hitlCheckpoints).where(eq(hitlCheckpoints.projectId, id)).orderBy(desc(hitlCheckpoints.createdAt)),
    db.select().from(commandExecutions).where(eq(commandExecutions.projectId, id)).orderBy(asc(commandExecutions.createdAt)),
    db.select().from(agentMessages).where(eq(agentMessages.projectId, id)).orderBy(asc(agentMessages.createdAt)).limit(400),
    db.select().from(llmCalls).where(eq(llmCalls.projectId, id)).orderBy(asc(llmCalls.createdAt)),
  ]);

  return NextResponse.json({
    project,
    agents: agentRows,
    tasks: taskRows,
    files: fileRows,
    tables: tableRows,
    env: envRows,
    checkpoints: checkpointRows,
    commands: commandRows,
    messages: messageRows,
    llmCalls: llmRows,
  });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { name?: string; description?: string; autoApprove?: boolean; status?: "paused" | "generating" };
  const patch: Partial<typeof projects.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.description === "string") patch.description = body.description;
  if (typeof body.autoApprove === "boolean") patch.autoApprove = body.autoApprove;
  if (body.status === "paused" || body.status === "generating") patch.status = body.status;
  const [row] = await db.update(projects).set(patch).where(eq(projects.id, id)).returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const [row] = await db.delete(projects).where(and(eq(projects.id, id))).returning({ id: projects.id });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
