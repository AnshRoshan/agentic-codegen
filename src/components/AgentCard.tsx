"use client";

import { motion } from "motion/react";
import { AGENT_DEFINITIONS, type AgentRoleId } from "@/lib/agents";
import { StatusBadge, ProgressBar } from "./ui";

interface AgentCardProps {
  agent: {
    id: string;
    role: string;
    name: string;
    status: string;
    currentTask: string | null;
    progress: number | null;
  };
}

export default function AgentCard({ agent }: AgentCardProps) {
  const def = AGENT_DEFINITIONS[agent.role as AgentRoleId];
  const progress = agent.progress ?? 0;
  const isActive = agent.status === "working";
  const isDone = agent.status === "completed";

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`relative rounded-xl border p-4 transition-colors overflow-hidden ${
        isActive
          ? "border-amber-500/40 bg-gradient-to-br from-amber-500/5 to-surface-900 shadow-lg shadow-amber-500/5"
          : isDone
          ? "border-emerald-500/25 bg-gradient-to-br from-emerald-500/5 to-surface-900"
          : "border-surface-800 bg-surface-900/50 hover:border-surface-700"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="text-2xl leading-none flex-shrink-0">{def?.emoji ?? "🤖"}</div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm text-surface-100 leading-tight">
              {agent.name}
            </h3>
            <p className="text-[11px] text-surface-500 mt-0.5 line-clamp-1">
              {def?.description?.slice(0, 60) ?? agent.role}
            </p>
          </div>
        </div>
        <StatusBadge status={agent.status} size="xs" />
      </div>

      {/* Progress bar */}
      <div className="mb-2">
        <ProgressBar
          value={progress}
          variant={isDone ? "success" : isActive ? "warning" : "primary"}
        />
      </div>

      {/* Current task or capabilities */}
      {agent.currentTask ? (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-300/90 mt-2 truncate">
          <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse-dot flex-shrink-0" />
          {agent.currentTask}
        </div>
      ) : (
        <div className="flex items-center justify-between text-[11px] text-surface-500 mt-2">
          <span>{progress}%</span>
          {def?.tools && (
            <span>
              {def.tools.length} tool{def.tools.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}
