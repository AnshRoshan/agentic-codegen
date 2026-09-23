"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, ScrollText } from "lucide-react";
import type { AgentMessage, LlmCall, Project } from "@/db/schema";
import { ActivityTab } from "./ActivityTab";
import { Progress, Spinner } from "@/components/ui";
import { cn, formatCost, formatTokens } from "@/lib/utils";

// Sticky bottom dock: always-visible run stats bar, expandable into the full
// live activity feed (agent messages + model calls). Replaces the sidebar
// feed and the in-page stats strip.
export function RunDock({ project, currentStep, isRunning, messages, llmCalls, onOpenFile }: {
  project: Project;
  currentStep?: { title: string };
  isRunning: boolean;
  messages: AgentMessage[];
  llmCalls: LlmCall[];
  onOpenFile: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const seenRef = useRef(messages.length);
  const [unseen, setUnseen] = useState(0);

  const total = project.totalSteps || 1;
  const pct = Math.round((Math.min(project.currentStep, total) / total) * 100);

  // Count arrivals while collapsed so the dock button signals new activity.
  useEffect(() => {
    if (open) seenRef.current = messages.length;
    else setUnseen(Math.max(0, messages.length - seenRef.current));
  }, [messages.length, open]);

  const statusText = isRunning && currentStep ? (
    <span className="flex items-center gap-2"><Spinner className="h-3 w-3" /> Step {project.currentStep + 1}/{total} · {currentStep.title}</span>
  ) : project.status === "waiting_approval" ? (
    <span className="text-amber-300">Waiting for your approval</span>
  ) : project.status === "completed" ? (
    <span className="text-mint-400">All {total} steps complete</span>
  ) : project.status === "failed" ? (
    <span className="text-rose-400">Failed: {project.errorMessage}</span>
  ) : (
    <span>{project.currentStep === 0 ? "Ready to start" : `Paused at step ${project.currentStep}/${total}`}</span>
  );

  return (
    <div className="sticky bottom-0 z-30 mt-auto">
      {open && (
        <div className="max-h-[42vh] overflow-y-auto border-t border-white/10 bg-void/95 px-5 py-4 backdrop-blur">
          <ActivityTab messages={messages} llmCalls={llmCalls} onOpenFile={onOpenFile} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 bg-panel2/95 px-5 py-2.5 backdrop-blur">
        <button onClick={() => setOpen((v) => !v)} className="flex min-w-0 items-center gap-2 text-[13px] text-ink-200 transition hover:text-white">
          <ScrollText size={14} className="shrink-0 text-brand-300" />
          <span className="relative shrink-0">
            Logs
            {!open && unseen > 0 && <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-[9px] font-semibold text-white">{unseen}</span>}
            {isRunning && <span className="absolute inset-0 -z-10" />}
          </span>
          {open ? <ChevronDown size={13} className="text-ink-400" /> : <ChevronUp size={13} className="text-ink-400" />}
        </button>

        <div className="flex min-w-[180px] flex-1 items-center gap-3">
          <span className="whitespace-nowrap text-xs text-ink-300">{statusText}</span>
          <Progress value={pct} className="flex-1" color={project.status === "completed" ? "bg-mint-400" : project.status === "failed" ? "bg-rose-400" : "bg-gradient-to-r from-brand-500 to-accent-400"} />
          <span className="font-mono text-xs text-ink-400">{pct}%</span>
        </div>

        <div className={cn("flex items-center gap-4 text-[11px] text-ink-500", open && "hidden sm:flex")}>
          <span><span className="font-display text-[13px] font-semibold text-ink-200">{project.generatedFiles}</span> files</span>
          <span><span className="font-display text-[13px] font-semibold text-ink-200">{project.completedTasks}/{project.totalTasks || total}</span> tasks</span>
          <span className="hidden md:inline">{formatTokens(project.tokensIn + project.tokensOut)} tokens</span>
          <span className="font-mono text-mint-400">{formatCost(project.costMicros)}</span>
        </div>
      </div>
    </div>
  );
}
