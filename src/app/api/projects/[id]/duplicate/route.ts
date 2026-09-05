import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  projects,
  agents,
  tasks,
  fileNodes,
  dbTables,
  environmentVariables,
  hitlCheckpoints,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { AGENT_DEFINITIONS, GREENFIELD_PIPELINE, BROWNFIELD_PIPELINE } from "@/lib/agents";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [source] = await db.select().from(projects).where(eq(projects.id, id));
    if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const newId = nanoid(12);
    const [newProject] = await db
      .insert(projects)
      .values({
        id: newId,
        name: source.name + " (copy)",
        description: source.description,
        mode: source.mode,
        status: "planning",
        prompt: source.prompt,
        techStack: source.techStack,
        sourceRepo: source.sourceRepo,
        templateId: source.templateId,
        architecture: source.architecture,
        generatedFiles: 0,
        totalTasks: source.totalTasks,
        completedTasks: 0,
      })
      .returning();

    // Duplicate agents
    const pipeline = source.mode === "brownfield" ? BROWNFIELD_PIPELINE : GREENFIELD_PIPELINE;
    const agentRecords = pipeline.map((role) => {
      const def = AGENT_DEFINITIONS[role];
      return {
        id: nanoid(12),
        projectId: newId,
        role,
        name: def.name,
        status: "idle" as const,
        systemPrompt: def.systemPrompt,
      };
    });
    await db.insert(agents).values(agentRecords);

    // Duplicate tasks
    const sourceTasks = await db.select().from(tasks).where(eq(tasks.projectId, id));
    if (sourceTasks.length > 0) {
      await db.insert(tasks).values(
        sourceTasks.map((t) => ({
          id: nanoid(12),
          projectId: newId,
          agentId: null,
          title: t.title,
          description: t.description,
          status: "pending" as const,
          priority: t.priority,
        }))
      );
    }

    // Duplicate file nodes
    const sourceNodes = await db.select().from(fileNodes).where(eq(fileNodes.projectId, id));
    if (sourceNodes.length > 0) {
      await db.insert(fileNodes).values(
        sourceNodes.map((n) => ({
          id: nanoid(12),
          projectId: newId,
          agentId: null,
          parentId: null, // simplify: no parent linking for copy
          name: n.name,
          path: n.path,
          type: n.type,
          content: n.content,
          language: n.language,
          size: n.size,
          isGenerated: n.isGenerated,
          isModified: false,
        }))
      );
    }

    // Duplicate DB tables
    const sourceTables = await db.select().from(dbTables).where(eq(dbTables.projectId, id));
    if (sourceTables.length > 0) {
      await db.insert(dbTables).values(
        sourceTables.map((t) => ({
          id: nanoid(12),
          projectId: newId,
          agentId: null,
          name: t.name,
          schema: t.schema,
          status: "defined" as const,
          columns: t.columns,
          indexes: t.indexes,
          sql: t.sql,
        }))
      );
    }

    // Duplicate env vars
    const sourceEnvVars = await db.select().from(environmentVariables).where(eq(environmentVariables.projectId, id));
    if (sourceEnvVars.length > 0) {
      await db.insert(environmentVariables).values(
        sourceEnvVars.map((e) => ({
          id: nanoid(12),
          projectId: newId,
          key: e.key,
          value: e.value,
          type: e.type,
          description: e.description,
          isSecret: e.isSecret,
          isRequired: e.isRequired,
          source: "user",
        }))
      );
    }

    return NextResponse.json({ id: newId, project: newProject }, { status: 201 });
  } catch (error) {
    console.error("Failed to duplicate project:", error);
    return NextResponse.json({ error: "Duplication failed" }, { status: 500 });
  }
}
