import { z } from "zod";
import { fail, handler, json, parseBody } from "@/lib/server/http";
import { pauseRun, startRun } from "@/lib/server/engine";
import { getProject, serializeProject } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

const schema = z.object({ action: z.enum(["start", "pause", "step"]) });

export const POST = handler<{ id: string }>(async (req, { id }) => {
  const { action } = await parseBody(req, schema);
  if (action === "pause") {
    await pauseRun(id);
  } else {
    const r = await startRun(id, { single: action === "step" });
    if (!r.ok) {
      const status = r.code === "not_found" ? 404 : 409;
      return fail(status, r.reason, { code: r.code });
    }
  }
  // Give the loop a moment so the first poll already reflects the new state.
  await new Promise((r) => setTimeout(r, 150));
  const p = await getProject(id);
  if (!p) return fail(404, "Project not found");
  return json({ project: serializeProject(p) });
});
