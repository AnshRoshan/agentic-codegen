import { sql } from "drizzle-orm";
import { db } from "@/db";
import { json, fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return json({ ok: true, status: "healthy", db: "connected", time: new Date().toISOString() });
  } catch (err) {
    return fail(503, "Database unreachable", err instanceof Error ? err.message : String(err));
  }
}
