"use client";

import { useEffect, useRef } from "react";
import { Terminal as TerminalIcon } from "lucide-react";

interface CommandEntry {
  id: string;
  command: string;
  status: string;
  exitCode: number | null;
  durationMs: number | null;
  stdout?: string | null;
  stderr?: string | null;
}

interface TerminalProps {
  commands: CommandEntry[];
  title?: string;
}

export default function Terminal({ commands, title = "Command Output" }: TerminalProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [commands.length]);

  return (
    <div className="h-full flex flex-col rounded-xl border border-surface-800 bg-[#010409] overflow-hidden shadow-2xl">
      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0d1117] border-b border-surface-800">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
          </div>
          <div className="flex items-center gap-1.5 ml-3 text-xs text-surface-500">
            <TerminalIcon className="w-3.5 h-3.5" />
            <span>{title}</span>
          </div>
        </div>
        <span className="text-[10px] text-surface-600 font-mono">
          {commands.filter((c) => c.status === "completed").length}/{commands.length} executed
        </span>
      </div>

      {/* Terminal body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gradient-to-b from-[#010409] to-[#020712]">
        {commands.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-surface-600">
            <TerminalIcon className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-xs">Awaiting commands from agents...</p>
            <p className="text-[10px] mt-1 font-mono">$ <span className="animate-blink">▊</span></p>
          </div>
        ) : (
          commands.map((cmd) => (
            <div key={cmd.id} className="animate-fade-in">
              {/* Command line */}
              <div className="flex items-start gap-2 terminal-line">
                <span className="text-emerald-400 select-none">$</span>
                <span className="text-surface-100 flex-1">{cmd.command}</span>
              </div>
              {/* Output */}
              {cmd.status === "completed" && (cmd.stdout || cmd.exitCode !== null) && (
                <div className="mt-1 pl-4 border-l border-surface-800/60 ml-1">
                  {cmd.stdout && (
                    <div className="terminal-line text-emerald-300/80">{cmd.stdout}</div>
                  )}
                  <div className="terminal-line text-surface-600 mt-0.5 text-[11px]">
                    <span className="text-emerald-500">✓</span> completed in {cmd.durationMs ?? 0}ms · exit {cmd.exitCode ?? 0}
                  </div>
                </div>
              )}
              {cmd.status === "failed" && (
                <div className="mt-1 pl-4 border-l border-red-900/60 ml-1">
                  {cmd.stderr && (
                    <div className="terminal-line text-red-400">{cmd.stderr}</div>
                  )}
                  <div className="terminal-line text-red-500/70 mt-0.5 text-[11px]">
                    <span>✗</span> failed with exit code {cmd.exitCode ?? 1}
                  </div>
                </div>
              )}
              {cmd.status === "running" && (
                <div className="pl-4 ml-1 mt-1">
                  <div className="terminal-line text-amber-400 animate-pulse-dot">
                    <span className="inline-block w-2 h-3 bg-amber-400 mr-1 animate-blink" />
                    running...
                  </div>
                </div>
              )}
              {cmd.status === "queued" && (
                <div className="pl-4 ml-1 mt-1">
                  <div className="terminal-line text-surface-600 italic">queued</div>
                </div>
              )}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {/* Terminal footer with prompt */}
      <div className="px-4 py-2 border-t border-surface-800 bg-[#0d1117] flex items-center gap-2">
        <span className="text-emerald-400 text-xs font-mono">➜</span>
        <span className="text-surface-500 text-xs font-mono">edl-agent</span>
        <span className="text-primary-400 text-xs font-mono">~</span>
        <span className="text-surface-100 text-xs font-mono animate-blink">▊</span>
      </div>
    </div>
  );
}
