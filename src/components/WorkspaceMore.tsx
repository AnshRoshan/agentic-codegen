import { useMemo, useState } from "react";
import {
  FileCode2, Database, KeyRound, ShieldCheck, Terminal as TerminalIcon,
  Check, X, Eye, EyeOff, Plus, Trash2, Pencil,
  ChevronDown, Copy, AlertTriangle, Info,
} from "lucide-react";
import { useStore, type WorkspaceTab } from "../lib/store";
import { agentMeta } from "../lib/types";
import { formatCost, formatTokens } from "../lib/models";
import { Empty, SectionCard } from "./ui";
import { AgentTag, CodeBlock, FileTree, timeAgo } from "./WorkspaceShared";
import { cn } from "../utils/cn";

// ─── Files ──────────────────────────────────────────────────────────────────
function FilesTab({ pid, openFile, setOpenFile }: { pid: string; openFile: string | null; setOpenFile: (p: string | null) => void }) {
  const { workspaces, updateFile } = useStore();
  const ws = workspaces[pid];
  const file = ws.files.find((f) => f.path === (openFile ?? ws.files[0]?.path)) ?? ws.files[0] ?? null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() =>
    filter ? ws.files.filter((f) => f.path.toLowerCase().includes(filter.toLowerCase())) : ws.files,
    [ws.files, filter]);

  if (ws.files.length === 0) {
    return <Empty icon={<FileCode2 size={20} />} title="No files yet"
      hint="Files appear here as the Architect, Database, Backend, Frontend, Testing and DevOps agents write them. Start the pipeline to begin." />;
  }

  return (
    <div className="grid gap-3.5 lg:grid-cols-[280px_1fr]">
      <div className="card flex max-h-[calc(100vh-220px)] flex-col overflow-hidden">
        <div className="border-b border-white/[0.07] p-2.5">
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter files…"
            className="input !py-1.5 !text-[12.5px]" />
          <div className="mt-1.5 px-1 font-mono text-[10.5px] text-ink-500">{filtered.length} files</div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <FileTree files={filtered} selected={file?.path ?? null} onSelect={(p) => { setOpenFile(p); setEditing(false); }} />
        </div>
      </div>
      <div className="card flex max-h-[calc(100vh-220px)] min-w-0 flex-col overflow-hidden">
        {file ? (
          <>
            <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-2.5">
              <FileCode2 size={14} className="text-ink-500" />
              <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{file.path}</span>
              <AgentTag role={file.agentRole} />
              <span className="chip font-mono !text-[10px]">v{file.version}</span>
              {file.isModified && <span className="chip !text-[10px] border-amber-400/30 bg-amber-400/10 text-amber-200">edited</span>}
              <button onClick={() => { navigator.clipboard.writeText(file.content); }} className="btn-ghost !p-1.5" title="Copy">
                <Copy size={14} />
              </button>
              <button onClick={() => { if (editing) { updateFile(pid, file.path, draft); } else { setDraft(file.content); } setEditing(!editing); }}
                className={cn("btn-sm", editing ? "btn-primary" : "btn-secondary")}>
                {editing ? <><Check size={13} /> Save</> : <><Pencil size={13} /> Edit</>}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-black/30">
              {editing ? (
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
                  className="h-full min-h-[400px] w-full bg-transparent p-4 font-mono text-[12.5px] leading-[1.65] text-ink-100 outline-none"
                  spellCheck={false} />
              ) : (
                <CodeBlock code={file.content} language={file.language} />
              )}
            </div>
            <div className="flex items-center justify-between border-t border-white/[0.07] px-4 py-2 font-mono text-[10.5px] text-ink-500">
              <span>{file.language} · {(file.size / 1024).toFixed(1)} KB</span>
              <span>updated {timeAgo(file.updatedAt)}</span>
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-[13px] text-ink-500">Select a file to preview.</div>
        )}
      </div>
    </div>
  );
}

// ─── Database ───────────────────────────────────────────────────────────────
function DatabaseTab({ pid }: { pid: string }) {
  const { workspaces } = useStore();
  const ws = workspaces[pid];
  const [sel, setSel] = useState<string | null>(null);
  const [showSql, setShowSql] = useState(true);
  const table = ws.tables.find((t) => t.name === (sel ?? ws.tables[0]?.name)) ?? ws.tables[0] ?? null;

  if (ws.tables.length === 0) {
    return <Empty icon={<Database size={20} />} title="No tables yet"
      hint="The Database agent defines tables during the schema step. Tables, columns and SQL appear here with migration status." />;
  }

  return (
    <div className="grid gap-3.5 lg:grid-cols-[260px_1fr]">
      <div className="card max-h-[calc(100vh-220px)] overflow-y-auto p-2">
        <div className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
          Tables ({ws.tables.length})
        </div>
        {ws.tables.map((t) => (
          <button key={t.id} onClick={() => setSel(t.name)}
            className={cn("mb-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition",
              table?.id === t.id ? "bg-cyan-500/10 text-white" : "hover:bg-white/[0.04]")}>
            <Database size={13} className="shrink-0 text-cyan-300/70" />
            <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{t.name}</span>
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full",
              t.status === "seeded" ? "bg-emerald-400" : t.status === "migrating" ? "bg-amber-400 animate-pulse" : "bg-ink-500")} />
          </button>
        ))}
      </div>
      {table && (
        <div className="space-y-3.5">
          <div className="card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-mono text-[15px] font-semibold">{table.name}</h3>
              <span className={cn("chip !text-[10.5px]",
                table.status === "seeded" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                : table.status === "migrating" ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                : "text-ink-300")}>
                {table.status}
              </span>
              <span className="chip !text-[10.5px]">{table.rowCount} rows</span>
              <span className="chip !text-[10.5px]">{table.columns.length} columns</span>
            </div>
            <div className="mt-4 overflow-x-auto rounded-lg border border-white/[0.07]">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="bg-white/[0.03] text-left text-[11px] uppercase tracking-wider text-ink-500">
                    <th className="px-3.5 py-2.5 font-semibold">Column</th>
                    <th className="px-3.5 py-2.5 font-semibold">Type</th>
                    <th className="px-3.5 py-2.5 font-semibold">Nullable</th>
                    <th className="px-3.5 py-2.5 font-semibold">Refs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {table.columns.map((c) => (
                    <tr key={c.name} className="hover:bg-white/[0.02]">
                      <td className="px-3.5 py-2 font-mono">
                        {c.isPrimary && <span className="mr-1.5 text-amber-300" title="Primary key">●</span>}{c.name}
                      </td>
                      <td className="px-3.5 py-2 font-mono text-[12px] text-cyan-200/90">{c.type}</td>
                      <td className="px-3.5 py-2 text-ink-400">{c.nullable ? "yes" : "no"}</td>
                      <td className="px-3.5 py-2 font-mono text-[11.5px] text-ink-400">{c.references ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card overflow-hidden">
            <button onClick={() => setShowSql((v) => !v)} className="flex w-full items-center gap-2 px-5 py-3.5 text-left">
              <ChevronDown size={15} className={cn("text-ink-400 transition", !showSql && "-rotate-90")} />
              <span className="text-[13.5px] font-semibold">Migration SQL</span>
            </button>
            {showSql && table.sql && (
              <div className="border-t border-white/[0.07] bg-black/30">
                <CodeBlock code={table.sql} language="sql" maxH="320px" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Environment ────────────────────────────────────────────────────────────
function EnvTab({ pid }: { pid: string }) {
  const { workspaces, addEnv, deleteEnv } = useStore();
  const ws = workspaces[pid];
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [k, setK] = useState("");
  const [v, setV] = useState("");

  return (
    <div className="grid gap-3.5 xl:grid-cols-[1fr_320px]">
      <SectionCard title={`Variables (${ws.env.length})`} subtitle="Secrets are masked. Agent-managed keys are created during auth setup.">
        {ws.env.length === 0 ? (
          <div className="py-6 text-center text-[13px] text-ink-500">No variables yet — they are created during the auth step.</div>
        ) : (
          <div className="space-y-2">
            {ws.env.map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5">
                <KeyRound size={14} className="shrink-0 text-ink-500" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12.5px] font-semibold">{e.key}</span>
                    {e.isSecret && <span className="chip !px-1.5 !py-0 !text-[9.5px]">secret</span>}
                    <span className="chip !px-1.5 !py-0 !text-[9.5px]">{e.source}</span>
                  </div>
                  <div className="truncate font-mono text-[12px] text-ink-400">
                    {e.isSecret && !revealed[e.id] ? "••••••••••••••••" : e.value}
                  </div>
                </div>
                {e.isSecret && (
                  <button onClick={() => setRevealed((r) => ({ ...r, [e.id]: !r[e.id] }))} className="btn-ghost !p-1.5">
                    {revealed[e.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                )}
                <button onClick={() => deleteEnv(pid, e.id)} className="btn-ghost !p-1.5 hover:!text-rose-300">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
      <SectionCard title="Add variable" subtitle="Stored with this project.">
        <div className="space-y-3">
          <input value={k} onChange={(e) => setK(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
            placeholder="API_KEY" className="input font-mono !text-[12.5px]" />
          <input value={v} onChange={(e) => setV(e.target.value)} placeholder="value…" className="input font-mono !text-[12.5px]" />
          <button disabled={!k.trim()} onClick={() => { addEnv(pid, k.trim(), v); setK(""); setV(""); }}
            className="btn-secondary btn-sm w-full justify-center"><Plus size={13} /> Add</button>
          <p className="text-[11.5px] leading-relaxed text-ink-500">
            Keys matching SECRET, KEY, TOKEN or PASSWORD are automatically treated as secrets and masked.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Approvals ──────────────────────────────────────────────────────────────
function ApprovalsTab({ pid }: { pid: string }) {
  const { projects, workspaces, approve, reject } = useStore();
  const project = projects.find((p) => p.id === pid)!;
  const ws = workspaces[pid];
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [showDiff, setShowDiff] = useState<Record<string, boolean>>({});

  const pending = ws.checkpoints.filter((c) => c.status === "pending");
  const history = ws.checkpoints.filter((c) => c.status !== "pending").reverse();

  return (
    <div className="space-y-3.5">
      {project.autoApprove && (
        <div className="flex items-center gap-2.5 rounded-xl border border-violet-400/25 bg-violet-500/[0.07] px-4 py-3 text-[13px] text-violet-200">
          <Info size={15} /> Auto-approve is on — future checkpoints will be approved automatically.
        </div>
      )}
      {pending.length === 0 && (
        <Empty icon={<ShieldCheck size={20} />} title="Inbox zero"
          hint="No checkpoints awaiting review. Schema migration and production deploy pause here for your decision." />
      )}
      {pending.map((cp) => (
        <div key={cp.id} className="card overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.07] bg-amber-400/[0.04] p-5">
            <div className="flex items-start gap-3">
              <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                cp.riskLevel === "high" ? "bg-rose-500/15 text-rose-300" : cp.riskLevel === "medium" ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300")}>
                <AlertTriangle size={18} />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[15px] font-semibold">{cp.title}</h3>
                  <span className={cn("chip !text-[10.5px]",
                    cp.riskLevel === "high" ? "border-rose-400/40 bg-rose-400/10 text-rose-200"
                    : cp.riskLevel === "medium" ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
                    : "border-emerald-400/40 bg-emerald-400/10 text-emerald-200")}>
                    {cp.riskLevel} risk
                  </span>
                  <span className="chip font-mono !text-[10.5px]">{cp.type}</span>
                </div>
                <p className="mt-1 max-w-2xl text-[13px] text-ink-300">{cp.description}</p>
                <div className="mt-1 font-mono text-[11px] text-ink-500">{timeAgo(cp.createdAt)}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => reject(pid, cp.id, notes[cp.id] || undefined)} className="btn-danger btn-sm">
                <X size={14} /> Reject & skip
              </button>
              <button onClick={() => approve(pid, cp.id, notes[cp.id] || undefined)} className="btn-primary btn-sm">
                <Check size={14} /> Approve & resume
              </button>
            </div>
          </div>
          <div className="grid gap-0 md:grid-cols-[240px_1fr]">
            <div className="space-y-3 border-b border-white/[0.07] p-5 md:border-b-0 md:border-r">
              {cp.context.summary && (
                <div>
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500">Summary</div>
                  <ul className="space-y-1">
                    {cp.context.summary.map((s, i) => <li key={i} className="font-mono text-[11.5px] text-ink-300">• {s}</li>)}
                  </ul>
                </div>
              )}
              {cp.context.command && (
                <div>
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500">Command</div>
                  <code className="block rounded-lg bg-black/40 p-2.5 font-mono text-[11.5px] text-cyan-300">{cp.context.command}</code>
                </div>
              )}
              {cp.context.affected && (
                <div>
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500">Affected</div>
                  <div className="flex flex-wrap gap-1">
                    {cp.context.affected.map((a) => <span key={a} className="chip font-mono !text-[10px]">{a}</span>)}
                  </div>
                </div>
              )}
            </div>
            <div className="p-5">
              <button onClick={() => setShowDiff((s) => ({ ...s, [cp.id]: !(s[cp.id] ?? true) }))}
                className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-200">
                <ChevronDown size={14} className={cn("transition", !(showDiff[cp.id] ?? true) && "-rotate-90")} />
                Proposed change {cp.context.diff ? "(SQL diff)" : ""}
              </button>
              {(showDiff[cp.id] ?? true) && cp.context.diff && (
                <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-black/40">
                  <CodeBlock code={cp.context.diff} language="sql" maxH="300px" />
                </div>
              )}
              <input value={notes[cp.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [cp.id]: e.target.value }))}
                placeholder="Add a review note (optional)…" className="input mt-3 !text-[12.5px]" />
            </div>
          </div>
        </div>
      ))}
      {history.length > 0 && (
        <SectionCard title={`Decision history (${history.length})`} subtitle="Past approvals and rejections with notes.">
          <div className="space-y-2">
            {history.map((cp) => (
              <div key={cp.id} className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 text-[12.5px]">
                {cp.status === "approved" ? <Check size={15} className="shrink-0 text-emerald-400" /> : <X size={15} className="shrink-0 text-rose-400" />}
                <span className="min-w-0 flex-1 truncate font-medium">{cp.title}</span>
                {cp.note && <span className="hidden max-w-[280px] truncate text-ink-400 md:inline">“{cp.note}”</span>}
                <span className="shrink-0 font-mono text-[11px] text-ink-500">{cp.resolvedAt ? timeAgo(cp.resolvedAt) : ""}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ─── Terminal ───────────────────────────────────────────────────────────────
function TerminalTab({ pid }: { pid: string }) {
  const { workspaces } = useStore();
  const ws = workspaces[pid];
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (ws.commands.length === 0) {
    return <Empty icon={<TerminalIcon size={20} />} title="No commands yet"
      hint="npm install, migrations, tests and builds stream here with full stdout and durations." />;
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        <span className="ml-2 font-mono text-[11px] text-ink-400">sandbox shell · {ws.commands.length} commands</span>
      </div>
      <div className="divide-y divide-white/[0.05]">
        {[...ws.commands].reverse().map((c) => {
          const open = expanded[c.id] ?? true;
          return (
            <div key={c.id}>
              <button onClick={() => setExpanded((e) => ({ ...e, [c.id]: !open }))}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left font-mono text-[12.5px] hover:bg-white/[0.02]">
                <ChevronDown size={14} className={cn("shrink-0 text-ink-500 transition", !open && "-rotate-90")} />
                <AgentTag role={c.agentRole} />
                <span className="truncate text-cyan-200">$ {c.command}</span>
                <span className="ml-auto flex shrink-0 items-center gap-2 text-[11px] text-ink-500">
                  {(c.durationMs / 1000).toFixed(1)}s
                  {c.exitCode === 0 ? <Check size={13} className="text-emerald-400" /> : <X size={13} className="text-rose-400" />}
                </span>
              </button>
              {open && (
                <pre className="code-scroll overflow-x-auto border-t border-white/[0.04] bg-black/40 px-4 py-3 pl-[52px] font-mono text-[12px] leading-relaxed text-ink-300">
                  {c.stdout}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Activity ───────────────────────────────────────────────────────────────
function ActivityTab({ pid }: { pid: string }) {
  const { workspaces } = useStore();
  const ws = workspaces[pid];
  const [kind, setKind] = useState<string>("all");
  const [agent, setAgent] = useState<string>("all");

  const kinds = ["all", "info", "tool", "file", "success", "warning", "error", "user"];
  const agents = ["all", ...Array.from(new Set(ws.messages.map((m) => m.agentRole).filter(Boolean) as string[]))];

  const list = [...ws.messages].reverse().filter((m) =>
    (kind === "all" || m.kind === kind) && (agent === "all" || m.agentRole === agent));

  const kindColor: Record<string, string> = {
    info: "text-ink-300", tool: "text-violet-300", file: "text-cyan-300",
    success: "text-emerald-300", warning: "text-amber-300", error: "text-rose-300", user: "text-white",
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
          {kinds.map((k) => (
            <button key={k} onClick={() => setKind(k)}
              className={cn("rounded-lg px-2.5 py-1 text-[12px] font-medium capitalize transition",
                kind === k ? "bg-white/[0.1] text-white" : "text-ink-400 hover:text-white")}>
              {k}
            </button>
          ))}
        </div>
        <select value={agent} onChange={(e) => setAgent(e.target.value)} className="input !w-auto !py-1.5 !text-[12.5px]">
          {agents.map((a) => <option key={a} value={a}>{a === "all" ? "All agents" : agentMeta(a).name}</option>)}
        </select>
        <span className="ml-auto font-mono text-[11.5px] text-ink-500">{list.length} events</span>
      </div>
      <div className="card divide-y divide-white/[0.05]">
        {list.length === 0 && <div className="p-8 text-center text-[13px] text-ink-500">No events match these filters.</div>}
        {list.map((m) => (
          <div key={m.id} className="flex items-start gap-3 px-4 py-3">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: agentMeta(m.agentRole).color }} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <AgentTag role={m.agentRole} />
                <span className={cn("font-mono text-[10.5px]", kindColor[m.kind])}>{m.kind}</span>
                <span className="ml-auto shrink-0 font-mono text-[10.5px] text-ink-500">{timeAgo(m.createdAt)}</span>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-200">{m.content.replace(/\*\*/g, "")}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Insights ───────────────────────────────────────────────────────────────
function InsightsTab({ pid }: { pid: string }) {
  const { projects, workspaces } = useStore();
  const project = projects.find((p) => p.id === pid)!;
  const ws = workspaces[pid];
  const maxTokens = Math.max(1, ...ws.agents.map((a) => a.tokensIn + a.tokensOut));

  return (
    <div className="grid gap-3.5 xl:grid-cols-2">
      <SectionCard title="Token usage by agent" subtitle="Input + output tokens per specialist.">
        <div className="space-y-3">
          {ws.agents.map((a) => {
            const total = a.tokensIn + a.tokensOut;
            const m = agentMeta(a.role);
            return (
              <div key={a.id}>
                <div className="mb-1 flex items-center justify-between text-[12.5px]">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span>{m.emoji}</span> {m.name}
                    <span className="font-mono text-[10.5px] text-ink-500">{m.model}</span>
                  </span>
                  <span className="font-mono text-[11.5px] text-ink-300">{formatTokens(total)}</span>
                </div>
                <div className="flex h-2 gap-[3px] overflow-hidden rounded-full">
                  <div className="rounded-full opacity-60" style={{ width: `${(a.tokensIn / maxTokens) * 100}%`, background: m.color }} />
                  <div className="rounded-full" style={{ width: `${(a.tokensOut / maxTokens) * 100}%`, background: m.color }} />
                </div>
                <div className="mt-0.5 flex justify-between font-mono text-[10px] text-ink-500">
                  <span>in {formatTokens(a.tokensIn)}</span><span>out {formatTokens(a.tokensOut)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
      <div className="space-y-3.5">
        <SectionCard title="Run economics" subtitle="Every LLM call is metered.">
          <div className="grid grid-cols-2 gap-2.5">
            {[
              ["Total cost", formatCost(project.costMicros)],
              ["Tokens", formatTokens(project.tokensIn + project.tokensOut)],
              ["LLM calls", String(project.llmCalls)],
              ["Tool calls", String(project.toolCalls)],
              ["Files / call", project.llmCalls ? (project.generatedFiles / project.llmCalls).toFixed(1) : "—"],
              ["Cost / file", project.generatedFiles ? formatCost(project.costMicros / project.generatedFiles) : "—"],
            ].map(([l, v]) => (
              <div key={l} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
                <div className="font-display text-[19px] font-bold">{v}</div>
                <div className="mt-0.5 text-[11.5px] text-ink-400">{l}</div>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title={`LLM call log (${ws.llmCalls.length})`} subtitle="Model, tokens and purpose per call.">
          <div className="max-h-[300px] space-y-1.5 overflow-y-auto">
            {ws.llmCalls.length === 0 && <div className="py-4 text-center text-[12.5px] text-ink-500">No calls yet.</div>}
            {[...ws.llmCalls].reverse().map((c) => (
              <div key={c.id} className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px]">
                <AgentTag role={c.agentRole} />
                <span className="min-w-0 flex-1 truncate text-ink-300">{c.purpose}</span>
                <span className="hidden font-mono text-[10.5px] text-ink-500 sm:inline">{c.model}</span>
                <span className="shrink-0 font-mono text-[11px]">{formatTokens(c.promptTokens + c.completionTokens)}</span>
                <span className="shrink-0 font-mono text-[11px] text-ink-400">{formatCost(c.costMicros)}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ─── Router ─────────────────────────────────────────────────────────────────
export default function WorkspaceMore({ pid, tab, openFile, setOpenFile }: {
  pid: string; tab: WorkspaceTab; openFile: string | null; setOpenFile: (p: string | null) => void;
}) {
  switch (tab) {
    case "files": return <FilesTab pid={pid} openFile={openFile} setOpenFile={setOpenFile} />;
    case "database": return <DatabaseTab pid={pid} />;
    case "env": return <EnvTab pid={pid} />;
    case "approvals": return <ApprovalsTab pid={pid} />;
    case "terminal": return <TerminalTab pid={pid} />;
    case "activity": return <ActivityTab pid={pid} />;
    case "insights": return <InsightsTab pid={pid} />;
    default: return null;
  }
}
