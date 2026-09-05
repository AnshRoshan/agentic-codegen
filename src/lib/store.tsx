"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Project, WorkspaceData, FileNode } from "./types";
import { PRESETS } from "./domains";

export type View = "landing" | "dashboard" | "workspace" | "models" | "skills" | "settings";
export type WorkspaceTab = "overview" | "pipeline" | "files" | "database" | "env" | "approvals" | "terminal" | "activity" | "insights";

export interface Settings {
  provider: "openai" | "anthropic" | "google" | "azure" | "custom";
  model: string;
  plannerModel: string | null;
  agentModels: Record<string, string>;
  baseUrl: string | null;
  azureResourceName: string | null;
  azureApiVersion: string | null;
  temperature: number;
  maxStepsPerTask: number;
  maxRetries: number;
  maxRepairIterations: number;
  budgetMicros: number;
  autoApproveDefault: boolean;
  isConfigured: boolean;
  hasApiKey: boolean;
  apiKeyHint: string | null;
  envConfigured: boolean;
  envProvider: string | null;
  lastTestStatus: string | null;
  lastTestMessage: string | null;
  lastTestedAt: string | null;
}

export type SettingsPatch = Partial<Omit<Settings, "isConfigured" | "hasApiKey" | "apiKeyHint" | "envConfigured" | "envProvider" | "lastTestStatus" | "lastTestMessage" | "lastTestedAt">> & { apiKey?: string };

const DEFAULT_SETTINGS: Settings = {
  provider: "openai", model: "gpt-4.1-mini", plannerModel: null, agentModels: {}, baseUrl: null,
  azureResourceName: null, azureApiVersion: null, temperature: 20, maxStepsPerTask: 12, maxRetries: 2,
  maxRepairIterations: 2, budgetMicros: 5_000_000, autoApproveDefault: false, isConfigured: false, hasApiKey: false,
  apiKeyHint: null, envConfigured: false, envProvider: null, lastTestStatus: null, lastTestMessage: null, lastTestedAt: null,
};

interface StoreShape {
  view: View; setView: (v: View) => void;
  projects: Project[];
  workspaces: Record<string, WorkspaceData>;
  activeId: string | null; setActiveId: (id: string | null) => void;
  wtab: WorkspaceTab; setWtab: (t: WorkspaceTab) => void;
  settings: Settings; updateSettings: (p: SettingsPatch) => Promise<boolean>;
  testConnection: (model?: string) => Promise<{ ok: boolean; message: string; latencyMs?: number }>;
  running: Record<string, boolean>;
  loading: boolean;
  online: boolean;
  createProject: (name: string, prompt: string, opts?: { emoji?: string; autoApprove?: boolean; mode?: "greenfield" | "brownfield" }) => Promise<string | null>;
  createFromPreset: (presetIdx: number) => Promise<string | null>;
  deleteProject: (id: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<void>;
  resetProject: (id: string) => Promise<void>;
  toggleAutoApprove: (id: string) => Promise<void>;
  updateProject: (id: string, patch: { name?: string; emoji?: string; settings?: Project["settings"] }) => Promise<void>;
  startPipeline: (id: string) => Promise<void>;
  pausePipeline: (id: string) => Promise<void>;
  stepOnce: (id: string) => Promise<void>;
  approve: (pid: string, cpId: string, note?: string) => Promise<void>;
  reject: (pid: string, cpId: string, note?: string) => Promise<void>;
  addEnv: (pid: string, key: string, value: string) => Promise<void>;
  deleteEnv: (pid: string, envId: string) => Promise<void>;
  updateFile: (pid: string, path: string, content: string) => Promise<void>;
  refresh: (pid?: string) => Promise<void>;
  toast: string | null;
  showToast: (msg: string) => void;
}

const StoreCtx = createContext<StoreShape | null>(null);
const UI_KEY = "forge-v3-ui";

async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.json !== undefined ? { "Content-Type": "application/json" } : {}), ...(init?.headers ?? {}) },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    cache: "no-store",
  });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: text.slice(0, 200) }; }
  if (!res.ok) {
    const d = data as { error?: string; details?: Array<{ path: string; message: string }> | { code?: string } } | null;
    const detail = Array.isArray(d?.details) ? `: ${d!.details.map((x) => `${x.path ? x.path + " " : ""}${x.message}`).join(", ")}` : "";
    throw new Error(`${d?.error ?? `Request failed (${res.status})`}${detail}`);
  }
  return data as T;
}

type Snapshot = WorkspaceData & { project: Project; filePaths: string[]; filesDelta: boolean; serverTime: string };

const ACTIVE_STATUSES = new Set(["planning", "generating", "building", "testing", "deploying"]);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [view, setViewState] = useState<View>("landing");
  const [projects, setProjects] = useState<Project[]>([]);
  const [workspaces, setWorkspaces] = useState<Record<string, WorkspaceData>>({});
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [wtab, setWtabState] = useState<WorkspaceTab>("overview");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSync = useRef<Record<string, string>>({});
  const hydrated = useRef(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3400);
  }, []);

  // ── UI state persistence ─────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(UI_KEY);
      if (raw) {
        const ui = JSON.parse(raw) as { view?: View; activeId?: string | null; wtab?: WorkspaceTab };
        if (ui.view) setViewState(ui.view);
        if (ui.activeId !== undefined) setActiveIdState(ui.activeId);
        if (ui.wtab) setWtabState(ui.wtab);
      }
    } catch { /* ignore */ }
    hydrated.current = true;
  }, []);
  useEffect(() => {
    if (!hydrated.current) return;
    try { localStorage.setItem(UI_KEY, JSON.stringify({ view, activeId, wtab })); } catch { /* ignore */ }
  }, [view, activeId, wtab]);

  const setView = useCallback((v: View) => setViewState(v), []);
  const setWtab = useCallback((t: WorkspaceTab) => setWtabState(t), []);
  const setActiveId = useCallback((id: string | null) => setActiveIdState(id), []);

  // ── Data loading ─────────────────────────────────────────────────────────
  const mergeProject = useCallback((p: Project) => {
    setProjects((prev) => {
      const idx = prev.findIndex((x) => x.id === p.id);
      if (idx === -1) return [p, ...prev];
      const next = [...prev];
      next[idx] = { ...prev[idx], ...p };
      return next;
    });
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      const { projects: list } = await api<{ projects: Project[] }>("/api/projects");
      setProjects(list);
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, []);

  const loadWorkspace = useCallback(async (pid: string, full = false) => {
    const since = full ? null : lastSync.current[pid];
    try {
      const snap = await api<Snapshot>(`/api/projects/${pid}${since ? `?filesSince=${encodeURIComponent(since)}` : ""}`);
      setOnline(true);
      lastSync.current[pid] = snap.serverTime;
      mergeProject(snap.project);
      setWorkspaces((prev) => {
        const old = prev[pid];
        let files: FileNode[];
        if (snap.filesDelta && old) {
          const byPath = new Map(old.files.map((f) => [f.path, f]));
          for (const f of snap.files) byPath.set(f.path, f);
          const keep = new Set(snap.filePaths);
          files = [...byPath.values()].filter((f) => keep.has(f.path)).sort((a, b) => a.path.localeCompare(b.path));
        } else files = snap.files;
        return {
          ...prev,
          [pid]: { agents: snap.agents, tasks: snap.tasks, files, tables: snap.tables, env: snap.env, checkpoints: snap.checkpoints, commands: snap.commands, messages: snap.messages, llmCalls: snap.llmCalls },
        };
      });
    } catch (err) {
      if (err instanceof Error && /not found/i.test(err.message)) {
        setProjects((prev) => prev.filter((p) => p.id !== pid));
        setActiveIdState((cur) => (cur === pid ? null : cur));
      } else setOnline(false);
    }
  }, [mergeProject]);

  const loadSettings = useCallback(async () => {
    try {
      const { settings: s } = await api<{ settings: Settings }>("/api/settings");
      setSettings((prev) => ({ ...prev, ...s }));
    } catch { /* keep defaults */ }
  }, []);

  useEffect(() => {
    (async () => {
      await Promise.all([loadProjects(), loadSettings()]);
      setLoading(false);
    })();
  }, [loadProjects, loadSettings]);

  // Full load when the active project changes; then poll.
  useEffect(() => {
    if (!activeId) return;
    delete lastSync.current[activeId];
    void loadWorkspace(activeId, true);
  }, [activeId, loadWorkspace]);

  const activeProject = projects.find((p) => p.id === activeId);
  const activeBusy = !!activeProject && (activeProject.isRunning || ACTIVE_STATUSES.has(activeProject.status));
  useEffect(() => {
    if (!activeId || view !== "workspace") return;
    const ms = activeBusy ? 1500 : 6000;
    const t = setInterval(() => { void loadWorkspace(activeId); }, ms);
    return () => clearInterval(t);
  }, [activeId, activeBusy, view, loadWorkspace]);

  const anyRunning = projects.some((p) => p.isRunning);
  useEffect(() => {
    if (view === "landing") return;
    const t = setInterval(() => { void loadProjects(); }, anyRunning ? 5000 : 20000);
    return () => clearInterval(t);
  }, [anyRunning, view, loadProjects]);

  const refresh = useCallback(async (pid?: string) => {
    await loadProjects();
    if (pid) await loadWorkspace(pid, true);
  }, [loadProjects, loadWorkspace]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const run = useCallback(async (fn: () => Promise<void>, failMsg = "Action failed") => {
    try { await fn(); } catch (err) { showToast(`${failMsg}: ${err instanceof Error ? err.message : String(err)}`); }
  }, [showToast]);

  const createProject = useCallback<StoreShape["createProject"]>(async (name, prompt, opts) => {
    try {
      const { project } = await api<{ project: Project }>("/api/projects", { method: "POST", json: { name: name || "Untitled project", prompt, mode: opts?.mode ?? "greenfield", emoji: opts?.emoji, autoApprove: opts?.autoApprove } });
      setProjects((prev) => [project, ...prev]);
      setActiveIdState(project.id);
      setWtabState("overview");
      setViewState("workspace");
      showToast(`Project "${project.name}" created`);
      return project.id;
    } catch (err) {
      showToast(`Could not create project: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }, [showToast]);

  const createFromPreset = useCallback(async (i: number) => {
    const preset = PRESETS[i];
    if (!preset) return null;
    return createProject(preset.name, preset.prompt, { emoji: preset.emoji });
  }, [createProject]);

  const deleteProject = useCallback(async (id: string) => run(async () => {
    await api(`/api/projects/${id}`, { method: "DELETE" });
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setWorkspaces((prev) => { const n = { ...prev }; delete n[id]; return n; });
    if (activeId === id) { setActiveIdState(null); setViewState("dashboard"); }
    showToast("Project deleted");
  }, "Delete failed"), [activeId, run, showToast]);

  const duplicateProject = useCallback(async (id: string) => run(async () => {
    const { project } = await api<{ project: Project }>(`/api/projects/${id}/duplicate`, { method: "POST" });
    setProjects((prev) => [project, ...prev]);
    showToast(`Duplicated as "${project.name}"`);
  }, "Duplicate failed"), [run, showToast]);

  const resetProject = useCallback(async (id: string) => run(async () => {
    const { project } = await api<{ project: Project }>(`/api/projects/${id}/reset`, { method: "POST" });
    mergeProject(project);
    await loadWorkspace(id, true);
    showToast("Project reset to draft");
  }, "Reset failed"), [run, mergeProject, loadWorkspace, showToast]);

  const updateProject = useCallback<StoreShape["updateProject"]>(async (id, patch) => run(async () => {
    const { project } = await api<{ project: Project }>(`/api/projects/${id}`, { method: "PATCH", json: patch });
    mergeProject(project);
  }, "Update failed"), [run, mergeProject]);

  const toggleAutoApprove = useCallback(async (id: string) => {
    const p = projects.find((x) => x.id === id);
    if (!p) return;
    const next = !p.autoApprove;
    setProjects((prev) => prev.map((x) => (x.id === id ? { ...x, autoApprove: next } : x)));
    await run(async () => {
      const { project } = await api<{ project: Project }>(`/api/projects/${id}`, { method: "PATCH", json: { autoApprove: next } });
      mergeProject(project);
    }, "Could not update auto-approve");
  }, [projects, run, mergeProject]);

  const runAction = useCallback(async (id: string, action: "start" | "pause" | "step") => run(async () => {
    const { project } = await api<{ project: Project }>(`/api/projects/${id}/run`, { method: "POST", json: { action } });
    mergeProject(project);
    await loadWorkspace(id);
    if (action === "start") showToast(project.engineMode === "llm" ? "Pipeline started — LLM agents engaged" : "Pipeline started (simulation — add an API key in Settings for real agents)");
    if (action === "pause") showToast("Pause requested — stopping after the current step");
  }, action === "pause" ? "Pause failed" : "Could not start pipeline"), [run, mergeProject, loadWorkspace, showToast]);

  const startPipeline = useCallback((id: string) => runAction(id, "start"), [runAction]);
  const pausePipeline = useCallback((id: string) => runAction(id, "pause"), [runAction]);
  const stepOnce = useCallback((id: string) => runAction(id, "step"), [runAction]);

  const decide = useCallback(async (pid: string, cpId: string, decision: "approved" | "rejected", note?: string) => run(async () => {
    const r = await api<{ project: Project | null; resumed: boolean }>(`/api/projects/${pid}/checkpoints/${cpId}`, { method: "POST", json: { decision, note } });
    if (r.project) mergeProject(r.project);
    await loadWorkspace(pid);
    showToast(decision === "approved" ? (r.resumed ? "Approved — pipeline resuming" : "Approved") : (r.resumed ? "Rejected — step skipped, resuming" : "Rejected — step skipped"));
  }, "Could not resolve checkpoint"), [run, mergeProject, loadWorkspace, showToast]);

  const approve = useCallback((pid: string, cpId: string, note?: string) => decide(pid, cpId, "approved", note), [decide]);
  const reject = useCallback((pid: string, cpId: string, note?: string) => decide(pid, cpId, "rejected", note), [decide]);

  const addEnv = useCallback(async (pid: string, key: string, value: string) => run(async () => {
    await api(`/api/projects/${pid}/env`, { method: "POST", json: { key, value } });
    await loadWorkspace(pid);
  }, "Could not save variable"), [run, loadWorkspace]);

  const deleteEnv = useCallback(async (pid: string, envId: string) => run(async () => {
    setWorkspaces((prev) => prev[pid] ? { ...prev, [pid]: { ...prev[pid], env: prev[pid].env.filter((e) => e.id !== envId) } } : prev);
    await api(`/api/projects/${pid}/env/${envId}`, { method: "DELETE" });
  }, "Could not delete variable"), [run]);

  const updateFile = useCallback(async (pid: string, path: string, content: string) => run(async () => {
    const { file } = await api<{ file: FileNode }>(`/api/projects/${pid}/files`, { method: "PUT", json: { path, content } });
    setWorkspaces((prev) => {
      const ws = prev[pid]; if (!ws || !file) return prev;
      const exists = ws.files.some((f) => f.path === file.path);
      return { ...prev, [pid]: { ...ws, files: exists ? ws.files.map((f) => (f.path === file.path ? file : f)) : [...ws.files, file] } };
    });
    showToast(`Saved ${path}`);
  }, "Save failed"), [run, showToast]);

  const updateSettings = useCallback(async (patch: SettingsPatch) => {
    try {
      const { settings: s } = await api<{ settings: Settings }>("/api/settings", { method: "PUT", json: patch });
      setSettings((prev) => ({ ...prev, ...s }));
      return true;
    } catch (err) {
      showToast(`Settings not saved: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }, [showToast]);

  const testConnection = useCallback(async (model?: string) => {
    try {
      const r = await api<{ ok: boolean; message: string; latencyMs: number }>("/api/settings/test", { method: "POST", json: { model } });
      await loadSettings();
      return r;
    } catch (err) {
      await loadSettings();
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }, [loadSettings]);

  const running = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, !!p.isRunning])), [projects]);

  const value = useMemo<StoreShape>(() => ({
    view, setView, projects, workspaces, activeId, setActiveId, wtab, setWtab, settings, updateSettings, testConnection,
    running, loading, online, createProject, createFromPreset, deleteProject, duplicateProject, resetProject, toggleAutoApprove,
    updateProject, startPipeline, pausePipeline, stepOnce, approve, reject, addEnv, deleteEnv, updateFile, refresh, toast, showToast,
  }), [view, setView, projects, workspaces, activeId, setActiveId, wtab, setWtab, settings, updateSettings, testConnection, running, loading, online,
    createProject, createFromPreset, deleteProject, duplicateProject, resetProject, toggleAutoApprove, updateProject, startPipeline, pausePipeline,
    stepOnce, approve, reject, addEnv, deleteEnv, updateFile, refresh, toast, showToast]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): StoreShape {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
