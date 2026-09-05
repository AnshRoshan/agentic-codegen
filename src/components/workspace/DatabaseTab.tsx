"use client";

import { useState } from "react";
import { Database, KeyRound, Link2 } from "lucide-react";
import { CodeView } from "@/components/CodeView";
import { EmptyState } from "@/components/ui";
import type { DbTable } from "@/db/schema";
import { cn } from "@/lib/utils";

const STATUS: Record<string, string> = { defined: "text-ink-300 bg-white/8", migrating: "text-amber-300 bg-amber-400/15", created: "text-accent-400 bg-accent-500/15", seeded: "text-mint-400 bg-mint-400/15" };

export function DatabaseTab({ tables }: { tables: DbTable[] }) {
  const [selected, setSelected] = useState<string | null>(tables[0]?.id ?? null);
  const table = tables.find((t) => t.id === selected) ?? tables[0];

  if (!tables.length) {
    return <EmptyState icon={Database} title="No tables yet" description="The Database agent designs the schema in step 5 and asks for approval before applying the migration." />;
  }

  const relations = tables.flatMap((t) => (t.columns ?? []).filter((c) => c.references).map((c) => ({ from: t.name, col: c.name, to: c.references!.split(".")[0] })));

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-semibold">Entity relationship map</span>
          <span className="text-xs text-ink-400">{tables.length} tables · {relations.length} foreign keys · {tables.reduce((s, t) => s + t.rowCount, 0)} seeded rows</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {tables.map((t) => (
            <button key={t.id} onClick={() => setSelected(t.id)} className={cn("rounded-xl border px-3 py-2 text-left transition", table?.id === t.id ? "border-mint-400/50 bg-mint-400/10" : "border-white/8 bg-white/[0.02] hover:border-white/20")}>
              <div className="flex items-center gap-2 font-mono text-xs text-ink-100"><Database size={12} className="text-mint-400" /> {t.name}</div>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-ink-500">
                <span>{t.columns?.length ?? 0} cols</span>
                <span>·</span>
                <span>{t.rowCount} rows</span>
                <span className={cn("rounded px-1 py-px", STATUS[t.status])}>{t.status}</span>
              </div>
            </button>
          ))}
        </div>
        {relations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/8 pt-3">
            {relations.map((r, i) => (
              <span key={i} className="chip font-mono"><Link2 size={10} className="text-accent-400" /> {r.from}.{r.col} → {r.to}</span>
            ))}
          </div>
        )}
      </div>

      {table && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
              <span className="font-mono text-sm">{table.name}</span>
              <span className={cn("rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider", STATUS[table.status])}>{table.status}</span>
            </div>
            <table className="w-full text-xs">
              <thead className="text-left text-[10px] uppercase tracking-wider text-ink-500">
                <tr><th className="px-4 py-2">Column</th><th className="px-4 py-2">Type</th><th className="px-4 py-2">Null</th><th className="px-4 py-2">Ref</th></tr>
              </thead>
              <tbody>
                {table.columns?.map((c) => (
                  <tr key={c.name} className="border-t border-white/6">
                    <td className="px-4 py-1.5 font-mono text-ink-100">{c.isPrimary && <KeyRound size={10} className="mr-1 inline text-amber-300" />}{c.name}</td>
                    <td className="px-4 py-1.5 font-mono text-brand-300">{c.type}</td>
                    <td className="px-4 py-1.5 text-ink-400">{c.nullable ? "yes" : "no"}</td>
                    <td className="px-4 py-1.5 font-mono text-accent-400">{c.references ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel overflow-hidden">
            <div className="border-b border-white/8 px-4 py-2.5 text-xs text-ink-400">DDL</div>
            <CodeView code={table.sql ?? ""} language="sql" className="rounded-none border-0" />
          </div>
        </div>
      )}
    </div>
  );
}
