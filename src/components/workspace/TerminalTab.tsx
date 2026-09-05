"use client";

import { useEffect, useRef } from "react";
import { Terminal } from "lucide-react";
import { EmptyState } from "@/components/ui";
import type { CommandExecution } from "@/db/schema";
import { agentMeta } from "@/lib/agents";
import { cn, formatDuration } from "@/lib/utils";

export function TerminalTab({ commands }: { commands: CommandExecution[] }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [commands.length]);

  if (!commands.length) {
    return <EmptyState icon={Terminal} title="No commands run yet" description="Installs, migrations, tests and Docker builds executed by the agents show up here with their output." />;
  }

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/8 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-mint-400/80" />
        <span className="ml-3 font-mono text-[11px] text-ink-400">/workspace — {commands.length} commands</span>
      </div>
      <div className="max-h-[640px] space-y-5 overflow-auto bg-ink-925 p-4 font-mono text-[12px] leading-relaxed">
        {commands.map((c) => {
          const m = agentMeta(c.agentRole);
          return (
            <div key={c.id}>
              <div className="flex flex-wrap items-center gap-2">
                <span style={{ color: m.color }}>{m.name.toLowerCase()}@forge</span>
                <span className="text-ink-500">{c.workingDir}</span>
                <span className="text-accent-400">$</span>
                <span className="text-ink-100">{c.command}</span>
                <span className="ml-auto flex items-center gap-2 text-[10px] text-ink-500">
                  <span>{formatDuration(c.durationMs ?? 0)}</span>
                  <span className={cn("rounded px-1.5 py-px", c.exitCode === 0 ? "bg-mint-400/15 text-mint-400" : "bg-rose-400/15 text-rose-300")}>exit {c.exitCode}</span>
                </span>
              </div>
              {c.stdout && <pre className="mt-1 whitespace-pre-wrap text-ink-400">{c.stdout}</pre>}
              {c.stderr && <pre className="mt-1 whitespace-pre-wrap text-rose-300">{c.stderr}</pre>}
            </div>
          );
        })}
        <div ref={end} />
      </div>
    </div>
  );
}
