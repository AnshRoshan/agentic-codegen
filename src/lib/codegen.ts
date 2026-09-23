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
    "@types/pg": "^8",
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
import "./globals.css";

export const metadata: Metadata = {
  title: "${projectName}",
  description: "${arch.overview.replace(/"/g, '\\"')}",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">{children}</body>
    </html>
  );
}`),
    file("src/app/page.tsx", `import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}`),
    file("src/app/globals.css", `@import "tailwindcss";

@theme {
  --color-brand-300: oklch(0.82 0.13 264);
  --color-brand-400: oklch(0.76 0.16 266);
  --color-brand-500: oklch(0.7 0.19 268);
  --color-brand-600: oklch(0.62 0.2 270);
  --color-surface: oklch(0.17 0.012 265);
  --color-surface-2: oklch(0.21 0.014 265);
  --font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif;
}

:root {
  color-scheme: dark;
}

body {
  background:
    radial-gradient(70rem 34rem at 78% -12%, oklch(0.7 0.19 268 / 0.09), transparent 60%),
    radial-gradient(46rem 26rem at -8% 8%, oklch(0.72 0.15 205 / 0.05), transparent 55%),
    oklch(0.135 0.008 265);
  background-attachment: fixed;
}

.card {
  @apply rounded-2xl border border-white/[0.07] bg-surface/80 p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset];
}
.card-hover { @apply transition duration-200 hover:border-brand-500/40 hover:bg-surface-2/80; }

.btn { @apply inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition active:scale-[0.98]; }
.btn-primary {
  @apply btn text-white;
  background: linear-gradient(135deg, var(--color-brand-400), var(--color-brand-600));
  box-shadow: 0 4px 14px oklch(0.7 0.19 268 / 0.35), inset 0 1px 0 rgb(255 255 255 / 0.18);
}
.btn-primary:hover { filter: brightness(1.08); }
.btn-ghost { @apply btn border border-white/10 text-zinc-300 hover:border-white/25 hover:text-white; }
.btn-danger { @apply btn border border-rose-500/30 text-rose-300 hover:bg-rose-500/10; }

.input {
  @apply w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-500;
}
.input:focus { @apply border-brand-400/60 ring-2 ring-brand-500/25; }

.chip { @apply inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5 text-xs text-zinc-300; }

::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-thumb { background: rgb(255 255 255 / 0.12); border-radius: 8px; border: 2px solid transparent; background-clip: content-box; }
::-webkit-scrollbar-thumb:hover { background: rgb(255 255 255 / 0.2); border: 2px solid transparent; background-clip: content-box; }`),
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
    return `  const ${camel(e.plural)}Rows: New${e.name}[] = [
${rows}
  ];
  await db.insert(${camel(e.plural)}).values(${camel(e.plural)}Rows);
  console.log("  ✔ ${snake(e.plural)}: " + ${camel(e.plural)}Rows.length + " rows");`;
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
import type { ${arch.entities.map((e) => "New" + e.name).join(", ")} } from "./schema";

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
  const nav = arch.entities.map((e) => `    { href: "/dashboard/${e.slug}", label: "${titleCase(e.plural)}" },`).join("\n");
  const countImports = arch.entities.filter((x) => x.name !== "User").map((e) => `  ${camel(e.plural)},`).join("\n");
  const countLines = arch.entities.filter((x) => x.name !== "User").map((e) => `  const ${camel(e.plural)}Count = await db.$count(${camel(e.plural)});`).join("\n");
  const statTiles = arch.entities.filter((x) => x.name !== "User").slice(0, 4).map((e) => `    { label: "${titleCase(e.plural)}", value: ${camel(e.plural)}Count, href: "/dashboard/${e.slug}" },`).join("\n");
  const cards = arch.entities.filter((x) => x.name !== "User").map((e) => `    { title: "${titleCase(e.plural)}", href: "/dashboard/${e.slug}", count: ${camel(e.plural)}Count, desc: "Browse, create and manage ${e.slug.replace(/-/g, " ")} records." },`).join("\n");
  return [
    file("src/components/AppShell.tsx", `"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Overview" },
${nav}
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-white/[0.07] bg-surface/60 p-4 backdrop-blur md:flex">
        <Link href="/dashboard" className="mb-7 flex items-center gap-2.5 px-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl text-sm font-black text-white" style={{ background: "linear-gradient(135deg, var(--color-brand-400), var(--color-brand-600))" }}>
            "${projectName.slice(0, 1).toUpperCase()}"
          </span>
          <span className="text-[15px] font-bold tracking-tight">${projectName}</span>
        </Link>
        <nav className="space-y-1">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}
                className={\`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition \${active ? "bg-brand-500/15 text-white ring-1 ring-brand-500/30" : "text-zinc-400 hover:bg-white/[0.05] hover:text-white"}\`}>
                <span className={\`h-1.5 w-1.5 rounded-full \${active ? "bg-brand-400" : "bg-zinc-600"}\`} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 text-[11px] leading-relaxed text-zinc-500">
          Built with Next.js, PostgreSQL and Drizzle. Data flows through typed API routes with Zod validation.
        </div>
      </aside>
      <div className="flex min-h-screen flex-1 flex-col md:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-white/[0.07] bg-surface/70 px-5 backdrop-blur md:hidden">
          <span className="text-[15px] font-bold">${projectName}</span>
          <nav className="ml-auto flex gap-1 overflow-x-auto">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className={\`rounded-lg px-2.5 py-1.5 text-xs \${pathname === item.href ? "bg-white/10 text-white" : "text-zinc-400"}\`}>{item.label}</Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">{children}</main>
      </div>
    </div>
  );
}`),
    file("src/components/DataTable.tsx", `import Link from "next/link";

interface Column<T> { key: keyof T & string; label: string; format?: "date" | "money" | "text"; }

export function DataTable<T extends { id: string }>({ rows, columns, empty, hrefBase }: {
  rows: T[]; columns: Column<T>[]; empty: string; hrefBase?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/12 px-6 py-14 text-center">
        <div className="text-sm font-semibold text-zinc-300">{empty}</div>
        <div className="mt-1 text-xs text-zinc-500">Use the button in the top-right to add the first one.</div>
      </div>
    );
  }
  const cell = (row: T, c: Column<T>) => {
    const v = row[c.key];
    if (v == null || v === "") return "—";
    if (c.format === "date") return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(String(v)));
    if (c.format === "money") return new Intl.NumberFormat("en", { style: "currency", currency: "USD" }).format(Number(v));
    return String(v);
  };
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-surface/60">
      <table className="w-full text-sm">
        <thead className="bg-white/[0.04] text-left text-[11px] uppercase tracking-wider text-zinc-500">
          <tr>{columns.map((c) => <th key={c.key} className="px-4 py-3 font-semibold">{c.label}</th>)}{hrefBase && <th className="px-4 py-3" />}</tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {rows.map((row) => (
            <tr key={row.id} className="transition hover:bg-white/[0.03]">
              {columns.map((c) => <td key={c.key} className="px-4 py-3 text-zinc-200">{cell(row, c)}</td>)}
              {hrefBase && (
                <td className="px-4 py-3 text-right">
                  <Link href={\`\${hrefBase}/\${row.id}\`} className="text-[13px] font-medium text-brand-300 hover:text-brand-200">Edit</Link>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}`),
    file("src/app/dashboard/layout.tsx", `import { AppShell } from "@/components/AppShell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}`),
    file("src/app/dashboard/loading.tsx", `export default function Loading() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="h-8 w-48 rounded-lg bg-white/[0.06]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-white/[0.04]" />)}
      </div>
      <div className="h-64 rounded-2xl bg-white/[0.04]" />
    </div>
  );
}`),
    file("src/app/dashboard/page.tsx", `import Link from "next/link";
import { db } from "@/db";
import {
${countImports}
} from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
${countLines}
  const stats = [
${statTiles}
  ];
  const cards = [
${cards}
  ];
  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">${arch.overview.replace(/"/g, "&quot;")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.href} href={s.href} className="card card-hover">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{s.label}</div>
            <div className="mt-2 text-3xl font-bold tabular-nums">{s.value}</div>
          </Link>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="card card-hover group flex items-center justify-between">
            <div>
              <div className="font-semibold">{c.title} <span className="ml-1 text-xs font-normal text-zinc-500">{c.count}</span></div>
              <div className="mt-1 text-sm text-zinc-400">{c.desc}</div>
            </div>
            <span className="text-brand-300 opacity-0 transition group-hover:opacity-100">→</span>
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
    const table = camel(e.plural);
    const schema = camel(e.name) + "Schema";
    const valImport = `import { ${schema} } from "@/lib/validators/${kebab(e.name)}";`;
    const cols = e.fields.slice(0, 4).map((fld) => `      { key: "${fld.name}", label: "${titleCase(fld.name)}"${fld.type === "number" && /price|cost|amount|total/i.test(fld.name) ? ', format: "money"' : fld.type === "date" ? ', format: "date"' : ""} },`).join("\n");

    const input = (fld: EntityField, prefix: string) => {
      const label = titleCase(fld.name);
      const req = fld.required === false ? "" : " required";
      const def = prefix ? ` defaultValue={${prefix} ? formValue(${prefix}.${fld.name}) : ""}` : "";
      if (fld.type === "enum") { const sel = prefix ? ` defaultValue={${prefix} ? String(${prefix}.${fld.name}) : undefined}` : ""; return `        <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-zinc-400">${label}</span>
          <select name="${fld.name}"${sel} className="input">${(fld.enumValues ?? []).map((v) => `<option value="${v}">${titleCase(v)}</option>`).join("")}</select></label>`; }
      if (fld.type === "text") return `        <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-zinc-400">${label}</span>\n          <textarea name="${fld.name}" rows={3} ${def} className="input" ${req} /></label>`;
      if (fld.type === "boolean") { const chk = prefix ? ` defaultChecked={${prefix} ? Boolean(${prefix}.${fld.name}) : false}` : ""; return `        <label className="flex items-center gap-2.5 text-sm text-zinc-300"><input type="checkbox" name="${fld.name}"${chk} className="h-4 w-4 accent-brand-500" /> ${label}</label>`; }
      const type = fld.type === "number" ? "number" : fld.type === "date" ? "date" : "text";
      const step = fld.type === "number" ? ` step="any"` : "";
      return `        <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-zinc-400">${label}</span>\n          <input name="${fld.name}" type="${type}"${step} ${def} className="input" ${req} /></label>`;
    };

    const formHelpers = `function formValue(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}`;

    const listFields = e.fields.slice(0, 5);
    out.push(file(`src/app/dashboard/${e.slug}/page.tsx`, `import { DataTable } from "@/components/DataTable";
import Link from "next/link";
import { db } from "@/db";
import { ${table} } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function ${e.name}ListPage() {
  const rows = await db.select().from(${table}).limit(100);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">${titleCase(e.plural)}</h1>
          <p className="mt-0.5 text-sm text-zinc-400">{rows.length} record{rows.length === 1 ? "" : "s"}</p>
        </div>
        <Link href="/dashboard/${e.slug}/new" className="btn-primary">+ New ${e.name}</Link>
      </div>
      <DataTable
        rows={rows}
        hrefBase="/dashboard/${e.slug}"
        empty="No ${e.slug.replace(/-/g, " ")} yet."
        columns={[
${cols}
        ]}
      />
    </div>
  );
}`));

    const createInputs = listFields.map((fld) => input(fld, "")).join("\n");
    out.push(file(`src/app/dashboard/${e.slug}/new/page.tsx`, `import { redirect } from "next/navigation";
import Link from "next/link";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { ${table} } from "@/db/schema";
${valImport}

export default function New${e.name}Page() {
  async function create(formData: FormData) {
    "use server";
    const parsed = ${schema}.safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new Error("Invalid input: " + parsed.error.issues[0]?.message);
    await db.insert(${table}).values({ id: nanoid(), ...parsed.data });
    redirect("/dashboard/${e.slug}");
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <Link href="/dashboard/${e.slug}" className="text-sm text-zinc-400 transition hover:text-white">← ${titleCase(e.plural)}</Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">New ${e.name}</h1>
      </div>
      <form action={create} className="card space-y-4">
${createInputs}
        <div className="flex gap-2 pt-1">
          <button type="submit" className="btn-primary flex-1">Create ${e.name}</button>
          <Link href="/dashboard/${e.slug}" className="btn-ghost">Cancel</Link>
        </div>
      </form>
    </div>
  );
}`));

    const editInputs = listFields.map((fld) => input(fld, "row")).join("\n");
    out.push(file(`src/app/dashboard/${e.slug}/[id]/page.tsx`, `import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ${table} } from "@/db/schema";
${valImport}

${formHelpers}

export default async function Edit${e.name}Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await db.select().from(${table}).where(eq(${table}.id, id));
  if (!row) notFound();

  async function update(formData: FormData) {
    "use server";
    const parsed = ${schema}.safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new Error("Invalid input: " + parsed.error.issues[0]?.message);
    await db.update(${table}).set(parsed.data).where(eq(${table}.id, id));
    redirect("/dashboard/${e.slug}");
  }

  async function remove() {
    "use server";
    await db.delete(${table}).where(eq(${table}.id, id));
    redirect("/dashboard/${e.slug}");
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <Link href="/dashboard/${e.slug}" className="text-sm text-zinc-400 transition hover:text-white">← ${titleCase(e.plural)}</Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Edit ${e.name}</h1>
      </div>
      <form action={update} className="card space-y-4">
${editInputs}
        <div className="flex gap-2 pt-1">
          <button type="submit" className="btn-primary flex-1">Save changes</button>
          <Link href="/dashboard/${e.slug}" className="btn-ghost">Cancel</Link>
        </div>
      </form>
      <form action={remove} className="card border-rose-500/20">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-zinc-400">Delete this ${e.slug.replace(/-/g, " ")} permanently.</div>
          <button type="submit" className="btn-danger">Delete</button>
        </div>
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
