import { z } from "zod";
import { fail, handler, json, parseBody } from "@/lib/server/http";
import { resolveCheckpoint } from "@/lib/server/engine";
import { getProject, serializeProject } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

const schema = z.object({ decision: z.enum(["approved", "rejected"]), note: z.string().max(1000).optional() });

export const POST = handler<{ id: string; cpId: string }>(async (req, { id, cpId }) => {
  const { decision, note } = await parseBody(req, schema);
  const r = await resolveCheckpoint(id, cpId, decision, note);
  if (!r.ok) return fail(409, r.reason ?? "Could not resolve checkpoint");
  await new Promise((res) => setTimeout(res, 150));
  const p = await getProject(id);
  return json({ ok: true, resumed: r.resumed, project: p ? serializeProject(p) : null });
});
