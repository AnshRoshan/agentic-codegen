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
import { eq, desc, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { AGENT_DEFINITIONS, GREENFIELD_PIPELINE, BROWNFIELD_PIPELINE, type AgentRoleId } from "@/lib/agents";
import { inferAppSpec } from "@/lib/domain-inference";
import {
  generateApplication,
  generateTaskGraph,
  generateDbTableRecords,
  generateEnvRecords,
} from "@/lib/universal-generator";

export async function GET() {
  try {
    const allProjects = await db.select().from(projects).orderBy(desc(projects.createdAt));
    return NextResponse.json(allProjects);
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, mode, prompt, techStack, sourceRepo, presetId } = body as {
      name: string;
      description?: string;
      mode: "greenfield" | "brownfield";
      prompt: string;
      techStack?: Record<string, string>;
      sourceRepo?: string;
      presetId?: string;
    };

    if (!name || !prompt) {
      return NextResponse.json({ error: "Name and prompt are required" }, { status: 400 });
    }

    const projectId = nanoid(12);
    const effectiveMode = mode || "greenfield";

    // ── UNIVERSAL INFERENCE: derive a full app spec from the free-form prompt ──
    const fullPrompt = [prompt, description].filter(Boolean).join("\n");
    const spec = inferAppSpec(fullPrompt, name);

    // Create the project row
    const [project] = await db
      .insert(projects)
      .values({
        id: projectId,
        name,
        description: description ?? null,
        mode: effectiveMode,
        status: "planning",
        prompt,
        techStack: techStack ?? null,
        sourceRepo: sourceRepo ?? null,
        templateId: presetId ?? spec.domain,
        architecture: {
          overview: `${spec.name} — inferred domain: ${spec.domain}. ${spec.entities.length} entities, ${spec.features.length} features.`,
          components: spec.entities.map((e) => ({
            name: e.label,
            type: "entity",
            description: e.description,
          })),
          dataFlow: `Client → /api/${spec.entities[1]?.slug ?? "resource"} → Drizzle → PostgreSQL`,
        },
      })
      .returning();

    // ── Agents ──
    const pipeline = effectiveMode === "brownfield" ? BROWNFIELD_PIPELINE : GREENFIELD_PIPELINE;
    const agentRecords = pipeline.map((role) => ({
      id: nanoid(12),
      projectId,
      role: role as AgentRoleId,
      name: AGENT_DEFINITIONS[role].name,
      status: "idle" as const,
      systemPrompt: AGENT_DEFINITIONS[role].systemPrompt,
    }));
    await db.insert(agents).values(agentRecords);

    // ── DYNAMIC TASK GRAPH derived from the actual inferred entities ──
    const genTasks = generateTaskGraph(spec).filter((t) =>
      pipeline.includes(t.agentRole as AgentRoleId)
    );
    const taskRecords = genTasks.map((t, i) => ({
      id: nanoid(12),
      projectId,
      agentId: agentRecords.find((a) => a.role === t.agentRole)?.id ?? null,
      title: t.title,
      description: t.description,
      status: "pending" as const,
      priority: i + 1,
    }));
    if (taskRecords.length > 0) await db.insert(tasks).values(taskRecords);

    // ── GENERATE THE FULL CODEBASE (greenfield only) ──
    if (effectiveMode === "greenfield") {
      const genFiles = generateApplication(spec);

      // Build directory set
      const dirPaths = new Set<string>();
      for (const f of genFiles) {
        const parts = f.path.split("/");
        for (let i = 1; i < parts.length; i++) dirPaths.add(parts.slice(0, i).join("/"));
      }

      const dirNodes = [...dirPaths]
        .sort((a, b) => a.split("/").length - b.split("/").length)
        .map((p) => ({
          id: nanoid(12),
          path: p,
          name: p.split("/").pop() ?? p,
          type: "directory" as const,
          content: null as string | null,
          language: null as string | null,
        }));

      const fileNodeRows = genFiles.map((f) => ({
        id: nanoid(12),
        path: f.path,
        name: f.name,
        type: "file" as const,
        content: f.content,
        language: f.language,
      }));

      const pathToId = new Map<string, string>();
      [...dirNodes, ...fileNodeRows].forEach((n) => pathToId.set(n.path, n.id));

      await db.insert(fileNodes).values(
        [...dirNodes, ...fileNodeRows].map((n) => {
          const parentPath = n.path.split("/").slice(0, -1).join("/");
          return {
            id: n.id,
            projectId,
            agentId: null,
            parentId: parentPath ? pathToId.get(parentPath) ?? null : null,
            name: n.name,
            path: n.path,
            type: n.type,
            content: n.content,
            language: n.language,
            size: n.content ? Buffer.byteLength(n.content, "utf8") : null,
            isGenerated: true,
          };
        })
      );

      // ── DB tables derived from the inferred entities ──
      const dbAgent = agentRecords.find((a) => a.role === "database");
      const tableRecords = generateDbTableRecords(spec);
      if (tableRecords.length > 0) {
        await db.insert(dbTables).values(
          tableRecords.map((t) => ({
            id: nanoid(12),
            projectId,
            agentId: dbAgent?.id ?? null,
            name: t.name,
            schema: t.schema,
            status: "defined" as const,
            columns: t.columns,
            indexes: t.indexes,
            sql: t.sql,
          }))
        );
      }

      // ── Env vars derived from the inferred features ──
      const envRecords = generateEnvRecords(spec);
      if (envRecords.length > 0) {
        await db.insert(environmentVariables).values(
          envRecords.map((e) => ({
            id: nanoid(12),
            projectId,
            key: e.key,
            value: e.value,
            type: e.type,
            description: e.description,
            isSecret: e.isSecret,
            isRequired: e.isRequired,
            source: "agent",
          }))
        );
      }

      // ── Queue realistic commands ──
      const devopsAgent = agentRecords.find((a) => a.role === "devops");
      await db.insert(commandExecutions).values([
        { id: nanoid(12), projectId, agentId: agentRecords.find((a) => a.role === "architect")?.id ?? null, command: "npm install", status: "queued" as const },
        { id: nanoid(12), projectId, agentId: dbAgent?.id ?? null, command: "npx drizzle-kit push", status: "queued" as const },
        { id: nanoid(12), projectId, agentId: dbAgent?.id ?? null, command: "npm run db:seed", status: "queued" as const },
        { id: nanoid(12), projectId, agentId: agentRecords.find((a) => a.role === "testing")?.id ?? null, command: "npm test", status: "queued" as const },
        { id: nanoid(12), projectId, agentId: devopsAgent?.id ?? null, command: "npm run build", status: "queued" as const },
        { id: nanoid(12), projectId, agentId: devopsAgent?.id ?? null, command: "docker compose build", status: "queued" as const },
      ]);

      // ── File operation log entries ──
      await db.insert(fileOperations).values(
        genFiles.slice(0, 30).map((f) => ({
          id: nanoid(12),
          projectId,
          agentId: null,
          taskId: null,
          action: "create" as const,
          filePath: f.path,
          language: f.language,
          content: null,
        }))
      );
    }

    // ── Illustrative HITL checkpoints (non-blocking) tuned to the domain ──
    const hitlAgent = agentRecords.find((a) => a.role === "database") ?? agentRecords[0];
    const primaryEntity = spec.entities.find((e) => e.table === spec.primaryEntity);
    await db.insert(hitlCheckpoints).values([
      {
        id: nanoid(12),
        projectId,
        agentId: hitlAgent?.id ?? null,
        taskId: null,
        status: "pending" as const,
        type: "db_migration",
        title: "Apply initial schema migration",
        description: `Create ${spec.entities.length} tables (${spec.entities.map((e) => e.table).join(", ")}) with constraints and indexes.`,
        riskLevel: "medium",
        isBlocking: false,
        context: {
          affectedTables: spec.entities.map((e) => e.table),
          diff: generateDbTableRecords(spec).slice(0, 2).map((t) => "+ " + t.sql.replace(/\n/g, "\n+ ")).join("\n\n"),
        },
      },
      {
        id: nanoid(12),
        projectId,
        agentId: agentRecords.find((a) => a.role === "devops")?.id ?? null,
        taskId: null,
        status: "pending" as const,
        type: "deployment",
        title: "Production container build",
        description: "Build and publish the Docker image for deployment.",
        riskLevel: "low",
        isBlocking: false,
        context: { command: "docker compose build && docker compose up -d" },
      },
      ...(primaryEntity
        ? [{
            id: nanoid(12),
            projectId,
            agentId: agentRecords.find((a) => a.role === "backend")?.id ?? null,
            taskId: null,
            status: "pending" as const,
            type: "file_edit",
            title: `Expose write API for ${primaryEntity.labelPlural}`,
            description: `Enable POST/PATCH/DELETE on /api/${primaryEntity.slug}. Review authorization before enabling mutations.`,
            riskLevel: "high" as const,
            isBlocking: false,
            context: {
              filePath: `src/app/api/${primaryEntity.slug}/route.ts`,
              proposedChanges: "Add mutation handlers guarded by role checks",
            },
          }]
        : []),
    ]);

    // ── Kickoff message ──
    await db.insert(agentMessages).values({
      id: nanoid(12),
      projectId,
      agentId: agentRecords.find((a) => a.role === "orchestrator")?.id ?? null,
      role: "agent",
      content: `🎯 **Orchestrator**: Analyzed "${name}".\n\nInferred domain: **${spec.domain}**\nEntities: ${spec.entities.map((e) => e.icon + " " + e.labelPlural).join(", ")}\nFeatures: ${spec.features.join(", ")}\n\nGenerated a ${taskRecords.length}-task graph across ${agentRecords.length} agents.`,
      metadata: { phase: "initialization", domain: spec.domain, entities: spec.entities.length },
    });

    // ── Recount files ──
    const actualFiles = await db
      .select({ id: fileNodes.id })
      .from(fileNodes)
      .where(and(eq(fileNodes.projectId, projectId), eq(fileNodes.type, "file")));

    await db
      .update(projects)
      .set({
        totalTasks: taskRecords.length,
        generatedFiles: actualFiles.length,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));

    return NextResponse.json(
      {
        ...project,
        totalTasks: taskRecords.length,
        generatedFiles: actualFiles.length,
        inferred: {
          domain: spec.domain,
          entities: spec.entities.map((e) => ({ name: e.label, table: e.table, fields: e.fields.length })),
          features: spec.features,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json(
      { error: "Failed to create project", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
