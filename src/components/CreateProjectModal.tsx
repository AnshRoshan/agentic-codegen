"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Sparkles, GitBranch, ArrowLeft, Check, Wand2, Database, Layers } from "lucide-react";
import { PRESETS } from "@/lib/templates";
import { TECH_STACK_OPTIONS } from "@/lib/agents";
import { inferAppSpec } from "@/lib/domain-inference";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  initialPrompt?: string;
}

type Step = "describe" | "review" | "stack";

export default function CreateProjectModal({ open, onClose, onCreated, initialPrompt }: Props) {
  const [step, setStep] = useState<Step>("describe");
  const [mode, setMode] = useState<"greenfield" | "brownfield">("greenfield");
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");

  // Auto-fill prompt when opened via CommandPalette with an initial value
  useState(() => {
    if (initialPrompt && !prompt) setPrompt(initialPrompt);
  });
  // Also handle if initialPrompt changes while modal is open
  if (initialPrompt && !prompt && open) {
    setTimeout(() => setPrompt(initialPrompt), 0);
  }
  const [description, setDescription] = useState("");
  const [sourceRepo, setSourceRepo] = useState("");
  const [presetId, setPresetId] = useState<string | null>(null);
  const [techStack, setTechStack] = useState({
    frontend: "Next.js (App Router)",
    backend: "Next.js API Routes",
    database: "PostgreSQL + Drizzle",
    testing: "Vitest + Playwright",
    deployment: "Docker + Docker Compose",
  });
  const [loading, setLoading] = useState(false);

  // Live inference preview — runs client-side as the user types
  const preview = useMemo(() => {
    if (prompt.trim().length < 12) return null;
    try {
      return inferAppSpec(prompt + "\n" + description, name || "Generated App");
    } catch {
      return null;
    }
  }, [prompt, description, name]);

  const reset = () => {
    setStep("describe"); setName(""); setPrompt(""); setDescription("");
    setSourceRepo(""); setPresetId(null); setMode("greenfield"); onClose();
  };

  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPresetId(id);
    setPrompt(p.prompt);
    if (!name) setName(p.name);
  };

  const canSubmit =
    name.trim().length > 0 &&
    prompt.trim().length > 10 &&
    (mode === "greenfield" || sourceRepo.trim().length > 0);

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, description: description || undefined, mode, prompt,
          presetId: presetId ?? undefined,
          techStack: mode === "greenfield" ? techStack : undefined,
          sourceRepo: mode === "brownfield" ? sourceRepo : undefined,
        }),
      });
      if (res.ok) { onCreated(); reset(); }
    } finally { setLoading(false); }
  };

  return (
    <AnimatePresence>
      {open && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
      onClick={reset}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="glass-heavy rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center">
              <Wand2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-surface-100">Describe your application</h2>
              <p className="text-xs text-surface-500">Any domain — the engine infers the entire data model and codebase</p>
            </div>
          </div>
          <button onClick={reset} className="btn btn-ghost btn-icon"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === "describe" && (
            <div className="space-y-5 anim-fade">
              {/* Mode toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setMode("greenfield")}
                  className={`flex-1 flex items-center gap-2.5 px-4 py-3 rounded-xl border transition-all ${
                    mode === "greenfield" ? "border-emerald-500/50 bg-emerald-500/10" : "border-surface-700 hover:border-surface-600"
                  }`}
                >
                  <span className="text-xl">🌱</span>
                  <div className="text-left">
                    <p className="text-sm font-medium text-surface-100">Greenfield</p>
                    <p className="text-[11px] text-surface-500">Generate from scratch</p>
                  </div>
                </button>
                <button
                  onClick={() => setMode("brownfield")}
                  className={`flex-1 flex items-center gap-2.5 px-4 py-3 rounded-xl border transition-all ${
                    mode === "brownfield" ? "border-amber-500/50 bg-amber-500/10" : "border-surface-700 hover:border-surface-600"
                  }`}
                >
                  <GitBranch className="w-5 h-5 text-amber-400" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-surface-100">Brownfield</p>
                    <p className="text-[11px] text-surface-500">Modify existing repo</p>
                  </div>
                </button>
              </div>

              {/* THE PROMPT — primary input */}
              <div>
                <label className="label">
                  {mode === "greenfield" ? "What do you want to build?" : "What should change?"}
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => { setPrompt(e.target.value); setPresetId(null); }}
                  rows={6}
                  autoFocus
                  placeholder="e.g. Build a capacity forecasting application that tracks resources and their available hours, defines monthly planning periods, records forecasted vs actual demand with scenario comparison, allocates capacity, and shows utilization trends with over-allocation alerts…"
                  className="input text-[13px] leading-relaxed"
                />
                <p className="text-[11px] text-surface-600 mt-1.5">
                  Describe entities, workflows, and features in plain language. The more detail, the richer the generated app.
                </p>
              </div>

              {/* Quick-start presets */}
              <div>
                <label className="label">Or start from a preset</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => applyPreset(p.id)}
                      className={`text-left p-3 rounded-xl border bg-gradient-to-br ${p.gradient} transition-all ${
                        presetId === p.id ? "border-primary-500 ring-1 ring-primary-500/30" : "border-surface-700 hover:border-primary-500/40"
                      }`}
                    >
                      <div className="text-lg mb-1">{p.emoji}</div>
                      <p className="text-xs font-semibold text-surface-100">{p.name}</p>
                      <p className="text-[10px] text-surface-400 mt-0.5 line-clamp-2">{p.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Project name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Capacity Planner" className="input" />
                </div>
                {mode === "brownfield" ? (
                  <div>
                    <label className="label">Source repository</label>
                    <input value={sourceRepo} onChange={(e) => setSourceRepo(e.target.value)} placeholder="https://github.com/org/repo" className="input mono text-xs" />
                  </div>
                ) : (
                  <div>
                    <label className="label">Extra context (optional)</label>
                    <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Constraints, integrations, scale…" className="input" />
                  </div>
                )}
              </div>

              {/* LIVE INFERENCE PREVIEW */}
              {preview && mode === "greenfield" && (
                <div className="rounded-xl border border-primary-500/25 bg-primary-500/5 p-4 anim-fade">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-primary-400" />
                    <span className="text-xs font-semibold text-primary-300 uppercase tracking-wide">Live inference</span>
                    <span className="badge text-[10px] bg-surface-800 text-surface-400 border-surface-700 ml-auto">
                      domain: {preview.domain}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="flex items-center gap-1.5 text-[11px] text-surface-500 mb-1.5">
                        <Database className="w-3 h-3" /> {preview.entities.length} entities detected
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {preview.entities.map((e) => (
                          <span key={e.table} className="badge text-[10px] bg-surface-800 text-surface-300 border-surface-700">
                            {e.icon} {e.labelPlural}
                            <span className="text-surface-600 ml-1">{e.fields.length}f</span>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-[11px] text-surface-500 mb-1.5">
                        <Layers className="w-3 h-3" /> {preview.features.length} features
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {preview.features.slice(0, 10).map((f) => (
                          <span key={f} className="badge text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">{f}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-surface-500 mt-3 pt-3 border-t border-surface-800">
                    Will generate ≈ <strong className="text-surface-300">{18 + (preview.entities.length - 1) * 4}</strong> files ·{" "}
                    <strong className="text-surface-300">{(preview.entities.length - 1) * 5}</strong> API endpoints ·{" "}
                    <strong className="text-surface-300">{preview.metrics.length}</strong> dashboard metrics
                  </p>
                </div>
              )}
            </div>
          )}

          {step === "stack" && (
            <div className="space-y-4 anim-fade">
              <div>
                <h3 className="text-lg font-semibold text-surface-100">Technology stack</h3>
                <p className="text-sm text-surface-500">Defaults work well for most projects.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(TECH_STACK_OPTIONS).map(([key, options]) => (
                  <div key={key}>
                    <label className="label capitalize">{key}</label>
                    <select
                      value={techStack[key as keyof typeof techStack]}
                      onChange={(e) => setTechStack({ ...techStack, [key]: e.target.value })}
                      className="input"
                    >
                      {options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-surface-800 flex items-center justify-between flex-shrink-0">
          <button
            onClick={() => (step === "stack" ? setStep("describe") : reset())}
            className="btn btn-ghost btn-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {step === "stack" ? "Back" : "Cancel"}
          </button>
          <div className="flex gap-2">
            {step === "describe" && mode === "greenfield" && (
              <button onClick={() => setStep("stack")} disabled={!canSubmit} className="btn btn-secondary btn-sm">
                Configure stack
              </button>
            )}
            <button onClick={submit} disabled={!canSubmit || loading} className="btn btn-primary btn-sm">
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" style={{ animation: "spin-slow .7s linear infinite" }} />
                  Generating…
                </>
              ) : (
                <><Check className="w-3.5 h-3.5" />Generate Application</>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  );
}
