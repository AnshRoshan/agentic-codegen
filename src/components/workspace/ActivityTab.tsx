"use client";

import { useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, FileCode2, Info, User, Wrench, XCircle } from "lucide-react";
import { EmptyState } from "@/components/ui";
import type { AgentMessage, LlmCall } from "@/db/schema";
import { AGENT_ORDER, AGENTS, agentMeta } from "@/lib/agents";
import { cn, formatCost, formatDuration, formatTokens } from "@/lib/utils";

const KIND_ICON = { info: Info, tool: Wrench, file: FileCode2, success: CheckCircle2, warning: AlertTriangle, error: XCircle, user: User } as const;
const KIND_COLOR: Record<string, string> = { info: "text-ink-400", tool: "text-accent-400", file: "text-brand-300", success: "text-mint-400", warning: "text-amber-300", error: "text-rose-400", user: "text-ink-100" };

function renderContent(content: string) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => (p.startsWith("**") ? <strong key={i} className="font-semibold text-ink-100">{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>));
}

export function ActivityTab({ messages, llmCalls, onOpenFile }: { messages: AgentMessage[]; llmCalls: LlmCall[]; onOpenFile: (path: string) => void }) {
  const [role, setRole] = useState<string>("all");
  const [showFiles, setShowFiles] = useState(true);
  const [view, setView] = useState<"timeline" | "llm">("timeline");

  const filtered = useMemo(
    () => messages.filter((m) => (role === "all" || m.agentRole === role || (role === "user" && m.kind === "user")) && (showFiles || m.kind !== "file")).slice().reverse(),
    [messages, role, showFiles],
  );

  if (!messages.length) return <EmptyState icon={Activity} title="No activity yet" />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl border border-white/8 bg-ink-900 p-1">
          <button className={cn("rounded-lg px-3 py-1 text-xs", view === "timeline" ? "bg-white/10 text-ink-100" : "text-ink-400")} onClick={() => setView("timeline")}>Timeline</button>
          <button className={cn("rounded-lg px-3 py-1 text-xs", view === "llm" ? "bg-white/10 text-ink-100" : "text-ink-400")} onClick={() => setView("llm")}>Model calls ({llmCalls.length})</button>
        </div>
        {view === "timeline" && (
          <>
            <div className="flex gap-1 overflow-x-auto">
              <button className={cn("chip", role === "all" && "border-brand-400/50 text-ink-100")} onClick={() => setRole("all")}>All</button>
              {AGENT_ORDER.map((r) => (
                <button key={r} className={cn("chip whitespace-nowrap", role === r && "border-brand-400/50 text-ink-100")} onClick={() => setRole(r)}>{AGENTS[r].emoji} {AGENTS[r].name}</button>
              ))}
              <button className={cn("chip", role === "user" && "border-brand-400/50 text-ink-100")} onClick={() => setRole("user")}>👤 You</button>
            </div>
            <label className="ml-auto flex items-center gap-2 text-xs text-ink-400"><input type="checkbox" checked={showFiles} onChange={(e) => setShowFiles(e.target.checked)} className="accent-brand-500" /> Show file writes</label>
          </>
        )}
      </div>

      {view === "timeline" ? (
        <div className="panel max-h-[680px] overflow-auto">
          <ul className="divide-y divide-white/5">
            {filtered.map((m) => {
              const meta = agentMeta(m.agentRole);
              const Icon = KIND_ICON[m.kind as keyof typeof KIND_ICON] ?? Info;
              const path = (m.metadata as { path?: string } | null)?.path;
              return (
                <li key={m.id} className="flex gap-3 px-4 py-2.5 text-sm hover:bg-white/[0.02]">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg text-xs" style={{ background: m.agentRole ? `${meta.color}22` : "rgba(255,255,255,0.06)" }}>{m.agentRole ? meta.emoji : "👤"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="font-medium" style={{ color: m.agentRole ? meta.color : "#eef1f9" }}>{m.agentRole ? meta.name : "You"}</span>
                      <Icon size={11} className={KIND_COLOR[m.kind]} />
                      <span className="text-ink-500">{new Date(m.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <div className={cn("mt-0.5 break-words text-[13px]", m.kind === "file" ? "font-mono text-xs text-ink-400" : KIND_COLOR[m.kind] === "text-ink-400" ? "text-ink-300" : KIND_COLOR[m.kind])}>
                      {path && m.kind === "file" ? <button onClick={() => onOpenFile(path)} className="hover:text-brand-300 hover:underline">{m.content}</button> : renderContent(m.content)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <table className="w-full text-xs">
            <thead className="text-left text-[10px] uppercase tracking-wider text-ink-500">
              <tr><th className="px-4 py-2.5">Agent</th><th className="px-4 py-2.5">Purpose</th><th className="px-4 py-2.5">Model</th><th className="px-4 py-2.5 text-right">Prompt</th><th className="px-4 py-2.5 text-right">Completion</th><th className="px-4 py-2.5 text-right">Tools</th><th className="px-4 py-2.5 text-right">Latency</th><th className="px-4 py-2.5 text-right">Cost</th></tr>
            </thead>
            <tbody>
              {llmCalls.slice().reverse().map((c) => {
                const m = agentMeta(c.agentRole);
                return (
                  <tr key={c.id} className="border-t border-white/6">
                    <td className="px-4 py-2" style={{ color: m.color }}>{m.emoji} {m.name}</td>
                    <td className="px-4 py-2 text-ink-300">{c.purpose}</td>
                    <td className="px-4 py-2 font-mono text-ink-400">{c.model}</td>
                    <td className="px-4 py-2 text-right font-mono text-ink-300">{formatTokens(c.promptTokens)}</td>
                    <td className="px-4 py-2 text-right font-mono text-ink-300">{formatTokens(c.completionTokens)}</td>
                    <td className="px-4 py-2 text-right font-mono text-ink-400">{c.toolCalls}</td>
                    <td className="px-4 py-2 text-right font-mono text-ink-400">{formatDuration(c.durationMs)}</td>
                    <td className="px-4 py-2 text-right font-mono text-mint-400">{formatCost(c.costMicros)}</td>
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
