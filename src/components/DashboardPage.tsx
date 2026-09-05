import { useMemo, useState } from "react";
import {
  Plus, Play, Clock, CheckCircle2, Wallet, FileCode2,
  ArrowRight, Copy, Trash2, Search, Sparkles, Layers,
} from "lucide-react";
import { useStore } from "../lib/store";
import { PRESETS } from "../lib/domains";
import { formatCost } from "../lib/models";
import { Progress, StatusBadge, Empty } from "./ui";
import { cn } from "../utils/cn";

export default function DashboardPage({ onNew }: { onNew: () => void }) {
  const { projects, workspaces, setActiveId, setView, setWtab, duplicateProject, deleteProject, createFromPreset, startPipeline, running } = useStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "needs" | "done">("all");

  const stats = useMemo(() => {
    const files = projects.reduce((a, p) => a + p.generatedFiles, 0);
    const cost = projects.reduce((a, p) => a + p.costMicros, 0);
    const done = projects.filter((p) => p.status === "completed").length;
    const active = projects.filter((p) => !["draft", "completed", "failed", "paused"].includes(p.status)).length;
    return { files, cost, done, active, total: projects.length };
  }, [projects]);

  const list = projects.filter((p) => {
    if (query && !`${p.name} ${p.prompt} ${p.domainLabel}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === "active") return !["draft", "completed", "failed", "paused"].includes(p.status);
    if (filter === "needs") return p.status === "waiting_approval";
    if (filter === "done") return p.status === "completed";
    return true;
  });

  const pendingCount = useMemo(() =>
    Object.values(workspaces).flatMap((w) => w.checkpoints).filter((c) => c.status === "pending").length,
    [workspaces]);

  return (
    <div className="mx-auto max-w-6xl p-5 sm:p-7">
      {/* Header row */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[24px] font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-[13.5px] text-ink-400">
            {stats.total} project{stats.total === 1 ? "" : "s"}
            {pendingCount > 0 && <span className="text-amber-300"> · {pendingCount} approval{pendingCount > 1 ? "s" : ""} waiting</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter projects…"
              className="input !w-[220px] !py-2 !pl-9 !text-[13px]" />
          </div>
          <button onClick={onNew} className="btn-primary"><Plus size={15} /> New project</button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { icon: <Play size={16} />, label: "Active pipelines", value: String(stats.active), tint: "text-violet-300 bg-violet-500/12" },
          { icon: <CheckCircle2 size={16} />, label: "Completed", value: String(stats.done), tint: "text-emerald-300 bg-emerald-500/12" },
          { icon: <FileCode2 size={16} />, label: "Files generated", value: stats.files.toLocaleString(), tint: "text-cyan-300 bg-cyan-500/12" },
          { icon: <Wallet size={16} />, label: "Total run cost", value: formatCost(stats.cost), tint: "text-amber-300 bg-amber-500/12" },
        ].map((s) => (
          <div key={s.label} className="card flex items-center gap-3 p-4">
            <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", s.tint)}>{s.icon}</span>
            <div>
              <div className="font-display text-[20px] font-bold leading-none">{s.value}</div>
              <div className="mt-1 text-[12px] text-ink-400">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="mt-6 flex items-center gap-1.5">
        {([["all", "All"], ["active", "Active"], ["needs", "Needs approval"], ["done", "Completed"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)}
            className={cn("rounded-lg px-3 py-1.5 text-[13px] font-medium transition",
              filter === id ? "bg-white/[0.09] text-white" : "text-ink-400 hover:bg-white/[0.05] hover:text-white")}>
            {label}
          </button>
        ))}
      </div>

      {/* Project grid */}
      {list.length === 0 ? (
        <div className="mt-4">
          <Empty
            icon={<Layers size={20} />}
            title={projects.length === 0 ? "No projects yet" : "No matches"}
            hint={projects.length === 0
              ? "Create your first project from a brief or a preset — the agents will plan and build it for you."
              : "Try a different search or filter."}
            action={projects.length === 0 ? <button onClick={onNew} className="btn-primary"><Plus size={14} /> Create project</button> : undefined}
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const pct = p.totalSteps ? Math.round((Math.min(p.currentStep, p.totalSteps) / p.totalSteps) * 100) : 0;
            const pending = workspaces[p.id] ? workspaces[p.id].checkpoints.filter((c) => c.status === "pending").length : (p.pendingCheckpoints ?? 0);
            return (
              <div key={p.id} className="card card-hover group flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.05] text-[20px]">{p.emoji}</span>
                    <div className="min-w-0">
                      <div className="truncate text-[14.5px] font-semibold">{p.name}</div>
                      <div className="text-[12px] text-ink-400">{p.domainLabel}</div>
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <p className="mt-3 line-clamp-2 min-h-[38px] text-[12.5px] leading-relaxed text-ink-400">{p.prompt}</p>
                <div className="mt-3">
                  <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
                    <span className="text-ink-400">{p.completedTasks}/{p.totalTasks} steps · {p.generatedFiles} files</span>
                    <span className="font-mono text-ink-300">{pct}%</span>
                  </div>
                  <Progress value={pct} />
                </div>
                {pending > 0 && (
                  <button
                    onClick={() => { setActiveId(p.id); setWtab("approvals"); setView("workspace"); }}
                    className="mt-3 flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 text-[12px] font-medium text-amber-200 transition hover:bg-amber-400/15">
                    <Clock size={13} /> {pending} approval{pending > 1 ? "s" : ""} pending — review
                  </button>
                )}
                <div className="mt-4 flex items-center gap-1.5 border-t border-white/[0.06] pt-3.5">
                  {running[p.id] ? (
                    <span className="flex items-center gap-1.5 text-[12.5px] text-violet-300">
                      <span className="status-dot bg-violet-400" data-live="true" /> Running…
                    </span>
                  ) : p.status === "draft" ? (
                    <button onClick={() => { setActiveId(p.id); setWtab("overview"); setView("workspace"); startPipeline(p.id); }}
                      className="btn-primary btn-sm"><Play size={13} /> Start</button>
                  ) : (
                    <button onClick={() => { setActiveId(p.id); setWtab("overview"); setView("workspace"); }}
                      className="btn-secondary btn-sm">Open <ArrowRight size={13} /></button>
                  )}
                  <span className="mx-1 text-[12px] text-ink-500">·</span>
                  <span className="text-[12px] text-ink-500">{formatCost(p.costMicros)}</span>
                  <span className="ml-auto flex gap-1 opacity-0 transition group-hover:opacity-100">
                    <button onClick={() => duplicateProject(p.id)} title="Duplicate" className="btn-ghost btn-icon !p-1.5"><Copy size={14} /></button>
                    <button onClick={() => { if (confirm(`Delete "${p.name}"?`)) deleteProject(p.id); }} title="Delete" className="btn-ghost btn-icon !p-1.5 hover:!text-rose-300"><Trash2 size={14} /></button>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Presets */}
      <div className="mt-10">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={15} className="text-violet-300" />
          <h2 className="text-[15px] font-semibold">Start from a preset</h2>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {PRESETS.map((preset, i) => (
            <button key={preset.name} onClick={() => createFromPreset(i)}
              className="card card-hover flex items-center gap-3 p-3.5 text-left">
              <span className="text-[22px]">{preset.emoji}</span>
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-semibold">{preset.name}</span>
                <span className="block truncate text-[12px] text-ink-400">{preset.prompt.slice(0, 52)}…</span>
              </span>
              <ArrowRight size={15} className="ml-auto shrink-0 text-ink-500" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
