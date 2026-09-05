import { fail, handler, json } from "@/lib/server/http";
import { duplicateProject, serializeProject } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

export const POST = handler<{ id: string }>(async (_req, { id }) => {
  const p = await duplicateProject(id);
  if (!p) return fail(404, "Project not found");
  return json({ project: serializeProject(p) }, { status: 201 });
});
