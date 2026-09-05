import type { Architecture, Entity, EntityField } from "@/db/schema";
import { camel, kebab, snake, titleCase } from "./domain";

export interface GeneratedFile {
  path: string;
  content: string;
  language: string;
}

export function languageFor(path: string) {
  const ext = path.split(".").pop() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    mjs: "javascript",
    json: "json",
    css: "css",
    md: "markdown",
    yml: "yaml",
    yaml: "yaml",
    sql: "sql",
    sh: "bash",
    env: "bash",
    example: "bash",
  };
  if (path.startsWith("Dockerfile")) return "docker";
  if (path.startsWith(".env")) return "bash";
  return map[ext] ?? "text";
}

const file = (path: string, content: string): GeneratedFile => ({
  path,
  content: content.trimStart(),
  language: languageFor(path),
});

// ─── Field helpers ────────────────────────────────────────────────────────────

function drizzleColumn(fld: EntityField, entity: Entity): string {
  const col = snake(fld.name);
  const notNull = fld.required === false ? "" : ".notNull()";
  switch (fld.type) {
    case "string":
      return `  ${fld.name}: text("${col}")${notNull},`;
    case "text":
      return `  ${fld.name}: text("${col}")${notNull},`;
    case "number":
      return `  ${fld.name}: integer("${col}")${notNull}.default(0),`;
    case "boolean":
      return `  ${fld.name}: boolean("${col}")${notNull}.default(false),`;
    case "date":
      return `  ${fld.name}: timestamp("${col}")${notNull},`;
    case "enum":
      return `  ${fld.name}: ${camel(entity.name)}${titleCase(fld.name).replace(/ /g, "")}Enum("${col}")${notNull}.default("${fld.enumValues?.[0]}"),`;
    case "reference":
      return `  ${fld.name}: text("${col}")${notNull}.references(() => ${camel(fld.references ?? "user") + "s"}.id, { onDelete: "cascade" }),`;
    default:
      return `  ${fld.name}: text("${col}")${notNull},`;
  }
}

function sqlType(fld: EntityField) {
  switch (fld.type) {
    case "number":
      return "integer";
    case "boolean":
      return "boolean";
    case "date":
      return "timestamp";
    case "enum":
      return "text";
    default:
      return "text";
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
    case "number":
      z = "z.coerce.number()";
      break;
    case "boolean":
      z = "z.coerce.boolean()";
      break;
    case "date":
      z = "z.coerce.date()";
      break;
    case "enum":
      z = `z.enum([${fld.enumValues?.map((v) => `"${v}"`).join(", ")}])`;
      break;
    case "text":
      z = "z.string().max(10_000)";
      break;
    default:
      z = fld.name.toLowerCase().includes("email") ? "z.string().email()" : "z.string().min(1).max(255)";
  }
  if (fld.required === false) z += ".optional()";
  return `  ${fld.name}: ${z},`;
}

function sampleValue(fld: EntityField, i: number) {
  switch (fld.type) {
    case "number":
      return String((i + 1) * 12);
    case "boolean":
      return i % 2 === 0 ? "true" : "false";
    case "date":
      return `new Date(Date.now() - ${i} * 86_400_000)`;
    case "enum":
      return `"${fld.enumValues?.[i % (fld.enumValues.length || 1)]}"`;
    case "reference":
      return `${camel(fld.references ?? "user")}Ids[${i} % ${camel(fld.references ?? "user")}Ids.length]`;
    default:
      if (fld.name.toLowerCase().includes("email")) return `"${fld.name}${i + 1}@example.com"`;
      return `"${titleCase(fld.name)} ${i + 1}"`;
  }
}

// ─── Generators per step ──────────────────────────────────────────────────────

export function scaffoldFiles(projectName: string, arch: Architecture): GeneratedFile[] {
  const slug = kebab(projectName);
  return [
    file(
      "package.json",
      `{
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
}
`,
    ),
    file(
      "tsconfig.json",
      `{
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
}
`,
    ),
    file(
      "next.config.ts",
      `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: { typedRoutes: true },
};

export default nextConfig;
`,
    ),
    file(
      "drizzle.config.ts",
      `import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
`,
    ),
    file(
      "src/app/layout.tsx",
      `import type { Metadata } from "next";
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
}
`,
    ),
    file(
      "src/app/globals.css",
      `@import "tailwindcss";

@theme {
  --color-brand-500: oklch(0.72 0.19 264);
  --color-brand-600: oklch(0.62 0.21 264);
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
}

:root {
  color-scheme: dark;
}

.card {
  @apply rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-sm;
}
.btn {
  @apply inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition;
}
.btn-primary {
  @apply btn bg-brand-500 text-white hover:bg-brand-600;
}
`,
    ),
    file(
      "src/lib/utils.ts",
      `export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

export function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(value);
}
`,
    ),
    file(
      "README.md",
      `# ${projectName}

${arch.overview}

## Features

${arch.features.map((f) => `- ${f}`).join("\n")}

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript
- PostgreSQL · Drizzle ORM
- Tailwind CSS v4
- Vitest

## Getting started

\`\`\`bash
cp .env.example .env
npm install
npm run db:push
npm run db:seed
npm run dev
\`\`\`

## Domain model

${arch.entities.map((e) => `- **${e.name}** — ${e.fields.map((fl) => fl.name).join(", ")}`).join("\n")}
`,
    ),
    file(
      "docs/ARCHITECTURE.md",
      `# Architecture

## Overview

${arch.overview}

## Components

${arch.components.map((c) => `### ${c.name} (${c.type})\n${c.description}\n\nDepends on: ${c.dependencies.length ? c.dependencies.join(", ") : "—"}`).join("\n\n")}

## Data flow

${arch.dataFlow.map((d, i) => `${i + 1}. ${d}`).join("\n")}
`,
    ),
  ];
}

export function databaseFiles(arch: Architecture): GeneratedFile[] {
  const enums = arch.entities.flatMap((e) =>
    e.fields
      .filter((fld) => fld.type === "enum")
      .map(
        (fld) =>
          `export const ${camel(e.name)}${titleCase(fld.name).replace(/ /g, "")}Enum = pgEnum("${snake(e.name)}_${snake(fld.name)}", [${fld.enumValues?.map((v) => `"${v}"`).join(", ")}]);`,
      ),
  );
  const tables = arch.entities.map(
    (e) => `export const ${camel(e.plural)} = pgTable("${snake(e.plural)}", {
  id: text("id").primaryKey(),
${e.fields.map((fld) => drizzleColumn(fld, e)).join("\n")}
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ${e.name} = typeof ${camel(e.plural)}.$inferSelect;
export type New${e.name} = typeof ${camel(e.plural)}.$inferInsert;`,
  );

  const seed = arch.entities
    .map((e) => {
      const rows = [0, 1, 2]
        .map((i) => `    { id: nanoid(), ${e.fields.map((fld) => `${fld.name}: ${sampleValue(fld, i)}`).join(", ")} },`)
        .join("\n");
      return `  const ${camel(e.plural)}Rows = [\n${rows}\n  ];\n  await db.insert(${camel(e.plural)}).values(${camel(e.plural)}Rows).onConflictDoNothing();\n  const ${camel(e.name)}Ids = ${camel(e.plural)}Rows.map((r) => r.id);\n  void ${camel(e.name)}Ids;`;
    })
    .join("\n\n");

  return [
    file(
      "src/db/schema.ts",
      `import { pgTable, pgEnum, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────
${enums.join("\n")}

// ─── Tables ──────────────────────────────────────────
${tables.join("\n\n")}
`,
    ),
    file(
      "src/db/index.ts",
      `import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
`,
    ),
    file(
      "src/db/seed.ts",
      `import { nanoid } from "nanoid";
import { db } from "./index";
import { ${arch.entities.map((e) => camel(e.plural)).join(", ")} } from "./schema";

async function main() {
${seed}

  console.log("✔ Seeded ${arch.entities.length} tables");
}

main().then(() => process.exit(0));
`,
    ),
    file(
      "drizzle/0000_initial.sql",
      arch.entities.map((e) => createTableSql(e)).join("\n\n") + "\n",
    ),
  ];
}

export function apiFiles(entity: Entity): GeneratedFile[] {
  const plural = camel(entity.plural);
  const schemaName = `${camel(entity.name)}Schema`;
  const stringField = entity.fields.find((fl) => fl.type === "string")?.name ?? "id";
  return [
    file(
      `src/lib/validation/${kebab(entity.name)}.ts`,
      `import { z } from "zod";

export const ${schemaName} = z.object({
${entity.fields.map(zodField).join("\n")}
});

export const ${camel(entity.name)}UpdateSchema = ${schemaName}.partial();
export type ${entity.name}Input = z.infer<typeof ${schemaName}>;
`,
    ),
    file(
      `src/services/${kebab(entity.plural)}.ts`,
      `import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { ${plural} } from "@/db/schema";
import type { ${entity.name}Input } from "@/lib/validation/${kebab(entity.name)}";

export interface ListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
}

export async function list${entity.plural}({ page = 1, pageSize = 20, search }: ListOptions = {}) {
  const where = search ? ilike(${plural}.${stringField}, \`%\${search}%\`) : undefined;
  const [rows, [{ count }]] = await Promise.all([
    db.select().from(${plural}).where(where).orderBy(desc(${plural}.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ count: sql<number>\`count(*)::int\` }).from(${plural}).where(where),
  ]);
  return { rows, total: count, page, pageSize };
}

export async function get${entity.name}(id: string) {
  const [row] = await db.select().from(${plural}).where(eq(${plural}.id, id));
  return row ?? null;
}

export async function create${entity.name}(input: ${entity.name}Input) {
  const [row] = await db.insert(${plural}).values({ id: nanoid(), ...input }).returning();
  return row;
}

export async function update${entity.name}(id: string, input: Partial<${entity.name}Input>) {
  const [row] = await db
    .update(${plural})
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(${plural}.id, id)))
    .returning();
  return row ?? null;
}

export async function delete${entity.name}(id: string) {
  const [row] = await db.delete(${plural}).where(eq(${plural}.id, id)).returning({ id: ${plural}.id });
  return !!row;
}
`,
    ),
    file(
      `src/app/api/${entity.slug}/route.ts`,
      `import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { ${schemaName} } from "@/lib/validation/${kebab(entity.name)}";
import { create${entity.name}, list${entity.plural} } from "@/services/${kebab(entity.plural)}";

export async function GET(req: NextRequest) {
  await requireSession();
  const { searchParams } = req.nextUrl;
  const result = await list${entity.plural}({
    page: Number(searchParams.get("page") ?? 1),
    pageSize: Math.min(Number(searchParams.get("pageSize") ?? 20), 100),
    search: searchParams.get("q") ?? undefined,
  });
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  await requireSession();
  const parsed = ${schemaName}.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }
  const created = await create${entity.name}(parsed.data);
  return NextResponse.json(created, { status: 201 });
}
`,
    ),
    file(
      `src/app/api/${entity.slug}/[id]/route.ts`,
      `import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { ${camel(entity.name)}UpdateSchema } from "@/lib/validation/${kebab(entity.name)}";
import { delete${entity.name}, get${entity.name}, update${entity.name} } from "@/services/${kebab(entity.plural)}";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  await requireSession();
  const { id } = await params;
  const row = await get${entity.name}(id);
  return row ? NextResponse.json(row) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  await requireSession();
  const { id } = await params;
  const parsed = ${camel(entity.name)}UpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }
  const row = await update${entity.name}(id, parsed.data);
  return row ? NextResponse.json(row) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  await requireSession();
  const { id } = await params;
  const ok = await delete${entity.name}(id);
  return ok ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
`,
    ),
  ];
}

export function authFiles(): GeneratedFile[] {
  return [
    file(
      "src/lib/auth.ts",
      `import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "session";

function sign(payload: string) {
  return createHmac("sha256", process.env.SESSION_SECRET!).update(payload).digest("base64url");
}

export function createSessionToken(userId: string, role: string) {
  const payload = Buffer.from(JSON.stringify({ userId, role, exp: Date.now() + 7 * 864e5 })).toString("base64url");
  return \`\${payload}.\${sign(payload)}\`;
}

export function verifySessionToken(token: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (expected.length !== signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
  const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { userId: string; role: string; exp: number };
  return data.exp > Date.now() ? data : null;
}

export async function getSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}

export async function requireSession(roles?: string[]) {
  const session = await getSession();
  if (!session) throw new Response("Unauthorized", { status: 401 });
  if (roles && !roles.includes(session.role)) throw new Response("Forbidden", { status: 403 });
  return session;
}
`,
    ),
    file(
      "src/app/api/auth/login/route.ts",
      `import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSessionToken } from "@/lib/auth";

const schema = z.object({ email: z.string().email(), password: z.string().min(8) });

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid credentials" }, { status: 422 });

  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email));
  const passwordHash = (user as unknown as { passwordHash?: string } | undefined)?.passwordHash ?? "";
  if (!user || !(await compare(parsed.data.password, passwordHash))) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const res = NextResponse.json({ id: user.id, email: user.email, role: user.role });
  res.cookies.set("session", createSessionToken(user.id, user.role), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return res;
}
`,
    ),
    file(
      "src/app/api/auth/logout/route.ts",
      `import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("session", "", { maxAge: 0, path: "/" });
  return res;
}
`,
    ),
    file(
      "src/app/api/health/route.ts",
      `import { sql } from "drizzle-orm";
import { db } from "@/db";

export async function GET() {
  try {
    await db.execute(sql\`select 1\`);
    return Response.json({ ok: true, uptime: process.uptime() });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
`,
    ),
    file(
      ".env.example",
      `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app
SESSION_SECRET=change-me-to-a-long-random-string
NEXT_PUBLIC_APP_URL=http://localhost:3000
`,
    ),
  ];
}

export function frontendShellFiles(projectName: string, arch: Architecture): GeneratedFile[] {
  const nav = arch.entities
    .filter((e) => e.name !== "User")
    .map((e) => `  { href: "/${e.slug}", label: "${titleCase(e.plural)}" },`)
    .join("\n");
  return [
    file(
      "src/components/AppShell.tsx",
      `"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard" },
${nav}
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-zinc-800 bg-zinc-950 p-4">
        <div className="mb-6 text-lg font-semibold tracking-tight">${projectName}</div>
        <nav className="space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
                pathname === item.href && "bg-zinc-900 text-zinc-100",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
`,
    ),
    file(
      "src/components/DataTable.tsx",
      `"use client";

import { useMemo, useState } from "react";

export interface Column<T> {
  key: keyof T & string;
  header: string;
  render?: (row: T) => React.ReactNode;
}

export function DataTable<T extends { id: string }>({ rows, columns, onDelete }: { rows: T[]; columns: Column<T>[]; onDelete?: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => rows.filter((r) => JSON.stringify(r).toLowerCase().includes(query.toLowerCase())),
    [rows, query],
  );

  if (!rows.length) {
    return <div className="card text-center text-zinc-400">Nothing here yet. Create your first record.</div>;
  }

  return (
    <div className="card p-0">
      <div className="border-b border-zinc-800 p-3">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter…" className="w-full rounded-md bg-zinc-900 px-3 py-1.5 text-sm outline-none" />
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-zinc-500">
          <tr>{columns.map((c) => <th key={c.key} className="px-4 py-2">{c.header}</th>)}{onDelete && <th />}</tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <tr key={row.id} className="border-t border-zinc-800 hover:bg-zinc-900/60">
              {columns.map((c) => <td key={c.key} className="px-4 py-2">{c.render ? c.render(row) : String(row[c.key] ?? "—")}</td>)}
              {onDelete && <td className="px-4 py-2 text-right"><button onClick={() => onDelete(row.id)} className="text-xs text-red-400 hover:underline">Delete</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
`,
    ),
    file(
      "src/app/page.tsx",
      `import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ${arch.entities.map((e) => camel(e.plural)).join(", ")} } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const counts = await Promise.all([
${arch.entities.map((e) => `    db.select({ n: sql<number>\`count(*)::int\` }).from(${camel(e.plural)}).then((r) => ({ label: "${titleCase(e.plural)}", href: "/${e.slug}", n: r[0].n })),`).join("\n")}
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-zinc-400">${arch.overview.replace(/"/g, '\\"')}</p>
      </header>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {counts.map((c) => (
          <Link key={c.href} href={c.href} className="card hover:border-zinc-700">
            <div className="text-xs uppercase tracking-wide text-zinc-500">{c.label}</div>
            <div className="mt-2 text-3xl font-semibold">{c.n}</div>
          </Link>
        ))}
      </section>
    </div>
  );
}
`,
    ),
  ];
}

export function entityPageFiles(entity: Entity): GeneratedFile[] {
  const plural = camel(entity.plural);
  const visible = entity.fields.filter((fl) => fl.type !== "text").slice(0, 5);
  return [
    file(
      `src/app/${entity.slug}/page.tsx`,
      `import { list${entity.plural} } from "@/services/${kebab(entity.plural)}";
import { ${entity.plural}Client } from "./${entity.plural}Client";

export const dynamic = "force-dynamic";

export default async function ${entity.plural}Page({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q, page } = await searchParams;
  const data = await list${entity.plural}({ search: q, page: Number(page ?? 1) });
  return <${entity.plural}Client initial={data} />;
}
`,
    ),
    file(
      `src/app/${entity.slug}/${entity.plural}Client.tsx`,
      `"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/DataTable";
import { ${entity.name}Form } from "@/components/${entity.name}Form";
import type { ${entity.name} } from "@/db/schema";

export function ${entity.plural}Client({ initial }: { initial: { rows: ${entity.name}[]; total: number } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleDelete(id: string) {
    if (!confirm("Delete this ${entity.name.toLowerCase()}?")) return;
    await fetch(\`/api/${entity.slug}/\${id}\`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">${titleCase(entity.plural)}</h1>
          <p className="text-sm text-zinc-400">{initial.total} total</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary">New ${entity.name}</button>
      </header>

      <DataTable
        rows={initial.rows}
        onDelete={handleDelete}
        columns={[
${visible.map((fl) => `          { key: "${fl.name}", header: "${titleCase(fl.name)}"${fl.type === "date" ? `, render: (r) => r.${fl.name} ? new Date(r.${fl.name}).toLocaleDateString() : "—"` : ""} },`).join("\n")}
        ]}
      />

      {open && (
        <${entity.name}Form
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
`,
    ),
    file(
      `src/components/${entity.name}Form.tsx`,
      `"use client";

import { useState } from "react";
import type { ${entity.name}Input } from "@/lib/validation/${kebab(entity.name)}";

const FIELDS = [
${entity.fields.map((fl) => `  { name: "${fl.name}", label: "${titleCase(fl.name)}", type: "${fl.type}"${fl.enumValues ? `, options: [${fl.enumValues.map((v) => `"${v}"`).join(", ")}]` : ""} },`).join("\n")}
] as const;

export function ${entity.name}Form({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/${entity.slug}", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values as unknown as ${entity.name}Input),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong");
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal>
      <form onSubmit={submit} className="card w-full max-w-lg space-y-4">
        <h2 className="text-lg font-semibold">New ${entity.name}</h2>
        {FIELDS.map((fl) => (
          <label key={fl.name} className="block text-sm">
            <span className="mb-1 block text-zinc-400">{fl.label}</span>
            {"options" in fl ? (
              <select className="w-full rounded-md bg-zinc-900 px-3 py-2" value={values[fl.name] ?? ""} onChange={(e) => setValues({ ...values, [fl.name]: e.target.value })}>
                <option value="">Select…</option>
                {fl.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input
                className="w-full rounded-md bg-zinc-900 px-3 py-2"
                type={fl.type === "number" ? "number" : fl.type === "date" ? "date" : "text"}
                value={values[fl.name] ?? ""}
                onChange={(e) => setValues({ ...values, [fl.name]: e.target.value })}
              />
            )}
          </label>
        ))}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn text-zinc-400 hover:text-zinc-100">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">{saving ? "Saving…" : "Create"}</button>
        </div>
      </form>
    </div>
  );
}
`,
    ),
  ];
}

export function testFiles(arch: Architecture): GeneratedFile[] {
  return [
    file(
      "vitest.config.ts",
      `import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", coverage: { reporter: ["text", "lcov"] } },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
`,
    ),
    ...arch.entities.map((e) =>
      file(
        `tests/${kebab(e.plural)}.test.ts`,
        `import { describe, it, expect } from "vitest";
import { ${camel(e.name)}Schema } from "@/lib/validation/${kebab(e.name)}";

describe("${e.name} validation", () => {
  it("rejects an empty payload", () => {
    const result = ${camel(e.name)}Schema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts a valid payload", () => {
    const result = ${camel(e.name)}Schema.safeParse({
${e.fields.filter((fl) => fl.required !== false).map((fl) => `      ${fl.name}: ${fl.type === "number" ? 1 : fl.type === "boolean" ? "true" : fl.type === "date" ? "new Date().toISOString()" : fl.type === "enum" ? `"${fl.enumValues?.[0]}"` : fl.name.toLowerCase().includes("email") ? '"a@b.co"' : '"example"'},`).join("\n")}
    });
    expect(result.success).toBe(true);
  });
});
`,
      ),
    ),
    file(
      "tests/auth.test.ts",
      `import { describe, it, expect, beforeAll } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/auth";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret";
});

describe("session tokens", () => {
  it("round-trips a signed token", () => {
    const token = createSessionToken("user_1", "admin");
    expect(verifySessionToken(token)?.userId).toBe("user_1");
  });

  it("rejects a tampered token", () => {
    const token = createSessionToken("user_1", "admin");
    expect(verifySessionToken(token + "x")).toBeNull();
  });
});
`,
    ),
  ];
}

export function devopsFiles(projectName: string): GeneratedFile[] {
  const slug = kebab(projectName);
  return [
    file(
      "Dockerfile",
      `FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
HEALTHCHECK CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "server.js"]
`,
    ),
    file(
      "docker-compose.yml",
      `services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/${snake(slug)}
      SESSION_SECRET: \${SESSION_SECRET}
    depends_on:
      db:
        condition: service_healthy
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ${snake(slug)}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      retries: 10

volumes:
  pgdata:
`,
    ),
    file(
      ".github/workflows/ci.yml",
      `name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
        ports: ["5432:5432"]
        options: --health-cmd pg_isready --health-interval 5s --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm test
      - run: npm run build
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t ghcr.io/\${{ github.repository }}:\${{ github.sha }} .
      - run: echo "Deploying ${slug}…"
`,
    ),
    file(
      ".dockerignore",
      `node_modules
.next
.git
*.log
.env
`,
    ),
  ];
}
