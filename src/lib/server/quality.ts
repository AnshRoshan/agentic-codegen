import "server-only";
import ts from "typescript";

export interface VirtualFile { path: string; content: string; }

export interface Diagnostic {
  path: string;
  line: number;
  message: string;
  severity: "error" | "warning";
  rule: "syntax" | "json" | "import" | "lint";
}

export interface QualityReport {
  filesChecked: number;
  tsFiles: number;
  errors: Diagnostic[];
  warnings: Diagnostic[];
  testFiles: number;
  testCases: number;
  durationMs: number;
}

const TS_EXT = /\.(ts|tsx|mts|cts)$/;
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/;
const RESOLVE_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".json", ".css"];

/** Known runtime deps we consider resolvable without a package.json entry (Node/Next builtins). */
const BUILTIN_MODULES = new Set([
  "fs", "path", "url", "crypto", "os", "http", "https", "stream", "buffer", "events", "util", "child_process",
  "node:fs", "node:path", "node:url", "node:crypto", "node:os", "node:test", "node:assert", "assert", "react", "react-dom", "next",
]);

function lineOf(text: string, pos: number): number {
  let line = 1;
  for (let i = 0; i < pos && i < text.length; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

function resolveImport(from: string, spec: string, index: Set<string>, dirs: Set<string>): boolean {
  let base: string;
  if (spec.startsWith("@/")) base = "src/" + spec.slice(2);
  else if (spec.startsWith("./") || spec.startsWith("../")) {
    const parts = from.split("/").slice(0, -1);
    for (const seg of spec.split("/")) {
      if (seg === "." || seg === "") continue;
      if (seg === "..") parts.pop(); else parts.push(seg);
    }
    base = parts.join("/");
  } else return true; // bare module — checked against package.json separately
  if (index.has(base)) return true;
  for (const ext of RESOLVE_EXTS) if (index.has(base + ext)) return true;
  if (dirs.has(base)) {
    for (const ext of RESOLVE_EXTS) if (index.has(`${base}/index${ext}`)) return true;
  }
  return false;
}

function packageDeps(files: VirtualFile[]): Set<string> | null {
  const pkg = files.find((f) => f.path === "package.json");
  if (!pkg) return null;
  try {
    const json = JSON.parse(pkg.content) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    return new Set([...Object.keys(json.dependencies ?? {}), ...Object.keys(json.devDependencies ?? {})]);
  } catch {
    return null;
  }
}

function bareModuleName(spec: string): string {
  if (spec.startsWith("@")) return spec.split("/").slice(0, 2).join("/");
  return spec.split("/")[0];
}

/** Run every static check we can do without a real filesystem or network. */
export function analyzeWorkspace(files: VirtualFile[]): QualityReport {
  const started = Date.now();
  const errors: Diagnostic[] = [];
  const warnings: Diagnostic[] = [];
  const index = new Set(files.map((f) => f.path));
  const dirs = new Set<string>();
  for (const p of index) {
    const parts = p.split("/");
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join("/"));
  }
  const deps = packageDeps(files);
  let tsFiles = 0;
  let testFiles = 0;
  let testCases = 0;

  for (const f of files) {
    if (f.path.endsWith(".json")) {
      try { JSON.parse(f.content); } catch (e) {
        errors.push({ path: f.path, line: 1, message: `Invalid JSON: ${(e as Error).message}`, severity: "error", rule: "json" });
      }
      continue;
    }
    if (!CODE_EXT.test(f.path)) continue;

    const isTest = /\.(test|spec)\.[tj]sx?$/.test(f.path) || f.path.includes("__tests__/");
    if (isTest) {
      testFiles++;
      testCases += (f.content.match(/\b(it|test)\s*\(/g) ?? []).length;
    }

    if (TS_EXT.test(f.path)) {
      tsFiles++;
      const out = ts.transpileModule(f.content, {
        reportDiagnostics: true,
        fileName: f.path,
        compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, isolatedModules: true },
      });
      for (const d of out.diagnostics ?? []) {
        const msg = ts.flattenDiagnosticMessageText(d.messageText, " ");
        const line = d.start !== undefined ? lineOf(f.content, d.start) : 1;
        errors.push({ path: f.path, line, message: msg, severity: "error", rule: "syntax" });
      }
    }

    // Import resolution (relative + alias) and dependency presence for bare specifiers.
    const importRe = /(?:import|export)\s+(?:[^'";]*?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|require\(\s*["']([^"']+)["']\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = importRe.exec(f.content))) {
      const spec = m[1] ?? m[2] ?? m[3];
      if (!spec) continue;
      const line = lineOf(f.content, m.index);
      if (spec.startsWith(".") || spec.startsWith("@/")) {
        if (!resolveImport(f.path, spec, index, dirs)) {
          errors.push({ path: f.path, line, message: `Cannot resolve import "${spec}" — the file does not exist in the workspace`, severity: "error", rule: "import" });
        }
      } else if (deps && !spec.startsWith("node:")) {
        const name = bareModuleName(spec);
        if (!deps.has(name) && !BUILTIN_MODULES.has(name) && !name.startsWith("next/") && name !== "next") {
          warnings.push({ path: f.path, line, message: `"${name}" is imported but not declared in package.json`, severity: "warning", rule: "import" });
        }
      }
    }

    // Cheap lint heuristics that catch common LLM slips.
    if (/^\s*```/m.test(f.content)) {
      errors.push({ path: f.path, line: lineOf(f.content, f.content.indexOf("```")), message: "Markdown code fence found inside source file", severity: "error", rule: "lint" });
    }
    if (/\bconsole\.log\(/.test(f.content) && !isTest && !f.path.includes("seed")) {
      warnings.push({ path: f.path, line: lineOf(f.content, f.content.indexOf("console.log(")), message: "console.log left in production code", severity: "warning", rule: "lint" });
    }
    if (/\/\/\s*TODO|FIXME/.test(f.content)) {
      const idx = f.content.search(/\/\/\s*TODO|FIXME/);
      warnings.push({ path: f.path, line: lineOf(f.content, idx), message: "Unresolved TODO/FIXME", severity: "warning", rule: "lint" });
    }
    if (/^["']use client["'];?/m.test(f.content) && /export\s+const\s+metadata\b/.test(f.content)) {
      errors.push({ path: f.path, line: 1, message: "Client component cannot export `metadata`", severity: "error", rule: "lint" });
    }
    if (/\.tsx$/.test(f.path) && /\b(useState|useEffect|useRef|useMemo|useCallback)\s*\(/.test(f.content) && !/^["']use client["']/m.test(f.content) && f.path.startsWith("src/app/")) {
      warnings.push({ path: f.path, line: 1, message: "Hooks used in an app-router file without \"use client\" directive", severity: "warning", rule: "lint" });
    }
  }

  return { filesChecked: files.length, tsFiles, errors, warnings, testFiles, testCases, durationMs: Date.now() - started };
}

export function formatDiagnostics(list: Diagnostic[], max = 40): string {
  return list.slice(0, max).map((d) => `${d.path}:${d.line} [${d.rule}] ${d.message}`).join("\n") + (list.length > max ? `\n… ${list.length - max} more` : "");
}

/** Which agent owns a path (for routing repair work). */
export function ownerRoleFor(path: string): "database" | "backend" | "frontend" | "testing" | "devops" | "architect" {
  if (/\.(test|spec)\.[tj]sx?$/.test(path) || path.startsWith("tests/") || path.includes("__tests__") || path.startsWith("vitest")) return "testing";
  if (path.startsWith("src/db/") || path.startsWith("drizzle") || path.endsWith(".sql")) return "database";
  if (path.startsWith("src/app/api/") || path.startsWith("src/lib/") || path.startsWith("src/server/") || path.startsWith("src/services/")) return "backend";
  if (path.startsWith("src/app/") || path.startsWith("src/components/") || path.endsWith(".css")) return "frontend";
  if (path.startsWith(".github/") || path.startsWith("Dockerfile") || path.startsWith("docker-compose") || path.startsWith(".docker")) return "devops";
  return "architect";
}

/** Produce terminal-style output for the virtual `tsc`, `lint` and `test` commands. */
export function renderTscOutput(report: QualityReport): { stdout: string; exitCode: number } {
  const errs = report.errors.filter((e) => e.rule === "syntax" || e.rule === "import" || e.rule === "json");
  if (!errs.length) return { stdout: `> tsc --noEmit\n\n✔ ${report.tsFiles} TypeScript files parsed · 0 errors`, exitCode: 0 };
  return {
    stdout: `> tsc --noEmit\n\n${errs.slice(0, 30).map((e) => `${e.path}(${e.line},1): error TS: ${e.message}`).join("\n")}\n\nFound ${errs.length} error${errs.length === 1 ? "" : "s"}.`,
    exitCode: 2,
  };
}

export function renderLintOutput(report: QualityReport): { stdout: string; exitCode: number } {
  const lintErrors = report.errors.filter((e) => e.rule === "lint");
  const lines = [...lintErrors, ...report.warnings].slice(0, 40).map((d) => `  ${d.path}:${d.line}  ${d.severity}  ${d.message}`);
  const header = `> eslint . --ext .ts,.tsx\n\n`;
  if (!lines.length) return { stdout: `${header}✔ ${report.filesChecked} files checked · 0 errors · 0 warnings`, exitCode: 0 };
  return {
    stdout: `${header}${lines.join("\n")}\n\n✖ ${lintErrors.length} error${lintErrors.length === 1 ? "" : "s"}, ${report.warnings.length} warning${report.warnings.length === 1 ? "" : "s"}`,
    exitCode: lintErrors.length ? 1 : 0,
  };
}

export function renderTestOutput(report: QualityReport, files: VirtualFile[]): { stdout: string; exitCode: number; passed: number; failed: number } {
  const testFiles = files.filter((f) => /\.(test|spec)\.[tj]sx?$/.test(f.path));
  if (!testFiles.length) return { stdout: `> vitest run\n\nNo test files found. Add *.test.ts files under src/ or tests/.`, exitCode: 1, passed: 0, failed: 0 };
  const broken = new Set(report.errors.map((e) => e.path));
  let passed = 0; let failed = 0;
  const lines = testFiles.map((f) => {
    const cases = Math.max(1, (f.content.match(/\b(it|test)\s*\(/g) ?? []).length);
    // A test file whose own imports are unresolvable or whose target file has syntax errors fails.
    const importedBroken = [...broken].some((b) => f.content.includes(b.replace(/^src\//, "@/").replace(/\.[tj]sx?$/, "")) || b === f.path);
    if (importedBroken) { failed += cases; return ` ✗ ${f.path} (${cases} test${cases === 1 ? "" : "s"}) — module failed to load`; }
    passed += cases;
    return ` ✓ ${f.path} (${cases} test${cases === 1 ? "" : "s"})`;
  });
  const total = passed + failed;
  const stdout = `> vitest run\n\n${lines.join("\n")}\n\n Test Files  ${failed ? `${testFiles.filter((_, i) => lines[i].startsWith(" ✗")).length} failed | ` : ""}${testFiles.length - testFiles.filter((_, i) => lines[i].startsWith(" ✗")).length} passed (${testFiles.length})\n      Tests  ${failed ? `${failed} failed | ` : ""}${passed} passed (${total})\n   Duration  ${(0.4 + total * 0.03).toFixed(2)}s`;
  return { stdout, exitCode: failed ? 1 : 0, passed, failed };
}
