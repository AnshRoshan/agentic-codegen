import { useEffect, useState } from "react";
import {
  ArrowLeft, Play, Pause, StepForward, RotateCcw, Download, Copy, Trash2,
  LayoutGrid, Workflow, FileCode2, Database, KeyRound, ShieldCheck,
  Terminal as TerminalIcon, Activity, Search, PanelRightClose, PanelRightOpen,
  CheckCircle2, Circle, Loader2, AlertTriangle, ChevronRight, Zap, Clock, MoreHorizontal,
} from "lucide-react";
import { useStore, type WorkspaceTab } from "../lib/store";
import { AGENT_ORDER, AGENTS, agentMeta } from "../lib/types";
import { formatCost, formatTokens } from "../lib/models";
import { Progress, StatusBadge, Toggle, Empty, SectionCard } from "./ui";
import { AgentTag, SearchPalette, downloadBundle, timeAgo } from "./WorkspaceShared";
import WorkspaceMore from "./WorkspaceMore";
import { cn } from "../utils/cn";

const TABS: Array<{ id: WorkspaceTab; label: string; icon: React.ReactNode }> = [
  { id: "overview", label: "Overview", icon: <LayoutGrid size={16} /> },
  { id: "pipeline", label: "Pipeline", icon: <Workflow size={16} /> },
  { id: "files", label: "Files", icon: <FileCode2 size={16} /> },
  { id: "database", label: "Database", icon: <Database size={16} /> },
  { id: "env", label: "Environment", icon: <KeyRound size={16} /> },
  { id: "approvals", label: "Approvals", icon: <ShieldCheck size={16} /> },
  { id: "terminal", label: "Terminal", icon: <TerminalIcon size={16} /> },
  { id: "activity", label: "Activity", icon: <Activity size={16} /> },
  { id: "insights", label: "Insights", icon: <Zap size={16} /> },
];

// ─── Overview tab ───────────────────────────────────────────────────────────
function OverviewTab({ pid }: { pid: string }) {
  const { projects, workspaces, setWtab, startPipeline, running } = useStore();
  const project = projects.find((p) => p.id === pid)!;
  const ws = workspaces[pid];
  const arch = project.architecture;
  const pct = project.totalSteps ? Math.round((Math.min(project.currentStep, project.totalSteps) / project.totalSteps) * 100) : 0;
  const pending = ws.checkpoints.filter((c) => c.status === "pending");
  const recent = [...ws.messages].slice(-5).reverse();

  return (
    <div className="grid gap-3.5 xl:grid-cols-3">
      <div className="space-y-3.5 xl:col-span-2">
        {/* Pipeline status — the single source of truth (no duplicates elsewhere) */}
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[14px] font-semibold">Pipeline status</h3>
              <p className="mt-0.5 text-[12.5px] text-ink-400">
                Step {Math.min(project.currentStep + 1, project.totalSteps)} of {project.totalSteps}
                {project.plan[project.currentStep] ? ` — next: ${project.plan[project.currentStep].title}` : " — complete"}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setWtab("pipeline")} className="btn-secondary btn-sm">Open pipeline <ChevronRight size={13} /></button>
              {project.status === "draft" && !running[pid] && (
                <button onClick={() => startPipeline(pid)} className="btn-primary btn-sm"><Play size={13} /> Start pipeline</button>
              )}
            </div>
          </div>
          <div className="mt-3">
            <Progress value={pct} />
            <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-ink-500">
              <span>{pct}% · {project.completedTasks}/{project.totalTasks} steps</span>
              <span>{project.generatedFiles} files · {formatTokens(project.tokensIn + project.tokensOut)} tokens · {formatCost(project.costMicros)}</span>
            </div>
          </div>
          {/* Compact step dots */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {project.plan.map((s, i) => {
              const t = ws.tasks.find((x) => x.order === i);
              const st = t?.status ?? "pending";
              return (
                <button key={s.index} onClick={() => setWtab("pipeline")} title={`${s.title} — ${st}`}
                  className={cn("h-2.5 flex-1 min-w-[14px] rounded-full transition",
                    st === "completed" ? "bg-emerald-400/80" : st === "in_progress" ? "bg-violet-400" :
                    st === "waiting_approval" ? "bg-amber-400" : st === "skipped" ? "bg-ink-500" :
                    st === "failed" ? "bg-rose-400" : "bg-white/10")} />
              );
            })}
          </div>
          {pending.length > 0 && (
            <button onClick={() => setWtab("approvals")}
              className="mt-3.5 flex w-full items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/[0.07] px-3 py-2.5 text-left text-[13px] text-amber-200 transition hover:bg-amber-400/[0.12]">
              <AlertTriangle size={15} />
              <span className="font-medium">{pending.length} checkpoint{pending.length > 1 ? "s" : ""} awaiting review</span>
              <span className="ml-auto text-[12px]">Review →</span>
            </button>
          )}
        </div>

        {/* Architecture */}
        <SectionCard title="Architecture" subtitle={`${arch?.domainLabel} · ${arch?.entities.length} entities · ${arch?.features.length} features`}
          right={<span className="chip font-mono !text-[10.5px]">{arch?.domain}</span>}>
          <p className="text-[13px] leading-relaxed text-ink-300">{arch?.overview}</p>
          <div className="mt-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">Entities → tables</div>
            <div className="flex flex-wrap gap-1.5">
              {arch?.entities.map((e) => (
                <button key={e.name} onClick={() => setWtab("database")}
                  className="chip font-mono !text-[11px] transition hover:border-cyan-400/40 hover:text-cyan-200">
                  {e.name} <span className="text-ink-500">· {e.fields.length} fields</span>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">Components</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {arch?.components.map((c) => (
                <div key={c.name} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold">{c.name}</span>
                    <span className="chip !px-1.5 !py-0 !text-[10px]">{c.type}</span>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-400">{c.description}</p>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="space-y-3.5">
        {/* Stack */}
        <div className="card p-5">
          <h3 className="text-[14px] font-semibold">Tech stack</h3>
          <div className="mt-3 space-y-2.5">
            {[
              ["Frontend", project.techStack.frontend], ["Backend", project.techStack.backend],
              ["Database", project.techStack.database], ["Styling", project.techStack.styling],
              ["Testing", project.techStack.testing], ["Deploy", project.techStack.deployment],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 text-[12.5px]">
                <span className="text-ink-500">{k}</span>
                <span className="truncate font-medium text-ink-200">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Agents mini */}
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold">Agents</h3>
            <button onClick={() => setWtab("pipeline")} className="text-[12px] font-medium text-violet-300 hover:text-violet-200">Details →</button>
          </div>
          <div className="space-y-2">
            {ws.agents.map((a) => (
              <div key={a.id} className="flex items-center gap-2.5">
                <span className="text-[16px]">{agentMeta(a.role).emoji}</span>
                <span className="w-[86px] truncate text-[12.5px] font-medium">{a.name}</span>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                  <div className="h-full rounded-full transition-all" style={{ width: `${a.status === "completed" ? 100 : a.progress}%`, background: agentMeta(a.role).color }} />
                </div>
                <span className={cn("w-[62px] text-right text-[11px]",
                  a.status === "working" ? "text-violet-300" : a.status === "completed" ? "text-emerald-300"
                  : a.status === "waiting" ? "text-amber-300" : "text-ink-500")}>
                  {a.status === "working" ? "working" : a.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold">Latest events</h3>
            <button onClick={() => setWtab("activity")} className="text-[12px] font-medium text-violet-300 hover:text-violet-200">All →</button>
          </div>
          <div className="space-y-2.5">
            {recent.map((m) => (
              <div key={m.id} className="flex items-start gap-2 text-[12.5px]">
                <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: agentMeta(m.agentRole).color }} />
                <span className="min-w-0 flex-1 truncate text-ink-300">{m.content.replace(/\*\*/g, "").replace(/`/g, "")}</span>
              </div>
            ))}
            {recent.length === 0 && <div className="text-[12.5px] text-ink-500">No events yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Pipeline tab — ONE organized board (stepper + tasks + agents) ──────────
function PipelineTab({ pid }: { pid: string }) {
  const { projects, workspaces } = useStore();
  const project = projects.find((p) => p.id === pid)!;
  const ws = workspaces[pid];
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const agentFor = (role: string) => ws.agents.find((a) => a.role === role);
  const sel = selectedAgent ? agentFor(selectedAgent) : null;

  return (
    <div className="space-y-3.5">
      {/* Horizontal stepper */}
      <div className="card overflow-x-auto p-5">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[14px] font-semibold">Execution order</h3>
          <span className="font-mono text-[11.5px] text-ink-500">{project.completedTasks}/{project.totalTasks} complete</span>
        </div>
        <div className="flex min-w-[880px] items-start pt-3">
          {project.plan.map((s, i) => {
            const t = ws.tasks.find((x) => x.order === i);
            const st = t?.status ?? "pending";
            const done = st === "completed";
            const active = st === "in_progress" || st === "waiting_approval";
            const a = AGENTS[s.agent as keyof typeof AGENTS];
            return (
              <div key={s.index} className={cn("flex-1", i < project.plan.length - 1 && "step-connector", done && "done")}>
                <div className="flex flex-col items-center text-center">
                  <span className={cn("z-10 grid h-[44px] w-[44px] place-items-center rounded-2xl border text-[19px]",
                    done ? "border-emerald-400/40 bg-emerald-400/10" :
                    active ? "border-violet-400/50 bg-violet-500/15" : "border-white/10 bg-white/[0.03] opacity-70")}>
                    {done ? <CheckCircle2 size={19} className="text-emerald-400" />
                      : active ? <Loader2 size={18} className="animate-spin text-violet-300" />
                      : a.emoji}
                  </span>
                  <div className={cn("mt-2 max-w-[110px] text-[11px] font-semibold leading-tight", done || active ? "text-ink-100" : "text-ink-500")}>
                    {s.title}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px]" style={{ color: done || active ? a.color : undefined }}>
                    {a.name}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3.5 xl:grid-cols-[1fr_340px]">
        {/* Task list */}
        <div className="card p-2">
          <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">Task graph</div>
          {project.plan.map((s, i) => {
            const t = ws.tasks.find((x) => x.order === i);
            const st = t?.status ?? "pending";
            const a = AGENTS[s.agent as keyof typeof AGENTS];
            return (
              <div key={s.index}
                className={cn("flex items-start gap-3 rounded-xl px-3 py-2.5 transition",
                  st === "in_progress" ? "bg-violet-500/[0.08]" : "hover:bg-white/[0.03]")}>
                <span className="mt-0.5">
                  {st === "completed" ? <CheckCircle2 size={17} className="text-emerald-400" />
                    : st === "in_progress" ? <Loader2 size={17} className="animate-spin text-violet-300" />
                    : st === "waiting_approval" ? <Clock size={17} className="text-amber-300" />
                    : st === "skipped" ? <Circle size={17} className="text-ink-500" />
                    : <Circle size={17} className="text-ink-500" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-ink-500">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-[13.5px] font-semibold">{s.title}</span>
                    <span className="chip !px-2 !py-0 !text-[10px]" style={{ color: a.color, borderColor: `${a.color}33`, background: `${a.color}0f` }}>
                      {a.name}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-ink-400">{s.description}</p>
                </div>
                <span className={cn("mt-1 shrink-0 font-mono text-[10.5px]",
                  st === "completed" ? "text-emerald-300" : st === "in_progress" ? "text-violet-300"
                  : st === "waiting_approval" ? "text-amber-300" : "text-ink-500")}>
                  {st.replace("_", " ")}
                </span>
              </div>
            );
          })}
        </div>

        {/* Agents panel */}
        <div className="space-y-3.5">
          <div className="card p-4">
            <div className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-wider text-ink-500">Specialists</div>
            <div className="grid grid-cols-1 gap-2">
              {AGENT_ORDER.map((role) => {
                const def = AGENTS[role];
                const live = agentFor(role);
                const active = selectedAgent === role;
                return (
                  <button key={role} onClick={() => setSelectedAgent(active ? null : role)}
                    className={cn("flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition",
                      active ? "border-violet-400/50 bg-violet-500/10" : "border-white/[0.07] bg-white/[0.02] hover:border-white/15")}>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[18px]" style={{ background: `${def.color}18` }}>
                      {def.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[13px] font-semibold">
                        {def.name}
                        {live?.status === "working" && <span className="status-dot" style={{ background: def.color }} data-live="true" />}
                      </span>
                      <span className="block truncate font-mono text-[10.5px] text-ink-500">
                        {live?.currentTask ?? def.model} · {live?.filesWritten ?? 0} files
                      </span>
                    </span>
                    <span className={cn("text-[11px]",
                      live?.status === "completed" ? "text-emerald-300" : live?.status === "working" ? "text-violet-300"
                      : live?.status === "waiting" ? "text-amber-300" : "text-ink-500")}>
                      {live?.status === "completed" ? "done" : live?.status === "working" ? `${live.progress}%` : live?.status}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {sel && (
            <div className="card p-4">
              <div className="flex items-center gap-2">
                <span className="text-[20px]">{agentMeta(sel.role).emoji}</span>
                <div>
                  <div className="text-[13.5px] font-semibold">{sel.name}</div>
                  <div className="font-mono text-[10.5px]" style={{ color: agentMeta(sel.role).color }}>{agentMeta(sel.role).model}</div>
                </div>
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-300">{agentMeta(sel.role).description}</p>
              <div className="mt-2.5 flex flex-wrap gap-1">
                {agentMeta(sel.role).tools.map((t) => <span key={t} className="chip font-mono !text-[10px]">{t}</span>)}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/[0.07] pt-3 text-center">
                <div><div className="font-mono text-[13px]">{formatTokens(sel.tokensIn + sel.tokensOut)}</div><div className="text-[10.5px] text-ink-500">tokens</div></div>
                <div><div className="font-mono text-[13px]">{sel.llmCalls}</div><div className="text-[10.5px] text-ink-500">llm calls</div></div>
                <div><div className="font-mono text-[13px]">{sel.filesWritten}</div><div className="text-[10.5px] text-ink-500">files</div></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Right inspector ────────────────────────────────────────────────────────
function Inspector({ pid }: { pid: string }) {
  const { projects, workspaces, setWtab } = useStore();
  const project = projects.find((p) => p.id === pid)!;
  const ws = workspaces[pid];
  const feed = [...ws.messages].slice(-9).reverse();
  const pending = ws.checkpoints.filter((c) => c.status === "pending");

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      {pending.length > 0 && (
        <button onClick={() => setWtab("approvals")}
          className="rounded-xl border border-amber-400/30 bg-amber-400/[0.07] p-3 text-left transition hover:bg-amber-400/[0.12]">
          <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-amber-200">
            <ShieldCheck size={14} /> {pending.length} approval{pending.length > 1 ? "s" : ""} needed
          </div>
          <div className="mt-1 truncate text-[12px] text-amber-200/70">{pending[0].title}</div>
        </button>
      )}
      <div className="card p-3.5">
        <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500">Run stats</div>
        <div className="grid grid-cols-2 gap-2 text-center">
          {[
            [String(project.generatedFiles), "files"],
            [formatCost(project.costMicros), "cost"],
            [formatTokens(project.tokensIn + project.tokensOut), "tokens"],
            [String(project.llmCalls), "llm calls"],
          ].map(([v, l]) => (
            <div key={l as string} className="rounded-lg bg-white/[0.03] px-2 py-2">
              <div className="font-mono text-[13px] font-semibold">{v}</div>
              <div className="text-[10.5px] text-ink-500">{l}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="card flex-1 p-3.5">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Live feed</span>
          <button onClick={() => setWtab("activity")} className="text-[11.5px] font-medium text-violet-300">All →</button>
        </div>
        <div className="space-y-2.5">
          {feed.map((m) => (
            <div key={m.id} className="text-[12px] leading-snug">
              <div className="mb-0.5 flex items-center gap-1.5">
                <AgentTag role={m.agentRole} />
                <span className="font-mono text-[10px] text-ink-500">{timeAgo(m.createdAt)}</span>
              </div>
              <p className="line-clamp-3 text-ink-300">{m.content.replace(/\*\*/g, "")}</p>
            </div>
          ))}
          {feed.length === 0 && <div className="text-[12px] text-ink-500">No events yet.</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Main workspace shell ───────────────────────────────────────────────────
export default function WorkspacePage() {
  const {
    projects, workspaces, activeId, setActiveId, setView, wtab, setWtab,
    running, startPipeline, pausePipeline, stepOnce, resetProject,
    toggleAutoApprove, duplicateProject, deleteProject,
  } = useStore();
  const [inspector, setInspector] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFile, setOpenFile] = useState<string | null>(null);

  const project = projects.find((p) => p.id === activeId);
  const ws = activeId ? workspaces[activeId] : undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen((v) => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!project || !ws) {
    return (
      <div className="mx-auto max-w-lg p-10">
        <Empty icon={<Workflow size={20} />} title="No project selected"
          hint="Pick a project from the sidebar or create a new one to open the workspace."
          action={<button onClick={() => setView("dashboard")} className="btn-primary">Go to projects</button>} />
      </div>
    );
  }

  const pid = project.id;
  const pct = project.totalSteps ? Math.round((Math.min(project.currentStep, project.totalSteps) / project.totalSteps) * 100) : 0;
  const pending = ws.checkpoints.filter((c) => c.status === "pending");
  const isRunning = !!running[pid];
  const canStart = ["draft", "paused", "planning", "generating", "building", "testing", "deploying"].includes(project.status) && !isRunning && project.currentStep < project.totalSteps;
  const currentStep = project.plan[project.currentStep];
  const badge = (id: WorkspaceTab): number =>
    id === "approvals" ? pending.length : id === "files" ? ws.files.length : id === "database" ? ws.tables.length : 0;

  return (
    <div className="flex h-full flex-col">
      <SearchPalette project={project} ws={ws} open={searchOpen} onClose={() => setSearchOpen(false)}
        onOpenFile={(p) => { setOpenFile(p); setWtab("files"); }} onGoto={(t) => setWtab(t as WorkspaceTab)} />

      {/* ── SINGLE compact header (fixes the double-header + scroll complaint) ── */}
      <div className="shrink-0 border-b border-white/[0.07] bg-panel/80 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-3">
          <button onClick={() => { setActiveId(null); setView("dashboard"); }} className="btn-ghost btn-icon !p-1.5" title="All projects">
            <ArrowLeft size={16} />
          </button>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-[19px]">{project.emoji}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[15px] font-semibold tracking-tight">{project.name}</h1>
              <StatusBadge status={project.status} />
              {pending.length > 0 && (
                <button onClick={() => setWtab("approvals")} className="chip border-amber-400/40 bg-amber-400/15 text-[11px] text-amber-200">
                  {pending.length} approval{pending.length > 1 ? "s" : ""}
                </button>
              )}
            </div>
            <div className="mt-0.5 truncate text-[12px] text-ink-500">
              {project.domainLabel} · {currentStep ? `next: ${currentStep.title}` : "pipeline complete"} · {formatCost(project.costMicros)}
            </div>
          </div>

          {/* Inline progress */}
          <div className="mx-2 hidden min-w-[160px] max-w-[280px] flex-1 md:block">
            <Progress value={pct} />
            <div className="mt-1 flex justify-between font-mono text-[10.5px] text-ink-500">
              <span>{project.completedTasks}/{project.totalTasks}</span><span>{pct}%</span>
            </div>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <button onClick={() => setSearchOpen(true)} className="btn-secondary btn-sm hidden lg:inline-flex" title="Search (⌘K)">
              <Search size={13} /> <span className="kbd ml-0.5">⌘K</span>
            </button>
            <div className="hidden items-center gap-2 rounded-lg border border-white/10 px-2.5 py-1.5 xl:flex">
              <Toggle checked={project.autoApprove} onChange={() => toggleAutoApprove(pid)} />
              <span className="text-[12px] text-ink-300">Auto-approve</span>
            </div>
            {isRunning ? (
              <button onClick={() => pausePipeline(pid)} className="btn-secondary btn-sm"><Pause size={13} /> Pause</button>
            ) : canStart ? (
              <button onClick={() => startPipeline(pid)} className="btn-primary btn-sm"><Play size={13} /> {project.status === "draft" ? "Start" : "Resume"}</button>
            ) : null}
            {!isRunning && project.currentStep < project.totalSteps && project.status !== "waiting_approval" && (
              <button onClick={() => stepOnce(pid)} className="btn-secondary btn-sm" title="Run one step">
                <StepForward size={13} /> Step
              </button>
            )}
            <div className="relative">
              <button onClick={() => setMenuOpen((v) => !v)} className="btn-secondary btn-sm !px-2" title="More actions">
                <MoreHorizontal size={15} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="glass absolute right-0 z-50 mt-1.5 w-52 overflow-hidden rounded-xl p-1.5 text-[13px]">
                    {[
                      { label: "Download bundle", icon: <Download size={14} />, fn: () => downloadBundle(project, ws) },
                      { label: "Duplicate", icon: <Copy size={14} />, fn: () => duplicateProject(pid) },
                      { label: "Reset to draft", icon: <RotateCcw size={14} />, fn: () => { if (confirm("Reset? All generated files, tables, logs and checkpoints will be removed.")) resetProject(pid); } },
                      { label: "Delete project", icon: <Trash2 size={14} />, danger: true, fn: () => { if (confirm(`Delete "${project.name}"?`)) { deleteProject(pid); } } },
                    ].map((a) => (
                      <button key={a.label} onClick={() => { a.fn(); setMenuOpen(false); }}
                        className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 transition",
                          a.danger ? "text-rose-300 hover:bg-rose-500/10" : "text-ink-200 hover:bg-white/[0.06]")}>
                        {a.icon} {a.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button onClick={() => setInspector((v) => !v)} className="btn-ghost btn-sm !px-2" title="Toggle inspector">
              {inspector ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Body: rail + content + inspector ── */}
      <div className="flex min-h-0 flex-1">
        {/* Icon rail — collapses to icons on small screens */}
        <nav className="flex w-[58px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-white/[0.07] bg-panel/40 p-2 sm:w-[172px]">
          {TABS.map((t) => {
            const b = badge(t.id);
            const active = wtab === t.id;
            return (
              <button key={t.id} onClick={() => setWtab(t.id)} title={t.label}
                className={cn("tab-rail-btn relative flex items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 text-left text-[13px] text-ink-400 hover:bg-white/[0.04] hover:text-white max-sm:justify-center max-sm:px-0",
                  active && "active")}>
                <span className={active ? "text-violet-300" : ""}>{t.icon}</span>
                <span className="flex-1 font-medium max-sm:hidden">{t.label}</span>
                {b > 0 && (
                  <span className={cn("rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold max-sm:absolute max-sm:-right-0.5 max-sm:-top-0.5 max-sm:px-1",
                    t.id === "approvals" ? "bg-amber-400/20 text-amber-200" : "bg-white/[0.08] text-ink-300")}>
                    {b}
                  </span>
                )}
              </button>
            );
          })}
          <div className="mt-auto px-2.5 pb-1 pt-3 text-[11px] leading-relaxed text-ink-500 max-sm:hidden">
            <Clock size={11} className="mr-1 inline" />
            Updated {timeAgo(project.updatedAt)}
          </div>
        </nav>

        {/* Content */}
        <div className="min-w-0 flex-1 overflow-y-auto p-4">
          {wtab === "overview" && <OverviewTab pid={pid} />}
          {wtab === "pipeline" && <PipelineTab pid={pid} />}
          {wtab !== "overview" && wtab !== "pipeline" && (
            <WorkspaceMore pid={pid} tab={wtab} openFile={openFile} setOpenFile={setOpenFile} />
          )}
        </div>

        {/* Inspector */}
        {inspector && (
          <aside className="hidden w-[264px] shrink-0 border-l border-white/[0.07] bg-panel/40 xl:block">
            <Inspector pid={pid} />
          </aside>
        )}
      </div>
    </div>
  );
}
