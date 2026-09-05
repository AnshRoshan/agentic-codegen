"use client";

import { useRef, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import gsap from "gsap";
import { AGENT_DEFINITIONS, type AgentRoleId } from "@/lib/agents";
import { CheckCircle2, Loader2, AlertCircle, Circle, PauseCircle } from "lucide-react";

interface AgentInfo {
  id: string;
  role: string;
  name: string;
  status: string;
  progress: number | null;
  currentTask: string | null;
}

interface TaskInfo { id: string; agentId: string | null; status: string; }

interface Props { agents: AgentInfo[]; tasks: TaskInfo[]; mode: string; }

const GREENFIELD_LAYOUT: AgentRoleId[][] = [
  ["orchestrator"], ["architect"], ["database"], ["backend", "frontend"], ["testing"], ["devops"],
];
const BROWNFIELD_LAYOUT: AgentRoleId[][] = [
  ["orchestrator"], ["architect"], ["backend", "frontend"], ["testing"],
];

const STATUS: Record<string, { icon: typeof Circle; ring: string; bg: string; text: string; pulse?: boolean; glow?: string }> = {
  idle:        { icon: Circle,        ring: "ring-surface-700",       bg: "bg-surface-800/60",     text: "text-surface-500" },
  planning:    { icon: Loader2,       ring: "ring-blue-500/50",       bg: "bg-blue-500/10",        text: "text-blue-400",    pulse: true, glow: "rgba(59,130,246,.35)" },
  working:     { icon: Loader2,       ring: "ring-amber-500/60",      bg: "bg-amber-500/10",       text: "text-amber-400",   pulse: true, glow: "rgba(245,158,11,.4)" },
  reviewing:   { icon: Loader2,       ring: "ring-violet-500/50",     bg: "bg-violet-500/10",      text: "text-violet-400",  pulse: true, glow: "rgba(139,92,246,.35)" },
  completed:   { icon: CheckCircle2,  ring: "ring-emerald-500/60",    bg: "bg-emerald-500/10",     text: "text-emerald-400", glow: "rgba(16,185,129,.3)" },
  failed:      { icon: AlertCircle,   ring: "ring-red-500/60",        bg: "bg-red-500/10",         text: "text-red-400",     glow: "rgba(239,68,68,.4)" },
  waiting:     { icon: Circle,        ring: "ring-surface-700",       bg: "bg-surface-800/60",     text: "text-surface-500" },
  hitl_paused: { icon: PauseCircle,   ring: "ring-amber-500/60",      bg: "bg-amber-500/10",       text: "text-amber-400" },
};

export default function AgentGraph({ agents, tasks, mode }: Props) {
  const layout = mode === "brownfield" ? BROWNFIELD_LAYOUT : GREENFIELD_LAYOUT;
  const containerRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<SVGSVGElement>(null);

  const getAgent = (role: AgentRoleId) => agents.find((a) => a.role === role);
  const getStats = (agentId: string | undefined) => {
    if (!agentId) return { total: 0, done: 0 };
    const t = tasks.filter((x) => x.agentId === agentId);
    return { total: t.length, done: t.filter((x) => x.status === "completed").length };
  };

  const activeRoles = useMemo(() => new Set(agents.filter((a) => a.status === "working" || a.status === "completed").map((a) => a.role)), [agents]);

  // GSAP-animate the flowing data particles on active connection lines
  useEffect(() => {
    if (!flowRef.current) return;
    const particles = flowRef.current.querySelectorAll(".flow-particle");
    const tl = gsap.timeline({ repeat: -1, ease: "none" });
    particles.forEach((p, i) => {
      tl.fromTo(p, { attr: { offset: 0 }, opacity: 0 }, { attr: { offset: 1 }, opacity: 1, duration: 2, ease: "power1.inOut" }, i * 0.3);
      tl.to(p, { opacity: 0, duration: 0.3 }, "-=0.3");
    });
    return () => { tl.kill(); };
  }, [activeRoles.size]);

  return (
    <div ref={containerRef} className="relative panel p-6 md:p-8 overflow-x-auto">
      {/* Background subtle grid */}
      <div className="absolute inset-0 bg-grid opacity-[0.15] pointer-events-none" />

      <div className="relative flex flex-col items-center gap-0 min-w-[640px]">
        {layout.map((row, rowIdx) => (
          <div key={rowIdx} className="flex flex-col items-center w-full">
            {/* Vertical connector coming in */}
            {rowIdx > 0 && (
              <div className="relative h-10 w-full flex items-center justify-center">
                <svg
                  ref={rowIdx === 1 ? flowRef : undefined}
                  width="100%"
                  height="40"
                  className="absolute inset-0"
                >
                  <defs>
                    <linearGradient id={`g-${rowIdx}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#818cf8" stopOpacity="0.4" />
                      <stop offset="1" stopColor="#a855f7" stopOpacity="0.4" />
                    </linearGradient>
                  </defs>
                  <line
                    x1="50%" y1="0" x2="50%" y2="40"
                    stroke={`url(#g-${rowIdx})`}
                    strokeWidth="1.5"
                    strokeDasharray={activeRoles.size > 0 ? "0" : "4 4"}
                  />
                  {activeRoles.size > 0 && (
                    <circle r="2.5" fill="#a5b4fc" className="flow-particle">
                      <animateMotion dur="2s" repeatCount="indefinite" path="M 0,0 L 0,40" />
                    </circle>
                  )}
                </svg>
              </div>
            )}

            {/* Row of nodes */}
            <div className="flex items-start justify-center gap-8 w-full relative">
              {row.length > 1 && (
                <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-primary-500/40 to-transparent" />
              )}
              {row.map((role, colIdx) => {
                const def = AGENT_DEFINITIONS[role];
                const agent = getAgent(role);
                const status = agent?.status ?? "idle";
                const cfg = STATUS[status] ?? STATUS.idle;
                const StatusIcon = cfg.icon;
                const stats = getStats(agent?.id);

                return (
                  <motion.div
                    key={role}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 * (rowIdx * 2 + colIdx), duration: 0.4 }}
                    className="flex flex-col items-center relative"
                  >
                    {row.length > 1 && <div className="w-px h-4 bg-primary-500/30" />}
                    <motion.div
                      whileHover={{ scale: 1.03, y: -2 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className={`relative flex flex-col items-center gap-1.5 px-5 py-4 rounded-2xl border ${cfg.bg} ring-2 ${cfg.ring} min-w-[160px] backdrop-blur-sm`}
                      style={cfg.glow ? { boxShadow: `0 0 30px ${cfg.glow}` } : {}}
                    >
                      <div className="absolute -top-2 -right-2 bg-surface-950 rounded-full">
                        <StatusIcon
                          className={`w-5 h-5 ${cfg.text}`}
                          style={cfg.pulse ? { animation: "spin-slow 2s linear infinite" } : {}}
                        />
                      </div>
                      <div className="text-2xl">{def.emoji}</div>
                      <div className="text-sm font-semibold text-surface-100">{def.name}</div>
                      <div className={`text-[10px] uppercase tracking-wider ${cfg.text}`}>
                        {status.replace("_", " ")}
                      </div>
                      {stats.total > 0 && (
                        <div className="w-full mt-1">
                          <div className="h-1 bg-surface-700 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full rounded-full"
                              style={{ background: cfg.text.replace("text-", "").includes("emerald") ? "#10b981" : cfg.text.includes("amber") ? "#f59e0b" : "#818cf8" }}
                              initial={{ width: 0 }}
                              animate={{ width: `${(stats.done / stats.total) * 100}%` }}
                              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                            />
                          </div>
                          <p className="text-[10px] text-surface-500 mt-1 text-center tabular-nums">
                            {stats.done}/{stats.total} tasks
                          </p>
                        </div>
                      )}
                      {agent?.currentTask && status === "working" && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-[10px] text-amber-300/80 mt-0.5 text-center max-w-[150px] truncate"
                        >
                          {agent.currentTask}
                        </motion.p>
                      )}
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-surface-800/60 flex-wrap">
        {[
          ["idle", "Idle"], ["working", "Working"], ["completed", "Completed"],
          ["hitl_paused", "Awaiting Approval"], ["failed", "Failed"],
        ].map(([k, l]) => {
          const cfg = STATUS[k];
          return (
            <div key={k} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${cfg.bg} ring-1 ${cfg.ring}`} />
              <span className="text-xs text-surface-500">{l}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
