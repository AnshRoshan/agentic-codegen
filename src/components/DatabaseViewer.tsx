"use client";

import { useState } from "react";
import { Database, Key, Link2, Hash, Table2, Info, Copy } from "lucide-react";
import { EmptyState, useCopyToClipboard } from "./ui";

interface DbTable {
  id: string;
  name: string;
  schema: string;
  status: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    default?: string;
    isPrimary?: boolean;
    isForeign?: boolean;
    references?: string;
  }>;
  indexes: Array<{ name: string; columns: string[]; unique?: boolean }>;
  rowCount: number | null;
  sql: string | null;
}

interface DatabaseViewerProps {
  tables: DbTable[];
}

const STATUS: Record<string, { cls: string; label: string }> = {
  defined:   { cls: "bg-surface-800 text-surface-400 border-surface-700",    label: "Defined" },
  migrating: { cls: "bg-amber-500/10 text-amber-400 border-amber-500/25",    label: "Migrating" },
  created:   { cls: "bg-blue-500/10  text-blue-400  border-blue-500/25",     label: "Created" },
  seeded:    { cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25", label: "Seeded" },
  error:     { cls: "bg-red-500/10   text-red-400   border-red-500/25",      label: "Error" },
};

const TYPE_COLOR: Record<string, string> = {
  serial:    "text-purple-400",
  integer:   "text-blue-400",
  bigint:    "text-blue-400",
  float:     "text-cyan-400",
  numeric:   "text-cyan-400",
  text:      "text-emerald-400",
  varchar:   "text-emerald-400",
  char:      "text-emerald-400",
  boolean:   "text-amber-400",
  timestamp: "text-rose-400",
  date:      "text-rose-400",
  jsonb:     "text-orange-400",
  json:      "text-orange-400",
  uuid:      "text-violet-400",
};

function typeColor(t: string): string {
  for (const [k, v] of Object.entries(TYPE_COLOR)) {
    if (t.toLowerCase().startsWith(k)) return v;
  }
  return "text-surface-300";
}

export default function DatabaseViewer({ tables }: DatabaseViewerProps) {
  const [selected, setSelected] = useState<DbTable | null>(tables[0] ?? null);
  const [tab, setTab] = useState<"schema" | "indexes" | "sql" | "erd">("schema");
  const { copy, copied } = useCopyToClipboard();

  if (tables.length === 0) {
    return (
      <div className="h-full panel flex items-center justify-center">
        <EmptyState icon={Database} title="No tables defined" description="The Database agent will design the schema here." />
      </div>
    );
  }

  return (
    <div className="h-full flex panel overflow-hidden">
      {/* Sidebar: table list */}
      <div className="w-52 border-r border-surface-800 flex flex-col bg-surface-900/50">
        {/* Header */}
        <div className="panel-header bg-gradient-to-r from-blue-500/5 to-transparent">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
              <Database className="w-3 h-3 text-white" />
            </div>
            <span className="panel-title">Schema</span>
          </div>
          <span className="text-[10px] text-surface-600">{tables.length} tables</span>
        </div>

        <div className="scroll p-2 space-y-0.5">
          {tables.map((t) => {
            const s = STATUS[t.status] ?? STATUS.defined;
            const isSelected = selected?.id === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSelected(t)}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 transition-all border ${
                  isSelected
                    ? "bg-primary-500/10 border-primary-500/20 text-primary-300"
                    : "border-transparent hover:bg-surface-800/60 text-surface-300"
                }`}
              >
                <Table2 className="w-3.5 h-3.5 flex-shrink-0 text-surface-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{t.name}</p>
                  <p className="text-[10px] text-surface-600">{t.schema} · {t.columns?.length ?? 0} cols</p>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded border ${s.cls} hidden group-hover:inline flex-shrink-0`}>
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail pane */}
      {selected && (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Table header */}
          <div className="panel-header border-b border-surface-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-surface-100">{selected.name}</span>
                <span className={`badge text-[10px] border ${(STATUS[selected.status] ?? STATUS.defined).cls}`}>
                  {(STATUS[selected.status] ?? STATUS.defined).label}
                </span>
                {selected.rowCount !== null && (
                  <span className="text-[10px] text-surface-600">{selected.rowCount} rows</span>
                )}
              </div>
              <p className="text-[11px] text-surface-600 mt-0.5">{selected.schema}.{selected.name} · {selected.columns?.length ?? 0} columns · {selected.indexes?.length ?? 0} indexes</p>
            </div>
            {/* Tab pills */}
            <div className="flex bg-surface-900 border border-surface-800 rounded-lg p-0.5 gap-0.5">
              {(["schema", "indexes", "sql", "erd"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-3 py-1 text-xs rounded-md capitalize transition-all ${
                    tab === t ? "bg-surface-700 text-surface-100 font-medium" : "text-surface-500 hover:text-surface-200"
                  }`}
                >
                  {t === "erd" ? "ERD" : t}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="scroll flex-1 p-4">
            {tab === "schema" && (
              <div className="space-y-3">
                <table className="table text-xs">
                  <thead>
                    <tr>
                      <th>Column</th>
                      <th>Type</th>
                      <th>Nullable</th>
                      <th>Default</th>
                      <th>Constraints</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selected.columns ?? []).map((col) => (
                      <tr key={col.name}>
                        <td>
                          <div className="flex items-center gap-1.5">
                            {col.isPrimary && <Key className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                            {col.isForeign && <Link2 className="w-3 h-3 text-blue-400 flex-shrink-0" />}
                            <code className={`font-mono text-xs ${col.isPrimary ? "text-amber-300" : "text-surface-200"}`}>{col.name}</code>
                          </div>
                        </td>
                        <td><code className={`mono text-xs ${typeColor(col.type)}`}>{col.type}</code></td>
                        <td>{col.nullable ? <span className="text-surface-600">yes</span> : <span className="text-red-400">no</span>}</td>
                        <td><code className="mono text-[11px] text-surface-500">{col.default ?? "—"}</code></td>
                        <td>
                          <div className="flex gap-1">
                            {col.isPrimary && <span className="badge text-[9px] bg-amber-500/10 text-amber-400 border-amber-500/25">PK</span>}
                            {col.isForeign && (
                              <span className="badge text-[9px] bg-blue-500/10 text-blue-400 border-blue-500/25" data-tip={col.references}>
                                FK
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "indexes" && (
              <div>
                {(selected.indexes ?? []).length === 0 ? (
                  <p className="text-xs text-surface-500">No indexes defined.</p>
                ) : (
                  <table className="table text-xs">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Columns</th>
                        <th>Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selected.indexes ?? []).map((idx) => (
                        <tr key={idx.name}>
                          <td><code className="mono text-xs text-surface-200">{idx.name}</code></td>
                          <td>
                            <div className="flex gap-1 flex-wrap">
                              {idx.columns.map((c) => (
                                <span key={c} className="badge text-[10px] bg-surface-800 text-surface-300 border-surface-700">
                                  <Hash className="w-2.5 h-2.5" />{c}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>
                            {idx.unique ? (
                              <span className="badge text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/25">UNIQUE</span>
                            ) : (
                              <span className="badge text-[10px] bg-surface-800 text-surface-500 border-surface-700">INDEX</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {tab === "sql" && (
              <div className="relative">
                <button
                  className="btn btn-secondary btn-xs absolute top-2 right-2 z-10"
                  onClick={() => copy(selected.sql ?? "")}
                >
                  <Copy className="w-3 h-3" />
                  {copied ? "Copied!" : "Copy"}
                </button>
                <pre className="terminal-bg rounded-xl p-4 text-xs mono text-emerald-300 whitespace-pre-wrap overflow-auto max-h-80">
                  {selected.sql ?? "-- No SQL available"}
                </pre>
              </div>
            )}

            {tab === "erd" && (
              <ERDiagram tables={tables} selectedId={selected.id} onSelect={(id) => setSelected(tables.find(t => t.id === id) ?? selected)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Simple ERD diagram ───────────────────────────────────────────────────────

function ERDiagram({
  tables,
  selectedId,
  onSelect,
}: {
  tables: DbTable[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  // Build relationship map
  const relations: Array<{ from: string; fromCol: string; to: string; toCol: string }> = [];
  for (const t of tables) {
    for (const col of t.columns ?? []) {
      if (col.isForeign && col.references) {
        const [toTable, toCol = "id"] = col.references.split(".");
        relations.push({ from: t.name, fromCol: col.name, to: toTable, toCol });
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-surface-500">
        <Info className="w-3.5 h-3.5" />
        Entity-Relationship overview · click a table to inspect its schema
      </div>
      <div className="flex flex-wrap gap-4">
        {tables.map((t) => {
          const isSelected = t.id === selectedId;
          const incoming = relations.filter(r => r.to === t.name).length;
          const outgoing = relations.filter(r => r.from === t.name).length;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className={`text-left rounded-xl border p-4 min-w-[180px] max-w-[220px] transition-all ${
                isSelected
                  ? "border-primary-500/50 bg-primary-500/10 shadow-lg shadow-primary-500/10"
                  : "border-surface-700 bg-surface-900/60 hover:border-primary-500/30"
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <Table2 className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-surface-100">{t.name}</span>
              </div>
              <div className="space-y-1">
                {(t.columns ?? []).slice(0, 6).map((col) => (
                  <div key={col.name} className="flex items-center gap-1.5">
                    {col.isPrimary && <Key className="w-2.5 h-2.5 text-amber-400 flex-shrink-0" />}
                    {col.isForeign && <Link2 className="w-2.5 h-2.5 text-blue-400 flex-shrink-0" />}
                    {!col.isPrimary && !col.isForeign && <span className="w-2.5 flex-shrink-0" />}
                    <span className="text-[11px] font-mono text-surface-300 truncate">{col.name}</span>
                    <span className={`text-[10px] font-mono ml-auto ${typeColor(col.type)} opacity-70`}>{col.type.slice(0, 8)}</span>
                  </div>
                ))}
                {(t.columns ?? []).length > 6 && (
                  <p className="text-[10px] text-surface-600 mt-1">+{(t.columns ?? []).length - 6} more columns</p>
                )}
              </div>
              {(incoming > 0 || outgoing > 0) && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-surface-800">
                  {incoming > 0 && <span className="text-[10px] text-blue-400">← {incoming} refs</span>}
                  {outgoing > 0 && <span className="text-[10px] text-amber-400">→ {outgoing} FK</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {relations.length > 0 && (
        <div className="panel p-4">
          <p className="label mb-3">Foreign Key Relationships</p>
          <div className="space-y-2">
            {relations.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-xs font-mono">
                <span className="text-amber-300">{r.from}.{r.fromCol}</span>
                <Link2 className="w-3 h-3 text-surface-500" />
                <span className="text-blue-300">{r.to}.{r.toCol}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
