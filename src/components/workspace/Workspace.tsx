"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  ArrowLeft,
  Database,
  Download,
  FileCode2,
  Copy,
  KeyRound,
  LayoutGrid,
  Pause,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  SkipForward,
  Terminal as TerminalIcon,
  Trash2,
} from "lucide-react";
import type { Agent, AgentMessage, CommandExecution, DbTable, EnvironmentVariable, HitlCheckpoint, LlmCall, Project, Task } from "@/db/schema";
import { AppShell } from "@/components/AppShell";
import { Progress, Spinner, StatusBadge, Toggle } from "@/components/ui";
import { api, cn, formatCost, formatTokens, RUNNING_STATUSES } from "@/lib/utils";
import { AgentsPanel } from "./AgentsPanel";
import { OverviewTab } from "./OverviewTab";
import { FilesTab } from "./FilesTab";
import { DatabaseTab } from "./DatabaseTab";
import { EnvTab } from "./EnvTab";
import { CheckpointsTab } from "./CheckpointsTab";
import { TerminalTab } from "./TerminalTab";
import { ActivityTab } from "./ActivityTab";
import { SearchPalette } from "./SearchPalette";

export type FileMeta = { id: string; path: string; name: string; language: string | null; size: number; version: number; agentRole: string | null; isModified: boolean; updatedAt: string };

export interface WorkspaceData {
  project: Project;
  agents: Agent[];
  tasks: Task[];
  files: FileMeta[];
  tables: DbTable[];
  env: EnvironmentVariable[];
  checkpoints: HitlCheckpoint[];
  commands: CommandExecution[];
  messages: AgentMessage[];
  llmCalls: LlmCall[];
}

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "files", label: "Files", icon: FileCode2 },
  { id: "database", label: "Database", icon: Database },
  { id: "env", label: "Environment", icon: KeyRound },
  { id: "checkpoints", label: "Approvals", icon: ShieldCheck },
  { id: "terminal", label: "Terminal", icon: TerminalIcon },
  { id: "activity", label: "Activity", icon: Activity },
] as const;
type TabId = (typeof TABS)[number]["id"];

const TICK_MS = 1100;

export function Workspace({ id }: { id: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [tab, setTab] = useState<TabId>("overview");
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [openFile, setOpenFile] = useState<string | null>(null);
  const runningRef = useRef(false);
  const autoStarted = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const d = await api<WorkspaceData>(`/api/projects/${id}`);
      setData(d);
      return d;
    } catch {
      return null;
    }
  }, [id]);

  // Initial load + background polling (so other tabs / users see progress)
  useEffect(() => {
    refresh().then((d) => {
      if (!d) {
        toast.error("Project not found");
        router.replace("/dashboard");
      }
    });
    const iv = setInterval(() => {
      if (!runningRef.current) refresh();
    }, 4000);
    return () => clearInterval(iv);
  }, [refresh, router]);

  // Run loop: keep calling /run until done / waiting / paused
  const stop = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
  }, []);

  const runLoop = useCallback(
    async (action: "start" | "resume" | "step" = "step") => {
      if (runningRef.current) return;
      runningRef.current = true;
      setRunning(true);
      let first = true;
      while (runningRef.current) {
        try {
          const r = await api<{ ok: boolean; done?: boolean; waiting?: boolean; status?: string; error?: string }>(`/api/projects/${id}/run`, {
            method: "POST",
            body: JSON.stringify({ action: first ? action : "step" }),
          });
          first = false;
          const d = await refresh();
          if (!r.ok) {
            toast.error(r.error ?? "Pipeline failed");
            break;
          }
          if (r.waiting) {
            toast.warning("Agents are waiting for your approval", { description: "Review the checkpoint in the Approvals tab." });
            setTab("checkpoints");
            break;
          }
          if (r.done) {
            toast.success("Pipeline complete 🎉", { description: `${d?.project.generatedFiles ?? 0} files generated.` });
            break;
          }
          if (d?.project.status === "paused") break;
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Pipeline error");
          break;
        }
        await new Promise((res) => setTimeout(res, TICK_MS));
      }
      stop();
    },
    [id, refresh, stop],
  );

  // ?start=1 → kick off immediately
  useEffect(() => {
    if (!data || autoStarted.current) return;
    if (params.get("start") === "1" && data.project.status === "draft") {
      autoStarted.current = true;
      router.replace(`/projects/${id}`);
      runLoop("start");
    }
  }, [data, params, id, router, runLoop]);

  // Keyboard: ⌘K search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pendingCheckpoints = useMemo(() => data?.checkpoints.filter((c) => c.status === "pending") ?? [], [data]);

  async function pause() {
    stop();
    await api(`/api/projects/${id}/run`, { method: "POST", body: JSON.stringify({ action: "pause" }) }).catch(() => null);
    await refresh();
    toast("Pipeline paused");
  }

  async function step() {
    setBusy("step");
    try {
      const r = await api<{ ok: boolean; waiting?: boolean; done?: boolean; error?: string }>(`/api/projects/${id}/run`, { method: "POST", body: JSON.stringify({ action: "resume" }) });
      await refresh();
      if (!r.ok) toast.error(r.error ?? "Failed");
      else if (r.waiting) setTab("checkpoints");
    } finally {
      setBusy(null);
    }
  }

  async function reset() {
    if (!confirm("Reset this project? All generated files, tables, logs and checkpoints will be removed.")) return;
    stop();
    setBusy("reset");
    await api(`/api/projects/${id}/reset`, { method: "POST" });
    await refresh();
    setOpenFile(null);
    setBusy(null);
    toast.success("Project reset to draft");
  }

  async function remove() {
    if (!confirm(`Delete "${data?.project.name}"? This cannot be undone.`)) return;
    stop();
    await api(`/api/projects/${id}`, { method: "DELETE" });
    toast.success("Project deleted");
    router.push("/dashboard");
  }

  async function duplicate() {
    setBusy("dup");
    const copy = await api<Project>(`/api/projects/${id}/duplicate`, { method: "POST" });
    setBusy(null);
    toast.success(`Duplicated as "${copy.name}"`);
    router.push(`/projects/${copy.id}`);
  }

  async function toggleAuto(v: boolean) {
    await api(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify({ autoApprove: v }) });
    await refresh();
  }

  async function resolve(cpId: string, decision: "approved" | "rejected", note?: string) {
    const r = await api<{ ok: boolean; status?: string; error?: string }>(`/api/projects/${id}/hitl/${cpId}`, { method: "POST", body: JSON.stringify({ decision, note }) });
    if (!r.ok) {
      toast.error(r.error ?? "Failed");
      return;
    }
    toast.success(decision === "approved" ? "Approved — resuming pipeline" : "Rejected — skipping step");
    await refresh();
    if (r.status !== "completed") runLoop("resume");
  }

  if (!data) {
    return (
      <AppShell>
        <div className="flex h-[60vh] items-center justify-center text-ink-400"><Spinner className="mr-2" /> Loading workspace…</div>
      </AppShell>
    );
  }

  const { project } = data;
  const pct = project.totalSteps ? Math.round((Math.min(project.currentStep, project.totalSteps) / project.totalSteps) * 100) : 0;
  const isRunning = running || RUNNING_STATUSES.has(project.status);
  const canStart = ["draft", "paused", "generating", "planning", "building", "testing", "deploying"].includes(project.status) && !running && project.currentStep < project.totalSteps;
  const currentStep = project.plan?.[project.currentStep];

  return (
    <AppShell
      right={
        <button className="btn-secondary btn-sm" onClick={() => setSearchOpen(true)} title="Search code (⌘K)">
          <Search size={13} /> <span className="hidden sm:inline">Search code</span> <span className="kbd ml-1 hidden sm:inline-flex">⌘K</span>
        </button>
      }
    >
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} projectId={id} onOpenFile={(p) => { setOpenFile(p); setTab("files"); setSearchOpen(false); }} />

      {/* Header */}
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <Link href="/dashboard" className="btn-ghost btn-icon mt-1 shrink-0" aria-label="Back to projects"><ArrowLeft size={16} /></Link>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/5 text-2xl">{project.emoji}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-semibold tracking-tight">{project.name}</h1>
              <StatusBadge status={project.status} />
              {pendingCheckpoints.length > 0 && (
                <button onClick={() => setTab("checkpoints")} className="chip border-amber-400/40 bg-amber-400/15 text-amber-200">
                  {pendingCheckpoints.length} approval{pendingCheckpoints.length > 1 ? "s" : ""} pending
                </button>
              )}
            </div>
            <p className="mt-0.5 line-clamp-1 max-w-2xl text-sm text-ink-400">{project.description}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Toggle checked={project.autoApprove} onChange={toggleAuto} label="Auto-approve" />
          <span className="mx-1 h-6 w-px bg-white/10" />
          {running ? (
            <button className="btn-secondary" onClick={pause}><Pause size={15} /> Pause</button>
          ) : (
            <button className="btn-primary" onClick={() => runLoop(project.status === "draft" ? "start" : "resume")} disabled={!canStart || project.status === "waiting_approval"}>
              <Play size={15} /> {project.status === "draft" ? "Start pipeline" : project.currentStep >= project.totalSteps ? "Completed" : "Resume"}
            </button>
          )}
          <button className="btn-secondary btn-icon" onClick={step} disabled={running || !canStart || project.status === "waiting_approval"} title="Run a single step">
            {busy === "step" ? <Spinner /> : <SkipForward size={15} />}
          </button>
          <a href={`/api/projects/${id}/download`} className={cn("btn-secondary", !data.files.length && "pointer-events-none opacity-50")} title="Download zip"><Download size={15} /> <span className="hidden sm:inline">Download</span></a>
          <button className="btn-ghost btn-icon" onClick={duplicate} title="Duplicate project">{busy === "dup" ? <Spinner /> : <Copy size={15} />}</button>
          <button className="btn-ghost btn-icon" onClick={reset} title="Reset project" disabled={running}>{busy === "reset" ? <Spinner /> : <RotateCcw size={15} />}</button>
          <button className="btn-ghost btn-icon text-rose-300 hover:bg-rose-500/10" onClick={remove} title="Delete project"><Trash2 size={15} /></button>
        </div>
      </div>

      {/* Progress strip */}
      <div className="panel mb-5 flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center">
        <div className="flex-1">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-ink-300">
              {isRunning && currentStep ? (
                <span className="flex items-center gap-2"><Spinner className="h-3 w-3" /> Step {project.currentStep + 1}/{project.totalSteps} · {currentStep.title}</span>
              ) : project.status === "waiting_approval" ? (
                <span className="text-amber-300">Paused at step {project.currentStep}/{project.totalSteps} — waiting for your approval</span>
              ) : project.status === "completed" ? (
                <span className="text-mint-400">All {project.totalSteps} steps complete</span>
              ) : project.status === "failed" ? (
                <span className="text-rose-400">Failed: {project.errorMessage}</span>
              ) : (
                <span>{project.currentStep === 0 ? "Ready to start" : `Paused at step ${project.currentStep}/${project.totalSteps}`}</span>
              )}
            </span>
            <span className="font-mono text-ink-400">{pct}%</span>
          </div>
          <Progress value={pct} color={project.status === "completed" ? "bg-mint-400" : project.status === "failed" ? "bg-rose-400" : "bg-gradient-to-r from-brand-500 to-accent-400"} />
        </div>
        <div className="grid grid-cols-4 gap-4 text-xs md:border-l md:border-white/8 md:pl-5">
          <div><div className="text-ink-500">Files</div><div className="font-display text-base font-semibold">{project.generatedFiles}</div></div>
          <div><div className="text-ink-500">Tasks</div><div className="font-display text-base font-semibold">{project.completedTasks}/{project.totalTasks || project.totalSteps}</div></div>
          <div><div className="text-ink-500">Tokens</div><div className="font-display text-base font-semibold">{formatTokens(project.tokensIn + project.tokensOut)}</div></div>
          <div><div className="text-ink-500">Cost</div><div className="font-display text-base font-semibold text-mint-400">{formatCost(project.costMicros)}</div></div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[300px_1fr]">
        <AgentsPanel agents={data.agents} tasks={data.tasks} plan={project.plan ?? []} currentStep={project.currentStep} status={project.status} />

        <section className="min-w-0">
          <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-white/8 bg-ink-900/60 p-1">
            {TABS.map((t) => {
              const count = t.id === "files" ? data.files.length : t.id === "database" ? data.tables.length : t.id === "env" ? data.env.length : t.id === "checkpoints" ? pendingCheckpoints.length : t.id === "terminal" ? data.commands.length : 0;
              return (
                <button key={t.id} className="tab" data-active={tab === t.id} onClick={() => setTab(t.id)}>
                  <t.icon size={14} /> {t.label}
                  {count > 0 && <span className={cn("rounded-full px-1.5 text-[10px]", t.id === "checkpoints" ? "bg-amber-400/20 text-amber-200" : "bg-white/10 text-ink-300")}>{count}</span>}
                </button>
              );
            })}
          </div>

          {tab === "overview" && <OverviewTab data={data} onGoTo={(t) => setTab(t as TabId)} />}
          {tab === "files" && <FilesTab projectId={id} files={data.files} openPath={openFile} onOpen={setOpenFile} />}
          {tab === "database" && <DatabaseTab tables={data.tables} />}
          {tab === "env" && <EnvTab projectId={id} env={data.env} onChange={refresh} />}
          {tab === "checkpoints" && <CheckpointsTab checkpoints={data.checkpoints} onResolve={resolve} autoApprove={project.autoApprove} />}
          {tab === "terminal" && <TerminalTab commands={data.commands} />}
          {tab === "activity" && <ActivityTab messages={data.messages} llmCalls={data.llmCalls} onOpenFile={(p) => { setOpenFile(p); setTab("files"); }} />}
        </section>
      </div>
    </AppShell>
  );
}
