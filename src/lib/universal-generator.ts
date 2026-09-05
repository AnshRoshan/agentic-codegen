// ─────────────────────────────────────────────────────────────────────────────
// Universal Application Generator
// Turns an inferred AppSpec into a COMPLETE, runnable Next.js + Drizzle codebase.
// Works for any domain — capacity forecasting, CRM, IoT, healthcare, anything.
// ─────────────────────────────────────────────────────────────────────────────

import type { AppSpec, Entity, EntityField, FieldType } from "./domain-inference";
import { pascal, camel, titleCase } from "./domain-inference";

export interface GenFile {
  path: string;
  name: string;
  language: string;
  content: string;
}

const L = (...parts: string[]) => parts.join("\n");
const q = (s: string) => JSON.stringify(s);

// ─── Type mapping ────────────────────────────────────────────────────────────

function drizzleCol(fld: EntityField): string {
  const n = q(fld.name);
  switch (fld.type) {
    case "serial":    return `serial(${n}).primaryKey()`;
    case "integer":   return `integer(${n})`;
    case "numeric":   return `numeric(${n})`;
    case "boolean":   return `boolean(${n})`;
    case "timestamp": return `timestamp(${n})`;
    case "date":      return `date(${n})`;
    case "jsonb":     return `jsonb(${n})`;
    default:          return `text(${n})`;
  }
}

function tsType(fld: EntityField): string {
  switch (fld.type) {
    case "serial": case "integer": case "numeric": return "number";
    case "boolean": return "boolean";
    case "timestamp": case "date": return "string";
    case "jsonb": return "unknown";
    default: return "string";
  }
}

function zodType(fld: EntityField): string {
  let base: string;
  switch (fld.type) {
    case "serial": case "integer": base = "z.coerce.number().int()"; break;
    case "numeric": base = "z.coerce.number()"; break;
    case "boolean": base = "z.coerce.boolean()"; break;
    case "timestamp": case "date": base = "z.string()"; break;
    case "jsonb": base = "z.any()"; break;
    case "email": base = "z.string().email()"; break;
    case "url": base = "z.string().url()"; break;
    case "enum": base = `z.enum([${(fld.enumValues ?? ["active"]).map(q).join(", ")}])`; break;
    case "longtext": base = "z.string()"; break;
    default: base = "z.string().min(1)";
  }
  return fld.required ? base : base + ".optional().nullable()";
}

function inputKind(fld: EntityField): string {
  switch (fld.type) {
    case "integer": case "numeric": case "serial": return "number";
    case "boolean": return "checkbox";
    case "date": return "date";
    case "timestamp": return "datetime-local";
    case "email": return "email";
    case "url": return "url";
    default: return "text";
  }
}

const editableFields = (e: Entity) =>
  e.fields.filter((f) => !f.isPrimary && f.name !== "created_at" && f.name !== "updated_at");

const listFields = (e: Entity) =>
  e.fields.filter((f) => f.inList !== false && !f.isPrimary && f.name !== "updated_at").slice(0, 6);

// ─── Drizzle schema ──────────────────────────────────────────────────────────

function genSchema(spec: AppSpec): string {
  const imports = new Set<string>(["pgTable"]);
  for (const e of spec.entities) {
    for (const f of e.fields) {
      switch (f.type) {
        case "serial": imports.add("serial"); break;
        case "integer": imports.add("integer"); break;
        case "numeric": imports.add("numeric"); break;
        case "boolean": imports.add("boolean"); break;
        case "timestamp": imports.add("timestamp"); break;
        case "date": imports.add("date"); break;
        case "jsonb": imports.add("jsonb"); break;
        default: imports.add("text");
      }
    }
  }

  const blocks = spec.entities.map((e) => {
    const cols = e.fields.map((f) => {
      let line = `  ${camel(f.name)}: ${drizzleCol(f)}`;
      if (f.required && !f.isPrimary) line += ".notNull()";
      if (f.defaultValue) {
        if (f.defaultValue === "now()") line += ".defaultNow()";
        else if (f.type === "boolean") line += `.default(${f.defaultValue})`;
        else if (f.type === "integer" || f.type === "numeric") line += `.default(${f.defaultValue})`;
        else line += `.default(${f.defaultValue.startsWith("'") ? f.defaultValue.replace(/'/g, '"') : q(f.defaultValue)})`;
      }
      if (f.isForeign && f.references) {
        const [refTable] = f.references.split(".");
        const refVar = spec.entities.find((x) => x.table === refTable)?.varName;
        if (refVar && refVar !== e.varName) line += `.references(() => ${refVar}.id)`;
      }
      return line + ",";
    });
    return L(
      `/** ${e.description} */`,
      `export const ${e.varName} = pgTable(${q(e.table)}, {`,
      ...cols,
      `});`,
      ``,
      `export type ${e.name} = typeof ${e.varName}.$inferSelect;`,
      `export type New${e.name} = typeof ${e.varName}.$inferInsert;`
    );
  });

  return L(
    `import { ${[...imports].sort().join(", ")} } from "drizzle-orm/pg-core";`,
    ``,
    `// Auto-generated schema for ${spec.name}`,
    `// Domain: ${spec.domain} | ${spec.entities.length} entities`,
    ``,
    ...blocks.map((b) => b + "\n")
  );
}

// ─── Zod validation ──────────────────────────────────────────────────────────

function genValidation(spec: AppSpec): string {
  const blocks = spec.entities.map((e) => {
    const fields = editableFields(e).map((f) => `  ${camel(f.name)}: ${zodType(f)},`);
    return L(
      `export const ${e.name}Schema = z.object({`,
      ...fields,
      `});`,
      `export const ${e.name}UpdateSchema = ${e.name}Schema.partial();`,
      `export type ${e.name}Input = z.infer<typeof ${e.name}Schema>;`
    );
  });
  return L(`import { z } from "zod";`, ``, ...blocks.map((b) => b + "\n"));
}

// ─── API routes ──────────────────────────────────────────────────────────────

function genListRoute(spec: AppSpec, e: Entity): string {
  const searchable = e.fields.filter((f) => f.searchable);
  const searchBlock = searchable.length
    ? L(
        `    if (search) {`,
        `      const term = "%" + search + "%";`,
        `      rows = rows.filter((r) =>`,
        searchable.map((f) => `        String(r.${camel(f.name)} ?? "").toLowerCase().includes(search.toLowerCase())`).join(" ||\n"),
        `      );`,
        `    }`
      )
    : "";

  return L(
    `import { NextRequest, NextResponse } from "next/server";`,
    `import { db } from "@/db";`,
    `import { ${e.varName} } from "@/db/schema";`,
    `import { ${e.name}Schema } from "@/lib/validation";`,
    `import { desc } from "drizzle-orm";`,
    ``,
    `/** GET /api/${e.slug} — list ${e.labelPlural} */`,
    `export async function GET(req: NextRequest) {`,
    `  try {`,
    `    const { searchParams } = new URL(req.url);`,
    `    const search = searchParams.get("q") ?? "";`,
    `    const limit = Number(searchParams.get("limit") ?? 100);`,
    ``,
    `    let rows = await db.select().from(${e.varName}).orderBy(desc(${e.varName}.id)).limit(limit);`,
    searchBlock,
    ``,
    `    return NextResponse.json({ data: rows, count: rows.length });`,
    `  } catch (error) {`,
    `    console.error("GET /api/${e.slug} failed:", error);`,
    `    return NextResponse.json({ error: "Failed to fetch ${e.labelPlural}" }, { status: 500 });`,
    `  }`,
    `}`,
    ``,
    `/** POST /api/${e.slug} — create a ${e.label} */`,
    `export async function POST(req: NextRequest) {`,
    `  try {`,
    `    const body = await req.json();`,
    `    const parsed = ${e.name}Schema.safeParse(body);`,
    `    if (!parsed.success) {`,
    `      return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });`,
    `    }`,
    `    const [created] = await db.insert(${e.varName}).values(parsed.data).returning();`,
    `    return NextResponse.json(created, { status: 201 });`,
    `  } catch (error) {`,
    `    console.error("POST /api/${e.slug} failed:", error);`,
    `    return NextResponse.json({ error: "Failed to create ${e.label}" }, { status: 500 });`,
    `  }`,
    `}`
  );
}

function genItemRoute(spec: AppSpec, e: Entity): string {
  return L(
    `import { NextRequest, NextResponse } from "next/server";`,
    `import { db } from "@/db";`,
    `import { ${e.varName} } from "@/db/schema";`,
    `import { ${e.name}UpdateSchema } from "@/lib/validation";`,
    `import { eq } from "drizzle-orm";`,
    ``,
    `/** GET /api/${e.slug}/[id] */`,
    `export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {`,
    `  const { id } = await params;`,
    `  const [row] = await db.select().from(${e.varName}).where(eq(${e.varName}.id, Number(id)));`,
    `  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });`,
    `  return NextResponse.json(row);`,
    `}`,
    ``,
    `/** PATCH /api/${e.slug}/[id] */`,
    `export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {`,
    `  const { id } = await params;`,
    `  const body = await req.json();`,
    `  const parsed = ${e.name}UpdateSchema.safeParse(body);`,
    `  if (!parsed.success) {`,
    `    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });`,
    `  }`,
    `  const [updated] = await db.update(${e.varName}).set(parsed.data).where(eq(${e.varName}.id, Number(id))).returning();`,
    `  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });`,
    `  return NextResponse.json(updated);`,
    `}`,
    ``,
    `/** DELETE /api/${e.slug}/[id] */`,
    `export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {`,
    `  const { id } = await params;`,
    `  await db.delete(${e.varName}).where(eq(${e.varName}.id, Number(id)));`,
    `  return NextResponse.json({ success: true });`,
    `}`
  );
}

// ─── Entity UI page ──────────────────────────────────────────────────────────

function genEntityPage(e: Entity): string {
  const cols = listFields(e);
  return L(
    `"use client";`,
    ``,
    `import { useEffect, useState, useCallback } from "react";`,
    `import { ${e.name}Form } from "@/components/${e.name}Form";`,
    ``,
    `interface Row { id: number; [key: string]: unknown }`,
    ``,
    `export default function ${e.name}Page() {`,
    `  const [rows, setRows] = useState<Row[]>([]);`,
    `  const [loading, setLoading] = useState(true);`,
    `  const [search, setSearch] = useState("");`,
    `  const [showForm, setShowForm] = useState(false);`,
    `  const [editing, setEditing] = useState<Row | null>(null);`,
    ``,
    `  const load = useCallback(async () => {`,
    `    setLoading(true);`,
    `    const res = await fetch("/api/${e.slug}?q=" + encodeURIComponent(search));`,
    `    const json = await res.json();`,
    `    setRows(json.data ?? []);`,
    `    setLoading(false);`,
    `  }, [search]);`,
    ``,
    `  useEffect(() => { load(); }, [load]);`,
    ``,
    `  const remove = async (id: number) => {`,
    `    if (!confirm("Delete this ${e.label.toLowerCase()}?")) return;`,
    `    await fetch("/api/${e.slug}/" + id, { method: "DELETE" });`,
    `    load();`,
    `  };`,
    ``,
    `  return (`,
    `    <div className="p-8 space-y-6">`,
    `      <div className="flex items-center justify-between">`,
    `        <div>`,
    `          <h1 className="text-2xl font-bold">${e.icon} ${e.labelPlural}</h1>`,
    `          <p className="text-sm text-slate-400 mt-1">${e.description}</p>`,
    `        </div>`,
    `        <button`,
    `          onClick={() => { setEditing(null); setShowForm(true); }}`,
    `          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"`,
    `        >`,
    `          + New ${e.label}`,
    `        </button>`,
    `      </div>`,
    ``,
    `      <input`,
    `        value={search}`,
    `        onChange={(ev) => setSearch(ev.target.value)}`,
    `        placeholder="Search ${e.labelPlural.toLowerCase()}..."`,
    `        className="w-full max-w-sm px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm"`,
    `      />`,
    ``,
    `      {showForm && (`,
    `        <${e.name}Form`,
    `          initial={editing}`,
    `          onSaved={() => { setShowForm(false); setEditing(null); load(); }}`,
    `          onCancel={() => { setShowForm(false); setEditing(null); }}`,
    `        />`,
    `      )}`,
    ``,
    `      <div className="rounded-xl border border-slate-800 overflow-hidden">`,
    `        <table className="w-full text-sm">`,
    `          <thead className="bg-slate-900/60">`,
    `            <tr>`,
    cols.map((f) => `              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase">${f.label}</th>`).join("\n"),
    `              <th className="px-4 py-2.5"></th>`,
    `            </tr>`,
    `          </thead>`,
    `          <tbody>`,
    `            {loading ? (`,
    `              <tr><td colSpan={${cols.length + 1}} className="px-4 py-8 text-center text-slate-500">Loading…</td></tr>`,
    `            ) : rows.length === 0 ? (`,
    `              <tr><td colSpan={${cols.length + 1}} className="px-4 py-8 text-center text-slate-500">No ${e.labelPlural.toLowerCase()} yet</td></tr>`,
    `            ) : rows.map((row) => (`,
    `              <tr key={row.id} className="border-t border-slate-800 hover:bg-slate-900/40">`,
    cols.map((f) => `                <td className="px-4 py-2.5">{String(row.${camel(f.name)} ?? "—")}</td>`).join("\n"),
    `                <td className="px-4 py-2.5 text-right space-x-2">`,
    `                  <button onClick={() => { setEditing(row); setShowForm(true); }} className="text-indigo-400 hover:text-indigo-300 text-xs">Edit</button>`,
    `                  <button onClick={() => remove(row.id)} className="text-red-400 hover:text-red-300 text-xs">Delete</button>`,
    `                </td>`,
    `              </tr>`,
    `            ))}`,
    `          </tbody>`,
    `        </table>`,
    `      </div>`,
    `    </div>`,
    `  );`,
    `}`
  );
}

// ─── Entity form component ───────────────────────────────────────────────────

function genEntityForm(e: Entity): string {
  const flds = editableFields(e);
  const inputs = flds.map((f) => {
    if (f.type === "enum") {
      return L(
        `      <label className="block">`,
        `        <span className="text-xs text-slate-400">${f.label}</span>`,
        `        <select name="${camel(f.name)}" defaultValue={String(initial?.${camel(f.name)} ?? ${q(f.enumValues?.[0] ?? "")})} className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm">`,
        (f.enumValues ?? []).map((v) => `          <option value=${q(v)}>${titleCase(v)}</option>`).join("\n"),
        `        </select>`,
        `      </label>`
      );
    }
    if (f.type === "longtext") {
      return L(
        `      <label className="block sm:col-span-2">`,
        `        <span className="text-xs text-slate-400">${f.label}</span>`,
        `        <textarea name="${camel(f.name)}" defaultValue={String(initial?.${camel(f.name)} ?? "")} rows={3} className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm" />`,
        `      </label>`
      );
    }
    if (f.type === "boolean") {
      return L(
        `      <label className="flex items-center gap-2 mt-5">`,
        `        <input type="checkbox" name="${camel(f.name)}" defaultChecked={Boolean(initial?.${camel(f.name)})} />`,
        `        <span className="text-xs text-slate-400">${f.label}</span>`,
        `      </label>`
      );
    }
    return L(
      `      <label className="block">`,
      `        <span className="text-xs text-slate-400">${f.label}${f.required ? " *" : ""}</span>`,
      `        <input type="${inputKind(f)}" name="${camel(f.name)}" defaultValue={String(initial?.${camel(f.name)} ?? "")} ${f.required ? "required " : ""}className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm" />`,
      `      </label>`
    );
  });

  const numberFields = flds.filter((f) => f.type === "integer" || f.type === "numeric").map((f) => camel(f.name));
  const boolFields = flds.filter((f) => f.type === "boolean").map((f) => camel(f.name));

  return L(
    `"use client";`,
    ``,
    `import { useState } from "react";`,
    ``,
    `interface Props {`,
    `  initial?: Record<string, unknown> | null;`,
    `  onSaved: () => void;`,
    `  onCancel: () => void;`,
    `}`,
    ``,
    `export function ${e.name}Form({ initial, onSaved, onCancel }: Props) {`,
    `  const [saving, setSaving] = useState(false);`,
    `  const [error, setError] = useState<string | null>(null);`,
    ``,
    `  const submit = async (ev: React.FormEvent<HTMLFormElement>) => {`,
    `    ev.preventDefault();`,
    `    setSaving(true);`,
    `    setError(null);`,
    `    const fd = new FormData(ev.currentTarget);`,
    `    const payload: Record<string, unknown> = {};`,
    `    fd.forEach((v, k) => { payload[k] = v; });`,
    numberFields.length ? `    for (const k of ${JSON.stringify(numberFields)}) { if (payload[k] !== undefined && payload[k] !== "") payload[k] = Number(payload[k]); else delete payload[k]; }` : "",
    boolFields.length ? `    for (const k of ${JSON.stringify(boolFields)}) { payload[k] = fd.get(k) === "on"; }` : "",
    ``,
    `    const url = initial?.id ? "/api/${e.slug}/" + initial.id : "/api/${e.slug}";`,
    `    const res = await fetch(url, {`,
    `      method: initial?.id ? "PATCH" : "POST",`,
    `      headers: { "Content-Type": "application/json" },`,
    `      body: JSON.stringify(payload),`,
    `    });`,
    `    setSaving(false);`,
    `    if (res.ok) onSaved();`,
    `    else { const j = await res.json(); setError(j.error ?? "Save failed"); }`,
    `  };`,
    ``,
    `  return (`,
    `    <form onSubmit={submit} className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">`,
    `      <h3 className="font-semibold">{initial?.id ? "Edit" : "New"} ${e.label}</h3>`,
    `      {error && <p className="text-sm text-red-400">{error}</p>}`,
    `      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">`,
    ...inputs,
    `      </div>`,
    `      <div className="flex gap-2">`,
    `        <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm disabled:opacity-50">`,
    `          {saving ? "Saving…" : "Save"}`,
    `        </button>`,
    `        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-slate-700 text-sm">Cancel</button>`,
    `      </div>`,
    `    </form>`,
    `  );`,
    `}`
  ).replace(/\n\n\n+/g, "\n\n");
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

function genDashboard(spec: AppSpec): string {
  const entities = spec.entities.filter((e) => e.table !== "users");
  return L(
    `import Link from "next/link";`,
    `import { db } from "@/db";`,
    `import { ${entities.map((e) => e.varName).join(", ")} } from "@/db/schema";`,
    `import { MetricCard } from "@/components/MetricCard";`,
    spec.hasTimeSeries ? `import { TrendChart } from "@/components/TrendChart";` : "",
    ``,
    `export const dynamic = "force-dynamic";`,
    ``,
    `export default async function DashboardPage() {`,
    entities.map((e) => `  const ${e.varName}Rows = await db.select().from(${e.varName});`).join("\n"),
    ``,
    `  const metrics = [`,
    spec.metrics.map((m) => {
      const ent = spec.entities.find((e) => e.table === m.entity);
      const varName = ent?.varName ?? entities[0]?.varName ?? "users";
      let value: string;
      if (m.agg === "count") value = `${varName}Rows.length`;
      else if (m.agg === "sum" && m.field) value = `${varName}Rows.reduce((s, r) => s + Number((r as Record<string, unknown>)[${q(camel(m.field))}] ?? 0), 0)`;
      else if (m.agg === "avg" && m.field) value = `${varName}Rows.length ? ${varName}Rows.reduce((s, r) => s + Number((r as Record<string, unknown>)[${q(camel(m.field))}] ?? 0), 0) / ${varName}Rows.length : 0`;
      else value = `${varName}Rows.length`;
      return `    { key: ${q(m.key)}, label: ${q(m.label)}, icon: ${q(m.icon)}, format: ${q(m.format)}, value: ${value} },`;
    }).join("\n"),
    `  ];`,
    ``,
    `  return (`,
    `    <main className="p-8 space-y-8">`,
    `      <header>`,
    `        <h1 className="text-3xl font-bold">${spec.name}</h1>`,
    `        <p className="text-slate-400 mt-1">Operational overview across ${entities.length} modules</p>`,
    `      </header>`,
    ``,
    `      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">`,
    `        {metrics.map((m) => (`,
    `          <MetricCard key={m.key} label={m.label} icon={m.icon} value={m.value} format={m.format} />`,
    `        ))}`,
    `      </section>`,
    ``,
    spec.hasTimeSeries
      ? L(
          `      <section className="rounded-xl border border-slate-800 p-5">`,
          `        <h2 className="font-semibold mb-4">Trend</h2>`,
          `        <TrendChart points={metrics.map((m) => ({ label: m.label, value: Number(m.value) }))} />`,
          `      </section>`
        )
      : "",
    ``,
    `      <section>`,
    `        <h2 className="font-semibold mb-3">Modules</h2>`,
    `        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">`,
    entities.map((e) => L(
      `          <Link href="/${e.slug}" className="rounded-xl border border-slate-800 p-5 hover:border-indigo-500/50 transition-colors">`,
      `            <div className="text-2xl mb-2">${e.icon}</div>`,
      `            <h3 className="font-semibold">${e.labelPlural}</h3>`,
      `            <p className="text-xs text-slate-400 mt-1">${e.description}</p>`,
      `            <p className="text-xs text-indigo-400 mt-3">{${e.varName}Rows.length} records →</p>`,
      `          </Link>`
    )).join("\n"),
    `        </div>`,
    `      </section>`,
    `    </main>`,
    `  );`,
    `}`
  ).replace(/\n\n\n+/g, "\n\n");
}

// ─── Shared components ───────────────────────────────────────────────────────

const METRIC_CARD = L(
  `interface Props {`,
  `  label: string;`,
  `  value: number;`,
  `  icon: string;`,
  `  format: string;`,
  `}`,
  ``,
  `function fmt(value: number, format: string): string {`,
  `  if (format === "currency") return "$" + value.toLocaleString(undefined, { maximumFractionDigits: 2 });`,
  `  if (format === "percent") return value.toFixed(1) + "%";`,
  `  if (format === "duration") return Math.round(value) + " min";`,
  `  return value.toLocaleString();`,
  `}`,
  ``,
  `export function MetricCard({ label, value, icon, format }: Props) {`,
  `  return (`,
  `    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">`,
  `      <div className="flex items-center justify-between mb-2">`,
  `        <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>`,
  `        <span className="text-lg">{icon}</span>`,
  `      </div>`,
  `      <p className="text-2xl font-bold">{fmt(value, format)}</p>`,
  `    </div>`,
  `  );`,
  `}`
);

const TREND_CHART = L(
  `"use client";`,
  ``,
  `interface Point { label: string; value: number }`,
  ``,
  `export function TrendChart({ points }: { points: Point[] }) {`,
  `  const max = Math.max(...points.map((p) => p.value), 1);`,
  `  return (`,
  `    <div className="flex items-end gap-3 h-48">`,
  `      {points.map((p) => (`,
  `        <div key={p.label} className="flex-1 flex flex-col items-center gap-2">`,
  `          <div`,
  `            className="w-full rounded-t bg-gradient-to-t from-indigo-600 to-indigo-400 transition-all"`,
  `            style={{ height: Math.max(4, (p.value / max) * 160) + "px" }}`,
  `            title={p.label + ": " + p.value}`,
  `          />`,
  `          <span className="text-[10px] text-slate-500 text-center leading-tight">{p.label}</span>`,
  `        </div>`,
  `      ))}`,
  `    </div>`,
  `  );`,
  `}`
);

function genNav(spec: AppSpec): string {
  const entities = spec.entities.filter((e) => e.table !== "users");
  return L(
    `"use client";`,
    ``,
    `import Link from "next/link";`,
    `import { usePathname } from "next/navigation";`,
    ``,
    `const LINKS = [`,
    `  { href: "/", label: "Dashboard", icon: "🏠" },`,
    entities.map((e) => `  { href: "/${e.slug}", label: ${q(e.labelPlural)}, icon: ${q(e.icon)} },`).join("\n"),
    `];`,
    ``,
    `export function Nav() {`,
    `  const pathname = usePathname();`,
    `  return (`,
    `    <aside className="w-56 border-r border-slate-800 p-4 space-y-1 min-h-screen">`,
    `      <p className="font-bold px-3 py-2">${spec.name}</p>`,
    `      {LINKS.map((l) => (`,
    `        <Link`,
    `          key={l.href}`,
    `          href={l.href}`,
    `          className={"flex items-center gap-2 px-3 py-2 rounded-lg text-sm " + (pathname === l.href ? "bg-indigo-500/15 text-indigo-300" : "text-slate-400 hover:bg-slate-800")}`,
    `        >`,
    `          <span>{l.icon}</span>{l.label}`,
    `        </Link>`,
    `      ))}`,
    `    </aside>`,
    `  );`,
    `}`
  );
}

// ─── Seed script ─────────────────────────────────────────────────────────────

function sampleValue(f: EntityField, i: number): string {
  switch (f.type) {
    case "integer": return String((i + 1) * 7);
    case "numeric": return String(((i + 1) * 12.5).toFixed(2));
    case "boolean": return i % 2 === 0 ? "true" : "false";
    case "timestamp": return `new Date()`;
    case "date": return q(new Date(Date.now() + i * 86400000).toISOString().slice(0, 10));
    case "jsonb": return `{}`;
    case "email": return q(`user${i + 1}@example.com`);
    case "url": return q(`https://example.com/${i + 1}`);
    case "enum": return q((f.enumValues ?? ["active"])[i % (f.enumValues?.length ?? 1)]);
    case "longtext": return q(`Sample ${f.label.toLowerCase()} content for record ${i + 1}.`);
    default: return q(`${titleCase(f.name)} ${i + 1}`);
  }
}

function genSeed(spec: AppSpec): string {
  const blocks = spec.entities.map((e) => {
    const rows = [0, 1, 2, 3, 4].map((i) => {
      const vals = editableFields(e).map((f) => `      ${camel(f.name)}: ${sampleValue(f, i)},`);
      return L(`    {`, ...vals, `    },`);
    });
    return L(
      `  console.log("Seeding ${e.table}…");`,
      `  await db.insert(schema.${e.varName}).values([`,
      ...rows,
      `  ]).onConflictDoNothing();`
    );
  });

  return L(
    `import { db } from "./index";`,
    `import * as schema from "./schema";`,
    ``,
    `async function seed() {`,
    ...blocks,
    `  console.log("✅ Seed complete");`,
    `  process.exit(0);`,
    `}`,
    ``,
    `seed().catch((e) => { console.error(e); process.exit(1); });`
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

function genApiTest(spec: AppSpec): string {
  const e = spec.entities.find((x) => x.table === spec.primaryEntity) ?? spec.entities[0];
  return L(
    `import { describe, it, expect } from "vitest";`,
    `import { ${e.name}Schema } from "@/lib/validation";`,
    ``,
    `describe("${e.name} validation", () => {`,
    `  it("accepts a valid payload", () => {`,
    `    const result = ${e.name}Schema.safeParse({`,
    editableFields(e).filter((f) => f.required).map((f) => `      ${camel(f.name)}: ${sampleValue(f, 0)},`).join("\n"),
    `    });`,
    `    expect(result.success).toBe(true);`,
    `  });`,
    ``,
    `  it("rejects an empty payload when required fields are missing", () => {`,
    `    const result = ${e.name}Schema.safeParse({});`,
    `    expect(result.success).toBe(${editableFields(e).some((f) => f.required) ? "false" : "true"});`,
    `  });`,
    `});`
  );
}

function genE2ETest(spec: AppSpec): string {
  const e = spec.entities.find((x) => x.table === spec.primaryEntity) ?? spec.entities[0];
  return L(
    `import { test, expect } from "@playwright/test";`,
    ``,
    `test("dashboard loads and shows metrics", async ({ page }) => {`,
    `  await page.goto("/");`,
    `  await expect(page.getByRole("heading", { name: ${q(spec.name)} })).toBeVisible();`,
    `});`,
    ``,
    `test("${e.labelPlural.toLowerCase()} page lists records", async ({ page }) => {`,
    `  await page.goto("/${e.slug}");`,
    `  await expect(page.getByRole("heading", { name: /${e.labelPlural}/i })).toBeVisible();`,
    `});`
  );
}

// ─── Config files ────────────────────────────────────────────────────────────

function genPackageJson(spec: AppSpec): string {
  const deps: Record<string, string> = {
    next: "^16.0.0", react: "^19.0.0", "react-dom": "^19.0.0",
    "drizzle-orm": "^0.45.0", pg: "^8.20.0", zod: "^3.23.0",
  };
  if (spec.features.includes("auth")) deps["bcryptjs"] = "^2.4.3";
  if (spec.features.includes("payments")) deps["stripe"] = "^17.0.0";
  if (spec.features.includes("chat")) deps["ai"] = "^4.0.0";

  return JSON.stringify({
    name: spec.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    version: "0.1.0",
    private: true,
    scripts: {
      dev: "next dev", build: "next build", start: "next start",
      lint: "eslint .", typecheck: "tsc --noEmit",
      test: "vitest run", "test:e2e": "playwright test",
      "db:push": "drizzle-kit push", "db:seed": "tsx src/db/seed.ts",
    },
    dependencies: deps,
    devDependencies: {
      typescript: "^5.9.0", "@types/node": "^22.0.0", "@types/react": "^19.0.0",
      "@types/pg": "^8.18.0", "drizzle-kit": "^0.31.0", tsx: "^4.19.0",
      tailwindcss: "^4.0.0", "@tailwindcss/postcss": "^4.0.0", postcss: "^8.5.0",
      eslint: "^9.0.0", "eslint-config-next": "^16.0.0",
      vitest: "^3.0.0", "@playwright/test": "^1.50.0",
    },
  }, null, 2);
}

function genReadme(spec: AppSpec): string {
  const entities = spec.entities.filter((e) => e.table !== "users");
  return L(
    `# ${spec.name}`,
    ``,
    spec.description,
    ``,
    `> Generated by **EDL** — domain: \`${spec.domain}\``,
    ``,
    `## Data Model`,
    ``,
    `| Entity | Table | Fields | Description |`,
    `|---|---|---|---|`,
    ...spec.entities.map((e) => `| ${e.icon} ${e.label} | \`${e.table}\` | ${e.fields.length} | ${e.description} |`),
    ``,
    `## API`,
    ``,
    ...entities.flatMap((e) => [
      `### ${e.labelPlural}`,
      `- \`GET    /api/${e.slug}\` — list (supports \`?q=\` search)`,
      `- \`POST   /api/${e.slug}\` — create`,
      `- \`GET    /api/${e.slug}/[id]\` — read one`,
      `- \`PATCH  /api/${e.slug}/[id]\` — update`,
      `- \`DELETE /api/${e.slug}/[id]\` — delete`,
      ``,
    ]),
    `## Features`,
    ``,
    ...spec.features.map((f) => `- ${titleCase(f)}`),
    ``,
    `## Getting Started`,
    ``,
    "```bash",
    `npm install`,
    `cp .env.example .env`,
    `npm run db:push`,
    `npm run db:seed`,
    `npm run dev`,
    "```",
    ``,
    `Open http://localhost:3000`,
    ``,
    `## Deploy`,
    ``,
    "```bash",
    `docker compose up --build`,
    "```"
  );
}

// ─── MAIN: generate the entire codebase ──────────────────────────────────────

export function generateApplication(spec: AppSpec): GenFile[] {
  const files: GenFile[] = [];
  const add = (path: string, language: string, content: string) => {
    files.push({ path, name: path.split("/").pop() ?? path, language, content });
  };

  const entities = spec.entities.filter((e) => e.table !== "users");

  // ── Root config ──
  add("package.json", "json", genPackageJson(spec));
  add("tsconfig.json", "json", JSON.stringify({
    compilerOptions: {
      target: "ES2022", lib: ["dom", "dom.iterable", "ES2022"], allowJs: true,
      skipLibCheck: true, strict: true, noEmit: true, esModuleInterop: true,
      module: "esnext", moduleResolution: "bundler", resolveJsonModule: true,
      isolatedModules: true, jsx: "preserve", incremental: true,
      plugins: [{ name: "next" }], paths: { "@/*": ["./src/*"] },
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"],
  }, null, 2));
  add("next.config.ts", "typescript", L(
    `import type { NextConfig } from "next";`, ``,
    `const nextConfig: NextConfig = {};`, ``, `export default nextConfig;`
  ));
  add("drizzle.config.ts", "typescript", L(
    `import { defineConfig } from "drizzle-kit";`, ``,
    `export default defineConfig({`,
    `  schema: "./src/db/schema.ts",`,
    `  out: "./drizzle",`,
    `  dialect: "postgresql",`,
    `  dbCredentials: { url: process.env.DATABASE_URL! },`,
    `});`
  ));
  add("postcss.config.mjs", "javascript", `export default { plugins: { "@tailwindcss/postcss": {} } };`);
  add(".gitignore", "text", L("node_modules", ".next", "out", ".env", ".env.local", "coverage", "test-results", ".DS_Store", "*.log"));
  add("README.md", "markdown", genReadme(spec));

  // ── Env ──
  const envLines = [
    "# Database",
    "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/appdb",
    "",
    "# Application",
    "NODE_ENV=development",
    "NEXT_PUBLIC_APP_NAME=" + spec.name,
  ];
  if (spec.features.includes("auth")) envLines.push("", "# Auth", "JWT_SECRET=change-me-in-production", "SESSION_MAX_AGE=604800");
  if (spec.features.includes("payments")) envLines.push("", "# Payments", "STRIPE_SECRET_KEY=sk_test_...", "STRIPE_WEBHOOK_SECRET=whsec_...");
  if (spec.features.includes("notifications")) envLines.push("", "# Notifications", "SMTP_URL=smtp://user:pass@localhost:1025");
  if (spec.features.includes("chat")) envLines.push("", "# AI", "OPENAI_API_KEY=sk-...");
  add(".env.example", "env", envLines.join("\n"));

  // ── Docker / CI ──
  add("Dockerfile", "dockerfile", L(
    "FROM node:20-alpine AS deps", "WORKDIR /app", "COPY package*.json ./", "RUN npm install", "",
    "FROM node:20-alpine AS builder", "WORKDIR /app",
    "COPY --from=deps /app/node_modules ./node_modules", "COPY . .", "RUN npm run build", "",
    "FROM node:20-alpine AS runner", "WORKDIR /app", "ENV NODE_ENV=production",
    "COPY --from=builder /app/.next ./.next", "COPY --from=builder /app/public ./public",
    "COPY --from=builder /app/package.json ./package.json",
    "COPY --from=builder /app/node_modules ./node_modules",
    "EXPOSE 3000", 'CMD ["npm", "start"]'
  ));
  add("docker-compose.yml", "yaml", L(
    "services:", "  app:", "    build: .", '    ports: ["3000:3000"]',
    "    environment:", "      - DATABASE_URL=postgresql://postgres:postgres@db:5432/appdb",
    "    depends_on: [db]", "  db:", "    image: postgres:16-alpine", "    environment:",
    "      - POSTGRES_USER=postgres", "      - POSTGRES_PASSWORD=postgres", "      - POSTGRES_DB=appdb",
    "    volumes: [pgdata:/var/lib/postgresql/data]", '    ports: ["5432:5432"]', "",
    "volumes:", "  pgdata:"
  ));
  add(".github/workflows/ci.yml", "yaml", L(
    "name: CI", "on: [push, pull_request]", "jobs:", "  build:", "    runs-on: ubuntu-latest",
    "    services:", "      postgres:", "        image: postgres:16",
    "        env:", "          POSTGRES_PASSWORD: postgres", "        options: >-",
    "          --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5",
    '        ports: ["5432:5432"]',
    "    steps:", "      - uses: actions/checkout@v4",
    "      - uses: actions/setup-node@v4", "        with:", "          node-version: 20",
    "      - run: npm install", "      - run: npm run typecheck", "      - run: npm run lint",
    "      - run: npm test", "      - run: npm run build"
  ));

  // ── App shell ──
  add("src/app/layout.tsx", "tsx", L(
    `import type { Metadata } from "next";`,
    `import { Nav } from "@/components/Nav";`,
    `import "./globals.css";`, ``,
    `export const metadata: Metadata = {`,
    `  title: ${q(spec.name)},`,
    `  description: ${q(spec.description.slice(0, 150))},`,
    `};`, ``,
    `export default function RootLayout({ children }: { children: React.ReactNode }) {`,
    `  return (`,
    `    <html lang="en" className="dark">`,
    `      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">`,
    `        <div className="flex">`,
    `          <Nav />`,
    `          <div className="flex-1 min-w-0">{children}</div>`,
    `        </div>`,
    `      </body>`,
    `    </html>`,
    `  );`,
    `}`
  ));
  add("src/app/globals.css", "css", L(
    `@import "tailwindcss";`, ``,
    `body { font-family: ui-sans-serif, system-ui, sans-serif; }`
  ));
  add("src/app/page.tsx", "tsx", genDashboard(spec));
  add("src/app/api/health/route.ts", "typescript", L(
    `import { NextResponse } from "next/server";`,
    `import { db } from "@/db";`,
    `import { sql } from "drizzle-orm";`, ``,
    `export async function GET() {`,
    `  try {`,
    `    await db.execute(sql\`select 1\`);`,
    `    return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });`,
    `  } catch {`,
    `    return NextResponse.json({ status: "degraded" }, { status: 503 });`,
    `  }`,
    `}`
  ));

  // ── DB layer ──
  add("src/db/index.ts", "typescript", L(
    `import { drizzle } from "drizzle-orm/node-postgres";`,
    `import { Pool } from "pg";`,
    `import * as schema from "./schema";`, ``,
    `const pool = new Pool({ connectionString: process.env.DATABASE_URL });`,
    `export const db = drizzle(pool, { schema });`
  ));
  add("src/db/schema.ts", "typescript", genSchema(spec));
  add("src/db/seed.ts", "typescript", genSeed(spec));

  // ── Lib ──
  add("src/lib/validation.ts", "typescript", genValidation(spec));
  add("src/lib/utils.ts", "typescript", L(
    `export function cn(...classes: (string | false | null | undefined)[]) {`,
    `  return classes.filter(Boolean).join(" ");`,
    `}`, ``,
    `export function formatDate(d: Date | string | null): string {`,
    `  if (!d) return "—";`,
    `  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });`,
    `}`, ``,
    `export function formatCurrency(n: number): string {`,
    `  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n);`,
    `}`
  ));

  // ── Components ──
  add("src/components/MetricCard.tsx", "tsx", METRIC_CARD);
  add("src/components/Nav.tsx", "tsx", genNav(spec));
  if (spec.hasTimeSeries) add("src/components/TrendChart.tsx", "tsx", TREND_CHART);

  // ── Per-entity: API routes, page, form ──
  for (const e of entities) {
    add(`src/app/api/${e.slug}/route.ts`, "typescript", genListRoute(spec, e));
    add(`src/app/api/${e.slug}/[id]/route.ts`, "typescript", genItemRoute(spec, e));
    add(`src/app/${e.slug}/page.tsx`, "tsx", genEntityPage(e));
    add(`src/components/${e.name}Form.tsx`, "tsx", genEntityForm(e));
  }

  // ── Auth (if inferred) ──
  if (spec.features.includes("auth")) {
    add("src/app/api/auth/login/route.ts", "typescript", L(
      `import { NextRequest, NextResponse } from "next/server";`,
      `import { db } from "@/db";`,
      `import { users } from "@/db/schema";`,
      `import { eq } from "drizzle-orm";`,
      `import { z } from "zod";`, ``,
      `const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });`, ``,
      `export async function POST(req: NextRequest) {`,
      `  const parsed = LoginSchema.safeParse(await req.json());`,
      `  if (!parsed.success) {`,
      `    return NextResponse.json({ error: "Invalid credentials format" }, { status: 400 });`,
      `  }`,
      `  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email));`,
      `  if (!user) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });`,
      `  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });`,
      `}`
    ));
    add("src/lib/auth.ts", "typescript", L(
      `import { db } from "@/db";`,
      `import { users } from "@/db/schema";`,
      `import { eq } from "drizzle-orm";`, ``,
      `export async function getUserByEmail(email: string) {`,
      `  const [user] = await db.select().from(users).where(eq(users.email, email));`,
      `  return user ?? null;`,
      `}`, ``,
      `export function hasRole(userRole: string | null, allowed: string[]): boolean {`,
      `  return userRole !== null && allowed.includes(userRole);`,
      `}`
    ));
  }

  // ── Tests ──
  add("tests/validation.test.ts", "typescript", genApiTest(spec));
  add("e2e/app.spec.ts", "typescript", genE2ETest(spec));
  add("vitest.config.ts", "typescript", L(
    `import { defineConfig } from "vitest/config";`,
    `import path from "path";`, ``,
    `export default defineConfig({`,
    `  test: { environment: "node" },`,
    `  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },`,
    `});`
  ));

  return files;
}

// ─── Dynamic task graph generation ───────────────────────────────────────────

export interface GenTask {
  agentRole: "orchestrator" | "architect" | "database" | "backend" | "frontend" | "testing" | "devops";
  title: string;
  description: string;
}

export function generateTaskGraph(spec: AppSpec): GenTask[] {
  const entities = spec.entities.filter((e) => e.table !== "users");
  const tasks: GenTask[] = [
    { agentRole: "orchestrator", title: "Analyze requirements", description: `Decompose the brief into a task graph. Detected domain: ${spec.domain}. ${spec.entities.length} entities, ${spec.features.length} features.` },
    { agentRole: "orchestrator", title: "Assign agent responsibilities", description: `Route ${entities.length} entity modules across the specialist crew and resolve dependency order.` },
    { agentRole: "architect", title: "Design system architecture", description: `Define layering, module boundaries, and API contracts for ${spec.name}.` },
    { agentRole: "architect", title: "Scaffold project structure", description: "Create package.json, tsconfig, next.config, drizzle.config, and Tailwind setup." },
    { agentRole: "database", title: "Design entity schema", description: `Model ${spec.entities.map((e) => e.table).join(", ")} with columns, types, and constraints.` },
  ];

  for (const e of entities) {
    tasks.push({
      agentRole: "database",
      title: `Model ${e.labelPlural} table`,
      description: `Define ${e.table} with ${e.fields.length} columns${e.fields.some((f) => f.isForeign) ? " and foreign keys" : ""}.`,
    });
  }

  tasks.push({ agentRole: "database", title: "Generate seed data", description: "Create deterministic sample records for local development." });

  for (const e of entities) {
    tasks.push({
      agentRole: "backend",
      title: `Build ${e.labelPlural} API`,
      description: `Implement GET/POST /api/${e.slug} and GET/PATCH/DELETE /api/${e.slug}/[id] with Zod validation.`,
    });
  }

  if (spec.features.includes("auth")) {
    tasks.push({ agentRole: "backend", title: "Implement authentication", description: "Add login route, session handling, and role guards." });
  }
  if (spec.features.includes("payments")) {
    tasks.push({ agentRole: "backend", title: "Wire payment provider", description: "Add Stripe checkout session and webhook handler." });
  }

  tasks.push({ agentRole: "frontend", title: "Build app shell and navigation", description: `Create layout with sidebar nav across ${entities.length} modules.` });
  tasks.push({ agentRole: "frontend", title: "Build dashboard", description: `Render ${spec.metrics.length} KPI cards${spec.hasTimeSeries ? " and trend chart" : ""}.` });

  for (const e of entities) {
    tasks.push({
      agentRole: "frontend",
      title: `Build ${e.labelPlural} UI`,
      description: `List view with search, plus create/edit form for ${e.fields.length} fields.`,
    });
  }

  tasks.push({ agentRole: "testing", title: "Write validation unit tests", description: "Cover Zod schemas for every entity." });
  tasks.push({ agentRole: "testing", title: "Write E2E smoke tests", description: "Playwright checks for dashboard and each module page." });
  tasks.push({ agentRole: "devops", title: "Containerize application", description: "Multi-stage Dockerfile plus docker-compose with Postgres." });
  tasks.push({ agentRole: "devops", title: "Set up CI pipeline", description: "GitHub Actions: typecheck, lint, test, build against a Postgres service." });
  tasks.push({ agentRole: "devops", title: "Document environment", description: `Write README and .env.example covering ${spec.features.length} feature areas.` });

  return tasks;
}

// ─── DB table metadata (for the Database viewer tab) ─────────────────────────

export function generateDbTableRecords(spec: AppSpec) {
  return spec.entities.map((e) => ({
    id: `tbl-${e.table}`,
    name: e.table,
    schema: "public",
    columns: e.fields.map((f) => ({
      name: f.name,
      type: f.type === "serial" ? "serial"
        : f.type === "longtext" || f.type === "email" || f.type === "url" || f.type === "enum" ? "text"
        : f.type,
      nullable: !f.required && !f.isPrimary,
      isPrimary: f.isPrimary,
      isForeign: f.isForeign,
      references: f.references,
      default: f.defaultValue,
    })),
    indexes: [
      ...(e.fields.some((f) => f.searchable)
        ? [{ name: `${e.table}_search_idx`, columns: e.fields.filter((f) => f.searchable).map((f) => f.name) }]
        : []),
      ...e.fields.filter((f) => f.isForeign).map((f) => ({ name: `${e.table}_${f.name}_idx`, columns: [f.name] })),
    ],
    sql: L(
      `CREATE TABLE ${e.table} (`,
      e.fields.map((f) => {
        const type = f.type === "serial" ? "SERIAL"
          : f.type === "integer" ? "INTEGER"
          : f.type === "numeric" ? "NUMERIC(12,2)"
          : f.type === "boolean" ? "BOOLEAN"
          : f.type === "timestamp" ? "TIMESTAMP"
          : f.type === "date" ? "DATE"
          : f.type === "jsonb" ? "JSONB" : "TEXT";
        let line = `  ${f.name} ${type}`;
        if (f.isPrimary) line += " PRIMARY KEY";
        if (f.required && !f.isPrimary) line += " NOT NULL";
        if (f.defaultValue === "now()") line += " DEFAULT NOW()";
        else if (f.defaultValue) line += ` DEFAULT ${f.type === "boolean" || f.type === "integer" || f.type === "numeric" ? f.defaultValue : `'${f.defaultValue.replace(/'/g, "")}'`}`;
        if (f.isForeign && f.references) line += ` REFERENCES ${f.references.split(".")[0]}(id)`;
        return line;
      }).join(",\n"),
      `);`
    ),
  }));
}

// ─── Env var records (for the Env tab) ───────────────────────────────────────

export function generateEnvRecords(spec: AppSpec) {
  const vars: Array<{ id: string; key: string; value: string; type: "plain" | "secret" | "vault_ref"; description: string; isSecret: boolean; isRequired: boolean }> = [
    { id: "env-db", key: "DATABASE_URL", value: "postgresql://postgres:postgres@localhost:5432/appdb", type: "secret", description: "PostgreSQL connection string", isSecret: true, isRequired: true },
    { id: "env-node", key: "NODE_ENV", value: "development", type: "plain", description: "Runtime environment", isSecret: false, isRequired: true },
    { id: "env-name", key: "NEXT_PUBLIC_APP_NAME", value: spec.name, type: "plain", description: "Public application name", isSecret: false, isRequired: false },
  ];
  if (spec.features.includes("auth")) {
    vars.push({ id: "env-jwt", key: "JWT_SECRET", value: "change-me-in-production", type: "secret", description: "Signing key for session tokens", isSecret: true, isRequired: true });
    vars.push({ id: "env-session", key: "SESSION_MAX_AGE", value: "604800", type: "plain", description: "Session lifetime in seconds", isSecret: false, isRequired: false });
  }
  if (spec.features.includes("payments")) {
    vars.push({ id: "env-stripe", key: "STRIPE_SECRET_KEY", value: "sk_test_...", type: "secret", description: "Stripe API secret key", isSecret: true, isRequired: true });
    vars.push({ id: "env-stripe-wh", key: "STRIPE_WEBHOOK_SECRET", value: "whsec_...", type: "secret", description: "Stripe webhook signing secret", isSecret: true, isRequired: true });
  }
  if (spec.features.includes("notifications")) {
    vars.push({ id: "env-smtp", key: "SMTP_URL", value: "smtp://user:pass@localhost:1025", type: "secret", description: "Outbound email transport", isSecret: true, isRequired: false });
  }
  if (spec.features.includes("chat")) {
    vars.push({ id: "env-openai", key: "OPENAI_API_KEY", value: "op://vault/openai/key", type: "vault_ref", description: "LLM provider key (vault reference)", isSecret: true, isRequired: true });
  }
  if (spec.features.includes("upload")) {
    vars.push({ id: "env-s3", key: "S3_BUCKET_URL", value: "https://bucket.s3.amazonaws.com", type: "plain", description: "Object storage bucket for uploads", isSecret: false, isRequired: false });
  }
  return vars;
}
