"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, KeyRound, PlugZap, Trash2, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Spinner } from "@/components/ui";
import { AGENT_ORDER, AGENTS } from "@/lib/agents";
import { api, cn } from "@/lib/utils";

interface Settings {
  provider: "openai" | "azure" | "anthropic" | "custom";
  model: string;
  baseUrl: string | null;
  temperature: number;
  apiKeyMasked: string | null;
  hasKey: boolean;
  envKeyPresent: boolean;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  lastTestMessage: string | null;
}

const PROVIDERS: Array<{ id: Settings["provider"]; label: string; hint: string; models: string[] }> = [
  { id: "openai", label: "OpenAI", hint: "api.openai.com", models: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "o4-mini"] },
  { id: "azure", label: "Azure OpenAI", hint: "https://<resource>.openai.azure.com", models: ["gpt-4.1", "gpt-4o"] },
  { id: "anthropic", label: "Anthropic", hint: "api.anthropic.com", models: ["claude-sonnet-4-5", "claude-opus-4-1", "claude-haiku-4-5"] },
  { id: "custom", label: "OpenAI-compatible", hint: "e.g. http://localhost:11434/v1", models: ["llama-3.3-70b", "qwen2.5-coder", "deepseek-v3"] },
];

export function SettingsPanel() {
  const [s, setS] = useState<Settings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    api<Settings>("/api/settings/ai").then(setS).catch(() => toast.error("Could not load settings"));
  }, []);

  async function save() {
    if (!s) return;
    setSaving(true);
    try {
      const next = await api<Settings>("/api/settings/ai", { method: "PUT", body: JSON.stringify({ provider: s.provider, model: s.model, baseUrl: s.baseUrl, temperature: s.temperature / 100, apiKey: apiKey || undefined }) });
      setS(next);
      setApiKey("");
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    try {
      const r = await api<{ status: string; message: string }>("/api/settings/ai/test", { method: "POST" });
      toast.success(r.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setTesting(false);
      api<Settings>("/api/settings/ai").then(setS);
    }
  }

  async function clearKey() {
    if (!confirm("Remove the stored API key?")) return;
    const next = await api<Settings>("/api/settings/ai", { method: "DELETE" });
    setS(next);
    toast.success("API key removed");
  }

  const provider = PROVIDERS.find((p) => p.id === s?.provider) ?? PROVIDERS[0];

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight">AI Settings</h1>
        <p className="mt-1 text-sm text-ink-400">Connect a model provider. The built-in generation engine works without a key; a key enables live connection checks and future model-backed steps.</p>
      </div>

      {!s ? (
        <div className="panel h-72 animate-pulse" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="panel space-y-6 p-6">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-ink-400">Provider</label>
              <div className="grid gap-2 sm:grid-cols-4">
                {PROVIDERS.map((p) => (
                  <button key={p.id} onClick={() => setS({ ...s, provider: p.id, model: p.models[0] })} className={cn("rounded-xl border px-3 py-3 text-left transition", s.provider === p.id ? "border-brand-400/60 bg-brand-500/15" : "border-white/10 bg-white/[0.02] hover:border-white/20")}>
                    <div className="text-sm font-medium">{p.label}</div>
                    <div className="mt-0.5 truncate text-[11px] text-ink-500">{p.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-ink-400">Model</label>
                <input className="input font-mono" list="models" value={s.model} onChange={(e) => setS({ ...s, model: e.target.value })} />
                <datalist id="models">
                  {provider.models.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-ink-400">Temperature · {(s.temperature / 100).toFixed(2)}</label>
                <input type="range" min={0} max={200} value={s.temperature} onChange={(e) => setS({ ...s, temperature: Number(e.target.value) })} className="mt-3 w-full accent-brand-500" />
              </div>
            </div>

            {(s.provider === "azure" || s.provider === "custom") && (
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-ink-400">Base URL</label>
                <input className="input font-mono" placeholder={provider.hint} value={s.baseUrl ?? ""} onChange={(e) => setS({ ...s, baseUrl: e.target.value })} />
              </div>
            )}

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-ink-400">API key</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <KeyRound size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                  <input type="password" className="input pl-9 font-mono" placeholder={s.hasKey ? `Stored: ${s.apiKeyMasked}` : "sk-…"} value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" />
                </div>
                {s.hasKey && (
                  <button className="btn-danger" onClick={clearKey} title="Remove key"><Trash2 size={15} /></button>
                )}
              </div>
              <p className="mt-1.5 text-[11px] text-ink-500">Keys are stored server-side and never sent to the browser. {s.envKeyPresent && <span className="text-mint-400">OPENAI_API_KEY is also present in the environment.</span>}</p>
            </div>

            <div className="flex items-center gap-2 border-t border-white/8 pt-5">
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? <Spinner /> : <CheckCircle2 size={15} />} Save settings</button>
              <button className="btn-secondary" onClick={test} disabled={testing}>{testing ? <Spinner /> : <PlugZap size={15} />} Test connection</button>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="panel p-5">
              <h2 className="text-sm font-semibold">Connection status</h2>
              {s.lastTestStatus ? (
                <div className={cn("mt-3 flex gap-3 rounded-xl border p-3 text-sm", s.lastTestStatus === "success" ? "border-mint-400/30 bg-mint-400/10 text-mint-300" : "border-rose-400/30 bg-rose-400/10 text-rose-300")}>
                  {s.lastTestStatus === "success" ? <CheckCircle2 size={18} className="shrink-0" /> : <XCircle size={18} className="shrink-0" />}
                  <div>
                    <div>{s.lastTestMessage}</div>
                    {s.lastTestedAt && <div className="mt-1 text-[11px] opacity-70">Tested {new Date(s.lastTestedAt).toLocaleString()}</div>}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-ink-500">Not tested yet.</p>
              )}
            </div>
            <div className="panel p-5">
              <h2 className="mb-3 text-sm font-semibold">Model per agent</h2>
              <ul className="space-y-2">
                {AGENT_ORDER.map((r) => (
                  <li key={r} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-ink-200"><span>{AGENTS[r].emoji}</span>{AGENTS[r].name}</span>
                    <span className="font-mono text-ink-400">{AGENTS[r].model}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-ink-500">Planning agents use the larger model; implementation agents use the cost-efficient one.</p>
            </div>
          </aside>
        </div>
      )}
    </AppShell>
  );
}
