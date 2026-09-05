import React, { useMemo, useState } from "react";
import { FileCode2, Folder, FolderOpen, Search, X, ChevronRight } from "lucide-react";
import type { FileNode, Project, WorkspaceData } from "../lib/types";
import { agentMeta } from "../lib/types";
import { cn } from "../utils/cn";

// ─── Safe tokenizer-based tinting (no nested-regex corruption) ──────────────
const TS_KEYWORDS = new Set("import,from,export,default,const,let,var,function,return,await,async,new,if,else,for,while,try,catch,interface,type,extends,typeof,in,of,as".split(","));
const TS_LITERALS = new Set(["true", "false", "null", "undefined"]);
const SQL_KEYWORDS = new Set("CREATE,TABLE,IF,NOT,EXISTS,PRIMARY,KEY,REFERENCES,DEFAULT,NULL,CHECK,IN,ON,DELETE,CASCADE".split(","));

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlight(code: string, language: string | null): string {
  const isSQL = language === "sql";
  const isCode = language === "typescript" || language === "tsx" || language === "javascript" || language === "json";
  if (!isSQL && !isCode) return esc(code);

  let out = "";
  let i = 0;
  const n = code.length;
  while (i < n) {
    const ch = code[i];
    // line comment
    if (!isSQL && ch === "/" && code[i + 1] === "/") {
      let j = i;
      while (j < n && code[j] !== "\n") j++;
      out += `<span class="text-ink-500 italic">${esc(code.slice(i, j))}</span>`;
      i = j;
      continue;
    }
    // SQL line comment
    if (isSQL && ch === "-" && code[i + 1] === "-") {
      let j = i;
      while (j < n && code[j] !== "\n") j++;
      out += `<span class="text-ink-500 italic">${esc(code.slice(i, j))}</span>`;
      i = j;
      continue;
    }
    // strings
    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      while (j < n && code[j] !== ch) { if (code[j] === "\\") j++; j++; }
      j = Math.min(n, j + 1);
      // json key coloring
      let k = j;
      while (k < n && /\s/.test(code[k])) k++;
      const isKey = language === "json" && code[k] === ":";
      out += `<span class="${isKey ? "text-cyan-300" : "text-emerald-300/90"}">${esc(code.slice(i, j))}</span>`;
      i = j;
      continue;
    }
    // numbers
    if (/[0-9]/.test(ch) && (i === 0 || /[^a-zA-Z0-9_$.]/.test(code[i - 1]))) {
      let j = i;
      while (j < n && /[0-9._]/.test(code[j])) j++;
      out += `<span class="text-amber-300">${esc(code.slice(i, j))}</span>`;
      i = j;
      continue;
    }
    // words
    if (/[a-zA-Z_$]/.test(ch)) {
      let j = i;
      while (j < n && /[a-zA-Z0-9_$]/.test(code[j])) j++;
      const word = code.slice(i, j);
      if (!isSQL && TS_KEYWORDS.has(word)) out += `<span class="text-violet-300">${word}</span>`;
      else if (!isSQL && TS_LITERALS.has(word)) out += `<span class="text-amber-300">${word}</span>`;
      else if (isSQL && SQL_KEYWORDS.has(word.toUpperCase())) out += `<span class="text-cyan-300">${word}</span>`;
      else if (isSQL && /^(timestamp|text|integer|boolean)$/i.test(word)) out += `<span class="text-amber-300">${word}</span>`;
      else out += esc(word);
      i = j;
      continue;
    }
    out += esc(ch);
    i++;
  }
  return out;
}

export function CodeBlock({ code, language, maxH }: { code: string; language: string | null; maxH?: string }) {
  const html = useMemo(() => highlight(code, language), [code, language]);
  return (
    <pre
      className="code-scroll overflow-auto p-4 font-mono text-[12.5px] leading-[1.65] text-ink-200"
      style={{ maxHeight: maxH ?? "100%" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function AgentDot({ role, size = 8 }: { role: string | null; size?: number }) {
  const m = agentMeta(role);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="rounded-full" style={{ width: size, height: size, background: m.color }} />
    </span>
  );
}

export function AgentTag({ role }: { role: string | null }) {
  const m = agentMeta(role);
  if (!role) return <span className="chip !text-[10.5px]">you</span>;
  return (
    <span className="chip !text-[10.5px]" style={{ borderColor: `${m.color}44`, background: `${m.color}14`, color: m.color }}>
      {m.emoji} {m.name}
    </span>
  );
}

export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── File tree ──────────────────────────────────────────────────────────────
interface TreeNode { name: string; path: string; file?: FileNode; children: TreeNode[]; }

export function buildTree(files: FileNode[]): TreeNode[] {
  const root: TreeNode[] = [];
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  for (const f of sorted) {
    const parts = f.path.split("/");
    let level = root;
    let acc = "";
    parts.forEach((part, i) => {
      acc = acc ? `${acc}/${part}` : part;
      const isFile = i === parts.length - 1;
      let node = level.find((n) => n.name === part && !n.file === !isFile);
      if (!node) {
        node = { name: part, path: acc, file: isFile ? f : undefined, children: [] };
        level.push(node);
      }
      if (!isFile) level = node.children;
    });
  }
  // directories first
  const sort = (nodes: TreeNode[]): TreeNode[] =>
    [...nodes].sort((a, b) => (a.file ? 1 : 0) - (b.file ? 1 : 0) || a.name.localeCompare(b.name))
      .map((n) => ({ ...n, children: sort(n.children) }));
  return sort(root);
}

export function FileTree({ files, selected, onSelect, dense }: {
  files: FileNode[]; selected: string | null; onSelect: (path: string) => void; dense?: boolean;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({ src: true, "src/app": true, "src/components": true, "src/lib": true, "src/db": true, docs: true });
  const tree = useMemo(() => buildTree(files), [files]);

  const render = (nodes: TreeNode[], depth: number): React.ReactNode =>
    nodes.map((n) => {
      if (!n.file) {
        const isOpen = open[n.path] ?? depth < 1;
        return (
          <div key={n.path}>
            <button
              onClick={() => setOpen((o) => ({ ...o, [n.path]: !isOpen }))}
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-[5px] text-left text-[12.5px] text-ink-300 hover:bg-white/[0.05] hover:text-white"
              style={{ paddingLeft: 8 + depth * 12 }}
            >
              <ChevronRight size={12} className={cn("text-ink-500 transition", isOpen && "rotate-90")} />
              {isOpen ? <FolderOpen size={14} className="text-amber-300/80" /> : <Folder size={14} className="text-amber-300/60" />}
              <span className="truncate font-medium">{n.name}</span>
            </button>
            {isOpen && render(n.children, depth + 1)}
          </div>
        );
      }
      const active = selected === n.file.path;
      return (
        <button
          key={n.path}
          onClick={() => onSelect(n.file!.path)}
          className={cn("flex w-full items-center gap-1.5 rounded-md px-2 text-left text-[12.5px] transition",
            dense ? "py-[3px]" : "py-[5px]",
            active ? "bg-violet-500/15 text-white" : "text-ink-400 hover:bg-white/[0.05] hover:text-white")}
          style={{ paddingLeft: 8 + depth * 12 }}
        >
          <FileCode2 size={13} className={active ? "text-violet-300" : "text-ink-500"} />
          <span className="min-w-0 flex-1 truncate font-mono text-[12px]">{n.name}</span>
          {n.file.isModified && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" title="Modified" />}
        </button>
      );
    });

  if (files.length === 0) {
    return <div className="p-4 text-[12.5px] text-ink-500">No files yet — they appear as agents write them.</div>;
  }
  return <div className="p-1.5">{render(tree, 0)}</div>;
}

// ─── ⌘K search palette ──────────────────────────────────────────────────────
export function SearchPalette({ project, ws, open, onClose, onOpenFile, onGoto }: {
  project: Project; ws: WorkspaceData; open: boolean;
  onClose: () => void; onOpenFile: (path: string) => void; onGoto: (tab: string) => void;
}) {
  const [q, setQ] = useState("");
  React.useEffect(() => { if (open) setQ(""); }, [open ]);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;

  const ql = q.toLowerCase();
  const files = ws.files.filter((f) => f.path.toLowerCase().includes(ql)).slice(0, 7);
  const tables = ws.tables.filter((t) => t.name.toLowerCase().includes(ql)).slice(0, 4);
  const tasks = project.plan.filter((t) => t.title.toLowerCase().includes(ql)).slice(0, 4);

  return (
    <div className="fixed inset-0 z-[85] flex items-start justify-center pt-[12vh] px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="glass relative w-full max-w-xl overflow-hidden rounded-2xl">
        <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3">
          <Search size={16} className="text-ink-400" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${project.name} — files, tables, steps…`} className="w-full bg-transparent text-[14px] outline-none placeholder:text-ink-500" />
          <button onClick={onClose} className="btn-ghost !p-1"><X size={15} /></button>
        </div>
        <div className="max-h-[46vh] overflow-y-auto p-2">
          {files.length === 0 && tables.length === 0 && tasks.length === 0 && (
            <div className="px-3 py-8 text-center text-[13px] text-ink-500">
              {q ? "No matches. Try a file name, table or pipeline step." : "Type to search across this project."}
            </div>
          )}
          {files.length > 0 && (
            <div className="mb-1">
              <div className="px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-500">Files</div>
              {files.map((f) => (
                <button key={f.path} onClick={() => { onOpenFile(f.path); onClose(); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-white/[0.06]">
                  <FileCode2 size={14} className="text-ink-500" />
                  <span className="truncate font-mono text-[12.5px]">{f.path}</span>
                </button>
              ))}
            </div>
          )}
          {tables.length > 0 && (
            <div className="mb-1">
              <div className="px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-500">Tables</div>
              {tables.map((t) => (
                <button key={t.id} onClick={() => { onGoto("database"); onClose(); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-white/[0.06]">
                  <span className="font-mono text-[12.5px]">{t.name}</span>
                  <span className="chip ml-auto !text-[10px]">{t.rowCount} rows</span>
                </button>
              ))}
            </div>
          )}
          {tasks.length > 0 && (
            <div>
              <div className="px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-500">Pipeline steps</div>
              {tasks.map((t) => (
                <button key={t.index} onClick={() => { onGoto("pipeline"); onClose(); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-white/[0.06]">
                  <span className="font-mono text-[11px] text-ink-500">{String(t.index + 1).padStart(2, "0")}</span>
                  <span>{t.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Download project bundle (JSON) ─────────────────────────────────────────
export function downloadBundle(project: Project, ws: WorkspaceData) {
  const bundle = {
    project: { name: project.name, domain: project.domainLabel, generatedAt: new Date().toISOString() },
    files: ws.files.map((f) => ({ path: f.path, language: f.language, content: f.content })),
    tables: ws.tables.map((t) => ({ name: t.name, sql: t.sql })),
    envExample: ws.env.map((e) => `${e.key}=`).join("\n"),
  };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project.name.toLowerCase().replace(/\s+/g, "-")}-bundle.json`;
  a.click();
  URL.revokeObjectURL(url);
}
