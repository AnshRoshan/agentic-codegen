"use client";

import { useState } from "react";
import { AlertTriangle, Check, ShieldCheck, X } from "lucide-react";
import { CodeView } from "@/components/CodeView";
import { EmptyState, Spinner } from "@/components/ui";
import type { HitlCheckpoint } from "@/db/schema";
import { agentMeta } from "@/lib/agents";
import { cn, timeAgo } from "@/lib/utils";

const RISK: Record<string, string> = { low: "text-mint-400 bg-mint-400/15 border-mint-400/30", medium: "text-amber-300 bg-amber-400/15 border-amber-400/30", high: "text-rose-300 bg-rose-400/15 border-rose-400/30" };

export function CheckpointsTab({ checkpoints, onResolve, autoApprove }: { checkpoints: HitlCheckpoint[]; onResolve: (id: string, d: "approved" | "rejected", note?: string) => Promise<void>; autoApprove: boolean }) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const pending = checkpoints.filter((c) => c.status === "pending");
  const resolved = checkpoints.filter((c) => c.status !== "pending");

  async function act(id: string, d: "approved" | "rejected") {
    setBusy(id + d);
    await onResolve(id, d, notes[id]);
    setBusy(null);
  }

  if (!checkpoints.length) {
    return <EmptyState icon={ShieldCheck} title="No checkpoints yet" description={autoApprove ? "Auto-approve is on: checkpoints will be approved automatically and listed here." : "Agents pause here before applying database migrations and deploying to production."} />;
  }

  return (
    <div className="space-y-4">
      {pending.map((c) => {
        const m = agentMeta(c.agentRole);
        return (
          <div key={c.id} className="panel overflow-hidden border-amber-400/30">
            <div className="flex flex-wrap items-center gap-3 border-b border-white/8 bg-amber-400/5 px-5 py-3">
              <AlertTriangle size={16} className="text-amber-300" />
              <span className="font-display font-semibold">{c.title}</span>
              <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider", RISK[c.riskLevel])}>{c.riskLevel} risk</span>
              <span className="chip" style={{ color: m.color }}>{m.emoji} {m.name}</span>
              <span className="ml-auto text-xs text-ink-500">{timeAgo(c.createdAt)}</span>
            </div>
            <div className="grid gap-5 p-5 lg:grid-cols-[1fr_320px]">
              <div className="min-w-0 space-y-4">
                <p className="text-sm text-ink-300">{c.description}</p>
                {c.context?.summary && (
                  <ul className="grid gap-1 sm:grid-cols-2">
                    {c.context.summary.map((s) => <li key={s} className="flex items-center gap-2 text-xs text-ink-300"><span className="h-1 w-1 rounded-full bg-amber-300" /> {s}</li>)}
                  </ul>
                )}
                {c.context?.command && (
                  <div className="rounded-lg border border-white/8 bg-ink-925 px-3 py-2 font-mono text-xs text-accent-400">$ {c.context.command}</div>
                )}
                {c.context?.diff && <CodeView code={c.context.diff} language="sql" className="max-h-72" />}
              </div>
              <div className="space-y-3">
                <div className="text-xs font-medium uppercase tracking-wider text-ink-400">Your decision</div>
                <textarea className="textarea min-h-[90px]" placeholder="Optional note for the agents (e.g. 'rename column x', 'deploy after 6pm')" value={notes[c.id] ?? ""} onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn-primary shadow-none" style={{ background: "#10b981" }} onClick={() => act(c.id, "approved")} disabled={!!busy}>{busy === c.id + "approved" ? <Spinner /> : <Check size={15} />} Approve</button>
                  <button className="btn-danger" onClick={() => act(c.id, "rejected")} disabled={!!busy}>{busy === c.id + "rejected" ? <Spinner /> : <X size={15} />} Reject</button>
                </div>
                <p className="text-[11px] text-ink-500">Approving resumes the pipeline immediately. Rejecting skips the dependent step and continues.</p>
                {c.context?.affected && <div className="flex flex-wrap gap-1">{c.context.affected.map((a) => <span key={a} className="chip font-mono">{a}</span>)}</div>}
              </div>
            </div>
          </div>
        );
      })}

      {resolved.length > 0 && (
        <div className="panel divide-y divide-white/6">
          <div className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-ink-500">History</div>
          {resolved.map((c) => {
            const m = agentMeta(c.agentRole);
            return (
              <div key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className={cn("grid h-6 w-6 place-items-center rounded-full", c.status === "approved" ? "bg-mint-400/15 text-mint-400" : "bg-rose-400/15 text-rose-300")}>{c.status === "approved" ? <Check size={13} /> : <X size={13} />}</span>
                <span className="text-ink-100">{c.title}</span>
                <span className={cn("rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider", RISK[c.riskLevel])}>{c.riskLevel}</span>
                <span className="text-xs" style={{ color: m.color }}>{m.emoji} {m.name}</span>
                {c.resolutionNote && <span className="text-xs italic text-ink-400">“{c.resolutionNote}”</span>}
                <span className="ml-auto text-xs text-ink-500">{c.resolvedAt ? timeAgo(c.resolvedAt) : ""}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
