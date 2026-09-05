import { z } from "zod";
import { handler, json, parseBody } from "@/lib/server/http";
import { createProject, listProjects } from "@/lib/server/repo";
import { getSettingsRow, resolveAiConfig } from "@/lib/server/ai";

export const dynamic = "force-dynamic";

export const GET = handler(async () => json({ projects: await listProjects() }));

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  prompt: z.string().trim().min(12, "Describe the product in at least a sentence").max(6000),
  mode: z.enum(["greenfield", "brownfield"]).default("greenfield"),
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

export const POST = handler(async (req) => {
  const body = await parseBody(req, createSchema);
  const [cfg, settings] = await Promise.all([resolveAiConfig(), getSettingsRow()]);
  const project = await createProject({
    ...body,
    autoApprove: body.autoApprove ?? settings.autoApproveDefault,
    engineMode: cfg ? "llm" : "simulation",
  });
  return json({ project: { ...project, isRunning: false } }, { status: 201 });
});
