import { fail, handler, json } from "@/lib/server/http";
import { abortRun } from "@/lib/server/engine";
import { resetProject, serializeProject } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

export const POST = handler<{ id: string }>(async (_req, { id }) => {
  abortRun(id);
  await new Promise((r) => setTimeout(r, 100));
  const p = await resetProject(id);
  if (!p) return fail(404, "Project not found");
  return json({ project: serializeProject(p) });
});
