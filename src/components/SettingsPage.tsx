"use client";
import { useEffect, useState } from "react";
import { Settings as SettingsIcon, KeyRound, CheckCircle2, XCircle, Loader2, Zap, Save, ShieldCheck, Cpu, Wallet, RefreshCw, Server, Info } from "lucide-react";
import { useStore, type Settings } from "../lib/store";
import { AI_MODELS, PROVIDER_KEY_LABELS, findModel, formatCost, type ProviderKey } from "../lib/models";
import { SectionCard, Toggle } from "./ui";
import { cn } from "../utils/cn";

const PROVIDER_HELP: Record<ProviderKey, { keyPlaceholder: string; baseUrl?: string; note: string }> = {
  openai: { keyPlaceholder: "sk-…", note: "Uses the OpenAI Responses API. GPT-5 / o-series ignore temperature automatically." },
  anthropic: { keyPlaceholder: "sk-ant-…", note: "Claude 4 family. Sonnet 4.5 is the best price/quality for agentic coding." },
  google: { keyPlaceholder: "AIza…", note: "Google AI Studio key. Gemini 2.5 Flash is the cheapest tool-capable frontier model." },
  azure: { keyPlaceholder: "Azure OpenAI key", note: "Model field must be your deployment name. Provide the resource name or a full base URL." },
  custom: { keyPlaceholder: "Bearer token", baseUrl: "https://openrouter.ai/api/v1", note: "Any OpenAI-compatible chat completions endpoint: OpenRouter, Together, Groq, DeepSeek, xAI, LiteLLM, vLLM, Ollama…" },
};

export default function SettingsPage() {
  const { settings, updateSettings, testConnection, projects, showToast } = useStore();
  const [form, setForm] = useState<{ provider: ProviderKey; apiKey: string; baseUrl: string; model: string; plannerModel: string; azureResourceName: string; azureApiVersion: string }>({
    provider: settings.provider, apiKey: "", baseUrl: settings.baseUrl ?? "", model: settings.model, plannerModel: settings.plannerModel ?? "",
    azureResourceName: settings.azureResourceName ?? "", azureApiVersion: settings.azureApiVersion ?? "",
  });
  const [engine, setEngine] = useState({ temperature: settings.temperature, maxStepsPerTask: settings.maxStepsPerTask, maxRetries: settings.maxRetries, maxRepairIterations: settings.maxRepairIterations, budgetUsd: settings.budgetMicros / 1e6 });
  const [saving, setSaving] = useState<"provider" | "engine" | null>(null);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; message: string; latencyMs?: number } | null>(
    settings.lastTestStatus ? { ok: settings.lastTestStatus === "ok", message: settings.lastTestMessage ?? "" } : null,
  );

  useEffect(() => {
    setForm((f) => ({ ...f, provider: settings.provider, baseUrl: settings.baseUrl ?? "", model: settings.model, plannerModel: settings.plannerModel ?? "", azureResourceName: settings.azureResourceName ?? "", azureApiVersion: settings.azureApiVersion ?? "" }));
    setEngine({ temperature: settings.temperature, maxStepsPerTask: settings.maxStepsPerTask, maxRetries: settings.maxRetries, maxRepairIterations: settings.maxRepairIterations, budgetUsd: settings.budgetMicros / 1e6 });
    if (settings.lastTestStatus) setTest({ ok: settings.lastTestStatus === "ok", message: settings.lastTestMessage ?? "" });
  }, [settings]);

  const help = PROVIDER_HELP[form.provider];
  const modelsForProvider = AI_MODELS.filter((m) => form.provider === "custom" || (form.provider === "azure" ? m.provider === "OpenAI" : m.servedBy.includes(form.provider)));
  const providerDirty = form.apiKey !== "" || form.provider !== settings.provider || form.baseUrl !== (settings.baseUrl ?? "") || form.model !== settings.model || form.plannerModel !== (settings.plannerModel ?? "") || form.azureResourceName !== (settings.azureResourceName ?? "") || form.azureApiVersion !== (settings.azureApiVersion ?? "");
  const engineDirty = engine.temperature !== settings.temperature || engine.maxStepsPerTask !== settings.maxStepsPerTask || engine.maxRetries !== settings.maxRetries || engine.maxRepairIterations !== settings.maxRepairIterations || Math.round(engine.budgetUsd * 1e6) !== settings.budgetMicros;

  const saveProvider = async () => {
    setSaving("provider");
    const ok = await updateSettings({
      provider: form.provider, ...(form.apiKey ? { apiKey: form.apiKey } : {}), baseUrl: form.baseUrl || null, model: form.model.trim(),
      plannerModel: form.plannerModel.trim() || null, azureResourceName: form.azureResourceName || null, azureApiVersion: form.azureApiVersion || null,
    });
    setSaving(null);
    if (ok) { setForm((f) => ({ ...f, apiKey: "" })); setTest(null); showToast("Provider settings saved"); }
  };
  const clearKey = async () => {
    if (!confirm("Remove the stored API key? New runs will fall back to the deterministic simulation engine.")) return;
    if (await updateSettings({ apiKey: "" })) { setTest(null); showToast("API key removed"); }
  };
  const saveEngine = async () => {
    setSaving("engine");
    const ok = await updateSettings({ temperature: engine.temperature, maxStepsPerTask: engine.maxStepsPerTask, maxRetries: engine.maxRetries, maxRepairIterations: engine.maxRepairIterations, budgetMicros: Math.round(engine.budgetUsd * 1e6) });
    setSaving(null);
    if (ok) showToast("Engine settings saved");
  };
  const runTest = async () => {
    if (providerDirty) { showToast("Save the provider settings first, then test."); return; }
    setTesting(true); setTest(null);
    const r = await testConnection(form.model.trim() || undefined);
    setTest(r); setTesting(false);
  };

  const totalSpend = projects.reduce((a, p) => a + p.costMicros, 0);
  const catalog = findModel(form.model);

  return (
    <div className="mx-auto max-w-3xl p-5 sm:p-7">
      <h1 className="flex items-center gap-2.5 font-display text-[24px] font-bold tracking-tight">
        <SettingsIcon size={22} className="text-violet-300" /> Settings
      </h1>
      <p className="mt-1 text-[13.5px] text-ink-400">Provider credentials, agent engine tuning and pipeline defaults. Keys are stored server-side and never sent to the browser.</p>

      <div className="mt-6 space-y-3.5">
        <StatusBanner settings={settings} />

        <SectionCard title="AI provider" subtitle="Which API serves your agents. Save, then test the connection with a real request."
          right={settings.hasApiKey ? <span className="chip border-emerald-400/30 bg-emerald-400/10 text-[11px] text-emerald-200"><KeyRound size={11} /> key {settings.apiKeyHint}</span> : <span className="chip text-[11px] text-ink-400">no key stored</span>}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Provider">
              <select value={form.provider} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value as ProviderKey, baseUrl: e.target.value === "custom" ? f.baseUrl : "" }))} className="input">
                {(Object.keys(PROVIDER_KEY_LABELS) as ProviderKey[]).map((k) => <option key={k} value={k}>{PROVIDER_KEY_LABELS[k]}</option>)}
              </select>
            </Field>
            <Field label={form.provider === "azure" ? "Deployment name (worker)" : "Default worker model"} hint={catalog ? `${catalog.name} · $${catalog.inputPer1M}/$${catalog.outputPer1M} per 1M` : "custom id — pricing unknown, cost tracked at $1/$4 per 1M"}>
              <input list="model-ids" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} className="input font-mono !text-[12.5px]" placeholder="gpt-4.1-mini" />
              <datalist id="model-ids">{modelsForProvider.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</datalist>
            </Field>
            <Field label="Planner model (optional)" hint="Used by Orchestrator & Architect. Leave empty to use the worker.">
              <input list="model-ids" value={form.plannerModel} onChange={(e) => setForm((f) => ({ ...f, plannerModel: e.target.value }))} className="input font-mono !text-[12.5px]" placeholder="e.g. gpt-5 / claude-sonnet-4-5" />
            </Field>
            {(form.provider === "custom" || form.provider === "azure" || form.provider === "openai" || form.provider === "anthropic") && (
              <Field label={form.provider === "custom" ? "Base URL (required)" : "Base URL (optional override)"}>
                <input value={form.baseUrl} onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))} className="input font-mono !text-[12.5px]" placeholder={help.baseUrl ?? "https://…/v1"} />
              </Field>
            )}
            {form.provider === "azure" && (<>
              <Field label="Azure resource name"><input value={form.azureResourceName} onChange={(e) => setForm((f) => ({ ...f, azureResourceName: e.target.value }))} className="input font-mono !text-[12.5px]" placeholder="my-openai-resource" /></Field>
              <Field label="API version (optional)"><input value={form.azureApiVersion} onChange={(e) => setForm((f) => ({ ...f, azureApiVersion: e.target.value }))} className="input font-mono !text-[12.5px]" placeholder="2025-04-01-preview" /></Field>
            </>)}
          </div>
          <div className="mt-3">
            <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-300">API key {settings.hasApiKey && <span className="font-normal text-ink-500">— leave blank to keep the stored key</span>}</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                <input type="password" autoComplete="off" value={form.apiKey} onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                  placeholder={settings.hasApiKey ? `stored (${settings.apiKeyHint})` : help.keyPlaceholder} className="input !pl-9 font-mono !text-[12.5px]" />
              </div>
              <button onClick={saveProvider} disabled={!providerDirty || saving === "provider"} className="btn-primary shrink-0">
                {saving === "provider" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
              </button>
              <button onClick={runTest} disabled={testing || (!settings.hasApiKey && !settings.envConfigured)} className="btn-secondary shrink-0" title={providerDirty ? "Save first" : "Send a real test request"}>
                {testing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />} {testing ? "Testing…" : "Test"}
              </button>
            </div>
            <p className="mt-2 flex items-start gap-1.5 text-[12px] text-ink-500"><Info size={12} className="mt-0.5 shrink-0" /> {help.note}</p>
            {test && (
              <div className={cn("mt-2.5 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[13px]", test.ok ? "border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-200" : "border-rose-400/25 bg-rose-400/[0.07] text-rose-200")}>
                {test.ok ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <XCircle size={15} className="mt-0.5 shrink-0" />}
                <span className="break-words">{test.message}</span>
              </div>
            )}
            {settings.hasApiKey && <button onClick={clearKey} className="mt-2 text-[12px] text-ink-500 underline-offset-2 hover:text-rose-300 hover:underline">Remove stored key</button>}
          </div>
        </SectionCard>

        <SectionCard title="Agent engine" subtitle="Guard-rails for the autonomous loop. Applied to every run; projects can override in their settings."
          right={<button onClick={saveEngine} disabled={!engineDirty || saving === "engine"} className="btn-primary btn-sm">{saving === "engine" ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save</button>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Slider label="Temperature" value={engine.temperature} min={0} max={100} step={5} format={(v) => (v / 100).toFixed(2)} onChange={(v) => setEngine((e) => ({ ...e, temperature: v }))} hint="Lower = more deterministic code. Ignored by reasoning models." />
            <Slider label="Max tool steps per task" value={engine.maxStepsPerTask} min={4} max={40} step={1} onChange={(v) => setEngine((e) => ({ ...e, maxStepsPerTask: v }))} hint="Hard cap on LLM ↔ tool round-trips for one plan step." />
            <Slider label="Retries per task" value={engine.maxRetries} min={0} max={5} step={1} onChange={(v) => setEngine((e) => ({ ...e, maxRetries: v }))} hint="Re-prompts with verification feedback before falling back." />
            <Slider label="Repair rounds (quality gate)" value={engine.maxRepairIterations} min={0} max={5} step={1} onChange={(v) => setEngine((e) => ({ ...e, maxRepairIterations: v }))} hint="Static analysis → route errors back to the owning agent." />
            <Field label="Budget per project (USD)" hint="Run pauses automatically when spend reaches this amount.">
              <div className="relative"><Wallet size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                <input type="number" min={0} step={0.5} value={engine.budgetUsd} onChange={(e) => setEngine((x) => ({ ...x, budgetUsd: Math.max(0, Number(e.target.value) || 0) }))} className="input !pl-9 font-mono !text-[12.5px]" /></div>
            </Field>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3.5">
              <div className="flex items-center justify-between">
                <div><div className="text-[13.5px] font-semibold">Auto-approve checkpoints</div><div className="text-[12px] text-ink-400">Default for new projects — skips schema & deploy gates.</div></div>
                <Toggle checked={settings.autoApproveDefault} onChange={(v) => void updateSettings({ autoApproveDefault: v })} />
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Usage" subtitle={`${projects.length} project${projects.length === 1 ? "" : "s"} · ${formatCost(totalSpend)} total metered spend`}>
          <div className="grid gap-2 sm:grid-cols-3">
            <Stat icon={<Cpu size={14} />} label="LLM calls" value={projects.reduce((a, p) => a + p.llmCalls, 0).toLocaleString()} />
            <Stat icon={<RefreshCw size={14} />} label="Tool calls" value={projects.reduce((a, p) => a + p.toolCalls, 0).toLocaleString()} />
            <Stat icon={<ShieldCheck size={14} />} label="Files generated" value={projects.reduce((a, p) => a + p.generatedFiles, 0).toLocaleString()} />
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-ink-500">
            All state lives in PostgreSQL: projects, the virtual filesystem, tables, env vars, checkpoints, command logs and every LLM call with real token usage.
            Without a provider key the pipeline runs a deterministic generator through the same engine, so you can explore the workflow offline.
          </p>
        </SectionCard>
      </div>
    </div>
  );
}

function StatusBanner({ settings }: { settings: Settings }) {
  if (settings.hasApiKey) return (
    <div className="flex items-center gap-2.5 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] px-4 py-3 text-[13px] text-emerald-100">
      <CheckCircle2 size={16} className="shrink-0 text-emerald-300" />
      <span>LLM engine active via <b>{PROVIDER_KEY_LABELS[settings.provider]}</b> — new runs use real agents with tool calling.{settings.lastTestedAt ? ` Last test: ${settings.lastTestStatus === "ok" ? "passed" : "failed"}.` : " Not tested yet."}</span>
    </div>
  );
  if (settings.envConfigured) return (
    <div className="flex items-center gap-2.5 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.06] px-4 py-3 text-[13px] text-cyan-100">
      <Server size={16} className="shrink-0 text-cyan-300" />
      <span>Provider configured from server environment variables (<b>{settings.envProvider}</b>). Saving a key here overrides it.</span>
    </div>
  );
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3 text-[13px] text-amber-100">
      <Zap size={16} className="shrink-0 text-amber-300" />
      <span>No provider configured — pipelines run in <b>deterministic simulation</b>. Add a key to switch to real LLM agents.</span>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div><label className="mb-1.5 block text-[12.5px] font-semibold text-ink-300">{label}</label>{children}{hint && <p className="mt-1 text-[11.5px] text-ink-500">{hint}</p>}</div>;
}

function Slider({ label, value, min, max, step, onChange, hint, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; hint?: string; format?: (v: number) => string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[12.5px]"><span className="font-semibold text-ink-300">{label}</span><span className="font-mono text-ink-200">{format ? format(value) : value}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-violet-500" />
      {hint && <p className="mt-1 text-[11.5px] text-ink-500">{hint}</p>}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-500">{icon} {label}</div>
      <div className="mt-1 font-mono text-[18px] font-semibold">{value}</div>
    </div>
  );
}
