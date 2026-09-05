// ─── Skills + MCP registry ──────────────────────────────────────────────────
export interface Skill {
  id: string; name: string; version: string; category: string;
  description: string; triggers: string[]; agents: string[];
  files: number; updated: string;
}

export const SKILLS: Skill[] = [
  { id: "nextjs-app-router", name: "Next.js App Router", version: "16.2.0", category: "Framework", description: "Server components, route handlers, layouts, loading/error boundaries and typed routes.", triggers: ["page.tsx", "route.ts", "layout"], agents: ["frontend", "backend", "architect"], files: 24, updated: "2d ago" },
  { id: "drizzle-schema", name: "Drizzle ORM + Postgres", version: "0.45.2", category: "Database", description: "Table definitions, relations, enums, indexes, migrations and seed scripts.", triggers: ["schema.ts", "migration", "seed"], agents: ["database"], files: 18, updated: "1d ago" },
  { id: "zod-validation", name: "Zod Validation", version: "4.4.0", category: "Backend", description: "Request schemas, coercion, filters/pagination and error shaping for every resource.", triggers: ["validators/", "schema"], agents: ["backend", "testing"], files: 12, updated: "3d ago" },
  { id: "tailwind-v4", name: "Tailwind CSS v4", version: "4.1.0", category: "Styling", description: "Theme tokens, utility-first layouts, dark mode and responsive data tables.", triggers: ["globals.css", "className"], agents: ["frontend"], files: 9, updated: "5d ago" },
  { id: "auth-sessions", name: "Auth + RBAC", version: "1.6.0", category: "Security", description: "Session cookies, bcrypt hashing, role guards and protected route patterns.", triggers: ["auth.ts", "middleware"], agents: ["backend", "architect"], files: 11, updated: "4d ago" },
  { id: "vitest-suite", name: "Vitest Testing", version: "3.2.0", category: "Quality", description: "Unit + API tests, coverage thresholds and CI quality gates.", triggers: [".test.ts", "coverage"], agents: ["testing"], files: 14, updated: "2d ago" },
  { id: "docker-deploy", name: "Docker + CI Deploy", version: "2.1.0", category: "DevOps", description: "Multi-stage Dockerfiles, compose stacks, GitHub Actions and health checks.", triggers: ["Dockerfile", "ci.yml"], agents: ["devops"], files: 10, updated: "6d ago" },
  { id: "react-forms", name: "React Forms + Tables", version: "1.9.0", category: "Frontend", description: "Server actions, accessible inputs, data tables with empty/loading/error states.", triggers: ["new/page.tsx", "DataTable"], agents: ["frontend"], files: 13, updated: "3d ago" },
];

export interface MCPServer {
  id: string; name: string; status: "connected" | "available" | "error";
  description: string; tools: string[]; version: string; latency: string;
}

export const MCP_SERVERS: MCPServer[] = [
  { id: "filesystem", name: "Filesystem", status: "connected", description: "Sandboxed read/write inside the project workspace with versioning.", tools: ["read_file", "write_file", "list_dir", "search"], version: "1.4.0", latency: "4ms" },
  { id: "postgres", name: "PostgreSQL", status: "connected", description: "Schema introspection, migration runs and seeded fixture inspection.", tools: ["introspect", "migrate", "query", "seed"], version: "2.0.1", latency: "12ms" },
  { id: "github", name: "GitHub", status: "connected", description: "Repo scaffolding, branch pushes and PR creation for generated code.", tools: ["create_repo", "push", "open_pr"], version: "1.9.2", latency: "180ms" },
  { id: "shell", name: "Sandbox Shell", status: "connected", description: "Executes npm, typecheck, test and build commands in an isolated container.", tools: ["exec", "npm_install", "npm_test", "npm_build"], version: "1.2.0", latency: "—" },
  { id: "playwright", name: "Playwright Web", status: "available", description: "Headless browser checks for generated pages and visual snapshots.", tools: ["navigate", "snapshot", "assert"], version: "0.9.4", latency: "320ms" },
  { id: "stripe", name: "Stripe", status: "available", description: "Test-mode products, prices and checkout sessions for billing templates.", tools: ["create_product", "checkout"], version: "1.1.0", latency: "210ms" },
];

export const SKILL_CATEGORIES = ["All", "Framework", "Database", "Backend", "Frontend", "Styling", "Security", "Quality", "DevOps"] as const;
