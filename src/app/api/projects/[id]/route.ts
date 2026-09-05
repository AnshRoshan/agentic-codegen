import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  projects,
  agents,
  tasks,
  fileOperations,
  commandExecutions,
  agentMessages,
  fileNodes,
  dbTables,
  environmentVariables,
  hitlCheckpoints,
} from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const [projectAgents, projectTasks, projectFiles, projectCommands, projectMessages, projectFileNodes, projectDbTables, projectEnvVars, projectHitl] = await Promise.all([
      db.select().from(agents).where(eq(agents.projectId, id)).orderBy(asc(agents.createdAt)),
      db.select().from(tasks).where(eq(tasks.projectId, id)).orderBy(asc(tasks.priority)),
      db.select().from(fileOperations).where(eq(fileOperations.projectId, id)).orderBy(asc(fileOperations.createdAt)),
      db.select().from(commandExecutions).where(eq(commandExecutions.projectId, id)).orderBy(asc(commandExecutions.createdAt)),
      db.select().from(agentMessages).where(eq(agentMessages.projectId, id)).orderBy(asc(agentMessages.createdAt)),
      db.select().from(fileNodes).where(eq(fileNodes.projectId, id)).orderBy(asc(fileNodes.path)),
      db.select().from(dbTables).where(eq(dbTables.projectId, id)).orderBy(asc(dbTables.name)),
      db.select().from(environmentVariables).where(eq(environmentVariables.projectId, id)).orderBy(asc(environmentVariables.key)),
      db.select().from(hitlCheckpoints).where(eq(hitlCheckpoints.projectId, id)).orderBy(asc(hitlCheckpoints.createdAt)),
    ]);

    return NextResponse.json({
      project,
      agents: projectAgents,
      tasks: projectTasks,
      files: projectFiles,
      commands: projectCommands,
      messages: projectMessages,
      fileNodes: projectFileNodes,
      dbTables: projectDbTables,
      envVars: projectEnvVars,
      hitlCheckpoints: projectHitl,
    });
  } catch (error) {
    console.error("Failed to fetch project:", error);
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, description, status } = body as {
      name?: string;
      description?: string;
      status?: string;
    };

    const [updated] = await db
      .update(projects)
      .set({
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status: status as "draft" | "planning" | "generating" | "building" | "testing" | "completed" | "failed" | "waiting_approval" }),
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();

    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update project:", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.delete(projects).where(eq(projects.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete project:", error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
