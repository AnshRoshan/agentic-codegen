const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "out", "dist", "build", "coverage", "__pycache__", ".venv", "vendor", ".turbo", ".pgdata"]);

/** Normalize a client-supplied import path; returns null when it's unsafe or junk. */
export function sanitizeImportPath(raw: string): string | null {
  const p = raw.replace(/\\/g, "/");
  if (!p || p.length > 300 || /[\x00-\x1f\x7f]/.test(p)) return null;
  if (p.startsWith("/") || /^[a-zA-Z]:/.test(p)) return null;
  const segs = p.split("/");
  if (segs.some((s) => !s || s === "." || s === "..")) return null;
  if (segs.some((s) => SKIP_DIRS.has(s))) return null;
  return segs.join("/");
}
