import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { reconcileStaleRuns } from "./engine";

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}

export const json = <T,>(data: T, init?: ResponseInit) => NextResponse.json(data, { ...init, headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) } });

export function fail(status: number, error: string, details?: unknown) {
  return NextResponse.json({ error, ...(details !== undefined ? { details } : {}) }, { status, headers: { "Cache-Control": "no-store" } });
}

type Ctx<P> = { params: Promise<P> };

/** Wrap a route handler: lazily reconciles stale run locks, maps thrown errors to JSON responses. */
export function handler<P = Record<string, string>>(fn: (req: Request, params: P) => Promise<Response>) {
  return async (req: Request, ctx: Ctx<P>): Promise<Response> => {
    try {
      await reconcileStaleRuns();
      const params = (await ctx?.params) ?? ({} as P);
      return await fn(req, params);
    } catch (err) {
      if (err instanceof HttpError) return fail(err.status, err.message, err.details);
      if (err instanceof z.ZodError) return fail(400, "Validation failed", err.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
      if (err instanceof SyntaxError) return fail(400, "Malformed JSON body");
      console.error("[api]", err);
      return fail(500, err instanceof Error ? err.message : "Internal error");
    }
  };
}

export async function parseBody<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<z.infer<T>> {
  let raw: unknown = {};
  const text = await req.text();
  if (text.trim()) raw = JSON.parse(text);
  return schema.parse(raw);
}
