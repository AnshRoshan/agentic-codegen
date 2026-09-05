import { z } from "zod";
import { fail, handler, json, parseBody } from "@/lib/server/http";
import { getProject, readFile, upsertFile, deleteFile, listFiles } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

export const GET = handler<{ id: string }>(async (req, { id }) => {
  const path = new URL(req.url).searchParams.get("path");
  if (!path) return json({ files: await listFiles(id) });
  const f = await readFile(id, path);
  if (!f) return fail(404, "File not found");
  return json({ file: { ...f, createdAt: f.createdAt.toISOString(), updatedAt: f.updatedAt.toISOString() } });
});

const putSchema = z.object({ path: z.string().min(1).max(300), content: z.string().max(400_000) });

export const PUT = handler<{ id: string }>(async (req, { id }) => {
  const body = await parseBody(req, putSchema);
  if (!(await getProject(id))) return fail(404, "Project not found");
  const r = await upsertFile(id, "user", body.path, body.content, { userEdit: true });
  const f = await readFile(id, r.path);
  return json({ file: f ? { ...f, createdAt: f.createdAt.toISOString(), updatedAt: f.updatedAt.toISOString() } : null });
});

export const DELETE = handler<{ id: string }>(async (req, { id }) => {
  const path = new URL(req.url).searchParams.get("path");
  if (!path) return fail(400, "path is required");
  const ok = await deleteFile(id, path);
  return ok ? json({ ok: true }) : fail(404, "File not found");
});
