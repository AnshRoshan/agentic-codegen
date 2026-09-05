"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  Coins,
  Copy,
  FileCode2,
  FolderKanban,
  MoreHorizontal,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CreateProjectModal } from "@/components/CreateProjectModal";
import { EmptyState, Progress, Stat, StatusBadge } from "@/components/ui";
import type { Project } from "@/db/schema";
import { agentMeta } from "@/lib/agents";
import { api, cn, formatCost, formatTokens, RUNNING_STATUSES, timeAgo } from "@/lib/utils";

interface Metrics {
  projects: number;
  completed: number;
  running: number;
  waiting: number;
  tokensIn: number;
  tokensOut: number;
  costMicros: number;
  llmCalls: number;
  toolCalls: number;
  files: number;
  bytes: number;
  pendingCheckpoints: number;
  byModel: Array<{ model: string; calls: number; tokens: number; costMicros: number }>;
}

interface ActivityRow {
  id: string;
  projectId: string;
  projectName: string;
  projectEmoji: string | null;
  agentRole: string | null;
  kind: string;
  content: string;
  createdAt: string;
}

const FILTERS = [
  { id: "all", label: "All" },
  { id: "running", label: "Running" },
  { id: "waiting_approval", label: "Needs approval" },
  { id: "completed", label: "Completed" },
  { id: "draft", label: "Draft" },
];

export function Dashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, m, a] = await Promise.all([api<Project[]>("/api/projects"), api<Metrics>("/api/metrics"), api<ActivityRow[]>("/api/activity?limit=25")]);
    setProjects(p);
    setMetrics(m);
    setActivity(a);
  }, []);

  useEffect(() => {
    load().catch(() => toast.error("Could not load projects"));
    const id = setInterval(load, 6000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (params.get("new") === "1") setCreateOpen(true);
  }, [params]);

  const filtered = useMemo(() => {
    if (!projects) return [];
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (filter === "running" && !RUNNING_STATUSES.has(p.status)) return false;
      if (filter !== "all" && filter !== "running" && p.status !== filter) return false;
      if (q && !`${p.name} ${p.prompt} ${p.domainLabel}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [projects, query, filter]);

  async function duplicate(p: Project) {
    setMenuFor(null);
    try {
      const copy = await api<Project>(`/api/projects/${p.id}/duplicate`, { method: "POST" });
      toast.success(`Duplicated as "${copy.name}"`);
      router.push(`/projects/${copy.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function remove(p: Project) {
    setMenuFor(null);
    if (!confirm(`Delete "${p.name}" and all generated artefacts?`)) return;
    try {
      await api(`/api/projects/${p.id}`, { method: "DELETE" });
      toast.success("Project deleted");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  function closeCreate() {
    setCreateOpen(false);
    if (params.get("new")) router.replace("/dashboard");
  }

  return (
    <AppShell>
      <CreateProjectModal open={createOpen} onClose={closeCreate} presetId={params.get("preset")} />

      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-ink-400">Every brief you have handed to the agents, with live status.</p>
        </div>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}>
          <Plus size={15} /> New project
        </button>
      </div>

      {/* Metrics */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Projects" value={metrics?.projects ?? "—"} sub={metrics ? `${metrics.completed} completed · ${metrics.running} running` : undefined} icon={FolderKanban} />
        <Stat label="Files generated" value={metrics?.files ?? "—"} sub={metrics ? `${(metrics.bytes / 1024).toFixed(0)} KB of source` : undefined} icon={FileCode2} accent="text-accent-400" />
        <Stat label="Tokens" value={metrics ? formatTokens(metrics.tokensIn + metrics.tokensOut) : "—"} sub={metrics ? `${formatTokens(metrics.tokensIn)} in · ${formatTokens(metrics.tokensOut)} out` : undefined} icon={Zap} accent="text-amber-400" />
        <Stat label="Spend" value={metrics ? formatCost(metrics.costMicros) : "—"} sub={metrics ? `${metrics.llmCalls} model calls` : undefined} icon={Coins} accent="text-mint-400" />
        <Stat label="Tool calls" value={metrics?.toolCalls ?? "—"} sub="files, commands, tables" icon={Activity} accent="text-brand-300" />
        <Stat label="Pending approvals" value={metrics?.pendingCheckpoints ?? "—"} sub={metrics?.pendingCheckpoints ? "action required" : "all clear"} icon={ShieldAlert} accent={metrics?.pendingCheckpoints ? "text-amber-300" : "text-ink-400"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <section>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
              <input className="input pl-9" placeholder="Search projects by name, brief or domain…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/8 bg-ink-900 p-1">
              {FILTERS.map((f) => (
                <button key={f.id} onClick={() => setFilter(f.id)} className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition", filter === f.id ? "bg-white/10 text-ink-100" : "text-ink-400 hover:text-ink-200")}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {projects === null ? (
            <div className="grid gap-3 md:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="panel h-44 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={projects.length ? Search : FolderKanban}
              title={projects.length ? "No projects match" : "No projects yet"}
              description={projects.length ? "Try a different search or filter." : "Describe a product and let the agents build it. Presets are a good way to see what a full run looks like."}
              action={!projects.length && <button className="btn-primary" onClick={() => setCreateOpen(true)}><Plus size={15} /> Create your first project</button>}
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filtered.map((p) => {
                const pct = p.totalSteps ? Math.round((p.currentStep / p.totalSteps) * 100) : 0;
                return (
                  <div key={p.id} className="group panel relative p-5 transition hover:border-brand-500/30">
                    <Link href={`/projects/${p.id}`} className="absolute inset-0 rounded-2xl" aria-label={`Open ${p.name}`} />
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/5 text-2xl">{p.emoji}</span>
                        <div>
                          <h3 className="font-display font-semibold leading-tight">{p.name}</h3>
                          <div className="mt-0.5 text-xs text-ink-400">{p.domainLabel} · {p.mode}</div>
                        </div>
                      </div>
                      <div className="relative z-10 flex items-center gap-2">
                        <StatusBadge status={p.status} />
                        <button className="btn-ghost btn-icon h-7 w-7 opacity-0 transition group-hover:opacity-100" onClick={() => setMenuFor(menuFor === p.id ? null : p.id)} aria-label="Project actions">
                          <MoreHorizontal size={15} />
                        </button>
                        {menuFor === p.id && (
                          <div className="absolute right-0 top-8 z-20 w-40 overflow-hidden rounded-xl border border-white/10 bg-ink-850 shadow-xl" onMouseLeave={() => setMenuFor(null)}>
                            <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5" onClick={() => duplicate(p)}><Copy size={14} /> Duplicate</button>
                            <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-300 hover:bg-rose-500/10" onClick={() => remove(p)}><Trash2 size={14} /> Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm text-ink-400">{p.prompt}</p>
                    <div className="mt-4">
                      <div className="mb-1.5 flex justify-between text-[11px] text-ink-500">
                        <span>Step {Math.min(p.currentStep, p.totalSteps)} / {p.totalSteps}</span>
                        <span>{pct}%</span>
                      </div>
                      <Progress value={pct} color={p.status === "completed" ? "bg-mint-400" : p.status === "failed" ? "bg-rose-400" : "bg-gradient-to-r from-brand-500 to-accent-400"} />
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-[11px] text-ink-500">
                      <span>{p.generatedFiles} files</span>
                      <span>{formatTokens(p.tokensIn + p.tokensOut)} tokens</span>
                      <span>{formatCost(p.costMicros)}</span>
                      <span className="ml-auto">{timeAgo(p.updatedAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Live activity</h2>
              <span className="chip"><span className="status-dot bg-mint-400" data-live="true" /> polling</span>
            </div>
            {activity.length === 0 ? (
              <p className="text-sm text-ink-500">Agent activity from all projects appears here.</p>
            ) : (
              <ul className="space-y-3">
                {activity.map((a) => {
                  const m = agentMeta(a.agentRole);
                  return (
                    <li key={a.id} className="flex gap-3 text-xs">
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg text-sm" style={{ background: `${m.color}22` }}>{a.agentRole ? m.emoji : "👤"}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-ink-200">{a.content.replace(/\*\*/g, "")}</div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-500">
                          <Link href={`/projects/${a.projectId}`} className="truncate hover:text-ink-300">{a.projectEmoji} {a.projectName}</Link>
                          <span>·</span>
                          <span>{timeAgo(a.createdAt)}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {metrics && metrics.byModel.length > 0 && (
            <div className="panel p-4">
              <h2 className="mb-3 text-sm font-semibold">Spend by model</h2>
              <ul className="space-y-2.5">
                {metrics.byModel.map((m) => {
                  const share = metrics.costMicros ? (m.costMicros / metrics.costMicros) * 100 : 0;
                  return (
                    <li key={m.model} className="text-xs">
                      <div className="flex justify-between">
                        <span className="font-mono text-ink-200">{m.model}</span>
                        <span className="text-ink-400">{formatCost(m.costMicros)} · {formatTokens(m.tokens)}</span>
                      </div>
                      <Progress value={share} className="mt-1.5" />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
