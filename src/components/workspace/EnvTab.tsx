"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Eye, EyeOff, KeyRound, Pencil, Plus, Trash2, X } from "lucide-react";
import { EmptyState, Spinner, Toggle } from "@/components/ui";
import type { EnvironmentVariable } from "@/db/schema";
import { api, cn } from "@/lib/utils";

export function EnvTab({ projectId, env, onChange }: { projectId: string; env: EnvironmentVariable[]; onChange: () => Promise<unknown> }) {
  const [reveal, setReveal] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ key: "", value: "", description: "", isSecret: false });
  const [busy, setBusy] = useState(false);

  const missing = env.filter((e) => e.isRequired && !e.value).length;

  async function save(e: EnvironmentVariable) {
    setBusy(true);
    try {
      await api(`/api/projects/${projectId}/env/${e.id}`, { method: "PATCH", body: JSON.stringify({ value: draft }) });
      setEditing(null);
      await onChange();
      toast.success(`${e.key} updated`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(e: EnvironmentVariable) {
    if (!confirm(`Remove ${e.key}?`)) return;
    await api(`/api/projects/${projectId}/env/${e.id}`, { method: "DELETE" });
    await onChange();
    toast.success(`${e.key} removed`);
  }

  async function toggleSecret(e: EnvironmentVariable) {
    await api(`/api/projects/${projectId}/env/${e.id}`, { method: "PATCH", body: JSON.stringify({ isSecret: !e.isSecret }) });
    await onChange();
  }

  async function add() {
    if (!form.key.trim()) return toast.error("Key is required");
    setBusy(true);
    try {
      await api(`/api/projects/${projectId}/env`, { method: "POST", body: JSON.stringify(form) });
      setForm({ key: "", value: "", description: "", isSecret: false });
      setAdding(false);
      await onChange();
      toast.success("Variable added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  function copyEnv() {
    navigator.clipboard.writeText(env.map((e) => `${e.key}=${e.value}`).join("\n"));
    toast.success(".env copied to clipboard");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-ink-400">
          {env.length} variables · {env.filter((e) => e.isSecret).length} secrets{missing > 0 && <span className="ml-2 text-amber-300">· {missing} required value{missing > 1 ? "s" : ""} missing</span>}
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary btn-sm" onClick={copyEnv} disabled={!env.length}><Copy size={13} /> Copy .env</button>
          <button className="btn-primary btn-sm" onClick={() => setAdding(true)}><Plus size={13} /> Add variable</button>
        </div>
      </div>

      {adding && (
        <div className="panel grid gap-3 p-4 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
          <input className="input font-mono" placeholder="KEY_NAME" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value.toUpperCase() })} autoFocus />
          <input className="input font-mono" placeholder="value" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
          <input className="input" placeholder="What is it for?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex items-center gap-2">
            <Toggle checked={form.isSecret} onChange={(v) => setForm({ ...form, isSecret: v })} label="Secret" />
            <button className="btn-primary btn-sm" onClick={add} disabled={busy}>{busy ? <Spinner className="h-3 w-3" /> : <Check size={13} />}</button>
            <button className="btn-ghost btn-sm" onClick={() => setAdding(false)}><X size={13} /></button>
          </div>
        </div>
      )}

      {!env.length ? (
        <EmptyState icon={KeyRound} title="No environment variables yet" description="The Backend agent registers the variables the generated app needs in step 7. You can also add your own." />
      ) : (
        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left text-[10px] uppercase tracking-wider text-ink-500">
              <tr><th className="px-4 py-2.5">Key</th><th className="px-4 py-2.5">Value</th><th className="hidden px-4 py-2.5 md:table-cell">Description</th><th className="px-4 py-2.5">Source</th><th className="px-4 py-2.5" /></tr>
            </thead>
            <tbody>
              {env.map((e) => {
                const shown = reveal.has(e.id) || !e.isSecret;
                return (
                  <tr key={e.id} className="border-t border-white/6 align-middle hover:bg-white/[0.02]">
                    <td className="px-4 py-2 font-mono text-xs text-ink-100">
                      <span className="flex items-center gap-1.5">{e.isSecret && <KeyRound size={11} className="text-amber-300" />}{e.key}{e.isRequired && !e.value && <span className="h-1.5 w-1.5 rounded-full bg-amber-300" title="Required" />}</span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {editing === e.id ? (
                        <div className="flex items-center gap-1">
                          <input className="input py-1 font-mono text-xs" value={draft} onChange={(ev) => setDraft(ev.target.value)} autoFocus onKeyDown={(ev) => ev.key === "Enter" && save(e)} />
                          <button className="btn-primary btn-sm" onClick={() => save(e)} disabled={busy}><Check size={12} /></button>
                          <button className="btn-ghost btn-sm" onClick={() => setEditing(null)}><X size={12} /></button>
                        </div>
                      ) : (
                        <span className={cn("block max-w-[260px] truncate", e.value ? "text-ink-300" : "italic text-ink-600")}>{e.value ? (shown ? e.value : "•".repeat(Math.min(e.value.length, 24))) : "not set"}</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-2 text-xs text-ink-400 md:table-cell">{e.description}</td>
                    <td className="px-4 py-2"><span className="chip">{e.source}</span></td>
                    <td className="px-2 py-2">
                      <div className="flex justify-end gap-0.5">
                        {e.isSecret && (
                          <button className="btn-ghost btn-icon h-7 w-7" onClick={() => setReveal((s) => { const n = new Set(s); n.has(e.id) ? n.delete(e.id) : n.add(e.id); return n; })} title={shown ? "Hide" : "Reveal"}>
                            {shown ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        )}
                        <button className="btn-ghost btn-icon h-7 w-7" onClick={() => toggleSecret(e)} title={e.isSecret ? "Mark as plain" : "Mark as secret"}><KeyRound size={13} className={e.isSecret ? "text-amber-300" : ""} /></button>
                        <button className="btn-ghost btn-icon h-7 w-7" onClick={() => { setEditing(e.id); setDraft(e.value); }} title="Edit value"><Pencil size={13} /></button>
                        <button className="btn-ghost btn-icon h-7 w-7 text-rose-300" onClick={() => remove(e)} title="Delete"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
