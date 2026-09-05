import React, { useEffect, useState } from "react";
import {
  LayoutDashboard, FolderKanban, Cpu, Blocks, Settings as SettingsIcon,
  Plus, Home, Search, Check, X, ArrowRight,
} from "lucide-react";
import { useStore, type View } from "../lib/store";
import { Logo } from "./ui";
import { cn } from "../utils/cn";

const NAV: Array<{ id: View; label: string; icon: React.ReactNode; hint?: string }> = [
  { id: "dashboard", label: "Projects", icon: <LayoutDashboard size={17} /> },
  { id: "models", label: "Model catalog", icon: <Cpu size={17} /> },
  { id: "skills", label: "Skills & MCP", icon: <Blocks size={17} /> },
  { id: "settings", label: "Settings", icon: <SettingsIcon size={17} /> },
];

export function CreateProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createProject, settings } = useStore();
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [emoji, setEmoji] = useState("✨");
  const [autoApprove, setAutoApprove] = useState(settings.autoApproveDefault);

  React.useEffect(() => {
    if (open) {
      const prefill = sessionStorage.getItem("forge-prefill");
      if (prefill) { setPrompt(prefill); sessionStorage.removeItem("forge-prefill"); }
    }
  }, [open ]);

  if (!open) return null;
  const emojis = ["✨", "🤝", "🛒", "🎫", "📅", "☁️", "🎓", "📦", "📊", "✍️", "🚀", "💡"];
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="glass relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl p-6">
        <h2 className="font-display text-[18px] font-semibold">New project</h2>
        <p className="mt-1 text-[13px] text-ink-400">Describe what to build. The orchestrator infers the domain and plans the pipeline.</p>
        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-300">Project name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sales CRM" className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-300">Icon</label>
            <div className="flex flex-wrap gap-1.5">
              {emojis.map((e) => (
                <button key={e} onClick={() => setEmoji(e)}
                  className={cn("grid h-9 w-9 place-items-center rounded-lg border text-[18px] transition",
                    emoji === e ? "border-violet-400/60 bg-violet-500/15" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]")}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-300">Brief — what should the agents build?</label>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
              placeholder="Build a CRM with companies, contacts and a kanban deal pipeline with activity logging…"
              className="input min-h-[110px]" />
            <div className="mt-1 text-right font-mono text-[11px] text-ink-500">{prompt.length} chars</div>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
            <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} className="mt-0.5 h-4 w-4 accent-violet-500" />
            <span>
              <span className="block text-[13px] font-semibold">Auto-approve checkpoints</span>
              <span className="block text-[12px] text-ink-400">Skip the human gates for schema migration and deploy. Useful for trusted, throwaway runs.</span>
            </span>
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              disabled={!prompt.trim()}
              onClick={() => { createProject(name || "Untitled project", prompt, { emoji, autoApprove }); onClose(); setName(""); setPrompt(""); }}
              className="btn-primary"
            >
              Create project
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GlobalPalette({ open, onClose, onNew }: { open: boolean; onClose: () => void; onNew: () => void }) {
  const { projects, setActiveId, setView, setWtab, workspaces } = useStore();
  const [q, setQ] = useState("");
  useEffect(() => { if (open) setQ(""); }, [open ]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const ql = q.toLowerCase();
  const nav = [
    { label: "Go to Projects", hint: "dashboard", fn: () => setView("dashboard") },
    { label: "Go to Model catalog", hint: "models", fn: () => setView("models") },
    { label: "Go to Skills & MCP", hint: "skills", fn: () => setView("skills") },
    { label: "Go to Settings", hint: "settings", fn: () => setView("settings") },
    { label: "Create new project", hint: "new", fn: onNew },
  ].filter((n) => n.label.toLowerCase().includes(ql));
  const projs = projects.filter((p) => `${p.name} ${p.prompt} ${p.domainLabel}`.toLowerCase().includes(ql)).slice(0, 6);
  const go = (fn: () => void) => { fn(); onClose(); };
  return (
    <div className="fixed inset-0 z-[85] flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="glass relative w-full max-w-xl overflow-hidden rounded-2xl">
        <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3">
          <Search size={16} className="text-ink-400" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Jump to projects, pages, actions…" className="w-full bg-transparent text-[14px] outline-none placeholder:text-ink-500" />
          <button onClick={onClose} className="btn-ghost !p-1"><X size={15} /></button>
        </div>
        <div className="max-h-[46vh] overflow-y-auto p-2">
          {nav.map((n) => (
            <button key={n.label} onClick={() => go(n.fn)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-white/[0.06]">
              <ArrowRight size={13} className="text-ink-500" /> {n.label}
            </button>
          ))}
          {projs.length > 0 && <div className="px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-500">Projects</div>}
          {projs.map((p) => {
            const pending = workspaces[p.id] ? workspaces[p.id].checkpoints.filter((c) => c.status === "pending").length : (p.pendingCheckpoints ?? 0);
            return (
              <button key={p.id} onClick={() => go(() => { setActiveId(p.id); setWtab(pending > 0 ? "approvals" : "overview"); setView("workspace"); })}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-white/[0.06]">
                <span className="text-[16px]">{p.emoji}</span>
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="font-mono text-[11px] text-ink-500">{p.domainLabel}</span>
                {pending > 0 && <span className="chip !text-[10px] border-amber-400/40 bg-amber-400/10 text-amber-200">{pending} pending</span>}
              </button>
            );
          })}
          {nav.length === 0 && projs.length === 0 && (
            <div className="px-3 py-8 text-center text-[13px] text-ink-500">No matches.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AppShell({ children, onNew }: { children: React.ReactNode; onNew?: () => void }) {
  const { view, setView, projects, activeId, setActiveId, setWtab, toast } = useStore();
  const [modal, setModal] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [palette, setPalette] = useState(false);

  const openModal = () => { if (onNew) onNew(); else setModal(true); };

  // Global ⌘K everywhere EXCEPT the workspace (it has its own project-scoped palette)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && view !== "workspace") {
        e.preventDefault();
        setPalette((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view]);

  return (
    <div className="flex h-screen overflow-hidden bg-void">
      {/* ── Sidebar ── */}
      <aside className={cn("flex shrink-0 flex-col border-r border-white/[0.07] bg-panel transition-all", collapsed ? "w-[64px]" : "w-[248px]")}>
        <div className="flex h-[60px] items-center gap-2.5 border-b border-white/[0.07] px-3.5">
          <button onClick={() => setView("landing")} className="flex items-center gap-2.5">
            <Logo size={30} />
            {!collapsed && <span className="font-display text-[16px] font-semibold">Forge</span>}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2.5">
          <button onClick={openModal}
            className={cn("btn-primary w-full justify-center", collapsed && "!px-0")}>
            <Plus size={16} /> {!collapsed && "New project"}
          </button>

          <div className={cn("mt-4 space-y-1", collapsed && "flex flex-col items-center")}>
            {!collapsed && <div className="px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-500">Workspace</div>}
            {NAV.map((n) => (
              <button key={n.id} onClick={() => setView(n.id)}
                title={collapsed ? n.label : undefined}
                className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition",
                  collapsed && "justify-center",
                  (view === n.id || (n.id === "dashboard" && view === "workspace"))
                    ? "bg-violet-500/15 text-white" : "text-ink-400 hover:bg-white/[0.05] hover:text-white")}>
                {n.icon} {!collapsed && n.label}
              </button>
            ))}
          </div>

          {/* Recent projects */}
          {!collapsed && projects.length > 0 && (
            <div className="mt-5">
              <div className="flex items-center justify-between px-2 pb-1">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-500">Recent</span>
                <FolderKanban size={13} className="text-ink-500" />
              </div>
              <div className="space-y-0.5">
                {projects.slice(0, 6).map((p) => (
                  <button key={p.id}
                    onClick={() => { setActiveId(p.id); setWtab("overview"); setView("workspace"); }}
                    className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition",
                      activeId === p.id && view === "workspace" ? "bg-white/[0.07] text-white" : "text-ink-400 hover:bg-white/[0.04] hover:text-white")}>
                    <span className="text-[15px]">{p.emoji}</span>
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className={cn("status-dot shrink-0",
                      p.status === "completed" ? "bg-emerald-400" : p.status === "waiting_approval" ? "bg-amber-400"
                        : p.status === "failed" ? "bg-rose-400" : ["draft", "paused"].includes(p.status) ? "bg-ink-500" : "bg-violet-400")}
                      data-live={!["draft", "paused", "completed", "failed"].includes(p.status)} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-white/[0.07] p-2.5">
          <button onClick={() => setView("landing")} className={cn("btn-ghost w-full", collapsed && "justify-center !px-0")}>
            <Home size={16} /> {!collapsed && "Back to site"}
          </button>
          <button onClick={() => setCollapsed(!collapsed)} className={cn("btn-ghost mt-0.5 w-full text-[12px]", collapsed && "justify-center !px-0")}>
            {collapsed ? "→" : "←  Collapse"}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-[60px] shrink-0 items-center gap-3 border-b border-white/[0.07] bg-panel/60 px-5 backdrop-blur">
          <button onClick={() => setPalette(true)} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-ink-500 transition hover:bg-white/[0.04] hover:text-ink-300">
            <Search size={15} className="shrink-0" />
            <span className="hidden sm:inline">Search projects, pages, actions…</span>
            <span className="kbd ml-1 hidden md:inline-flex">⌘K</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="chip hidden !text-[11px] lg:inline-flex">
              <span className="status-dot bg-emerald-400" data-live="true" /> orchestrator online
            </span>
            <button onClick={openModal} className="btn-secondary btn-sm"><Plus size={14} /> New</button>
          </div>
        </div>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      <CreateProjectModal open={modal} onClose={() => setModal(false)} />
      <GlobalPalette open={palette} onClose={() => setPalette(false)} onNew={openModal} />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[90] flex -translate-x-1/2 items-center gap-2.5 rounded-xl border border-white/10 bg-panel2 px-4 py-3 text-[13.5px] shadow-2xl">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-400/15 text-emerald-300"><Check size={14} /></span>
          {toast}
        </div>
      )}
    </div>
  );
}
