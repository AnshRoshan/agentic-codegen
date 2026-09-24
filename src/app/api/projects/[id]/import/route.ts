import { z } from "zod";
import { fail, handler, json, parseBody } from "@/lib/server/http";
import { getProject, importFiles } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  files: z.array(z.object({ path: z.string().min(1).max(300), content: z.string().max(400_000) })).min(1).max(500),
});

// Bulk-import an existing codebase (brownfield): client unpacks zips and sends { path, content } pairs.
export const POST = handler<{ id: string }>(async (req, { id }) => {
  const body = await parseBody(req, bodySchema);
  if (!(await getProject(id))) return fail(404, "Project not found");
  return json(await importFiles(id, body.files));
});
