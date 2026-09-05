import type { Architecture, Entity, EntityField } from "./types";
import { camel, kebab, snake, titleCase } from "./domains";

export interface GeneratedFile { path: string; content: string; language: string; }

export function languageFor(path: string) {
  const ext = path.split(".").pop() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", mjs: "javascript",
    json: "json", css: "css", md: "markdown", yml: "yaml", yaml: "yaml",
    sql: "sql", sh: "bash",
  };
  if (path.startsWith("Dockerfile")) return "docker";
  if (path.startsWith(".env")) return "bash";
  return map[ext] ?? "text";
}

const file = (path: string, content: string): GeneratedFile =>
  ({ path, content: content.trimStart(), language: languageFor(path) });

// ─── Field helpers ──────────────────────────────────────────────────────────
function drizzleColumn(fld: EntityField, entity: Entity): string {
  const col = snake(fld.name);
  const nn = fld.required === false ? "" : ".notNull()";
  switch (fld.type) {
    case "number": return `  ${fld.name}: integer("${col}")${nn}.default(0),`;
    case "boolean": return `  ${fld.name}: boolean("${col}")${nn}.default(false),`;
    case "date": return `  ${fld.name}: timestamp("${col}")${nn},`;
    case "enum": return `  ${fld.name}: ${camel(entity.name)}${titleCase(fld.name).replace(/ /g, "")}Enum("${col}")${nn}.default("${fld.enumValues?.[0]}"),`;
    case "reference": return `  ${fld.name}: text("${col}")${nn}.references(() => ${camel(fld.references ?? "user")}s.id, { onDelete: "cascade" }),`;
    default: return `  ${fld.name}: text("${col}")${nn},`;
  }
}

function sqlType(fld: EntityField) {
  switch (fld.type) {
    case "number": return "integer";
    case "boolean": return "boolean";
    case "date": return "timestamp";
    case "enum": return "text";
    default: return "text";
  }
}

export function tableColumns(entity: Entity) {
  return [
    { name: "id", type: "text", nullable: false, isPrimary: true },
    ...entity.fields.map((fld) => ({
      name: snake(fld.name),
      type: fld.type === "enum" ? `enum(${fld.enumValues?.join("|")})` : sqlType(fld),
      nullable: fld.required === false,
      references: fld.references ? `${snake(fld.references)}s.id` : undefined,
    })),
    { name: "created_at", type: "timestamp", nullable: false, defaultValue: "now()" },
    { name: "updated_at", type: "timestamp", nullable: false, defaultValue: "now()" },
  ];
}

export function createTableSql(entity: Entity) {
  const table = snake(entity.plural);
  const cols = [
    `  "id" text PRIMARY KEY`,
    ...entity.fields.map((fld) => {
      const parts = [`  "${snake(fld.name)}" ${sqlType(fld)}`];
      if (fld.required !== false) parts.push("NOT NULL");
      if (fld.type === "enum") parts.push(`CHECK ("${snake(fld.name)}" IN (${fld.enumValues?.map((v) => `'${v}'`).join(", ")}))`);
      if (fld.references) parts.push(`REFERENCES "${snake(fld.references)}s"("id") ON DELETE CASCADE`);
      return parts.join(" ");
    }),
    `  "created_at" timestamp NOT NULL DEFAULT now()`,
    `  "updated_at" timestamp NOT NULL DEFAULT now()`,
  ];
  return `CREATE TABLE IF NOT EXISTS "${table}" (\n${cols.join(",\n")}\n);`;
}

function zodField(fld: EntityField) {
  let z: string;
  switch (fld.type) {
    case "number": z = "z.coerce.number()"; break;
    case "boolean": z = "z.coerce.boolean()"; break;
    case "date": z = "z.coerce.date()"; break;
    case "enum": z = `z.enum([${fld.enumValues?.map((v) => `"${v}"`).join(", ")}])`; break;
    case "text": z = "z.string().max(10_000)"; break;
    default: z = fld.name.toLowerCase().includes("email") ? "z.string().email()" : "z.string().min(1).max(255)";
  }
  if (fld.required === false) z += ".optional()";
  return `  ${fld.name}: ${z},`;
}

function sampleValue(fld: EntityField, i: number) {
  switch (fld.type) {
    case "number": return String((i + 1) * 12);
    case "boolean": return i % 2 === 0 ? "true" : "false";
    case "date": return `new Date(Date.now() - ${i} * 86_400_000)`;
    case "enum": return `"${fld.enumValues?.[i % (fld.enumValues.length || 1)]}"`;
    case "reference": return `${camel(fld.references ?? "user")}Ids[${i} % ${camel(fld.references ?? "user")}Ids.length]`;
    default:
      if (fld.name.toLowerCase().includes("email")) return `"${fld.name}${i + 1}@example.com"`;
      return `"${titleCase(fld.name)} ${i + 1}"`;
  }
}

// ─── Scaffold ───────────────────────────────────────────────────────────────
export function scaffoldFiles(projectName: string, arch: Architecture): GeneratedFile[] {
  const slug = kebab(projectName);
  return [
    file("package.json", `{
  "name": "${slug}",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "test": "vitest run",
    "db:push": "drizzle-kit push",
    "db:seed": "tsx src/db/seed.ts"
  },
  "dependencies": {
    "drizzle-orm": "^0.45.2",
    "next": "16.2.6",
    "pg": "^8.20.0",
    "react": "19.2.6",
    "react-dom": "19.2.6",
    "zod": "^4.4.3",
    "bcryptjs": "^3.0.2",
    "nanoid": "^6.0.1"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.1.17",
    "@types/node": "^22",
    "@types/react": "^19",
    "drizzle-kit": "^0.31.10",
    "tailwindcss": "^4.1.17",
    "tsx": "^4.20.0",
    "typescript": "^5.9.3",
    "vitest": "^3.2.4"
  }
}`),
    file("tsconfig.json", `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "strict": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "paths": { "@/*": ["./src/*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}`),
    file("next.config.ts", `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: { typedRoutes: true },
};

export default nextConfig;`),
    file("drizzle.config.ts", `import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});`),
    file("src/app/layout.tsx", `import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "${projectName}",
  description: "${arch.overview.replace(/"/g, '\\"')}",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}`),
    file("src/app/globals.css", `@import "tailwindcss";

@theme {
  --color-brand-500: oklch(0.72 0.19 264);
  --color-brand-600: oklch(0.62 0.21 264);
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
}

:root { color-scheme: dark; }

.card {
  @apply rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-sm;
}
.btn { @apply inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition; }
.btn-primary { @apply btn bg-brand-500 text-white hover:bg-brand-600; }`),
    file("src/lib/utils.ts", `export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

export function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(value);
}`),
    file("README.md", `# ${projectName}

${arch.overview}

## Features

${arch.features.map((x) => `- ${x}`).join("\n")}

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript
- PostgreSQL · Drizzle ORM
- Tailwind CSS v4 · Vitest

## Getting started

\`\`\`bash
cp .env.example .env
npm install
npm run db:push
npm run db:seed
npm run dev
\`\`\`

## Domain model

${arch.entities.map((e) => `- **${e.name}** — ${e.fields.map((fl) => fl.name).join(", ")}`).join("\n")}`),
    file("docs/ARCHITECTURE.md", `# Architecture

## Overview

${arch.overview}

## Components

${arch.components.map((c) => `### ${c.name} (${c.type})\n${c.description}\n\nDepends on: ${c.dependencies.length ? c.dependencies.join(", ") : "—"}`).join("\n\n")}

## Data flow

${arch.dataFlow.map((d, i) => `${i + 1}. ${d}`).join("\n")}`),
  ];
}

// ─── Database ───────────────────────────────────────────────────────────────
export function databaseFiles(arch: Architecture): GeneratedFile[] {
  const enums = arch.entities.flatMap((e) =>
    e.fields.filter((fld) => fld.type === "enum").map(
      (fld) => `export const ${camel(e.name)}${titleCase(fld.name).replace(/ /g, "")}Enum = pgEnum("${snake(e.name)}_${snake(fld.name)}", [${fld.enumValues?.map((v) => `"${v}"`).join(", ")}]);`
    )
  );
  const tables = arch.entities.map(
    (e) => `export const ${camel(e.plural)} = pgTable("${snake(e.plural)}", {
  id: text("id").primaryKey(),
${e.fields.map((fld) => drizzleColumn(fld, e)).join("\n")}
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ${e.name} = typeof ${camel(e.plural)}.$inferSelect;
export type New${e.name} = typeof ${camel(e.plural)}.$inferInsert;`
  );
  const seedBlocks = arch.entities.map((e, ei) => {
    const rows = [0, 1, 2].map((i) =>
      `    { id: nanoid(), ${e.fields.map((fld) => `${fld.name}: ${sampleValue(fld, i + ei)}`).join(", ")} }`
    ).join(",\n");
    return `  const ${camel(e.plural)}Rows = [\n${rows}\n  ];\n  await db.insert(${camel(e.plural)}).values(${camel(e.plural)}Rows);\n  console.log("  ✔ ${snake(e.plural)}: ${camel(e.plural)}Rows.length} rows");`;
  });

  return [
    file("src/db/index.ts", `import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool);`),
    file("src/db/schema.ts", `import { pgTable, pgEnum, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

${enums.join("\n")}

${tables.join("\n\n")}`),
    file("src/db/seed.ts", `import { nanoid } from "nanoid";
import { db } from "./index";
import { ${arch.entities.map((e) => camel(e.plural)).join(", ")} } from "./schema";

async function main() {
${arch.entities.map((e) => `  const ${camel(e.name)}Ids = ["${e.slug}-1", "${e.slug}-2", "${e.slug}-3"];`).join("\n")}
${seedBlocks.join("\n\n")}
  console.log("\\n✔ Seeded ${arch.entities.length} tables");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });`),
    file("drizzle/0001_init.sql", arch.entities.map(createTableSql).join("\n\n")),
  ];
}

// ─── Auth ───────────────────────────────────────────────────────────────────
export function authFiles(arch: Architecture): GeneratedFile[] {
  void arch;
  return [
    file("src/lib/auth.ts", `import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

const SESSION_COOKIE = "session";

export interface Session { userId: string; email: string; role: string; }

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try { return JSON.parse(Buffer.from(raw, "base64").toString()); }
  catch { return null; }
}

export async function requireRole(roles: string[]) {
  const session = await getSession();
  if (!session || !roles.includes(session.role)) {
    throw new Response("Forbidden", { status: 403 });
  }
  return session;
}`),
    file("src/app/api/health/route.ts", `import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
}`),
    file(".env.example", `# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/appdb

# Auth
SESSION_SECRET=change-me-to-a-long-random-string

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000`),
  ];
}

// ─── API ────────────────────────────────────────────────────────────────────
export function apiFiles(arch: Architecture): GeneratedFile[] {
  const out: GeneratedFile[] = [];
  for (const e of arch.entities) {
    const table = camel(e.plural);
    out.push(file(`src/lib/validators/${kebab(e.name)}.ts`, `import { z } from "zod";

export const ${camel(e.name)}Schema = z.object({
${e.fields.map(zodField).join("\n")}
});

export const ${camel(e.name)}FilterSchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type ${e.name}Input = z.infer<typeof ${camel(e.name)}Schema>;`));
    out.push(file(`src/app/api/${e.slug}/route.ts`, `import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { ${table} } from "@/db/schema";
import { ${camel(e.name)}Schema, ${camel(e.name)}FilterSchema } from "@/lib/validators/${kebab(e.name)}";
import { requireRole } from "@/lib/auth";

export async function GET(req: NextRequest) {
  await requireRole(["admin", "editor", "viewer"]);
  const query = ${camel(e.name)}FilterSchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const rows = await db.select().from(${table}).limit(query.limit).offset((query.page - 1) * query.limit);
  return NextResponse.json({ data: rows, page: query.page, limit: query.limit });
}

export async function POST(req: NextRequest) {
  await requireRole(["admin", "editor"]);
  const body = ${camel(e.name)}Schema.parse(await req.json());
  const [row] = await db.insert(${table}).values({ id: nanoid(), ...body }).returning();
  return NextResponse.json(row, { status: 201 });
}`));
    out.push(file(`src/app/api/${e.slug}/[id]/route.ts`, `import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ${table} } from "@/db/schema";
import { ${camel(e.name)}Schema } from "@/lib/validators/${kebab(e.name)}";
import { requireRole } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireRole(["admin", "editor", "viewer"]);
  const { id } = await params;
  const [row] = await db.select().from(${table}).where(eq(${table}.id, id)).limit(1);
  if (!row) return NextResponse.json({ error: "${e.name} not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireRole(["admin", "editor"]);
  const { id } = await params;
  const body = ${camel(e.name)}Schema.partial().parse(await req.json());
  const [row] = await db.update(${table}).set({ ...body, updatedAt: new Date() }).where(eq(${table}.id, id)).returning();
  if (!row) return NextResponse.json({ error: "${e.name} not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireRole(["admin"]);
  const { id } = await params;
  await db.delete(${table}).where(eq(${table}.id, id));
  return NextResponse.json({ ok: true });
}`));
  }
  return out;
}

// ─── Frontend shell ─────────────────────────────────────────────────────────
export function frontendShellFiles(projectName: string, arch: Architecture): GeneratedFile[] {
  const nav = arch.entities.map((e) => `    { href: "/${e.slug}", label: "${titleCase(e.plural)}" },`).join("\n");
  return [
    file("src/components/AppShell.tsx", `"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Overview" },
${nav}
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-zinc-800 bg-zinc-900/50 p-4">
        <Link href="/" className="mb-6 block text-lg font-bold">${projectName}</Link>
        <nav className="space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={\`block rounded-lg px-3 py-2 text-sm \${pathname === item.href ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5"}\`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}`),
    file("src/components/DataTable.tsx", `interface Column<T> { key: keyof T & string; label: string; render?: (row: T) => React.ReactNode; }

export function DataTable<T extends { id: string }>({ rows, columns, empty }: { rows: T[]; columns: Column<T>[]; empty: string }) {
  if (rows.length === 0) {
    return <div className="rounded-xl border border-dashed border-zinc-700 p-10 text-center text-sm text-zinc-500">{empty}</div>;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-900 text-left text-xs uppercase tracking-wider text-zinc-500">
          <tr>{columns.map((c) => <th key={c.key} className="px-4 py-3">{c.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-white/[0.02]">
              {columns.map((c) => <td key={c.key} className="px-4 py-3">{c.render ? c.render(row) : String(row[c.key] ?? "—")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}`),
    file("src/app/page.tsx", `import Link from "next/link";

const CARDS = [
${arch.entities.map((e) => `  { title: "${titleCase(e.plural)}", href: "/${e.slug}", desc: "Manage ${e.slug.replace(/-/g, " ")}" },`).join("\n")}
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-sm text-zinc-400">${arch.overview}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href} className="card transition hover:border-zinc-600">
            <div className="font-semibold">{c.title}</div>
            <div className="mt-1 text-sm text-zinc-400">{c.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}`),
  ];
}

// ─── Entity pages ───────────────────────────────────────────────────────────
export function entityPageFiles(arch: Architecture): GeneratedFile[] {
  const out: GeneratedFile[] = [];
  for (const e of arch.entities.filter((x) => x.name !== "User")) {
    const cols = e.fields.slice(0, 4).map((fld) => `      { key: "${fld.name}", label: "${titleCase(fld.name)}" },`).join("\n");
    const inputs = e.fields.slice(0, 5).map((fld) => {
      if (fld.type === "enum") return `        <label className="block text-sm"><span className="text-zinc-400">${titleCase(fld.name)}</span>\n          <select name="${fld.name}" className="input mt-1">${fld.enumValues?.map((v) => `<option value="${v}">${titleCase(v)}</option>`).join("")}</select></label>`;
      if (fld.type === "text") return `        <label className="block text-sm"><span className="text-zinc-400">${titleCase(fld.name)}</span>\n          <textarea name="${fld.name}" className="input mt-1" ${fld.required === false ? "" : "required"} /></label>`;
      return `        <label className="block text-sm"><span className="text-zinc-400">${titleCase(fld.name)}</span>\n          <input name="${fld.name}" type="${fld.type === "number" ? "number" : fld.type === "date" ? "date" : "text"}" className="input mt-1" ${fld.required === false ? "" : "required"} /></label>`;
    }).join("\n");
    out.push(file(`src/app/${e.slug}/page.tsx`, `import { DataTable } from "@/components/DataTable";
import Link from "next/link";

async function getRows() {
  const res = await fetch(\`\${process.env.NEXT_PUBLIC_APP_URL}/api/${e.slug}\`, { cache: "no-store" });
  if (!res.ok) return [];
  const json = await res.json();
  return json.data ?? [];
}

export default async function ${e.name}ListPage() {
  const rows = await getRows();
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">${titleCase(e.plural)}</h1>
          <p className="text-sm text-zinc-400">{rows.length} record{rows.length === 1 ? "" : "s"}</p>
        </div>
        <Link href="/${e.slug}/new" className="btn-primary">New ${e.name}</Link>
      </div>
      <DataTable
        rows={rows}
        empty="No ${e.slug.replace(/-/g, " ")} yet. Create the first one to get started."
        columns={[
${cols}
        ]}
      />
    </div>
  );
}`));
    out.push(file(`src/app/${e.slug}/new/page.tsx`, `import Link from "next/link";

export default function New${e.name}Page() {
  async function create(formData: FormData) {
    "use server";
    const payload = Object.fromEntries(formData);
    await fetch(\`\${process.env.NEXT_PUBLIC_APP_URL}/api/${e.slug}\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <Link href="/${e.slug}" className="text-sm text-zinc-400 hover:text-white">← Back to ${titleCase(e.plural)}</Link>
        <h1 className="mt-2 text-2xl font-bold">New ${e.name}</h1>
      </div>
      <form action={create} className="card space-y-4">
${inputs}
        <button type="submit" className="btn-primary w-full justify-center">Create ${e.name}</button>
      </form>
    </div>
  );
}`));
  }
  return out;
}

// ─── Tests ──────────────────────────────────────────────────────────────────
export function testFiles(arch: Architecture): GeneratedFile[] {
  const e = arch.entities[0];
  return [
    file("vitest.config.ts", `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});`),
    file(`src/lib/validators/${kebab(e.name)}.test.ts`, `import { describe, it, expect } from "vitest";
import { ${camel(e.name)}Schema } from "./${kebab(e.name)}";

describe("${e.name} validation", () => {
  it("accepts a valid payload", () => {
    const result = ${camel(e.name)}Schema.safeParse({
${e.fields.map((fld) => `      ${fld.name}: ${sampleValue(fld, 0)},`).join("\n")}
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty payload", () => {
    const result = ${camel(e.name)}Schema.safeParse({});
    expect(result.success).toBe(false);
  });
});`),
    file("src/lib/auth.test.ts", `import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./auth";

describe("auth", () => {
  it("hashes and verifies passwords", async () => {
    const hash = await hashPassword("correct-horse-123");
    expect(await verifyPassword("correct-horse-123", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  }, 15000);
});`),
  ];
}

// ─── DevOps ─────────────────────────────────────────────────────────────────
export function devopsFiles(projectName: string, arch: Architecture): GeneratedFile[] {
  void arch;
  const slug = kebab(projectName);
  return [
    file("Dockerfile", `FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS build
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]`),
    file("docker-compose.yml", `services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ${slug}
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
  app:
    build: .
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/${slug}
    ports: ["3000:3000"]
    depends_on: [db]

volumes:
  pgdata:`),
    file(".github/workflows/ci.yml", `name: CI
on: [push, pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env: { POSTGRES_PASSWORD: postgres }
        ports: ["5432:5432"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm test
      - run: npm run build`),
    file(".dockerignore", `node_modules
.next
.git
.env
coverage`),
  ];
}
