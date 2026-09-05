"use client";
import { useEffect, useMemo, useState } from "react";
import { Cpu, Search, ArrowUpDown, Check, Zap, Brain, Eye, Wrench, Braces, Unlock, Gauge, ShieldAlert, Route, Sparkles, X, Info } from "lucide-react";
import { AI_MODELS, PROVIDERS, PROVIDER_KEY_LABELS, ROLE_STEP_TOKENS, estimateRoutedRunCostUsd, estimateRunCostUsd, findModel, formatContext, type AIModel, type Capability, type ModelTier } from "../lib/models";

const RUN_TOKENS = Object.values(ROLE_STEP_TOKENS).reduce((acc, t) => ({ in: acc.in + t.in * t.steps, out: acc.out + t.out * t.steps }), { in: 0, out: 0 });
import { AGENT_ORDER, AGENTS } from "../lib/types";
import { useStore } from "../lib/store";
import { Meter, SectionCard } from "./ui";
import { cn } from "../utils/cn";

type SortKey = "quality" | "coding" | "speed" | "inputPer1M" | "contextTokens" | "released";
const TIERS: Array<{ id: ModelTier | "all"; label: string }> = [
  { id: "all", label: "All tiers" }, { id: "frontier", label: "Frontier" }, { id: "balanced", label: "Balanced" },
  { id: "fast", label: "Fast & cheap" }, { id: "reasoning", label: "Reasoning" }, { id: "coder", label: "Code-specialised" },
];
const CAP_ICON: Record<Capability, { icon: React.ReactNode; label: string }> = {
  tools: { icon: <Wrench size={11} />, label: "Tool calling" },
  structured: { icon: <Braces size={11} />, label: "Structured output" },
  reasoning: { icon: <Brain size={11} />, label: "Extended reasoning" },
  vision: { icon: <Eye size={11} />, label: "Vision" },
  audio: { icon: <Sparkles size={11} />, label: "Audio" },
  "open-weights": { icon: <Unlock size={11} />, label: "Open weights" },
  "long-context": { icon: <Gauge size={11} />, label: "≥256K context" },
  fim: { icon: <Braces size={11} />, label: "Fill-in-the-middle" },
  cache: { icon: <Zap size={11} />, label: "Prompt caching" },
};

export default function ModelsPage() {
  const { settings, updateSettings, showToast } = useStore();
  const [provider, setProvider] = useState<string>("All");
  const [tier, setTier] = useState<ModelTier | "all">("all");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [toolsOnly, setToolsOnly] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("quality");
  const [compare, setCompare] = useState<string[]>([]);
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const [routing, setRouting] = useState<Record<string, string>>(settings.agentModels ?? {});
  const [savingRoute, setSavingRoute] = useState(false);

  useEffect(() => { setRouting(settings.agentModels ?? {}); }, [settings.agentModels]);
  useEffect(() => {
    fetch("/api/models", { cache: "no-store" }).then((r) => r.json()).then((d: { models?: Array<{ id: string; available: boolean }> }) => {
      if (d.models) setAvailability(Object.fromEntries(d.models.map((m) => [m.id, m.available])));
    }).catch(() => undefined);
  }, [settings.provider, settings.isConfigured]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = AI_MODELS.filter((m) =>
      (provider === "All" || m.provider === provider) &&
      (tier === "all" || m.tier === tier) &&
      (!onlyAvailable || availability[m.id]) &&
      (!toolsOnly || m.capabilities.includes("tools")) &&
      (!q || `${m.name} ${m.id} ${m.family} ${m.provider} ${m.bestFor.join(" ")} ${m.capabilities.join(" ")}`.toLowerCase().includes(q)));
    rows = [...rows].sort((a, b) => {
      if (sort === "inputPer1M") return a.inputPer1M - b.inputPer1M;
      if (sort === "released") return b.released.localeCompare(a.released);
      return (b[sort] as number) - (a[sort] as number) || a.inputPer1M - b.inputPer1M;
    });
    return rows;
  }, [provider, tier, onlyAvailable, toolsOnly, query, sort, availability]);

  const toggleCompare = (id: string) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id].slice(-3)));
  const compared = AI_MODELS.filter((m) => compare.includes(m.id));
  const defaultModel = findModel(settings.model);
  const routedCost = estimateRoutedRunCostUsd(routing, settings.model);
  const flatCost = defaultModel ? estimateRunCostUsd(defaultModel) : 0;
  const routingDirty = JSON.stringify(routing) !== JSON.stringify(settings.agentModels ?? {});
  const configuredLabel = settings.isConfigured ? PROVIDER_KEY_LABELS[settings.provider] : null;

  const setDefault = async (id: string) => {
    if (await updateSettings({ model: id })) showToast(`Default worker model set to ${id}`);
  };
  const saveRouting = async () => {
    setSavingRoute(true);
    const ok = await updateSettings({ agentModels: routing });
    setSavingRoute(false);
    if (ok) showToast("Agent routing saved");
  };
  const applyRecommended = () => {
    const next: Record<string, string> = {};
    for (const role of AGENT_ORDER) {
      const pick = AI_MODELS.filter((m) => m.recommendedRoles?.includes(role) && (!settings.isConfigured || availability[m.id]))
        .sort((a, b) => b.coding - a.coding || a.inputPer1M - b.inputPer1M)[0];
      if (pick) next[role] = pick.id;
    }
    setRouting(next);
  };

  return (
    <div className="mx-auto max-w-7xl p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 font-display text-[24px] font-bold tracking-tight">
            <Cpu size={22} className="text-violet-300" /> Model catalog
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-400">
            {AI_MODELS.length} models · list price per 1M tokens · default worker <span className="font-mono text-ink-200">{settings.model}</span>
            {configuredLabel ? <> · provider <span className="text-emerald-300">{configuredLabel}</span></> : <> · <span className="text-amber-300">no provider configured</span></>}
          </p>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search models, families, capabilities…" className="input !w-[280px] !py-2 !pl-9 !text-[13px]" />
        </div>
      </div>

      {/* Agent routing */}
      <SectionCard className="mt-5" title="Per-agent routing" subtitle="Route each specialist to the model that fits its job. Unset roles use the default worker (planners fall back to the planner model if set)."
        right={<div className="flex items-center gap-2">
          <button onClick={applyRecommended} className="btn-secondary btn-sm"><Sparkles size={13} /> Use recommended</button>
          <button onClick={() => setRouting({})} className="btn-ghost btn-sm">Clear</button>
          <button onClick={saveRouting} disabled={!routingDirty || savingRoute} className="btn-primary btn-sm"><Route size={13} /> {savingRoute ? "Saving…" : "Save routing"}</button>
        </div>}>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {AGENT_ORDER.map((role) => {
            const a = AGENTS[role];
            const current = routing[role] ?? "";
            const m = findModel(current || settings.model);
            const incompatible = current && settings.isConfigured && availability[current] === false;
            return (
              <div key={role} className={cn("rounded-xl border bg-white/[0.02] p-3", incompatible ? "border-rose-400/40" : "border-white/[0.07]")}>
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg text-[14px]" style={{ background: `${a.color}22` }}>{a.emoji}</span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold">{a.name}</div>
                    <div className="truncate text-[11px] text-ink-500">{a.tagline}</div>
                  </div>
                </div>
                <select value={current} onChange={(e) => setRouting((r) => ({ ...r, [role]: e.target.value }))} className="input mt-2.5 !py-1.5 font-mono !text-[12px]">
                  <option value="">default ({settings.model})</option>
                  {AI_MODELS.filter((x) => x.capabilities.includes("tools") || role === "orchestrator").map((x) => (
                    <option key={x.id} value={x.id} disabled={settings.isConfigured && availability[x.id] === false}>
                      {x.name} — ${x.inputPer1M}/${x.outputPer1M}{settings.isConfigured && availability[x.id] === false ? " (not on provider)" : ""}
                    </option>
                  ))}
                </select>
                <div className="mt-1.5 flex items-center justify-between font-mono text-[10.5px] text-ink-500">
                  <span>{m ? `${formatContext(m.contextTokens)} ctx` : "unknown model"}</span>
                  {incompatible ? <span className="flex items-center gap-1 text-rose-300"><ShieldAlert size={10} /> not routable</span> : m?.recommendedRoles?.includes(role) ? <span className="flex items-center gap-1 text-emerald-300"><Check size={10} /> recommended</span> : null}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-ink-400">
          <span>Estimated full run with this routing: <span className="font-mono text-emerald-300">${routedCost.toFixed(2)}</span></span>
          <span>Flat on default worker: <span className="font-mono text-ink-200">${flatCost.toFixed(2)}</span></span>
          <span className="flex items-center gap-1 text-ink-500"><Info size={11} /> Based on per-role token averages (≈{Math.round(RUN_TOKENS.in / 1000)}K in / {Math.round(RUN_TOKENS.out / 1000)}K out per full run).</span>
        </div>
      </SectionCard>

      {/* Filters */}
      <div className="mt-5 flex flex-wrap items-center gap-1.5">
        {PROVIDERS.map((p) => (
          <button key={p} onClick={() => setProvider(p)}
            className={cn("rounded-lg px-3 py-1.5 text-[13px] font-medium transition", provider === p ? "bg-white/[0.09] text-white" : "text-ink-400 hover:bg-white/[0.05] hover:text-white")}>
            {p}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2 text-[12.5px] text-ink-400">
          <select value={tier} onChange={(e) => setTier(e.target.value as ModelTier | "all")} className="input !w-auto !py-1.5 !text-[12.5px]">
            {TIERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" checked={toolsOnly} onChange={(e) => setToolsOnly(e.target.checked)} className="accent-violet-500" /> tool-capable</label>
          <label className={cn("flex items-center gap-1.5", settings.isConfigured ? "cursor-pointer" : "opacity-50")}><input type="checkbox" disabled={!settings.isConfigured} checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} className="accent-violet-500" /> on my provider</label>
          <ArrowUpDown size={13} />
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="input !w-auto !py-1.5 !text-[12.5px]">
            <option value="quality">Sort: quality</option>
            <option value="coding">Sort: coding</option>
            <option value="speed">Sort: speed</option>
            <option value="inputPer1M">Sort: cheapest</option>
            <option value="contextTokens">Sort: context</option>
            <option value="released">Sort: newest</option>
          </select>
        </div>
      </div>

      {/* Compare tray */}
      {compared.length > 0 && (
        <div className="card mt-4 overflow-x-auto p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[13px] font-semibold">Comparing {compared.length}</span>
            <button onClick={() => setCompare([])} className="text-[12px] text-ink-400 hover:text-white">Clear</button>
          </div>
          <table className="w-full min-w-[560px] text-[12.5px]">
            <thead><tr className="text-left text-ink-500"><th className="pb-2 font-medium">Metric</th>{compared.map((m) => <th key={m.id} className="pb-2 font-semibold text-ink-100">{m.name}</th>)}</tr></thead>
            <tbody className="[&_td]:py-1.5 [&_tr]:border-t [&_tr]:border-white/[0.06]">
              <tr><td className="text-ink-400">Input / 1M</td>{compared.map((m) => <td key={m.id} className="font-mono">${m.inputPer1M}</td>)}</tr>
              <tr><td className="text-ink-400">Output / 1M</td>{compared.map((m) => <td key={m.id} className="font-mono">${m.outputPer1M}</td>)}</tr>
              <tr><td className="text-ink-400">Cached input</td>{compared.map((m) => <td key={m.id} className="font-mono">{m.cachedInputPer1M ? `$${m.cachedInputPer1M}` : "—"}</td>)}</tr>
              <tr><td className="text-ink-400">Context / max out</td>{compared.map((m) => <td key={m.id} className="font-mono">{formatContext(m.contextTokens)} / {formatContext(m.maxOutputTokens)}</td>)}</tr>
              <tr><td className="text-ink-400">Quality</td>{compared.map((m) => <td key={m.id}><Meter value={m.quality} /></td>)}</tr>
              <tr><td className="text-ink-400">Coding</td>{compared.map((m) => <td key={m.id}><Meter value={m.coding} /></td>)}</tr>
              <tr><td className="text-ink-400">Speed</td>{compared.map((m) => <td key={m.id}><Meter value={m.speed} /></td>)}</tr>
              <tr><td className="text-ink-400">Capabilities</td>{compared.map((m) => <td key={m.id} className="text-[11.5px] text-ink-300">{m.capabilities.map((c) => CAP_ICON[c].label).join(", ")}</td>)}</tr>
              <tr><td className="text-ink-400">Est. full run</td>{compared.map((m) => <td key={m.id} className="font-mono text-emerald-300">${estimateRunCostUsd(m).toFixed(2)}</td>)}</tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Catalog */}
      <div className="card mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-[13px]">
            <thead>
              <tr className="border-b border-white/[0.07] bg-white/[0.02] text-left text-[11px] uppercase tracking-wider text-ink-500">
                <th className="px-4 py-3 font-semibold">Model</th>
                <th className="px-4 py-3 font-semibold">Tier</th>
                <th className="px-4 py-3 font-semibold">Context</th>
                <th className="px-4 py-3 font-semibold">In / Out per 1M</th>
                <th className="px-4 py-3 font-semibold">Quality</th>
                <th className="px-4 py-3 font-semibold">Coding</th>
                <th className="px-4 py-3 font-semibold">Speed</th>
                <th className="px-4 py-3 font-semibold">Capabilities</th>
                <th className="px-4 py-3 font-semibold">Best for</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {list.map((m) => <ModelRow key={m.id} m={m} isDefault={settings.model === m.id} available={settings.isConfigured ? !!availability[m.id] : null}
                comparing={compare.includes(m.id)} onCompare={() => toggleCompare(m.id)} onDefault={() => setDefault(m.id)} />)}
              {list.length === 0 && <tr><td colSpan={10} className="px-4 py-10 text-center text-[13px] text-ink-500">No models match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-3 flex items-start gap-1.5 text-[12px] leading-relaxed text-ink-500">
        <Info size={12} className="mt-0.5 shrink-0" />
        <span>Prices are public list prices without caching or batch discounts and may drift. Models marked “not on provider” cannot be served by your configured provider — switch provider or use an OpenAI-compatible gateway (OpenRouter, LiteLLM, vLLM) via the <em>Custom endpoint</em> option. Reasoning-only models without tool calling are suitable for planning steps only.</span>
      </p>
    </div>
  );
}

function ModelRow({ m, isDefault, available, comparing, onCompare, onDefault }: { m: AIModel; isDefault: boolean; available: boolean | null; comparing: boolean; onCompare: () => void; onDefault: () => void }) {
  const tierClass: Record<ModelTier, string> = {
    frontier: "border-violet-400/40 bg-violet-500/10 text-violet-200", balanced: "border-cyan-400/40 bg-cyan-500/10 text-cyan-200",
    fast: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200", reasoning: "border-amber-400/40 bg-amber-500/10 text-amber-200", coder: "border-pink-400/40 bg-pink-500/10 text-pink-200",
  };
  return (
    <tr className={cn("transition hover:bg-white/[0.025]", comparing && "bg-violet-500/[0.05]", available === false && "opacity-60")}>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold">{m.name}</span>
          {isDefault && <span className="chip !py-0 !text-[9.5px] border-emerald-400/40 bg-emerald-400/10 text-emerald-200">default</span>}
          {available === true && !isDefault && <span className="chip !py-0 !text-[9.5px] border-emerald-400/30 text-emerald-300"><Check size={9} /> on provider</span>}
          {available === false && <span className="chip !py-0 !text-[9.5px] border-rose-400/30 text-rose-300"><X size={9} /> not on provider</span>}
        </div>
        <div className="mt-0.5 font-mono text-[11px] text-ink-500">{m.id} · {m.provider} · {m.released}</div>
        {m.recommendedRoles && <div className="mt-1 flex flex-wrap gap-1">{m.recommendedRoles.map((r) => <span key={r} className="chip !px-1.5 !py-0 !text-[9.5px]"><Zap size={9} /> {r}</span>)}</div>}
      </td>
      <td className="px-4 py-3"><span className={cn("chip !text-[10.5px] capitalize", tierClass[m.tier])}>{m.tier}</span></td>
      <td className="px-4 py-3 font-mono text-[12px]">{formatContext(m.contextTokens)}<div className="text-[10.5px] text-ink-500">out {formatContext(m.maxOutputTokens)}</div></td>
      <td className="px-4 py-3 font-mono">${m.inputPer1M.toFixed(2)} <span className="text-ink-500">/</span> ${m.outputPer1M.toFixed(2)}{m.cachedInputPer1M !== undefined && <div className="text-[10.5px] text-ink-500">cached ${m.cachedInputPer1M}</div>}</td>
      <td className="px-4 py-3"><Meter value={m.quality} /></td>
      <td className="px-4 py-3"><Meter value={m.coding} /></td>
      <td className="px-4 py-3"><Meter value={m.speed} /></td>
      <td className="px-4 py-3">
        <div className="flex max-w-[150px] flex-wrap gap-1">
          {m.capabilities.map((c) => <span key={c} title={CAP_ICON[c].label} className="grid h-5 w-5 place-items-center rounded-md border border-white/10 bg-white/[0.03] text-ink-300">{CAP_ICON[c].icon}</span>)}
        </div>
      </td>
      <td className="max-w-[190px] px-4 py-3 text-[12px] text-ink-400">{m.bestFor.join(" · ")}{m.notes && <div className="mt-0.5 text-[11px] text-ink-500">{m.notes}</div>}</td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-1.5">
          <button onClick={onCompare} className={cn("btn-sm rounded-lg border px-2.5 py-1 text-[12px] transition", comparing ? "border-violet-400/50 bg-violet-500/15 text-violet-200" : "border-white/10 text-ink-300 hover:bg-white/[0.06]")}>Compare</button>
          {!isDefault ? (
            <button onClick={onDefault} disabled={available === false || !m.capabilities.includes("tools")} title={!m.capabilities.includes("tools") ? "Agents need tool calling" : undefined}
              className="btn-sm rounded-lg border border-white/10 px-2.5 py-1 text-[12px] text-ink-300 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40">Set default</button>
          ) : <span className="grid h-[30px] w-[30px] place-items-center text-emerald-300"><Check size={15} /></span>}
        </div>
      </td>
    </tr>
  );
}
