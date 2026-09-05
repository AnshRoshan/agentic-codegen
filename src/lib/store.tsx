import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Project, WorkspaceData } from "./types";
import { bootstrapProject, resolveCheckpoint, runStep } from "./orchestrator";
import { PRESETS } from "./domains";

export type View = "landing" | "dashboard" | "workspace" | "models" | "skills" | "settings";
export type WorkspaceTab = "overview" | "pipeline" | "files" | "database" | "env" | "approvals" | "terminal" | "activity" | "insights";

interface Settings { provider: string; model: string; apiKey: string; autoApproveDefault: boolean; }

interface StoreShape {
  view: View; setView: (v: View) => void;
  projects: Project[];
  workspaces: Record<string, WorkspaceData>;
  activeId: string | null; setActiveId: (id: string | null) => void;
  wtab: WorkspaceTab; setWtab: (t: WorkspaceTab) => void;
  settings: Settings; updateSettings: (p: Partial<Settings>) => void;
  running: Record<string, boolean>;
  createProject: (name: string, prompt: string, opts?: { emoji?: string; autoApprove?: boolean; mode?: "greenfield" | "brownfield" }) => string;
  createFromPreset: (presetIdx: number) => string;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => void;
  resetProject: (id: string) => void;
  toggleAutoApprove: (id: string) => void;
  startPipeline: (id: string) => void;
  pausePipeline: (id: string) => void;
  stepOnce: (id: string) => void;
  approve: (pid: string, cpId: string, note?: string) => void;
  reject: (pid: string, cpId: string, note?: string) => void;
  addEnv: (pid: string, key: string, value: string) => void;
  deleteEnv: (pid: string, envId: string) => void;
  updateFile: (pid: string, path: string, content: string) => void;
  toast: string | null;
}

const StoreCtx = createContext<StoreShape | null>(null);

const LS_KEY = "forge-v2-store";

function loadPersisted(): { projects: Project[]; workspaces: Record<string, WorkspaceData>; settings: Settings } | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function seedDemo(): { projects: Project[]; workspaces: Record<string, WorkspaceData> } {
  // One mid-run demo project so the dashboard never looks empty on first visit
  const { project, ws } = bootstrapProject(
    "Sales CRM", PRESETS[0].prompt, "greenfield", "🤝", false, "prj_demo_crm"
  );
  // Run 4 steps instantly so the demo shows pipeline progress + files
  let p = project; let w = ws;
  for (let i = 0; i < 4; i++) {
    const r = runStep(p, w);
    p = r.project; w = r.ws;
    if (r.outcome.waiting || r.outcome.done) break;
  }
  return { projects: [p], workspaces: { [p.id]: w } };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<View>("landing");
  const [projects, setProjects] = useState<Project[]>([]);
  const [workspaces, setWorkspaces] = useState<Record<string, WorkspaceData>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [wtab, setWtab] = useState<WorkspaceTab>("overview");
  const [settings, setSettings] = useState<Settings>({ provider: "openai", model: "gpt-4.1-mini", apiKey: "", autoApproveDefault: false });
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const hydrated = useRef(false);

  // Hydrate
  useEffect(() => {
    const persisted = loadPersisted();
    if (persisted && persisted.projects.length > 0) {
      setProjects(persisted.projects);
      setWorkspaces(persisted.workspaces);
      setSettings(persisted.settings);
      setView("dashboard");
    } else {
      const demo = seedDemo();
      setProjects(demo.projects);
      setWorkspaces(demo.workspaces);
    }
    hydrated.current = true;
  }, []);

  // Persist
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ projects, workspaces, settings }));
    } catch { /* quota */ }
  }, [projects, workspaces, settings]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }, []);

  const projectsRef = useRef(projects);
  projectsRef.current = projects;
  const workspacesRef = useRef(workspaces);
  workspacesRef.current = workspaces;

  const applyStep = useCallback((id: string): boolean => {
    // Compute synchronously from refs so the loop knows whether to continue.
    const p = projectsRef.current.find((x) => x.id === id);
    const ws = workspacesRef.current[id];
    if (!p || !ws) return false;
    if (p.currentStep >= p.totalSteps) {
      setRunning((r) => ({ ...r, [id]: false }));
      return false;
    }
    const { project: np, ws: nws, outcome } = runStep(p, ws);
    setProjects((prev) => prev.map((x) => (x.id === id ? np : x)));
    setWorkspaces((wprev) => ({ ...wprev, [id]: nws }));
    if (outcome.waiting) {
      setRunning((r) => ({ ...r, [id]: false }));
      showToast("Waiting for approval — review the checkpoint");
      return false;
    }
    if (outcome.done) {
      setRunning((r) => ({ ...r, [id]: false }));
      showToast(`Pipeline complete — ${np.generatedFiles} files generated`);
      return false;
    }
    return true;
  }, [showToast]);

  const loop = useCallback((id: string) => {
    if (timers.current[id]) clearTimeout(timers.current[id]);
    const tick = () => {
      const cont = applyStep(id);
      if (cont) {
        timers.current[id] = setTimeout(tick, 1500);
      } else {
        setRunning((r) => ({ ...r, [id]: false }));
      }
    };
    timers.current[id] = setTimeout(tick, 900);
  }, [applyStep]);

  const startPipeline = useCallback((id: string) => {
    setRunning((r) => ({ ...r, [id]: true }));
    setProjects((prev) => prev.map((p) => p.id === id && p.status === "draft"
      ? { ...p, status: "planning" as const, startedAt: p.startedAt ?? new Date().toISOString() } : p));
    loop(id);
    showToast("Pipeline started");
  }, [loop, showToast]);

  const pausePipeline = useCallback((id: string) => {
    if (timers.current[id]) clearTimeout(timers.current[id]);
    setRunning((r) => ({ ...r, [id]: false }));
    setProjects((prev) => prev.map((p) => p.id === id ? { ...p, status: "paused" as const } : p));
    showToast("Pipeline paused");
  }, [showToast]);

  const stepOnce = useCallback((id: string) => {
    applyStep(id);
  }, [applyStep]);

  const createProject = useCallback((name: string, prompt: string, opts?: { emoji?: string; autoApprove?: boolean; mode?: "greenfield" | "brownfield" }) => {
    const { project, ws } = bootstrapProject(
      name || "Untitled project", prompt,
      opts?.mode ?? "greenfield", opts?.emoji ?? "✨",
      opts?.autoApprove ?? settings.autoApproveDefault,
    );
    setProjects((p) => [project, ...p]);
    setWorkspaces((w) => ({ ...w, [project.id]: ws }));
    setActiveId(project.id);
    setWtab("overview");
    setView("workspace");
    showToast(`Project "${project.name}" created`);
    return project.id;
  }, [settings.autoApproveDefault, showToast]);

  const createFromPreset = useCallback((presetIdx: number) => {
    const preset = PRESETS[presetIdx];
    return createProject(preset.name, preset.prompt, { emoji: preset.emoji });
  }, [createProject]);

  const deleteProject = useCallback((id: string) => {
    if (timers.current[id]) clearTimeout(timers.current[id]);
    setProjects((p) => p.filter((x) => x.id !== id));
    setWorkspaces((w) => { const n = { ...w }; delete n[id]; return n; });
    setRunning((r) => { const n = { ...r }; delete n[id]; return n; });
    if (activeId === id) { setActiveId(null); setView("dashboard"); }
    showToast("Project deleted");
  }, [activeId, showToast]);

  const duplicateProject = useCallback((id: string) => {
    const p = projects.find((x) => x.id === id);
    const ws = workspaces[id];
    if (!p || !ws) return;
    const copyId = `prj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const copy: Project = { ...JSON.parse(JSON.stringify(p)), id: copyId, name: `${p.name} (copy)`, createdAt: now, updatedAt: now };
    const wsCopy: WorkspaceData = JSON.parse(JSON.stringify(ws));
    for (const arr of [wsCopy.agents, wsCopy.tasks, wsCopy.files, wsCopy.tables, wsCopy.env, wsCopy.checkpoints, wsCopy.commands, wsCopy.messages, wsCopy.llmCalls] as Array<Array<{ projectId: string }>>) {
      for (const item of arr) item.projectId = copyId;
    }
    setProjects((prev) => [copy, ...prev]);
    setWorkspaces((w) => ({ ...w, [copyId]: wsCopy }));
    showToast(`Duplicated as "${copy.name}"`);
  }, [projects, workspaces, showToast]);

  const resetProject = useCallback((id: string) => {
    const p = projects.find((x) => x.id === id);
    if (!p) return;
    if (timers.current[id]) clearTimeout(timers.current[id]);
    setRunning((r) => ({ ...r, [id]: false }));
    const { project, ws } = bootstrapProject(p.name, p.prompt, p.mode, p.emoji, p.autoApprove, p.id);
    project.createdAt = p.createdAt;
    setProjects((prev) => prev.map((x) => x.id === id ? project : x));
    setWorkspaces((w) => ({ ...w, [id]: ws }));
    showToast("Project reset to draft");
  }, [projects, showToast]);

  const toggleAutoApprove = useCallback((id: string) => {
    setProjects((prev) => prev.map((p) => p.id === id ? { ...p, autoApprove: !p.autoApprove } : p));
  }, []);

  const approve = useCallback((pid: string, cpId: string, note?: string) => {
    const p = projects.find((x) => x.id === pid);
    const ws = workspaces[pid];
    if (!p || !ws) return;
    const { project, ws: nws } = resolveCheckpoint(p, ws, cpId, "approved", note);
    setProjects((prev) => prev.map((x) => x.id === pid ? project : x));
    setWorkspaces((w) => ({ ...w, [pid]: nws }));
    if (project.status === "completed") {
      setRunning((r) => ({ ...r, [pid]: false }));
      showToast(`Pipeline complete — ${project.generatedFiles} files generated`);
    } else {
      showToast("Approved — resuming pipeline");
      setRunning((r) => ({ ...r, [pid]: true }));
      loop(pid);
    }
  }, [projects, workspaces, loop, showToast]);

  const reject = useCallback((pid: string, cpId: string, note?: string) => {
    const p = projects.find((x) => x.id === pid);
    const ws = workspaces[pid];
    if (!p || !ws) return;
    const { project, ws: nws } = resolveCheckpoint(p, ws, cpId, "rejected", note);
    setProjects((prev) => prev.map((x) => x.id === pid ? project : x));
    setWorkspaces((w) => ({ ...w, [pid]: nws }));
    if (project.status === "completed") {
      setRunning((r) => ({ ...r, [pid]: false }));
      showToast("Pipeline finished — deploy skipped by reviewer");
    } else {
      showToast("Rejected — step skipped, resuming");
      setRunning((r) => ({ ...r, [pid]: true }));
      loop(pid);
    }
  }, [projects, workspaces, loop, showToast]);

  const addEnv = useCallback((pid: string, key: string, value: string) => {
    setWorkspaces((w) => {
      const ws = w[pid]; if (!ws) return w;
      return { ...w, [pid]: { ...ws, env: [...ws.env, { id: `env_${Date.now()}`, projectId: pid, key, value, description: "Added manually", isSecret: /SECRET|KEY|TOKEN|PASSWORD/i.test(key), isRequired: true, source: "user" as const }] } };
    });
  }, []);

  const deleteEnv = useCallback((pid: string, envId: string) => {
    setWorkspaces((w) => {
      const ws = w[pid]; if (!ws) return w;
      return { ...w, [pid]: { ...ws, env: ws.env.filter((e) => e.id !== envId) } };
    });
  }, []);

  const updateFile = useCallback((pid: string, path: string, content: string) => {
    setWorkspaces((w) => {
      const ws = w[pid]; if (!ws) return w;
      return {
        ...w, [pid]: {
          ...ws,
          files: ws.files.map((f) => f.path === path ? { ...f, content, size: content.length, version: f.version + 1, isModified: true, updatedAt: new Date().toISOString() } : f),
        },
      };
    });
  }, []);

  const updateSettings = useCallback((p: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...p }));
  }, []);

  const value = useMemo<StoreShape>(() => ({
    view, setView, projects, workspaces, activeId, setActiveId,
    wtab, setWtab, settings, updateSettings, running,
    createProject, createFromPreset, deleteProject, duplicateProject,
    resetProject, toggleAutoApprove, startPipeline, pausePipeline,
    stepOnce, approve, reject, addEnv, deleteEnv, updateFile, toast,
  }), [view, projects, workspaces, activeId, wtab, settings, running, toast,
    createProject, createFromPreset, deleteProject, duplicateProject, resetProject,
    toggleAutoApprove, startPipeline, pausePipeline, stepOnce, approve, reject,
    addEnv, deleteEnv, updateFile, updateSettings]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): StoreShape {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
