import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { environmentVariables } from "@/db/schema";
import { fail, handler, json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const DELETE = handler<{ id: string; envId: string }>(async (_req, { id, envId }) => {
  const deleted = await db.delete(environmentVariables)
    .where(and(eq(environmentVariables.projectId, id), eq(environmentVariables.id, envId)))
    .returning({ id: environmentVariables.id });
  return deleted.length ? json({ ok: true }) : fail(404, "Variable not found");
});
