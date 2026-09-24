"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Wand2 } from "lucide-react";
import { Modal, Spinner, Toggle } from "@/components/ui";
import { PRESETS, inferDomain } from "@/lib/domain";
import { api, cn } from "@/lib/utils";
import type { Project } from "@/db/schema";

/** Read chosen files/zip into { path, content } pairs; same caps as the import API. */
async function collectImportFiles(list: File[]): Promise<Array<{ path: string; content: string }>> {
  const out: Array<{ path: string; content: string }> = [];
  for (const f of list) {
    if (out.length >= 500) break;
    if (f.size > 400_000) continue;
    if (/\.zip$/i.test(f.name)) {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(f);
      for (const entry of Object.values(zip.files)) {
        if (entry.dir) continue;
        out.push({ path: entry.name, content: await entry.async("string") });
        if (out.length >= 500) return out;
      }
    } else {
      const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
      out.push({ path: rel && rel.includes("/") ? rel.slice(rel.indexOf("/") + 1) : f.name, content: await f.text() });
    }
  }
  return out;
}

export function CreateProjectModal({ open, onClose, presetId }: { open: boolean; onClose: () => void; presetId?: string | null }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"greenfield" | "brownfield" | "static">("greenfield");
  const [autoApprove, setAutoApprove] = useState(false);
  const [autoStart, setAutoStart] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    if (!open) return;
    const p = PRESETS.find((x) => x.id === presetId);
    if (p) {
      setPrompt(p.prompt);
      setName(p.name);
      setSelected(p.id);
    }
  }, [open, presetId]);

  const preview = useMemo(() => (prompt.trim().length >= 12 ? inferDomain(prompt, name) : null), [prompt, name]);

  function applyPreset(id: string) {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setSelected(id);
    setPrompt(p.prompt);
    setName(p.name);
  }

  async function submit() {
    if (prompt.trim().length < 12) {
      toast.error("Describe what you want to build — a sentence or two is enough.");
      return;
    }
    setBusy(true);
    try {
      const project = await api<Project>("/api/projects", { method: "POST", body: JSON.stringify({ prompt, name: name || undefined, mode, autoApprove }) });
      if (mode === "brownfield" && files.length) {
        const payload = await collectImportFiles(files);
        if (payload.length) {
          const r = await api<{ imported: number; skipped: number }>(`/api/projects/${project.id}/import`, { method: "POST", body: JSON.stringify({ files: payload }) });
          toast.success(`${r.imported} existing files imported${r.skipped ? ` (${r.skipped} skipped)` : ""}`);
        }
      }
      toast.success(`Project "${project.name}" created`);
      onClose();
      router.push(`/projects/${project.id}${autoStart ? "?start=1" : ""}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create project");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={<span className="flex items-center gap-2"><Sparkles size={16} className="text-brand-300" /> New project</span>} width="max-w-4xl">
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-ink-400">Start from a preset (optional)</label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {PRESETS.map((p) => (
                <button key={p.id} type="button" onClick={() => applyPreset(p.id)} className={cn("flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs transition", selected === p.id ? "border-brand-400/60 bg-brand-500/15 text-ink-100" : "border-white/10 bg-white/[0.03] text-ink-300 hover:border-white/20")}>
                  <span>{p.emoji}</span> {p.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-ink-400">Describe the product</label>
            <textarea
              className="textarea min-h-[170px]"
              placeholder="e.g. Build a helpdesk where customers open tickets, agents reply in threads, and SLA breaches are tracked on a dashboard…"
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setSelected(null);
              }}
              autoFocus
            />
            <div className="mt-1 flex justify-between text-[11px] text-ink-500">
              <span>Mention the things you want to manage (customers, orders, tickets…) and the features (search, charts, roles…)</span>
              <span>{prompt.length} chars</span>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-ink-400">Project name</label>
              <input className="input" placeholder={preview?.name ?? "Auto-generated from the brief"} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-ink-400">Mode</label>
              <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-ink-900 p-1">
                {(["greenfield", "brownfield", "static"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setMode(m)} title={m === "static" ? "A beautiful static website: 7 fast steps, no database" : m === "brownfield" ? "Import an existing codebase; agents audit and extend it without destroying your code" : undefined} className={cn("rounded-lg py-1.5 text-xs font-medium capitalize transition", mode === m ? "bg-white/10 text-ink-100" : "text-ink-400 hover:text-ink-200")}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {mode === "brownfield" && (
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-ink-400">Existing code</label>
              <div className="flex flex-wrap items-center gap-2">
                <label className="btn-secondary cursor-pointer text-xs">
                  Upload ZIP
                  <input type="file" accept=".zip" className="hidden" onChange={(e) => setFiles(e.target.files ? [...e.target.files] : [])} />
                </label>
                <label className="btn-secondary cursor-pointer text-xs">
                  Pick folder
                  <input
                    type="file" multiple className="hidden"
                    {...{ webkitdirectory: "true", directory: "true" }}
                    onChange={(e) => setFiles(e.target.files ? [...e.target.files].filter((f) => f.size <= 400_000).slice(0, 500) : [])}
                  />
                </label>
                {files.length > 0 && (
                  <span className="text-[11px] text-ink-500">
                    {files.length} file{files.length === 1 ? "" : "s"} selected
                    <button type="button" className="ml-2 text-rose-300 hover:underline" onClick={() => setFiles([])}>clear</button>
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-ink-500">node_modules, .git and binaries are skipped automatically. Max 500 files, 400KB each.</p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-6 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
            <Toggle checked={autoStart} onChange={setAutoStart} label="Start pipeline immediately" />
            <Toggle checked={autoApprove} onChange={setAutoApprove} label="Auto-approve checkpoints" />
          </div>
        </div>

        <aside className="panel h-fit space-y-4 p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-ink-400">
            <Wand2 size={13} /> Live inference
          </div>
          {preview ? (
            <>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{preview.emoji}</span>
                <div>
                  <div className="font-display font-semibold">{preview.name}</div>
                  <div className="text-xs text-ink-400">{preview.domainLabel}</div>
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-[11px] uppercase tracking-wider text-ink-500">Entities · {preview.entities.length}</div>
                <div className="flex flex-wrap gap-1.5">
                  {preview.entities.map((e) => (
                    <span key={e.name} className="chip">{e.name} <span className="text-ink-500">{e.fields.length}</span></span>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-[11px] uppercase tracking-wider text-ink-500">Features · {preview.features.length}</div>
                <ul className="space-y-1 text-xs text-ink-300">
                  {preview.features.map((f) => (
                    <li key={f} className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-brand-400" /> {f}</li>
                  ))}
                </ul>
              </div>
              <p className="text-[11px] text-ink-500">The Orchestrator refines this once the pipeline starts.</p>
            </>
          ) : (
            <p className="text-sm text-ink-500">Start typing and Forge will show the domain, entities and features it detects.</p>
          )}
        </aside>
      </div>
      <div className="mt-6 flex items-center justify-end gap-2 border-t border-white/8 pt-5">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={busy}>
          {busy ? <Spinner /> : <Sparkles size={15} />} Create project
        </button>
      </div>
    </Modal>
  );
}
