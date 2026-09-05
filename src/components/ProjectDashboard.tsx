"use client";

import { useState, useEffect, useCallback } from "react";
import AgentCard from "./AgentCard";
import CodeWorkspace from "./CodeWorkspace";
import AgentGraph from "./AgentGraph";
import DatabaseViewer from "./DatabaseViewer";
import EnvironmentVariables from "./EnvironmentVariables";
import HitlCheckpoints from "./HitlCheckpoints";
import SettingsModal from "./SettingsModal";
import Terminal from "./Terminal";
import ProjectStats from "./ProjectStats";
import {
  StatusBadge,
  ProgressBar,
  EmptyState,
  ToastProvider,
  useToast,
  useKeyboardShortcuts,
  ConfirmDialog,
  Tabs,
  Spinner,
} from "./ui";
import { AGENT_DEFINITIONS, type AgentRoleId } from "@/lib/agents";
import { TEMPLATES, domainIcon } from "@/lib/templates";
import {
  ArrowLeft,
  Play,
  Pause,
  StepForward,
  KeyRound,
  Sparkles,
  WifiOff,
  ShieldAlert,
  FolderTree,
  GitBranch,
  Database,
  Terminal as TerminalIcon,
  History,
  ListChecks,
  Download,
  RefreshCw,
  ChevronRight,
  BarChart3,
  RotateCcw,
  Copy,
  MoreHorizontal,
  Pencil,
  Search,
  X,
  CheckCircle2,
} from "lucide-react";

interface ProjectDashboardProps {
  projectId: string;
  onBack: () => void;
  onDuplicated?: (newId: string) => void;
}

interface FileNode {
  id: string;
  name: string;
  path: string;
  type: string;
  language: string | null;
  content: string | null;
  size: number | null;
  isGenerated: boolean | null;
  isModified: boolean | null;
}

interface ProjectData {
  project: {
    id: string;
    name: string;
    description: string | null;
    mode: string;
    status: string;
    prompt: string;
    templateId?: string | null;
    techStack: Record<string, string> | null;
    totalTasks: number | null;
    completedTasks: number | null;
    generatedFiles: number | null;
    createdAt: string;
    updatedAt: string;
  };
  agents: Array<{ id: string; role: string; name: string; status: string; currentTask: string | null; progress: number | null }>;
  tasks: Array<{ id: string; agentId: string | null; title: string; description: string | null; status: string; priority: number | null; completedAt?: string | null }>;
  commands: Array<{ id: string; agentId: string | null; command: string; status: string; exitCode: number | null; durationMs: number | null; stdout?: string | null; stderr?: string | null }>;
  messages: Array<{ id: string; agentId: string | null; role: string; content: string; createdAt: string }>;
  fileNodes: FileNode[];
  dbTables: Array<{
    id: string; name: string; schema: string; status: string;
    columns: Array<{ name: string; type: string; nullable: boolean; default?: string; isPrimary?: boolean; isForeign?: boolean; references?: string }>;
    indexes: Array<{ name: string; columns: string[]; unique?: boolean }>;
    rowCount: number | null; sql: string | null;
  }>;
  envVars: Array<{ id: string; key: string; value: string | null; type: "plain" | "secret" | "vault_ref"; description: string | null; isSecret: boolean; isRequired: boolean; vaultPath: string | null; source?: string | null }>;
  hitlCheckpoints: Array<{ id: string; status: string; type: string; title: string; description: string; riskLevel: string; context: { proposedChanges?: string; diff?: string; filePath?: string; command?: string; affectedTables?: string[] }; createdAt: string }>;
}

type SectionId = "overview" | "workspace" | "orchestration" | "database" | "env" | "hitl" | "tasks" | "terminal" | "timeline" | "stats";

// ─── Inner component (has access to toast) ────────────────────────────────────

function DashboardInner({ projectId, onBack, onDuplicated }: ProjectDashboardProps) {
  const { addToast } = useToast();
  const [data, setData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [autoRun, setAutoRun] = useState(false);
  const [section, setSection] = useState<SectionId>("overview");
  const [showSettings, setShowSettings] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [fileSearch, setFileSearch] = useState("");
  const [fileSearchResults, setFileSearchResults] = useState<Array<{ fileId: string; path: string; language: string | null; matches: Array<{ line: number; text: string }> }>>([]);
  const [searching, setSearching] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const d = await res.json() as ProjectData;
        setData(d);
        if (!nameInput) setNameInput(d.project.name);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, nameInput]);

  const checkAi = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/ai");
      const j = await res.json();
      setAiConfigured(Boolean(j.isConfigured));
    } catch { setAiConfigured(false); }
  }, []);

  useEffect(() => {
    fetchData();
    checkAi();
  }, [fetchData, checkAi]);

  const simulateStep = useCallback(async (): Promise<boolean> => {
    if (simulating) return false;
    setSimulating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/simulate`, { method: "POST" });
      await fetchData();
      if (res.ok) {
        const r = await res.json();
        if (r.live) addToast("success", "AI agent completed a task", r.completedTask);
        return r.status === "completed" || r.status === "waiting_approval" || r.remaining === 0;
      }
    } catch (e) {
      addToast("error", "Simulation error", String(e));
    } finally {
      setSimulating(false);
    }
    return false;
  }, [projectId, simulating, fetchData, addToast]);

  useEffect(() => {
    if (!autoRun || !data) return;
    const s = data.project.status;
    if (s === "completed" || s === "waiting_approval" || s === "failed") { setAutoRun(false); return; }
    const t = setTimeout(async () => {
      const done = await simulateStep();
      if (done) { setAutoRun(false); addToast("success", "Pipeline complete! 🎉", "All agent tasks finished."); }
    }, 1400);
    return () => clearTimeout(t);
  }, [autoRun, data, simulateStep, addToast]);

  const handleApprove = async (cpId: string) => {
    await fetch(`/api/projects/${projectId}/hitl/${cpId}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve" }),
    });
    addToast("success", "Checkpoint approved", "Agent will resume shortly.");
    fetchData();
  };

  const handleReject = async (cpId: string, reason: string) => {
    await fetch(`/api/projects/${projectId}/hitl/${cpId}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reject", reason }),
    });
    addToast("warning", "Checkpoint rejected", reason || "Agent task will be skipped.");
    fetchData();
  };

  const handleReset = async () => {
    await fetch(`/api/projects/${projectId}/reset`, { method: "POST" });
    setAutoRun(false);
    setShowResetConfirm(false);
    addToast("info", "Project reset", "Pipeline will restart from the beginning.");
    fetchData();
  };

  const handleDuplicate = async () => {
    const res = await fetch(`/api/projects/${projectId}/duplicate`, { method: "POST" });
    if (res.ok) {
      const j = await res.json();
      addToast("success", "Project duplicated!", "Opening copy…");
      onDuplicated?.(j.id);
    }
    setShowActions(false);
  };

  const saveName = async () => {
    if (!nameInput.trim() || nameInput === data?.project.name) { setEditingName(false); return; }
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nameInput }),
    });
    setEditingName(false);
    addToast("success", "Name updated");
    fetchData();
  };

  const doFileSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setFileSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/search?q=${encodeURIComponent(q)}`);
      const j = await res.json();
      setFileSearchResults(j.results ?? []);
    } finally { setSearching(false); }
  }, [projectId]);

  useEffect(() => {
    const t = setTimeout(() => doFileSearch(fileSearch), 300);
    return () => clearTimeout(t);
  }, [fileSearch, doFileSearch]);

  useKeyboardShortcuts({
    "r": () => simulateStep(),
    " ": () => setAutoRun((a) => !a),
    "Escape": () => { setAutoRun(false); setShowActions(false); setFileSearch(""); },
    "s": () => setSection("stats"),
    "w": () => setSection("workspace"),
    "t": () => setSection("terminal"),
  });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Spinner size={28} />
    </div>
  );
  if (!data) return null;

  const { project, agents: agentsList, tasks: tasksList, commands, messages, fileNodes, dbTables, envVars, hitlCheckpoints: hitlList } = data;
  const pendingHitl = hitlList.filter((h) => h.status === "pending");
  const progress = project.totalTasks ? Math.round(((project.completedTasks ?? 0) / project.totalTasks) * 100) : 0;
  const template = TEMPLATES.find((t) => t.id === project.templateId);
  const isComplete = project.status === "completed";

  const SECTIONS: Array<{ id: SectionId; label: string; icon: typeof FolderTree; badge?: number; count?: number }> = [
    { id: "overview",      label: "Overview",      icon: Sparkles },
    { id: "workspace",     label: "Workspace",      icon: FolderTree,    count: fileNodes.filter(f => f.type === "file").length },
    { id: "orchestration", label: "Agents",         icon: GitBranch,     count: agentsList.length },
    { id: "database",      label: "Database",       icon: Database,      count: dbTables.length },
    { id: "env",           label: "Env & Secrets",  icon: KeyRound,      count: envVars.length },
    { id: "hitl",          label: "Approvals",      icon: ShieldAlert,   badge: pendingHitl.length },
    { id: "tasks",         label: "Tasks",          icon: ListChecks,    count: tasksList.length },
    { id: "terminal",      label: "Terminal",       icon: TerminalIcon,  count: commands.length },
    { id: "timeline",      label: "Activity",       icon: History,       count: messages.length },
    { id: "stats",         label: "Analytics",      icon: BarChart3 },
  ];

  return (
    <div className="space-y-4 anim-up">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button onClick={onBack} className="btn btn-ghost btn-icon flex-shrink-0" data-tip="Back to projects">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-2xl flex-shrink-0">{domainIcon(project.templateId)}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                    className="input text-lg font-bold py-1 px-2 w-64"
                    autoFocus
                  />
                  <button className="btn btn-primary btn-xs" onClick={saveName}><CheckCircle2 className="w-3 h-3" /></button>
                  <button className="btn btn-ghost btn-xs" onClick={() => setEditingName(false)}><X className="w-3 h-3" /></button>
                </div>
              ) : (
                <button
                  className="text-xl font-bold text-surface-100 hover:text-primary-300 transition-colors text-left"
                  onClick={() => { setEditingName(true); setNameInput(project.name); }}
                  data-tip="Click to rename"
                >
                  {project.name}
                </button>
              )}
              <StatusBadge status={project.mode === "greenfield" ? "greenfield" : "brownfield"} size="xs" />
              <StatusBadge status={project.status} size="xs" />
              {aiConfigured !== null && (
                <span className={`badge text-[10px] ${aiConfigured ? "bg-emerald-900/30 text-emerald-400 border-emerald-500/20" : "bg-surface-800 text-surface-500 border-surface-700"}`}>
                  {aiConfigured ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 anim-pulse" />Live Model</> : <><WifiOff className="w-2.5 h-2.5" />Simulation</>}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={fetchData} className="btn btn-ghost btn-icon" data-tip="Refresh (F5)">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowSettings(true)} className="btn btn-ghost btn-icon" data-tip="AI Settings">
            <KeyRound className="w-4 h-4" />
          </button>
          <button onClick={() => window.location.href = `/api/projects/${projectId}/download`} className="btn btn-secondary btn-sm">
            <Download className="w-3.5 h-3.5" />
            Download
          </button>
          {!isComplete && (
            <>
              <button onClick={() => simulateStep()} disabled={simulating || autoRun} className="btn btn-secondary btn-sm" data-tip="Single step (R)">
                <StepForward className="w-3.5 h-3.5" />
                Step
              </button>
              <button
                onClick={() => setAutoRun(!autoRun)}
                className={`btn btn-sm font-semibold ${autoRun ? "bg-red-600 hover:bg-red-500 text-white" : "btn-primary"}`}
                data-tip={autoRun ? "Pause (Space)" : "Auto run (Space)"}
              >
                {autoRun ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {autoRun ? "Pause" : "Run"}
              </button>
            </>
          )}
          <div className="relative">
            <button className="btn btn-ghost btn-icon" onClick={() => setShowActions(!showActions)}>
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {showActions && (
              <div className="absolute right-0 top-full mt-1.5 glass-panel rounded-xl p-1 min-w-[160px] z-50 shadow-2xl anim-scale">
                <button className="btn btn-ghost w-full justify-start text-xs" onClick={() => { setEditingName(true); setShowActions(false); }}>
                  <Pencil className="w-3.5 h-3.5" />Rename project
                </button>
                <button className="btn btn-ghost w-full justify-start text-xs" onClick={handleDuplicate}>
                  <Copy className="w-3.5 h-3.5" />Duplicate project
                </button>
                <button className="btn btn-ghost w-full justify-start text-xs" onClick={() => { setShowResetConfirm(true); setShowActions(false); }}>
                  <RotateCcw className="w-3.5 h-3.5" />Reset pipeline
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── HITL alert ─────────────────────────────────────────────────── */}
      {pendingHitl.length > 0 && (
        <button
          onClick={() => setSection("hitl")}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-900/15 border border-amber-500/25 text-amber-300 text-sm anim-glow hover:bg-amber-900/25 transition-colors anim-up"
        >
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <div className="flex-1 text-left">
            <span className="font-semibold">{pendingHitl.length} approval{pendingHitl.length > 1 ? "s" : ""} waiting</span>
            <span className="text-amber-400/70 ml-2 text-xs">— Pipeline is paused until you review</span>
          </div>
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* ─── Progress bar ─────────────────────────────────────────────── */}
      <div className="panel p-3">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-surface-500">{isComplete ? "✅ Complete" : autoRun ? "🤖 Running…" : "Pipeline progress"}</span>
              <span className="text-surface-300 tabular-nums">{project.completedTasks ?? 0}/{project.totalTasks ?? 0} tasks · {progress}%</span>
            </div>
            <ProgressBar value={progress} variant={isComplete ? "success" : autoRun ? "primary" : "primary"} showLabel={false} />
          </div>
        </div>
      </div>

      {/* ─── File search bar (shows when fileSearch non-empty) ─────────── */}
      {section === "workspace" && (
        <div className="flex items-center gap-2 panel px-3 py-2">
          <Search className="w-4 h-4 text-surface-500 flex-shrink-0" />
          <input
            value={fileSearch}
            onChange={(e) => setFileSearch(e.target.value)}
            placeholder="Search in files… (function name, import, CSS class, SQL column…)"
            className="flex-1 bg-transparent text-sm outline-none text-surface-200 placeholder-surface-600"
          />
          {searching && <Spinner size={14} />}
          {fileSearch && <button onClick={() => { setFileSearch(""); setFileSearchResults([]); }} className="btn btn-ghost btn-xs"><X className="w-3 h-3" /></button>}
        </div>
      )}

      {/* File search results */}
      {fileSearch.length >= 2 && fileSearchResults.length > 0 && section === "workspace" && (
        <div className="panel overflow-hidden max-h-60 overflow-y-auto anim-fade">
          <div className="panel-header">
            <span className="panel-title">{fileSearchResults.length} files match &ldquo;{fileSearch}&rdquo;</span>
          </div>
          {fileSearchResults.map((r) => (
            <div key={r.fileId} className="px-3 py-2 border-b border-surface-800/50">
              <p className="text-xs font-mono text-primary-300">{r.path}</p>
              {r.matches.map((m, idx) => (
                <p key={idx} className="text-xs text-surface-500 mono mt-0.5 truncate">
                  {m.line > 0 && <span className="text-surface-700 mr-2">:{m.line}</span>}
                  {m.text}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ─── Layout: sidebar + main ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[208px_1fr] gap-4">
        {/* Sidebar */}
        <nav className="flex flex-col gap-0.5 lg:pt-0">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`sidebar-link ${section === s.id ? "active" : ""}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{s.label}</span>
                {s.badge !== undefined && s.badge > 0 ? (
                  <span className="text-[9px] font-bold bg-amber-500 text-black rounded-full w-4 h-4 flex items-center justify-center">
                    {s.badge}
                  </span>
                ) : s.count !== undefined && s.count > 0 ? (
                  <span className="text-[10px] text-surface-600 tabular-nums">{s.count}</span>
                ) : null}
              </button>
            );
          })}
          {/* Keyboard hints */}
          <div className="mt-auto pt-4 px-2 text-[10px] text-surface-700 leading-5">
            <p><kbd>R</kbd> step · <kbd>Space</kbd> auto · <kbd>Esc</kbd> pause</p>
            <p><kbd>W</kbd> workspace · <kbd>T</kbd> terminal</p>
          </div>
        </nav>

        {/* Main content */}
        <div className="min-w-0 min-h-[600px]">
          {section === "overview" && (
            <OverviewSection
              project={project}
              agents={agentsList}
              tasks={tasksList}
              fileNodes={fileNodes}
              dbTables={dbTables}
              envVars={envVars}
              pendingHitl={pendingHitl.length}
              onNavigate={setSection}
            />
          )}

          {section === "workspace" && (
            <div className="h-[calc(100vh-300px)] min-h-[600px]">
              <CodeWorkspace
                projectId={projectId}
                projectName={project.name}
                fileNodes={fileNodes}
                onOpenSettings={() => setShowSettings(true)}
                onRefresh={fetchData}
              />
            </div>
          )}

          {section === "orchestration" && (
            <div className="space-y-4">
              <AgentGraph agents={agentsList} tasks={tasksList} mode={project.mode} />
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {agentsList.map((a) => <AgentCard key={a.id} agent={a} />)}
              </div>
            </div>
          )}

          {section === "database" && (
            <div className="h-[calc(100vh-300px)] min-h-[520px]">
              <DatabaseViewer tables={dbTables} />
            </div>
          )}

          {section === "env" && (
            <div className="h-[calc(100vh-300px)] min-h-[520px]">
              <EnvironmentVariables projectId={projectId} envVars={envVars} onRefresh={fetchData} />
            </div>
          )}

          {section === "hitl" && (
            <div className="h-[calc(100vh-300px)] min-h-[520px]">
              <HitlCheckpoints checkpoints={hitlList} onApprove={handleApprove} onReject={handleReject} />
            </div>
          )}

          {section === "tasks" && <TasksTable tasks={tasksList} agents={agentsList} />}

          {section === "terminal" && (
            <div className="h-[calc(100vh-300px)] min-h-[520px]">
              <Terminal commands={commands} />
            </div>
          )}

          {section === "timeline" && (
            <TimelineView messages={messages} agents={agentsList} />
          )}

          {section === "stats" && <ProjectStats projectId={projectId} />}
        </div>
      </div>

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} onSaved={checkAi} />

      <ConfirmDialog
        open={showResetConfirm}
        title="Reset pipeline?"
        message="All agent progress, task states, and activity messages will be cleared. Generated files and DB schema are preserved. Are you sure?"
        confirmLabel="Reset"
        danger
        onConfirm={handleReset}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  );
}

// ─── Export wrapper with ToastProvider ───────────────────────────────────────

export default function ProjectDashboard(props: ProjectDashboardProps) {
  return (
    <ToastProvider>
      <DashboardInner {...props} />
    </ToastProvider>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────

function OverviewSection({
  project, agents, tasks, fileNodes, dbTables, envVars, pendingHitl, onNavigate,
}: {
  project: ProjectData["project"];
  agents: ProjectData["agents"];
  tasks: ProjectData["tasks"];
  fileNodes: FileNode[];
  dbTables: ProjectData["dbTables"];
  envVars: ProjectData["envVars"];
  pendingHitl: number;
  onNavigate: (s: SectionId) => void;
}) {
  const completedTasks = tasks.filter(t => t.status === "completed").length;
  const workingAgents = agents.filter(a => a.status === "working").length;

  const stats: Array<{ label: string; value: number | string; sub: string; section: SectionId; gradient: string }> = [
    { label: "Files",       value: fileNodes.filter(f => f.type === "file").length, sub: `${fileNodes.filter(f => f.type === "directory").length} directories`, section: "workspace",     gradient: "from-blue-500 to-cyan-500" },
    { label: "Agents live", value: workingAgents,                                    sub: `${agents.length} total`,                                             section: "orchestration", gradient: "from-primary-500 to-violet-500" },
    { label: "DB Tables",   value: dbTables.length,                                  sub: `${dbTables.reduce((s, t) => s + (t.columns?.length ?? 0), 0)} cols`, section: "database",      gradient: "from-emerald-500 to-teal-500" },
    { label: "Env Vars",    value: envVars.length,                                   sub: `${envVars.filter(e => e.isSecret).length} encrypted`,                section: "env",           gradient: "from-amber-500 to-orange-500" },
    { label: "Tasks done",  value: `${completedTasks}/${tasks.length}`,              sub: `${tasks.filter(t => t.status === "in_progress").length} in flight`,  section: "tasks",         gradient: "from-rose-500 to-pink-500" },
    { label: "Approvals",   value: pendingHitl,                                      sub: pendingHitl > 0 ? "Review to unblock" : "Nothing pending",            section: "hitl",          gradient: pendingHitl > 0 ? "from-amber-500 to-red-500" : "from-surface-600 to-surface-700" },
  ];

  return (
    <div className="space-y-4 anim-up">
      {/* Prompt card */}
      <div className="panel p-4">
        <p className="label mb-2">Original prompt</p>
        <p className="text-sm text-surface-200 leading-relaxed">{project.prompt}</p>
        {project.description && <p className="text-xs text-surface-500 mt-2">{project.description}</p>}
        {project.techStack && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-surface-800">
            {Object.entries(project.techStack).map(([k, v]) => (
              <span key={k} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-800 text-surface-400 border border-surface-700">
                <span className="text-surface-600 uppercase">{k}:</span> {v}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {stats.map((s) => (
          <button key={s.label} onClick={() => onNavigate(s.section)}
            className="glass-card text-left p-4 group hover:scale-[1.015] transition-all active:scale-100">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${s.gradient} flex items-center justify-center mb-3 shadow-lg`}>
              <span className="text-white text-xs font-bold">
                {typeof s.value === "number" ? s.value : s.value.toString().split("/")[0]}
              </span>
            </div>
            <p className="text-xl font-bold text-surface-100 group-hover:text-primary-300 transition-colors">{s.value}</p>
            <p className="text-xs text-surface-500 mt-0.5 capitalize">{s.label}</p>
            <p className="text-[10px] text-surface-600 mt-1">{s.sub}</p>
          </button>
        ))}
      </div>

      {/* Agent status mini grid */}
      <div className="panel p-4">
        <p className="label mb-3">Crew status</p>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {agents.map((agent) => {
            const def = AGENT_DEFINITIONS[agent.role as AgentRoleId];
            const dotClass = agent.status === "working" ? "dot-working" : agent.status === "completed" ? "dot-complete" : agent.status === "failed" ? "dot-failed" : "dot-idle";
            return (
              <button key={agent.id} onClick={() => onNavigate("orchestration")}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-surface-800 bg-surface-900/40 hover:border-primary-500/30 transition-all">
                <span className="text-xl">{def.emoji}</span>
                <span className="text-[10px] text-surface-400 text-center leading-tight font-medium">{def.name}</span>
                <div className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${dotClass} ${agent.status === "working" ? "anim-pulse" : ""}`} />
                  <span className="text-[9px] text-surface-600 capitalize">{agent.status}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Tasks table ──────────────────────────────────────────────────────────────

function TasksTable({ tasks, agents }: { tasks: ProjectData["tasks"]; agents: ProjectData["agents"] }) {
  const [filter, setFilter] = useState<"all" | "pending" | "in_progress" | "completed" | "failed">("all");
  const filtered = tasks.filter(t => filter === "all" || t.status === filter);

  if (tasks.length === 0) return <EmptyState icon={ListChecks} title="No tasks yet" description="Tasks appear once the orchestrator decomposes the requirements." />;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "pending", "in_progress", "completed", "failed"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`btn btn-xs capitalize ${filter === f ? "btn-primary" : "btn-secondary"}`}>
            {f.replace("_", " ")} ({f === "all" ? tasks.length : tasks.filter(t => t.status === f).length})
          </button>
        ))}
      </div>
      <div className="panel overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Task</th>
              <th>Agent</th>
              <th>Priority</th>
              <th>Completed</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((task) => {
              const agent = agents.find(a => a.id === task.agentId);
              const def = agent ? AGENT_DEFINITIONS[agent.role as AgentRoleId] : null;
              return (
                <tr key={task.id}>
                  <td><StatusBadge status={task.status} size="xs" /></td>
                  <td>
                    <p className="text-surface-100 text-sm font-medium">{task.title}</p>
                    {task.description && <p className="text-xs text-surface-500 mt-0.5 max-w-sm line-clamp-1">{task.description}</p>}
                  </td>
                  <td>
                    {def && <span className="text-xs text-surface-400">{def.emoji} {def.name}</span>}
                  </td>
                  <td><span className="mono text-xs text-surface-600">#{task.priority}</span></td>
                  <td>
                    {task.completedAt ? (
                      <span className="text-xs text-surface-600">{new Date(task.completedAt).toLocaleTimeString()}</span>
                    ) : (
                      <span className="text-surface-700 text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

function TimelineView({ messages, agents }: { messages: ProjectData["messages"]; agents: ProjectData["agents"] }) {
  if (messages.length === 0) return <EmptyState icon={History} title="No activity yet" description="Agent thoughts, tool calls, and completions appear here as they happen." />;
  return (
    <div className="panel p-5 space-y-4 max-h-[70vh] overflow-y-auto scroll">
      {messages.map((msg, idx) => {
        const agent = agents.find(a => a.id === msg.agentId);
        const def = agent ? AGENT_DEFINITIONS[agent.role as AgentRoleId] : null;
        return (
          <div key={msg.id} className="flex gap-3 anim-up">
            {idx < messages.length - 1 && (
              <div className="absolute" style={{ left: "28px", height: "calc(100% + 16px)", top: "32px" }} />
            )}
            <div className="w-8 h-8 rounded-xl bg-surface-800 border border-surface-700 flex items-center justify-center flex-shrink-0 text-sm">
              {msg.role === "system" ? "🔔" : def?.emoji ?? "🤖"}
            </div>
            <div className="flex-1 min-w-0 pb-4 border-b border-surface-800/40 last:border-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-surface-200">{def?.name ?? "System"}</span>
                <span className="badge text-[9px] bg-surface-800 text-surface-600 border-surface-700">{msg.role}</span>
                <span className="text-[10px] text-surface-600 ml-auto">{new Date(msg.createdAt).toLocaleTimeString()}</span>
              </div>
              <p className="text-sm text-surface-400 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
