"use client";

import { Check, Circle, Clock, X } from "lucide-react";
import type { Agent, PlanStep, Task } from "@/db/schema";
import { AGENT_ORDER, AGENTS } from "@/lib/agents";
import { cn, formatTokens } from "@/lib/utils";

export function AgentsPanel({ agents, tasks, plan, currentStep, status }: { agents: Agent[]; tasks: Task[]; plan: PlanStep[]; currentStep: number; status: string }) {
  const byRole = Object.fromEntries(agents.map((a) => [a.role, a]));
  return (
    <aside className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold">Agent pipeline</h2>
        <span className="text-[11px] text-ink-500">{plan.length} steps</span>
      </div>
      <div className="relative space-y-2">
        <div className="absolute bottom-6 left-[27px] top-6 w-px bg-gradient-to-b from-brand-500/60 via-white/10 to-transparent" />
        {AGENT_ORDER.map((role) => {
          const a = byRole[role];
          const def = AGENTS[role];
          const steps = plan.filter((s) => s.agent === role);
          const isActive = a?.status === "working" || (steps.some((s) => s.index === currentStep) && status !== "draft" && status !== "completed");
          const isWaiting = a?.status === "waiting" && status === "waiting_approval" && steps.some((s) => s.index === currentStep - 1);
          return (
            <div key={role} className={cn("panel relative p-3 transition", isActive && "ring-glow", isWaiting && "border-amber-400/40")}>
              <div className="flex items-start gap-3">
                <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg" style={{ background: `${def.color}22`, border: `1px solid ${def.color}55` }}>
                  {def.emoji}
                  {(isActive || isWaiting) && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full" style={{ background: isWaiting ? "#fbbf24" : def.color }}><span className="absolute inset-0 animate-ping rounded-full" style={{ background: isWaiting ? "#fbbf24" : def.color }} /></span>}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{def.name}</span>
                    <span className={cn("text-[10px] font-medium uppercase tracking-wider", a?.status === "completed" ? "text-mint-400" : a?.status === "failed" ? "text-rose-400" : isWaiting ? "text-amber-300" : isActive ? "text-brand-300" : "text-ink-500")}>
                      {isWaiting ? "awaiting you" : a?.status === "working" || isActive ? "working" : a?.status ?? "idle"}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-ink-400">{a?.currentTask ?? def.tagline}</div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/8">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${a?.progress ?? 0}%`, background: def.color }} />
                  </div>
                  <ul className="mt-2 space-y-1">
                    {steps.map((s) => {
                      const t = tasks.find((x) => x.stepKey === s.key);
                      const st = t?.status ?? (s.index < currentStep ? "completed" : "pending");
                      const active = s.index === currentStep && status !== "completed" && status !== "draft";
                      return (
                        <li key={s.key} className={cn("flex items-center gap-1.5 text-[11px]", st === "completed" ? "text-ink-300" : active ? "text-ink-100" : st === "skipped" ? "text-ink-500 line-through" : "text-ink-500")}>
                          {st === "completed" ? <Check size={11} className="text-mint-400" /> : st === "failed" ? <X size={11} className="text-rose-400" /> : st === "skipped" ? <X size={11} /> : active ? <Clock size={11} className="text-brand-300" /> : <Circle size={9} />}
                          <span className="truncate">{s.title}</span>
                        </li>
                      );
                    })}
                  </ul>
                  {a && (a.tokensIn + a.tokensOut > 0 || a.filesWritten > 0) && (
                    <div className="mt-2 flex gap-3 text-[10px] text-ink-500">
                      <span>{formatTokens(a.tokensIn + a.tokensOut)} tok</span>
                      <span>{a.llmCalls} calls</span>
                      {a.filesWritten > 0 && <span>{a.filesWritten} files</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
