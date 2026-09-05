"use client";

import { useState } from "react";
import {
  AlertTriangle, CheckCircle, XCircle, Clock, FileEdit, Database, Terminal, Rocket,
  ChevronDown, ChevronRight, ShieldCheck,
} from "lucide-react";
import { EmptyState, StatusBadge } from "./ui";

interface HitlCheckpoint {
  id: string;
  status: string;
  type: string;
  title: string;
  description: string;
  riskLevel: string;
  context: {
    proposedChanges?: string;
    diff?: string;
    filePath?: string;
    command?: string;
    affectedTables?: string[];
  };
  createdAt: string;
}

interface HitlCheckpointsProps {
  checkpoints: HitlCheckpoint[];
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
}

const TYPE_CFG: Record<string, { icon: typeof FileEdit; label: string; color: string }> = {
  file_edit:    { icon: FileEdit,  label: "File Edit",    color: "text-blue-400" },
  db_migration: { icon: Database,  label: "DB Migration", color: "text-emerald-400" },
  command_exec: { icon: Terminal,  label: "Command",      color: "text-amber-400" },
  deployment:   { icon: Rocket,    label: "Deployment",   color: "text-purple-400" },
};

const RISK_CFG: Record<string, { bg: string; text: string; border: string; label: string }> = {
  low:    { bg: "bg-emerald-900/20", text: "text-emerald-400", border: "border-emerald-500/25", label: "Low Risk" },
  medium: { bg: "bg-amber-900/20",   text: "text-amber-400",   border: "border-amber-500/25",   label: "Medium Risk" },
  high:   { bg: "bg-red-900/20",     text: "text-red-400",     border: "border-red-500/25",      label: "High Risk" },
};

function CheckpointCard({
  cp,
  onApprove,
  onReject,
}: {
  cp: HitlCheckpoint;
  onApprove: () => void;
  onReject: (reason: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [action, setAction] = useState<"idle" | "rejecting" | "modifying">("idle");
  const [reason, setReason] = useState("");
  const [modifications, setModifications] = useState("");

  const typeCfg = TYPE_CFG[cp.type] ?? TYPE_CFG.file_edit;
  const riskCfg = RISK_CFG[cp.riskLevel] ?? RISK_CFG.low;
  const Icon = typeCfg.icon;
  const isPending = cp.status === "pending";

  return (
    <div className={`panel overflow-hidden ${isPending ? `border ${riskCfg.border}` : "border-surface-800"}`}>
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-surface-800/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${riskCfg.bg}`}>
            <Icon className={`w-4 h-4 ${typeCfg.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-semibold text-sm text-surface-100">{cp.title}</span>
              <span className={`badge text-[10px] ${riskCfg.bg} ${riskCfg.text} border ${riskCfg.border}`}>
                {riskCfg.label}
              </span>
              <span className="badge text-[10px] bg-surface-800 text-surface-500 border-surface-700">
                {typeCfg.label}
              </span>
              <StatusBadge status={cp.status} size="xs" />
            </div>
            <p className="text-xs text-surface-400 leading-relaxed line-clamp-2">{cp.description}</p>
          </div>
          <div className="flex-shrink-0">
            {expanded ? <ChevronDown className="w-4 h-4 text-surface-600" /> : <ChevronRight className="w-4 h-4 text-surface-600" />}
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-surface-800 p-4 space-y-3">
          {cp.context.filePath && (
            <div>
              <p className="label mb-1">File</p>
              <code className="text-xs text-blue-300 bg-surface-900 px-2 py-1 rounded">{cp.context.filePath}</code>
            </div>
          )}
          {cp.context.command && (
            <div>
              <p className="label mb-1">Command</p>
              <code className="text-xs text-amber-300 bg-surface-900 px-2 py-1 rounded">{cp.context.command}</code>
            </div>
          )}
          {cp.context.affectedTables && cp.context.affectedTables.length > 0 && (
            <div>
              <p className="label mb-1">Affected Tables</p>
              <div className="flex flex-wrap gap-1">
                {cp.context.affectedTables.map((t) => (
                  <span key={t} className="badge text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/25">{t}</span>
                ))}
              </div>
            </div>
          )}
          {cp.context.diff && (
            <div>
              <p className="label mb-1">Proposed changes</p>
              <pre className="terminal-bg rounded-xl p-3 text-[11px] text-surface-300 mono whitespace-pre-wrap max-h-56 overflow-auto">
                {cp.context.diff}
              </pre>
            </div>
          )}
          {cp.context.proposedChanges && (
            <div>
              <p className="label mb-1">Description</p>
              <p className="text-xs text-surface-400">{cp.context.proposedChanges}</p>
            </div>
          )}

          {/* Action forms */}
          {isPending && (
            <div className="space-y-3 pt-2 border-t border-surface-800">
              {action === "rejecting" && (
                <div className="space-y-2">
                  <p className="label">Rejection reason</p>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="input text-xs"
                    rows={2}
                    placeholder="Explain why this change should not proceed…"
                  />
                </div>
              )}
              {action === "modifying" && (
                <div className="space-y-2">
                  <p className="label">Requested modifications</p>
                  <textarea
                    value={modifications}
                    onChange={(e) => setModifications(e.target.value)}
                    className="input text-xs"
                    rows={3}
                    placeholder="Describe what should be changed before proceeding…"
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {action === "idle" ? (
                  <>
                    <button className="btn btn-sm bg-emerald-600 hover:bg-emerald-500 text-white" onClick={onApprove}>
                      <CheckCircle className="w-3.5 h-3.5" />
                      Approve
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setAction("modifying")}>
                      <FileEdit className="w-3.5 h-3.5" />
                      Approve with modifications
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => setAction("rejecting")}>
                      <XCircle className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn btn-sm btn-primary"
                      disabled={action === "rejecting" && !reason.trim()}
                      onClick={() => {
                        if (action === "rejecting") onReject(reason);
                        else onApprove();
                        setAction("idle");
                      }}
                    >
                      {action === "rejecting" ? "Confirm Rejection" : "Confirm Modifications"}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setAction("idle")}>Cancel</button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function HitlCheckpoints({ checkpoints, onApprove, onReject }: HitlCheckpointsProps) {
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "resolved">("all");

  const pending = checkpoints.filter((c) => c.status === "pending");
  const resolved = checkpoints.filter((c) => c.status !== "pending");

  const filtered = filterStatus === "all"
    ? checkpoints
    : filterStatus === "pending"
    ? pending
    : resolved;

  if (checkpoints.length === 0) {
    return (
      <div className="h-full panel flex items-center justify-center">
        <EmptyState
          icon={ShieldCheck}
          title="No approvals required"
          description="HITL checkpoints appear when agents request human review before proceeding with risky changes."
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col panel overflow-hidden">
      {/* Header */}
      <div className="panel-header bg-gradient-to-r from-amber-500/5 to-transparent">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <AlertTriangle className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-surface-100 text-sm">Human-in-the-Loop</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-amber-400 font-medium">{pending.length} pending</span>
          <span className="text-surface-600">·</span>
          <span className="text-emerald-400">{resolved.length} resolved</span>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-1 px-3 py-2 border-b border-surface-800">
        {(["all", "pending", "resolved"] as const).map((f) => (
          <button key={f} onClick={() => setFilterStatus(f)}
            className={`btn btn-xs capitalize ${filterStatus === f ? "btn-primary" : "btn-secondary"}`}>
            {f} ({f === "all" ? checkpoints.length : f === "pending" ? pending.length : resolved.length})
          </button>
        ))}
      </div>

      {/* Explanation */}
      <div className="mx-3 my-2 px-3 py-2.5 rounded-lg bg-surface-900/50 border border-surface-800 text-xs text-surface-500 leading-relaxed">
        Agents pause execution at high-risk checkpoints and wait for your decision. Approve to continue, modify to adjust the approach, or reject to skip.
        Illustrative checkpoints (seeded at project creation) don&apos;t gate the pipeline — only live agent requests do.
      </div>

      {/* Cards */}
      <div className="scroll flex-1 p-3 space-y-3">
        {filtered.map((cp) => (
          <CheckpointCard
            key={cp.id}
            cp={cp}
            onApprove={() => onApprove(cp.id)}
            onReject={(reason) => onReject(cp.id, reason)}
          />
        ))}
      </div>
    </div>
  );
}
