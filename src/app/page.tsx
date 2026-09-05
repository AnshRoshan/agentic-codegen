"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Toaster, toast } from "sonner";
import CreateProjectModal from "@/components/CreateProjectModal";
import ProjectDashboard from "@/components/ProjectDashboard";
import ArchitectureView from "@/components/ArchitectureView";
import SettingsModal from "@/components/SettingsModal";
import CommandPalette from "@/components/CommandPalette";
import ActivityFeed from "@/components/ActivityFeed";
import HeroScene from "@/components/motion/HeroScene";
import AnimatedNumber from "@/components/motion/AnimatedNumber";
import { FadeIn, Stagger, StaggerItem, TiltCard, Magnetic } from "@/components/motion/primitives";
import { StatusBadge, ProgressBar, EmptyState } from "@/components/ui";
import { PRESETS, domainIcon } from "@/lib/templates";
import {
  KeyRound, Sparkles, WifiOff, Plus, Rocket, FolderKanban, BookOpen,
  Trash2, Search, Filter, Bot, Layers, Shield, Zap, Command,
  Activity, DollarSign, Cpu, TrendingUp, Files, Terminal as TerminalIcon,
} from "lucide-react";

interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  mode: string;
  status: string;
  prompt: string;
  templateId: string | null;
  totalTasks: number | null;
  completedTasks: number | null;
  generatedFiles: number | null;
  createdAt: string;
  totalCostUsd?: string | null;
  totalTokensIn?: number | null;
  totalTokensOut?: number | null;
  totalLlmCalls?: number | null;
}

interface StudioMetrics {
  projects: { total: number; completed: number; running: number; failed: number; awaiting: number };
  agents: { total: number; working: number };
  tasks: { total: number; completed: number };
  files: { total: number; totalBytes: number };
  commands: { total: number; completed: number };
  llm: { totalCalls: number; totalTokensIn: number; totalTokensOut: number; totalTokens: number; totalCostUsd: number; cacheHits: number };
}

type View = "projects" | "architecture" | { type: "project"; id: string };

export default function Home() {
  const [view, setView] = useState<View>("projects");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [metrics, setMetrics] = useState<StudioMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCmdk, setShowCmdk] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState<string | undefined>();
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [aiInfo, setAiInfo] = useState<{ provider: string; model: string | null } | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) setProjects(await res.json());
    } finally { setLoading(false); }
  }, []);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch("/api/metrics");
      if (res.ok) setMetrics(await res.json());
    } catch { /* ignore */ }
  }, []);

  const checkAi = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/ai");
      const j = await res.json();
      setAiConfigured(Boolean(j.isConfigured));
      setAiInfo({ provider: j.provider, model: j.model });
    } catch { setAiConfigured(false); }
  }, []);

  useEffect(() => {
    fetchProjects();
    fetchMetrics();
    checkAi();
  }, [fetchProjects, fetchMetrics, checkAi]);

  // Poll metrics every 5s when on projects view
  useEffect(() => {
    if (view !== "projects") return;
    const t = setInterval(() => { fetchMetrics(); fetchProjects(); }, 5000);
    return () => clearInterval(t);
  }, [view, fetchMetrics, fetchProjects]);

  const deleteProject = async (id: string) => {
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    toast.success("Project deleted");
    fetchProjects();
    fetchMetrics();
  };

  const openNewProject = (prompt?: string) => {
    setInitialPrompt(prompt);
    setShowCreateModal(true);
  };

  const currentKey = typeof view === "object" ? `project-${view.id}` : view;

  return (
    <div className="min-h-screen">
      <Toaster position="bottom-right" theme="dark" richColors closeButton />

      {/* ─── Top nav ─────────────────────────────────────────────────────── */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="sticky top-0 z-40 glass border-b border-surface-800/50"
      >
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 min-w-0">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setView("projects")}
              className="flex items-center gap-2.5 flex-shrink-0"
            >
              <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 via-violet-500 to-cyan-500 anim-gradient flex items-center justify-center shadow-lg shadow-primary-500/30">
                <span className="text-white text-xs font-bold">E</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-surface-100 font-bold">EDL</span>
                <span className="text-surface-500 text-xs hide-mobile">Agentic Studio</span>
              </div>
            </motion.button>
            <nav className="flex items-center gap-1">
              <NavButton active={view === "projects"} onClick={() => setView("projects")}>
                <FolderKanban className="w-3.5 h-3.5" />Projects
              </NavButton>
              <NavButton active={view === "architecture"} onClick={() => setView("architecture")}>
                <BookOpen className="w-3.5 h-3.5" />Architecture
              </NavButton>
            </nav>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowCmdk(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-surface-800 bg-surface-900/40 text-surface-500 hover:text-surface-300 hover:border-surface-700 transition-all"
            >
              <Search className="w-3 h-3" />
              <span>Quick search…</span>
              <kbd>⌘K</kbd>
            </button>
            {aiConfigured !== null && (
              <button
                onClick={() => setShowSettingsModal(true)}
                className={`hide-mobile flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border transition-all ${
                  aiConfigured
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                    : "bg-surface-800 border-surface-700 text-surface-400 hover:bg-surface-700"
                }`}
              >
                {aiConfigured ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 anim-pulse" />
                    <span className="font-medium">{aiInfo?.model?.slice(0, 20)}</span>
                  </>
                ) : (
                  <><WifiOff className="w-3 h-3" />Simulation</>
                )}
              </button>
            )}
            <button onClick={() => setShowSettingsModal(true)} className="btn btn-ghost btn-icon" title="AI Settings">
              <KeyRound className="w-4 h-4" />
            </button>
            <Magnetic>
              <button onClick={() => openNewProject()} className="btn btn-primary btn-sm">
                <Plus className="w-3.5 h-3.5" />New Project
              </button>
            </Magnetic>
          </div>
        </div>
      </motion.header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            {view === "projects" && (
              <ProjectsListView
                projects={projects}
                metrics={metrics}
                loading={loading}
                aiConfigured={aiConfigured}
                onSelect={(id) => setView({ type: "project", id })}
                onDelete={deleteProject}
                onNewProject={openNewProject}
                onOpenSettings={() => setShowSettingsModal(true)}
              />
            )}

            {view === "architecture" && <ArchitectureView />}

            {typeof view === "object" && view.type === "project" && (
              <ProjectDashboard
                projectId={view.id}
                onBack={() => { setView("projects"); fetchProjects(); fetchMetrics(); }}
                onDuplicated={(newId) => { fetchProjects(); setView({ type: "project", id: newId }); }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <CreateProjectModal
        open={showCreateModal}
        initialPrompt={initialPrompt}
        onClose={() => { setShowCreateModal(false); setInitialPrompt(undefined); }}
        onCreated={() => { fetchProjects(); fetchMetrics(); toast.success("Project generated"); }}
      />

      <SettingsModal open={showSettingsModal} onClose={() => setShowSettingsModal(false)} onSaved={checkAi} />

      <CommandPalette
        open={showCmdk}
        onOpenChange={setShowCmdk}
        projects={projects}
        onSelectProject={(id) => setView({ type: "project", id })}
        onNewProject={openNewProject}
        onNavigate={(v) => v === "settings" ? setShowSettingsModal(true) : setView(v)}
        onOpenSettings={() => setShowSettingsModal(true)}
      />

      {view === "projects" && projects.length > 0 && (
        <ActivityFeed onSelectProject={(id) => setView({ type: "project", id })} />
      )}
    </div>
  );
}

function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
        active ? "text-surface-100 font-medium" : "text-surface-400 hover:text-surface-100"
      }`}
    >
      {active && (
        <motion.div
          layoutId="nav-pill"
          className="absolute inset-0 bg-surface-800/80 rounded-lg"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      <span className="relative flex items-center gap-1.5">{children}</span>
    </button>
  );
}

// ─── Projects list view ──────────────────────────────────────────────────────

function ProjectsListView({
  projects, metrics, loading, aiConfigured, onSelect, onDelete, onNewProject, onOpenSettings,
}: {
  projects: ProjectSummary[];
  metrics: StudioMetrics | null;
  loading: boolean;
  aiConfigured: boolean | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNewProject: (prompt?: string) => void;
  onOpenSettings: () => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = projects.filter((p) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.prompt.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* ─── HERO ─────────────────────────────────────────────────────── */}
      <Hero
        aiConfigured={aiConfigured}
        onNewProject={() => onNewProject()}
        onOpenSettings={onOpenSettings}
      />

      {/* ─── LIVE METRICS BAND ────────────────────────────────────────── */}
      {metrics && projects.length > 0 && <MetricsBand metrics={metrics} />}

      {/* ─── TEMPLATE GALLERY (only when empty) ───────────────────────── */}
      {projects.length === 0 && (
        <FadeIn delay={0.2}>
          <div>
            <div className="flex items-baseline justify-between mb-5">
              <div>
                <h2 className="text-xl font-semibold text-surface-100">Start with a preset</h2>
                <p className="text-sm text-surface-500 mt-1">Or describe any application in plain language — the engine handles the rest.</p>
              </div>
            </div>
            <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {PRESETS.map((preset) => (
                <StaggerItem key={preset.id}>
                  <TiltCard>
                    <button
                      onClick={() => onNewProject(preset.prompt)}
                      className={`group relative w-full text-left p-5 rounded-2xl border border-surface-800 bg-gradient-to-br ${preset.gradient} overflow-hidden hover:border-primary-500/40 transition-all`}
                    >
                      <div className="absolute inset-0 bg-dots opacity-20" />
                      <div className="relative">
                        <div className="text-3xl mb-3">{preset.emoji}</div>
                        <h3 className="font-semibold text-surface-100 mb-1">{preset.name}</h3>
                        <p className="text-xs text-surface-400 line-clamp-2 mb-3">{preset.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {preset.tags.map((tag) => (
                            <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-900/60 text-surface-300 border border-surface-700/50">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </button>
                  </TiltCard>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </FadeIn>
      )}

      {/* ─── PROJECTS ─────────────────────────────────────────────────── */}
      {projects.length > 0 && (
        <FadeIn>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div className="flex items-baseline gap-3">
                <h2 className="text-xl font-semibold text-surface-100">Your Projects</h2>
                <span className="text-xs text-surface-500 tabular-nums">
                  {filtered.length} of {projects.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search…"
                    className="input pl-8 pr-3 py-1.5 text-xs w-48"
                  />
                </div>
                <div className="relative">
                  <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-surface-500 pointer-events-none" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="input pl-8 pr-8 py-1.5 text-xs cursor-pointer"
                  >
                    <option value="all">All statuses</option>
                    <option value="planning">Planning</option>
                    <option value="generating">Generating</option>
                    <option value="waiting_approval">Awaiting Approval</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="panel">
                <EmptyState icon={Search} title="No projects match" description="Try clearing the filter or changing search terms." />
              </div>
            ) : (
              <Stagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((p) => (
                  <StaggerItem key={p.id}>
                    <ProjectCard project={p} onSelect={onSelect} onDelete={onDelete} />
                  </StaggerItem>
                ))}
              </Stagger>
            )}
          </div>
        </FadeIn>
      )}
    </div>
  );
}

// ─── Hero with Three.js scene ─────────────────────────────────────────────────

function Hero({
  aiConfigured, onNewProject, onOpenSettings,
}: { aiConfigured: boolean | null; onNewProject: () => void; onOpenSettings: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-surface-800 bg-gradient-to-br from-surface-925 via-surface-950 to-surface-900 min-h-[440px]">
      {/* 3D scene */}
      <div className="absolute inset-0">
        <HeroScene className="w-full h-full opacity-90" />
      </div>

      {/* Radial fade overlay so content is readable */}
      <div className="absolute inset-0 bg-gradient-to-r from-surface-950 via-surface-950/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-transparent to-transparent" />

      <div className="relative p-8 md:p-12 h-full flex flex-col justify-center min-h-[440px]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-2xl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/30 text-xs text-primary-300 mb-5 backdrop-blur-sm"
          >
            <Sparkles className="w-3 h-3" />
            {aiConfigured ? "Live model connected — real code generation" : "Add an AI provider to unlock live generation"}
          </motion.div>

          <h1 className="font-display text-5xl md:text-6xl leading-[0.95] tracking-tight mb-4">
            <span className="text-gradient">Any application,</span>
            <br />
            <span className="text-surface-100">generated by AI agents.</span>
          </h1>

          <p className="text-lg text-surface-400 max-w-xl leading-relaxed mb-8">
            Describe what you want — capacity forecasting, IoT dashboard, CRM, restaurant POS — and a crew of
            specialized agents design the data model, generate production code, run tests, and hand you a deployable app.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Magnetic strength={0.15}>
              <button onClick={onNewProject} className="btn btn-primary" style={{ fontSize: 14, padding: "10px 18px" }}>
                <Rocket className="w-4 h-4" />Start a new project
              </button>
            </Magnetic>
            {!aiConfigured && (
              <button onClick={onOpenSettings} className="btn btn-secondary">
                <KeyRound className="w-4 h-4" />Connect provider
              </button>
            )}
            <div className="text-xs text-surface-500 flex items-center gap-1.5 ml-1">
              <kbd>⌘K</kbd> for anything
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Studio-wide live metrics band ───────────────────────────────────────────

function MetricsBand({ metrics }: { metrics: StudioMetrics }) {
  const stats = [
    { icon: FolderKanban, label: "Projects",    value: metrics.projects.total,        sub: `${metrics.projects.running} running`, color: "text-primary-400" },
    { icon: Cpu,          label: "LLM calls",   value: metrics.llm.totalCalls,        sub: `${metrics.llm.cacheHits} cached`, color: "text-violet-400" },
    { icon: TrendingUp,   label: "Tokens",      value: metrics.llm.totalTokens,       sub: `${Math.round(metrics.llm.totalTokensIn/1000)}k in`, color: "text-cyan-400" },
    { icon: DollarSign,   label: "Total cost",  value: metrics.llm.totalCostUsd,      sub: "across all runs", color: "text-emerald-400", isCurrency: true },
    { icon: Files,        label: "Files gen'd", value: metrics.files.total,           sub: `${Math.round(metrics.files.totalBytes/1024)}KB`, color: "text-amber-400" },
    { icon: TerminalIcon, label: "Commands",    value: metrics.commands.completed,    sub: `${metrics.commands.total} total`, color: "text-rose-400" },
  ];

  return (
    <FadeIn delay={0.1}>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.4 }}
              className="glass-card p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider text-surface-500 font-medium">{s.label}</span>
                <Icon className={`w-3.5 h-3.5 ${s.color}`} />
              </div>
              <div className="text-2xl font-bold text-surface-100 tabular-nums">
                {s.isCurrency ? (
                  <AnimatedNumber value={Number(s.value)} format={(n) => "$" + n.toFixed(3)} />
                ) : (
                  <AnimatedNumber value={Number(s.value)} />
                )}
              </div>
              <p className="text-[10px] text-surface-600 mt-0.5">{s.sub}</p>
            </motion.div>
          );
        })}
      </div>
    </FadeIn>
  );
}

// ─── Project card ────────────────────────────────────────────────────────────

function ProjectCard({
  project: p, onSelect, onDelete,
}: {
  project: ProjectSummary;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const progress = p.totalTasks ? Math.round(((p.completedTasks ?? 0) / p.totalTasks) * 100) : 0;
  const templateEmoji = domainIcon(p.templateId);
  const isActive = ["generating", "planning", "waiting_approval", "building", "testing"].includes(p.status);
  const cost = Number(p.totalCostUsd ?? 0);

  return (
    <TiltCard>
      <div
        onClick={() => onSelect(p.id)}
        className={`group relative rounded-2xl border cursor-pointer overflow-hidden transition-all border-glow ${
          isActive
            ? "border-primary-500/30 bg-gradient-to-br from-surface-900 to-surface-950 shadow-lg shadow-primary-500/5"
            : "border-surface-800 bg-surface-900/50"
        }`}
      >
        <div className="relative p-5">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="text-2xl flex-shrink-0">{templateEmoji}</div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-surface-100 truncate group-hover:text-primary-300 transition-colors">
                  {p.name}
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    p.mode === "greenfield"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  }`}>
                    {p.mode === "greenfield" ? "🌱 New" : "🏗️ Existing"}
                  </span>
                  <StatusBadge status={p.status} size="xs" />
                </div>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete "${p.name}"?`)) onDelete(p.id);
              }}
              className="p-1.5 rounded-lg text-surface-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-xs text-surface-400 line-clamp-2 mb-4 min-h-[2.4em] leading-relaxed">
            {p.prompt}
          </p>

          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-surface-500">Progress</span>
              <span className={progress === 100 ? "text-emerald-400" : "text-surface-300"}>{progress}%</span>
            </div>
            <ProgressBar value={progress} variant={progress === 100 ? "success" : "primary"} />
          </div>

          <div className="flex items-center justify-between text-xs pt-3 border-t border-surface-800">
            <div className="flex items-center gap-3">
              <span className="text-surface-500 flex items-center gap-1">
                <Files className="w-3 h-3" />
                <span className="text-surface-300 font-medium">{p.generatedFiles ?? 0}</span>
              </span>
              {cost > 0 && (
                <span className="text-emerald-400/70 flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  <span className="font-medium tabular-nums">{cost.toFixed(4)}</span>
                </span>
              )}
              {p.totalLlmCalls && p.totalLlmCalls > 0 ? (
                <span className="text-violet-400/70 flex items-center gap-1">
                  <Cpu className="w-3 h-3" />
                  <span className="font-medium tabular-nums">{p.totalLlmCalls}</span>
                </span>
              ) : null}
            </div>
            <span className="text-surface-600 text-[10px]">
              {new Date(p.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          </div>
        </div>

        {isActive && (
          <div className="absolute top-3 right-3 pointer-events-none">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500" />
            </span>
          </div>
        )}
      </div>
    </TiltCard>
  );
}
