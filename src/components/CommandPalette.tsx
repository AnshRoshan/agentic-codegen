"use client";

import { useState, useEffect, useCallback } from "react";
import { Command } from "cmdk";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, Plus, Settings, FolderKanban, BookOpen, Rocket,
  KeyRound, BarChart3, Sparkles, ArrowRight, Zap,
} from "lucide-react";
import { PRESETS } from "@/lib/templates";

interface Project {
  id: string;
  name: string;
  mode: string;
  status: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  onSelectProject: (id: string) => void;
  onNewProject: (prompt?: string) => void;
  onNavigate: (view: "projects" | "architecture" | "settings") => void;
  onOpenSettings: () => void;
}

export default function CommandPalette({
  open, onOpenChange, projects, onSelectProject, onNewProject, onNavigate, onOpenSettings,
}: Props) {
  const [search, setSearch] = useState("");

  // ⌘K / Ctrl+K to open
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  const close = useCallback(() => { onOpenChange(false); setSearch(""); }, [onOpenChange]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[200] flex items-start justify-center bg-black/60 backdrop-blur-md pt-[10vh] px-4"
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl glass-heavy border border-surface-700 rounded-2xl shadow-2xl overflow-hidden"
          >
            <Command label="Command Menu" shouldFilter={true}>
              <div className="flex items-center gap-3 px-4 border-b border-surface-800">
                <Search className="w-4 h-4 text-surface-500 flex-shrink-0" />
                <Command.Input
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Type a command or search projects..."
                  autoFocus
                />
                <kbd className="flex-shrink-0">ESC</kbd>
              </div>

              <Command.List>
                <Command.Empty>No results found.</Command.Empty>

                <Command.Group heading="Actions">
                  <Command.Item onSelect={() => { onNewProject(); close(); }}>
                    <Plus className="w-4 h-4 text-primary-400" />
                    <span className="flex-1">Create new project</span>
                    <kbd>N</kbd>
                  </Command.Item>
                  <Command.Item onSelect={() => { onOpenSettings(); close(); }}>
                    <KeyRound className="w-4 h-4 text-amber-400" />
                    <span className="flex-1">Configure AI provider</span>
                  </Command.Item>
                </Command.Group>

                <Command.Group heading="Navigation">
                  <Command.Item onSelect={() => { onNavigate("projects"); close(); }}>
                    <FolderKanban className="w-4 h-4 text-blue-400" />
                    <span className="flex-1">All projects</span>
                  </Command.Item>
                  <Command.Item onSelect={() => { onNavigate("architecture"); close(); }}>
                    <BookOpen className="w-4 h-4 text-violet-400" />
                    <span className="flex-1">Architecture guide</span>
                  </Command.Item>
                </Command.Group>

                {projects.length > 0 && (
                  <Command.Group heading={`Projects (${projects.length})`}>
                    {projects.slice(0, 8).map((p) => (
                      <Command.Item
                        key={p.id}
                        value={`project ${p.name} ${p.mode}`}
                        onSelect={() => { onSelectProject(p.id); close(); }}
                      >
                        <span className="w-4 h-4 rounded-full bg-gradient-to-br from-primary-500 to-violet-600 flex-shrink-0" />
                        <span className="flex-1 truncate">{p.name}</span>
                        <span className="text-[10px] text-surface-600 uppercase">{p.status}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                <Command.Group heading="Start from preset">
                  {PRESETS.slice(0, 6).map((preset) => (
                    <Command.Item
                      key={preset.id}
                      value={`preset ${preset.name} ${preset.description}`}
                      onSelect={() => { onNewProject(preset.prompt); close(); }}
                    >
                      <span>{preset.emoji}</span>
                      <span className="flex-1">{preset.name}</span>
                      <ArrowRight className="w-3 h-3 text-surface-600" />
                    </Command.Item>
                  ))}
                </Command.Group>

                <Command.Group heading="Generate from prompt">
                  {search.length > 5 && (
                    <Command.Item
                      value={`generate ${search}`}
                      onSelect={() => { onNewProject(search); close(); }}
                    >
                      <Sparkles className="w-4 h-4 text-primary-400" />
                      <span className="flex-1 truncate">Generate: &ldquo;{search}&rdquo;</span>
                      <kbd>↵</kbd>
                    </Command.Item>
                  )}
                </Command.Group>
              </Command.List>

              <div className="px-4 py-2 border-t border-surface-800 flex items-center justify-between text-[10px] text-surface-600">
                <div className="flex items-center gap-2">
                  <Zap className="w-3 h-3" /> Powered by universal domain inference
                </div>
                <div className="flex items-center gap-2">
                  <kbd>↑↓</kbd> nav <kbd>↵</kbd> select
                </div>
              </div>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
