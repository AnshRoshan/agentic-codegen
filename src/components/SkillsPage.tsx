import { useState } from "react";
import { Blocks, Server, BookOpen, Plug, CheckCircle2, Circle, Wrench } from "lucide-react";
import { SKILLS, MCP_SERVERS, SKILL_CATEGORIES } from "../lib/skills";
import { SectionCard } from "./ui";
import { cn } from "../utils/cn";

export default function SkillsPage() {
  const [cat, setCat] = useState<string>("All");
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(SKILLS.map((s) => [s.id, true])));
  const [servers, setServers] = useState<Record<string, boolean>>(
    Object.fromEntries(MCP_SERVERS.map((s) => [s.id, s.status === "connected"])));

  const skills = SKILLS.filter((s) => cat === "All" || s.category === cat);

  return (
    <div className="mx-auto max-w-6xl p-5 sm:p-7">
      <h1 className="flex items-center gap-2.5 font-display text-[24px] font-bold tracking-tight">
        <Blocks size={22} className="text-violet-300" /> Skills & MCP
      </h1>
      <p className="mt-1 text-[13.5px] text-ink-400">
        Skills are versioned knowledge packs agents load per task. MCP servers are live tool integrations.
      </p>

      <div className="mt-6 grid gap-3.5 xl:grid-cols-[1fr_340px]">
        {/* Skills */}
        <div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {SKILL_CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCat(c)}
                className={cn("rounded-lg px-3 py-1.5 text-[13px] font-medium transition",
                  cat === c ? "bg-white/[0.09] text-white" : "text-ink-400 hover:bg-white/[0.05] hover:text-white")}>
                {c}
              </button>
            ))}
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {skills.map((s) => {
              const on = enabled[s.id];
              return (
                <div key={s.id} className={cn("card p-4 transition", !on && "opacity-55")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-violet-500/12 text-violet-300">
                        <BookOpen size={16} />
                      </span>
                      <div>
                        <div className="text-[13.5px] font-semibold">{s.name}</div>
                        <div className="font-mono text-[10.5px] text-ink-500">v{s.version} · {s.files} files · {s.updated}</div>
                      </div>
                    </div>
                    <button onClick={() => setEnabled((e) => ({ ...e, [s.id]: !e[s.id] }))}
                      className={cn("flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium transition",
                        on ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-white/10 text-ink-400")}>
                      {on ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                      {on ? "on" : "off"}
                    </button>
                  </div>
                  <p className="mt-2.5 line-clamp-2 text-[12.5px] leading-relaxed text-ink-400">{s.description}</p>
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {s.triggers.map((t) => <span key={t} className="chip font-mono !px-1.5 !py-0 !text-[10px]">{t}</span>)}
                  </div>
                  <div className="mt-2 border-t border-white/[0.06] pt-2 text-[11.5px] text-ink-500">
                    Used by <span className="text-ink-300">{s.agents.join(", ")}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* MCP servers */}
        <div className="space-y-3.5">
          <SectionCard title="MCP servers" subtitle={`${MCP_SERVERS.filter((s) => servers[s.id]).length}/${MCP_SERVERS.length} connected`}>
            <div className="space-y-2.5">
              {MCP_SERVERS.map((s) => {
                const on = servers[s.id];
                return (
                  <div key={s.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
                    <div className="flex items-center gap-2">
                      <Server size={14} className={on ? "text-emerald-300" : "text-ink-500"} />
                      <span className="text-[13px] font-semibold">{s.name}</span>
                      <span className="ml-auto flex items-center gap-1.5">
                        <span className={cn("status-dot", on ? "bg-emerald-400" : "bg-ink-500")} data-live={on} />
                        <span className={cn("text-[11px]", on ? "text-emerald-300" : "text-ink-500")}>
                          {on ? "connected" : "offline"}
                        </span>
                      </span>
                    </div>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-ink-400">{s.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {s.tools.map((t) => (
                        <span key={t} className="chip font-mono !px-1.5 !py-0 !text-[10px]">
                          <Wrench size={9} /> {t}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-mono text-[10.5px] text-ink-500">v{s.version} · {s.latency}</span>
                      <button onClick={() => setServers((x) => ({ ...x, [s.id]: !x[s.id] }))}
                        className="flex items-center gap-1 text-[12px] font-medium text-violet-300 hover:text-violet-200">
                        <Plug size={12} /> {on ? "Disconnect" : "Connect"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
          <div className="card p-4 text-[12px] leading-relaxed text-ink-400">
            <span className="font-semibold text-ink-200">How it wires together:</span> when a task starts,
            the orchestrator injects matching skills into the agent's context and grants scoped MCP tools —
            e.g. the Database agent gets <span className="font-mono text-cyan-300">drizzle-schema</span> + <span className="font-mono text-cyan-300">postgres.migrate</span>.
          </div>
        </div>
      </div>
    </div>
  );
}
