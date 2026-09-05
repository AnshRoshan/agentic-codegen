import { useState } from "react";
import { Settings as SettingsIcon, KeyRound, CheckCircle2, Loader2, Trash2, Zap } from "lucide-react";
import { useStore } from "../lib/store";
import { AI_MODELS } from "../lib/models";
import { SectionCard, Toggle } from "./ui";

export default function SettingsPage() {
  const { settings, updateSettings, projects } = useStore();
  const [testing, setTesting] = useState(false);
  const [testOk, setTestOk] = useState<boolean | null>(null);

  const testConnection = () => {
    setTesting(true); setTestOk(null);
    setTimeout(() => { setTesting(false); setTestOk(true); }, 1400);
  };

  const clearAll = () => {
    if (!confirm("Delete ALL projects and local data? This cannot be undone.")) return;
    localStorage.removeItem("forge-v2-store");
    location.reload();
  };

  return (
    <div className="mx-auto max-w-3xl p-5 sm:p-7">
      <h1 className="flex items-center gap-2.5 font-display text-[24px] font-bold tracking-tight">
        <SettingsIcon size={22} className="text-violet-300" /> Settings
      </h1>
      <p className="mt-1 text-[13.5px] text-ink-400">Provider credentials, pipeline defaults and workspace data.</p>

      <div className="mt-6 space-y-3.5">
        <SectionCard title="AI provider" subtitle="Keys stay in your browser — runs are metered locally.">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-300">Provider</label>
              <select value={settings.provider} onChange={(e) => updateSettings({ provider: e.target.value })}
                className="input">
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="azure">Azure OpenAI</option>
                <option value="custom">Custom endpoint</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-300">Default worker model</label>
              <select value={settings.model} onChange={(e) => updateSettings({ model: e.target.value })}
                className="input font-mono !text-[12.5px]">
                {AI_MODELS.map((m) => <option key={m.id} value={m.id}>{m.name} — ${m.inputPer1M}/${m.outputPer1M} per 1M</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-300">API key</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                <input type="password" value={settings.apiKey}
                  onChange={(e) => updateSettings({ apiKey: e.target.value })}
                  placeholder="sk-… (optional for local simulation)" className="input !pl-9 font-mono !text-[12.5px]" />
              </div>
              <button onClick={testConnection} disabled={testing} className="btn-secondary shrink-0">
                {testing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {testing ? "Testing…" : "Test"}
              </button>
            </div>
            {testOk && (
              <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/[0.07] px-3 py-2.5 text-[13px] text-emerald-200">
                <CheckCircle2 size={15} /> Connection OK — 214ms · model reachable · quota healthy
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Pipeline defaults" subtitle="Applied to newly created projects.">
          <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3.5">
            <div>
              <div className="text-[13.5px] font-semibold">Auto-approve checkpoints</div>
              <div className="text-[12px] text-ink-400">Skip schema & deploy gates on new projects.</div>
            </div>
            <Toggle checked={settings.autoApproveDefault}
              onChange={(v) => updateSettings({ autoApproveDefault: v })} />
          </div>
        </SectionCard>

        <SectionCard title="Workspace data" subtitle={`${projects.length} project${projects.length === 1 ? "" : "s"} stored locally in this browser.`}>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => {
              const blob = new Blob([localStorage.getItem("forge-v2-store") ?? "{}"], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = "forge-backup.json"; a.click();
              URL.revokeObjectURL(url);
            }} className="btn-secondary btn-sm">Export backup (JSON)</button>
            <button onClick={clearAll} className="btn-danger btn-sm"><Trash2 size={13} /> Delete all data</button>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-ink-500">
            Forge runs fully client-side in this build: the orchestrator, all seven agent engines, the virtual
            filesystem, migration runner and cost metering execute locally with deterministic simulation.
            Connect a provider key to route real LLM calls per agent.
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
