"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  Files,
  CheckCircle2,
  Clock,
  AlertCircle,
  Terminal,
  MessageSquare,
  Database,
  KeyRound,
  ShieldAlert,
} from "lucide-react";
import { EmptyState, Spinner } from "./ui";

interface Stats {
  overview: {
    status: string;
    mode: string;
    progress: number;
    createdAt: string;
    updatedAt: string;
  };
  files: {
    total: number;
    directories: number;
    totalBytes: number;
    totalKb: number;
    languages: Array<{ lang: string; count: number; pct: number }>;
  };
  tasks: {
    total: number;
    completed: number;
    pending: number;
    inProgress: number;
    failed: number;
    byAgent: Array<{ role: string; total: number; done: number }>;
  };
  agents: { total: number; completed: number; working: number };
  database: { tables: number; totalColumns: number };
  env: { total: number; secrets: number; vaultRefs: number };
  hitl: { total: number; pending: number; approved: number; rejected: number };
  commands: { total: number; completed: number; failed: number; avgDuration: number };
  messages: { total: number };
}

const LANG_COLORS: Record<string, string> = {
  tsx: "#61dafb",
  typescript: "#3178c6",
  javascript: "#f7df1e",
  json: "#8bc34a",
  css: "#264de4",
  markdown: "#084298",
  dockerfile: "#0db7ed",
  yaml: "#cc1018",
  sql: "#e38c00",
  env: "#7cd348",
  text: "#6b7280",
};

export default function ProjectStats({ projectId }: { projectId: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/projects/${projectId}/stats`)
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={24} />
      </div>
    );
  }

  if (!stats) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Stats unavailable"
        description="Unable to load project statistics."
      />
    );
  }

  return (
    <div className="space-y-5 anim-up">
      {/* Top KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={Files}
          label="Files Generated"
          value={stats.files.total}
          sub={`${stats.files.totalKb} KB · ${stats.files.directories} dirs`}
          color="text-blue-400"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Tasks Done"
          value={`${stats.tasks.completed}/${stats.tasks.total}`}
          sub={`${stats.tasks.inProgress} in progress`}
          color="text-emerald-400"
        />
        <KpiCard
          icon={Terminal}
          label="Commands"
          value={stats.commands.completed}
          sub={`avg ${stats.commands.avgDuration}ms · ${stats.commands.failed} failed`}
          color="text-amber-400"
        />
        <KpiCard
          icon={MessageSquare}
          label="Agent Messages"
          value={stats.messages.total}
          sub={`${stats.agents.total} agents total`}
          color="text-purple-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Language breakdown */}
        <div className="panel p-5">
          <h3 className="panel-title mb-4">Language Breakdown</h3>
          {stats.files.languages.length === 0 ? (
            <p className="text-xs text-surface-500">No files yet</p>
          ) : (
            <div className="space-y-2.5">
              {stats.files.languages.map((l) => (
                <div key={l.lang}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-surface-300 capitalize">{l.lang}</span>
                    <span className="text-xs text-surface-500 tabular-nums">
                      {l.count} file{l.count > 1 ? "s" : ""} · {l.pct}%
                    </span>
                  </div>
                  <div className="progress">
                    <div
                      className="progress-bar"
                      style={{
                        width: `${l.pct}%`,
                        background: LANG_COLORS[l.lang] ?? "#6366f1",
                        animation: "none",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tasks by agent */}
        <div className="panel p-5">
          <h3 className="panel-title mb-4">Tasks by Agent</h3>
          {stats.tasks.byAgent.length === 0 ? (
            <p className="text-xs text-surface-500">No tasks yet</p>
          ) : (
            <div className="space-y-2.5">
              {stats.tasks.byAgent.map((a) => {
                const pct = a.total ? Math.round((a.done / a.total) * 100) : 0;
                return (
                  <div key={a.role}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-surface-300 capitalize">{a.role}</span>
                      <span className="text-xs text-surface-500 tabular-nums">
                        {a.done}/{a.total}
                      </span>
                    </div>
                    <div className="progress">
                      <div
                        className={`progress-bar ${pct === 100 ? "done" : ""}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricTile
          icon={Database}
          label="Tables"
          value={stats.database.tables}
          sub={`${stats.database.totalColumns} columns`}
          color="border-blue-500/20"
        />
        <MetricTile
          icon={KeyRound}
          label="Env Vars"
          value={stats.env.total}
          sub={`${stats.env.secrets} secrets · ${stats.env.vaultRefs} vault`}
          color="border-emerald-500/20"
        />
        <MetricTile
          icon={ShieldAlert}
          label="HITL Checks"
          value={stats.hitl.total}
          sub={`${stats.hitl.approved} approved · ${stats.hitl.pending} pending`}
          color="border-amber-500/20"
        />
        <MetricTile
          icon={AlertCircle}
          label="Failed Tasks"
          value={stats.tasks.failed}
          sub={`${stats.commands.failed} commands failed`}
          color={stats.tasks.failed > 0 ? "border-red-500/30" : "border-surface-700"}
        />
      </div>

      {/* Timeline */}
      <div className="panel p-5">
        <h3 className="panel-title mb-3">Project Timeline</h3>
        <div className="flex items-center gap-4 text-xs text-surface-400">
          <div>
            <Clock className="w-3 h-3 inline mr-1 text-surface-500" />
            Created: {new Date(stats.overview.createdAt).toLocaleString()}
          </div>
          <div className="text-surface-700">→</div>
          <div>
            Last update: {new Date(stats.overview.updatedAt).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: typeof Files;
  label: string;
  value: number | string;
  sub: string;
  color: string;
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-surface-500 font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-surface-100 tabular-nums">{value}</p>
      <p className="text-xs text-surface-500 mt-0.5">{sub}</p>
    </div>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: typeof Database;
  label: string;
  value: number;
  sub: string;
  color: string;
}) {
  return (
    <div className={`panel border ${color} p-4`}>
      <Icon className="w-4 h-4 text-surface-500 mb-2" />
      <p className="text-xl font-bold text-surface-100 tabular-nums">{value}</p>
      <p className="text-xs text-surface-500 mt-0.5">{label}</p>
      <p className="text-[10px] text-surface-600 mt-1">{sub}</p>
    </div>
  );
}
