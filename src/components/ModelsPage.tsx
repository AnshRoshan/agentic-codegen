import { useMemo, useState } from "react";
import { Cpu, Search, ArrowUpDown, Check, Zap } from "lucide-react";
import { AI_MODELS, PROVIDERS } from "../lib/models";
import { useStore } from "../lib/store";
import { Meter } from "./ui";
import { cn } from "../utils/cn";

type SortKey = "quality" | "speed" | "inputPer1M" | "contextTokens";

export default function ModelsPage() {
  const { settings, updateSettings } = useStore();
  const [provider, setProvider] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("quality");
  const [compare, setCompare] = useState<string[]>([]);

  const list = useMemo(() => {
    let rows = AI_MODELS.filter((m) =>
      (provider === "All" || m.provider === provider) &&
      (!query || `${m.name} ${m.id} ${m.bestFor.join(" ")}`.toLowerCase().includes(query.toLowerCase())));
    rows = [...rows].sort((a, b) => {
      if (sort === "inputPer1M") return a.inputPer1M - b.inputPer1M;
      return b[sort] - a[sort];
    });
    return rows;
  }, [provider, query, sort]);

  const toggleCompare = (id: string) =>
    setCompare((c) => c.includes(id) ? c.filter((x) => x !== id) : [...c, id].slice(-3));

  const compared = AI_MODELS.filter((m) => compare.includes(m.id));

  return (
    <div className="mx-auto max-w-6xl p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 font-display text-[24px] font-bold tracking-tight">
            <Cpu size={22} className="text-violet-300" /> Model catalog
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-400">
            {AI_MODELS.length} models · priced per 1M tokens · default worker: <span className="font-mono text-ink-200">{settings.model}</span>
          </p>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search models, uses…"
            className="input !w-[240px] !py-2 !pl-9 !text-[13px]" />
        </div>
      </div>

      {/* Filters */}
      <div className="mt-5 flex flex-wrap items-center gap-1.5">
        {PROVIDERS.map((p) => (
          <button key={p} onClick={() => setProvider(p)}
            className={cn("rounded-lg px-3 py-1.5 text-[13px] font-medium transition",
              provider === p ? "bg-white/[0.09] text-white" : "text-ink-400 hover:bg-white/[0.05] hover:text-white")}>
            {p}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 text-[12.5px] text-ink-400">
          <ArrowUpDown size={13} />
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="input !w-auto !py-1.5 !text-[12.5px]">
            <option value="quality">Sort: quality</option>
            <option value="speed">Sort: speed</option>
            <option value="inputPer1M">Sort: cheapest</option>
            <option value="contextTokens">Sort: context</option>
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
            <thead>
              <tr className="text-left text-ink-500">
                <th className="pb-2 font-medium">Metric</th>
                {compared.map((m) => <th key={m.id} className="pb-2 font-semibold text-ink-100">{m.name}</th>)}
              </tr>
            </thead>
            <tbody className="[&_td]:py-1.5 [&_tr]:border-t [&_tr]:border-white/[0.06]">
              <tr><td className="text-ink-400">Input / 1M</td>{compared.map((m) => <td key={m.id} className="font-mono">${m.inputPer1M}</td>)}</tr>
              <tr><td className="text-ink-400">Output / 1M</td>{compared.map((m) => <td key={m.id} className="font-mono">${m.outputPer1M}</td>)}</tr>
              <tr><td className="text-ink-400">Context</td>{compared.map((m) => <td key={m.id} className="font-mono">{m.context}</td>)}</tr>
              <tr><td className="text-ink-400">Quality</td>{compared.map((m) => <td key={m.id}><Meter value={m.quality} /></td>)}</tr>
              <tr><td className="text-ink-400">Speed</td>{compared.map((m) => <td key={m.id}><Meter value={m.speed} /></td>)}</tr>
              <tr><td className="text-ink-400">Est. run cost*</td>{compared.map((m) => {
                const est = (22000 * m.inputPer1M + 28000 * m.outputPer1M) / 1_000_000;
                return <td key={m.id} className="font-mono text-emerald-300">${est.toFixed(2)}</td>;
              })}</tr>
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-ink-500">*Estimated full 14-step run: ~22K in / ~28K out tokens.</p>
        </div>
      )}

      {/* Catalog table */}
      <div className="card mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead>
              <tr className="border-b border-white/[0.07] bg-white/[0.02] text-left text-[11px] uppercase tracking-wider text-ink-500">
                <th className="px-4 py-3 font-semibold">Model</th>
                <th className="px-4 py-3 font-semibold">Provider</th>
                <th className="px-4 py-3 font-semibold">Context</th>
                <th className="px-4 py-3 font-semibold">In / 1M</th>
                <th className="px-4 py-3 font-semibold">Out / 1M</th>
                <th className="px-4 py-3 font-semibold">Quality</th>
                <th className="px-4 py-3 font-semibold">Speed</th>
                <th className="px-4 py-3 font-semibold">Best for</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {list.map((m) => {
                const isDefault = settings.model === m.id;
                return (
                  <tr key={m.id} className={cn("transition hover:bg-white/[0.025]", compare.includes(m.id) && "bg-violet-500/[0.05]")}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{m.name}</span>
                        {isDefault && <span className="chip !py-0 !text-[9.5px] border-emerald-400/40 bg-emerald-400/10 text-emerald-200">default</span>}
                        {m.recommended && <span className="chip !py-0 !text-[9.5px]" title={`Recommended for ${m.recommended}`}><Zap size={10} /> {m.recommended}</span>}
                      </div>
                      <div className="font-mono text-[11px] text-ink-500">{m.id}</div>
                    </td>
                    <td className="px-4 py-3"><span className="chip !text-[11px]">{m.provider}</span></td>
                    <td className="px-4 py-3 font-mono text-[12px]">{m.context}</td>
                    <td className="px-4 py-3 font-mono">${m.inputPer1M.toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono">${m.outputPer1M.toFixed(2)}</td>
                    <td className="px-4 py-3"><Meter value={m.quality} /></td>
                    <td className="px-4 py-3"><Meter value={m.speed} /></td>
                    <td className="max-w-[190px] px-4 py-3 text-[12px] text-ink-400">{m.bestFor.join(" · ")}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => toggleCompare(m.id)}
                          className={cn("btn-sm rounded-lg border px-2.5 py-1 text-[12px] transition",
                            compare.includes(m.id) ? "border-violet-400/50 bg-violet-500/15 text-violet-200" : "border-white/10 text-ink-300 hover:bg-white/[0.06]")}>
                          Compare
                        </button>
                        {!isDefault && (
                          <button onClick={() => updateSettings({ model: m.id })}
                            className="btn-sm rounded-lg border border-white/10 px-2.5 py-1 text-[12px] text-ink-300 transition hover:bg-white/[0.06]">
                            Set default
                          </button>
                        )}
                        {isDefault && <span className="grid h-[30px] w-[30px] place-items-center text-emerald-300"><Check size={15} /></span>}
                      </div>
                      <div className="mt-1 flex justify-end gap-1">
                        {m.capabilities.slice(0, 3).map((c) => (
                          <span key={c} className="font-mono text-[10px] text-ink-500">{c}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-3 text-[12px] text-ink-500">
        Pricing is per 1M tokens. The orchestrator and architect use the frontier model; specialists use the default worker unless overridden.
      </p>
    </div>
  );
}
