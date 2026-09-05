import { z } from "zod";
import { fail, handler, json, parseBody } from "@/lib/server/http";
import { getProject, setEnvVar } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

const schema = z.object({
  key: z.string().trim().min(1).max(64).regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Use letters, digits and underscores"),
  value: z.string().max(4000).default(""),
  description: z.string().max(300).optional(),
  isSecret: z.boolean().optional(),
});

export const POST = handler<{ id: string }>(async (req, { id }) => {
  const body = await parseBody(req, schema);
  if (!(await getProject(id))) return fail(404, "Project not found");
  const secret = body.isSecret ?? /SECRET|KEY|TOKEN|PASSWORD|PRIVATE/i.test(body.key);
  const r = await setEnvVar(id, body.key, body.value, body.description ?? "Added manually", secret, "user");
  return json({ ok: true, id: r.id, key: r.key, created: r.created }, { status: r.created ? 201 : 200 });
});
