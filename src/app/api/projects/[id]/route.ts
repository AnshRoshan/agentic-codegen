import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { fail, handler, json, parseBody } from "@/lib/server/http";
import { getProject, loadSnapshot, serializeProject } from "@/lib/server/repo";
import { abortRun } from "@/lib/server/engine";

export const dynamic = "force-dynamic";

export const GET = handler<{ id: string }>(async (req, { id }) => {
  const url = new URL(req.url);
  const since = url.searchParams.get("filesSince");
  const sinceDate = since ? new Date(since) : null;
  const snap = await loadSnapshot(id, { filesSince: sinceDate && !Number.isNaN(sinceDate.getTime()) ? sinceDate : null });
  if (!snap) return fail(404, "Project not found");
  return json(snap);
});

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  emoji: z.string().trim().max(8).optional(),
  autoApprove: z.boolean().optional(),
  settings: z.object({
    agentModels: z.record(z.string(), z.string()).optional(),
    maxStepsPerTask: z.number().int().min(2).max(40).optional(),
    maxRetries: z.number().int().min(0).max(5).optional(),
    maxRepairIterations: z.number().int().min(0).max(5).optional(),
    budgetMicros: z.number().int().min(0).optional(),
  }).optional(),
});

export const PATCH = handler<{ id: string }>(async (req, { id }) => {
  const body = await parseBody(req, patchSchema);
  const existing = await getProject(id);
  if (!existing) return fail(404, "Project not found");
  const [updated] = await db.update(projects).set({
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.emoji !== undefined ? { emoji: body.emoji } : {}),
    ...(body.autoApprove !== undefined ? { autoApprove: body.autoApprove } : {}),
    ...(body.settings !== undefined ? { settings: { ...(existing.settings ?? {}), ...body.settings } } : {}),
    updatedAt: new Date(),
  }).where(eq(projects.id, id)).returning();
  return json({ project: serializeProject(updated) });
});

export const DELETE = handler<{ id: string }>(async (_req, { id }) => {
  abortRun(id);
  const deleted = await db.delete(projects).where(eq(projects.id, id)).returning({ id: projects.id });
  if (!deleted.length) return fail(404, "Project not found");
  return json({ ok: true });
});
