import { db } from "@/db";
import { dbTables, environmentVariables, fileNodes, projects, tasks, type RunEvalCheck, type RunEvalScore } from "@/db/schema";
import { analyzeWorkspace, type VirtualFile } from "./quality";
import { eq } from "drizzle-orm";

// Deterministic run scoring ("eval"): machine-checked quality rubric over the
// finished workspace. The LLM judge described in docs/ROADMAP.md layers on top
// of this; execution-based checks always stay the backbone.
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export async function scoreRun(projectId: string): Promise<RunEvalScore> {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  const [files, tables, env, allTasks] = await Promise.all([
    db.select().from(fileNodes).where(eq(fileNodes.projectId, projectId)),
    db.select().from(dbTables).where(eq(dbTables.projectId, projectId)),
    db.select().from(environmentVariables).where(eq(environmentVariables.projectId, projectId)),
    db.select().from(tasks).where(eq(tasks.projectId, projectId)),
  ]);
  const virtual: VirtualFile[] = files.map((f) => ({ path: f.path, content: f.content }));
  const report = analyzeWorkspace(virtual);
  const paths = new Set(files.map((f) => f.path));
  const entities = project?.architecture?.entities ?? [];
  const has = (p: string) => [...paths].some((f) => f === p || f.endsWith("/" + p));
  // Generated artefacts use plural kebab-case naming (entity "StockLevel" ->
  // table "stocklevels", route "api/stocklevels", page "dashboard/stocklevels").
  const variants = (name: string) => {
    const base = slug(name);
    return new Set([base, base + "s", base + "es", name.toLowerCase(), name.toLowerCase() + "s", name.toLowerCase() + "es", name.toLowerCase().replace(/s$/, ""), name.toLowerCase().replace(/e?s$/, "")]);
  };

  const completed = allTasks.filter((t) => t.status === "completed").length;
  const failed = allTasks.filter((t) => t.status === "failed").length;

  const checks: RunEvalCheck[] = [];

  // 1. Compiles: zero error-level diagnostics from real static analysis.
  const errors = report.errors;
  checks.push({
    id: "compiles", label: "Static analysis passes", pass: errors.length === 0, weight: 25,
    detail: errors.length === 0 ? `${report.warnings.length} warnings, no errors` : `${errors.length} error(s), e.g. ${errors[0].path}:${errors[0].line}`,
  });

  // 2. Schema coverage: every designed entity is a real table (N/A for static sites).
  const isStatic = entities.length === 0;
  const appEntities = entities.filter((e) => !/^users?$/i.test(e.name)); // auth owns the User table
  const missingTables = appEntities.filter((e) => {
    const v = variants(e.name);
    return !tables.some((t) => v.has(t.name.toLowerCase()));
  });
  checks.push({
    id: "schema", label: "Schema covers every entity", pass: isStatic || missingTables.length === 0, weight: 15,
    detail: isStatic ? "not applicable (static site)" : missingTables.length === 0 ? `${tables.length} tables for ${entities.length} entities` : `missing: ${missingTables.map((e) => e.name).join(", ")}`,
  });

  // 3. API coverage: a typed route file per entity.
  const missingApi = appEntities.filter((e) => ![...variants(e.name)].some((v) => paths.has(`src/app/api/${v}/route.ts`)));
  checks.push({
    id: "api", label: "REST API per entity", pass: isStatic || missingApi.length === 0, weight: 15,
    detail: isStatic ? "not applicable (static site)" : missingApi.length === 0 ? `${entities.length} route files` : `missing: ${missingApi.map((e) => slug(e.name)).join(", ")}`,
  });

  // 4. UI coverage: a list page per non-user entity.
  const pageEntities = appEntities;
  const missingPages = pageEntities.filter((e) => ![...variants(e.name)].some((v) => has(`src/app/${v}/page.tsx`) || has(`src/app/dashboard/${v}/page.tsx`)));
  checks.push({
    id: "pages", label: "Pages per entity", pass: isStatic || missingPages.length === 0, weight: 10,
    detail: isStatic ? `${files.filter((f) => f.path.endsWith(".html")).length} HTML pages` : missingPages.length === 0 ? `${pageEntities.length} resource pages` : `missing: ${missingPages.map((e) => e.name).join(", ")}`,
  });

  // 5. Tests written and green (static sites: their quality-gate step instead).
  const testFiles = files.filter((f) => /\.(test|spec)\.[tj]sx?$/.test(f.path));
  const testTask = allTasks.find((t) => t.stepKey === (isStatic ? "static-quality" : "run-tests"));
  checks.push({
    id: "tests", label: isStatic ? "Quality gate green" : "Test suite present and green",
    pass: isStatic ? testTask?.status === "completed" : testFiles.length >= 2 && testTask?.status === "completed", weight: 15,
    detail: isStatic ? `quality gate ${testTask?.status ?? "unknown"}` : `${testFiles.length} test files, gate ${testTask?.status ?? "unknown"}`,
  });

  // 6. Auth + secrets registered (static sites ship none by design).
  checks.push({
    id: "auth", label: "Auth config and env vars", pass: isStatic || env.some((e) => /SESSION|SECRET|DATABASE/i.test(e.key)), weight: 5,
    detail: isStatic ? "not applicable (static site)" : `${env.length} env vars registered`,
  });

  // 7. Docs: plan + architecture.
  checks.push({
    id: "docs", label: "Plan and architecture docs", pass: paths.has("docs/PLAN.md") && paths.has("docs/ARCHITECTURE.md"), weight: 5,
    detail: `${[paths.has("docs/PLAN.md") && "PLAN", paths.has("docs/ARCHITECTURE.md") && "ARCHITECTURE"].filter(Boolean).join(" + ") || "none"}`,
  });

  // 8. Infra: container image and CI (static sites: static-host config).
  checks.push({
    id: "infra", label: isStatic ? "Static host config" : "Dockerfile and CI workflow",
    pass: isStatic ? paths.has("netlify.toml") : paths.has("Dockerfile") && has(".github/workflows/ci.yml"), weight: 5,
    detail: isStatic ? [paths.has("netlify.toml") && "netlify.toml", paths.has("README.md") && "deploy docs"].filter(Boolean).join(" + ") || "none"
      : [paths.has("Dockerfile") && "Dockerfile", has(".github/workflows/ci.yml") && "CI"].filter(Boolean).join(" + ") || "none",
  });

  // 9. Pipeline integrity: nothing failed.
  checks.push({
    id: "pipeline", label: "All steps completed", pass: failed === 0 && allTasks.length > 0 && completed === allTasks.length, weight: 5,
    detail: `${completed}/${allTasks.length} steps completed${failed ? `, ${failed} failed` : ""}`,
  });

  const total = Math.round(checks.reduce((sum, c) => sum + (c.pass ? c.weight : 0), 0));
  const grade: RunEvalScore["grade"] = total >= 90 ? "A" : total >= 75 ? "B" : total >= 55 ? "C" : "D";
  return { total, grade, checks, scoredAt: new Date().toISOString() };
}
