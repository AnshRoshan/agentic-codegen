"use client";

import { ArrowRight, Boxes, Database, GitBranch, Layers, ShieldCheck, Sparkles } from "lucide-react";
import type { WorkspaceData } from "./Workspace";
import { AGENT_ORDER, AGENTS } from "@/lib/agents";
import { cn, formatCost, formatTokens } from "@/lib/utils";

const TYPE_COLORS: Record<string, string> = {
  frontend: "#ec4899",
  backend: "#f59e0b",
  service: "#8b5cf6",
  database: "#10b981",
  infra: "#f97316",
};

export function OverviewTab({ data, onGoTo }: { data: WorkspaceData; onGoTo: (tab: string) => void }) {
  const { project, agents, llmCalls } = data;
  const arch = project.architecture;
  const totalCost = project.costMicros || 1;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="panel p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Sparkles size={15} className="text-brand-300" /> Brief</div>
          <p className="text-sm leading-relaxed text-ink-300">{project.prompt}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {Object.entries(project.techStack ?? {}).map(([k, v]) => (
              <div key={k} className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-ink-500">{k}</div>
                <div className="mt-0.5 text-xs text-ink-200">{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Layers size={15} className="text-accent-400" /> Features</div>
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {arch?.features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-ink-300"><span className="h-1.5 w-1.5 rounded-full bg-accent-400" /> {f}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold"><Database size={15} className="text-mint-400" /> Domain model</div>
            <button className="btn-ghost btn-sm" onClick={() => onGoTo("database")}>Schema <ArrowRight size={12} /></button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {arch?.entities.map((e) => (
              <div key={e.name} className="rounded-xl border border-white/6 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-ink-100">{e.name}</span>
                  <span className="text-[10px] text-ink-500">{e.fields.length} fields</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {e.fields.slice(0, 5).map((f) => (
                    <span key={f.name} className={cn("rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px]", f.type === "reference" ? "text-accent-400" : f.type === "enum" ? "text-amber-300" : "text-ink-400")}>{f.name}</span>
                  ))}
                  {e.fields.length > 5 && <span className="text-[10px] text-ink-500">+{e.fields.length - 5}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Boxes size={15} className="text-brand-300" /> Architecture</div>
          <div className="space-y-2">
            {arch?.components.map((c) => (
              <div key={c.name} className="flex items-start gap-3 rounded-xl border border-white/6 bg-white/[0.02] p-3">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TYPE_COLORS[c.type] }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-ink-100">{c.name}</span>
                    <span className="text-[10px] uppercase tracking-wider text-ink-500">{c.type}</span>
                  </div>
                  <div className="text-xs text-ink-400">{c.description}</div>
                  {c.dependencies.length > 0 && <div className="mt-1 flex items-center gap-1 text-[10px] text-ink-500"><GitBranch size={10} /> {c.dependencies.join(", ")}</div>}
                </div>
              </div>
            ))}
          </div>
          {arch?.dataFlow && (
            <ol className="mt-4 space-y-1 border-t border-white/8 pt-3">
              {arch.dataFlow.map((d, i) => (
                <li key={i} className="flex gap-2 text-xs text-ink-400"><span className="font-mono text-brand-300">{i + 1}.</span> {d}</li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="panel p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={15} className="text-amber-300" /> Cost & usage by agent</div>
          <span className="text-xs text-ink-400">{llmCalls.length} model calls · {formatCost(project.costMicros)} total</span>
        </div>
        {project.llmCalls === 0 ? (
          <p className="text-sm text-ink-500">Token usage appears once the pipeline starts.</p>
        ) : (
          <div className="space-y-2.5">
            {AGENT_ORDER.map((role) => {
              const a = agents.find((x) => x.role === role);
              if (!a || a.llmCalls === 0) return null;
              const calls = llmCalls.filter((c) => c.agentRole === role);
              const cost = calls.reduce((s, c) => s + c.costMicros, 0);
              return (
                <div key={role} className="grid grid-cols-[110px_1fr_170px] items-center gap-3 text-xs">
                  <span className="flex items-center gap-2 text-ink-200"><span>{AGENTS[role].emoji}</span>{AGENTS[role].name}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-white/6">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(2, (cost / totalCost) * 100)}%`, background: AGENTS[role].color }} />
                  </div>
                  <span className="text-right font-mono text-ink-400">{formatTokens(a.tokensIn + a.tokensOut)} tok · {formatCost(cost)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
