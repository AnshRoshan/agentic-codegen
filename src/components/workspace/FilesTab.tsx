"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, File, FileCode2, Folder, FolderOpen, Pencil, Save, X } from "lucide-react";
import { CodeView } from "@/components/CodeView";
import { EmptyState, Spinner } from "@/components/ui";
import type { FileNode } from "@/db/schema";
import { agentMeta } from "@/lib/agents";
import { api, cn, formatBytes, timeAgo } from "@/lib/utils";
import type { FileMeta } from "./Workspace";

interface TreeNode {
  name: string;
  path: string;
  children: TreeNode[];
  file?: FileMeta;
}

function buildTree(files: FileMeta[]): TreeNode {
  const root: TreeNode = { name: "", path: "", children: [] };
  for (const f of files) {
    const parts = f.path.split("/");
    let node = root;
    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join("/");
      let child = node.children.find((c) => c.name === part);
      if (!child) {
        child = { name: part, path, children: [] };
        node.children.push(child);
      }
      if (i === parts.length - 1) child.file = f;
      node = child;
    });
  }
  const sort = (n: TreeNode) => {
    n.children.sort((a, b) => (!!a.file === !!b.file ? a.name.localeCompare(b.name) : a.file ? 1 : -1));
    n.children.forEach(sort);
  };
  sort(root);
  return root;
}

const ICON_COLORS: Record<string, string> = { tsx: "#38bdf8", typescript: "#3b82f6", json: "#facc15", css: "#a78bfa", markdown: "#94a3b8", yaml: "#f472b6", sql: "#34d399", docker: "#60a5fa", bash: "#a3e635" };

function Tree({ node, depth, open, toggle, selected, onSelect }: { node: TreeNode; depth: number; open: Set<string>; toggle: (p: string) => void; selected: string | null; onSelect: (p: string) => void }) {
  return (
    <>
      {node.children.map((c) => {
        const isDir = !c.file;
        const isOpen = open.has(c.path);
        return (
          <div key={c.path}>
            <button
              onClick={() => (isDir ? toggle(c.path) : onSelect(c.path))}
              className={cn("flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-[12.5px] hover:bg-white/5", selected === c.path && "bg-brand-500/15 text-ink-100")}
              style={{ paddingLeft: depth * 12 + 8 }}
            >
              {isDir ? (
                <>
                  {isOpen ? <ChevronDown size={12} className="text-ink-500" /> : <ChevronRight size={12} className="text-ink-500" />}
                  {isOpen ? <FolderOpen size={13} className="text-amber-300" /> : <Folder size={13} className="text-amber-300" />}
                </>
              ) : (
                <>
                  <span className="w-3" />
                  <File size={13} style={{ color: ICON_COLORS[c.file?.language ?? ""] ?? "#8590b0" }} />
                </>
              )}
              <span className={cn("truncate", isDir ? "text-ink-200" : "text-ink-300")}>{c.name}</span>
              {c.file?.isModified && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-300" title="Modified" />}
            </button>
            {isDir && isOpen && <Tree node={c} depth={depth + 1} open={open} toggle={toggle} selected={selected} onSelect={onSelect} />}
          </div>
        );
      })}
    </>
  );
}

export function FilesTab({ projectId, files, openPath, onOpen }: { projectId: string; files: FileMeta[]; openPath: string | null; onOpen: (p: string | null) => void }) {
  const tree = useMemo(() => buildTree(files), [files]);
  const [open, setOpen] = useState<Set<string>>(new Set(["src", "src/app", "src/app/api", "src/db", "src/lib"]));
  const [file, setFile] = useState<FileNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!openPath && files.length && !file) onOpen(files.find((f) => f.path === "README.md")?.path ?? files[0].path);
  }, [files, openPath, file, onOpen]);

  useEffect(() => {
    if (!openPath) return;
    setLoading(true);
    setEditing(false);
    api<FileNode>(`/api/projects/${projectId}/files?path=${encodeURIComponent(openPath)}`)
      .then((f) => {
        setFile(f);
        setDraft(f.content);
        // expand parent dirs
        const parts = openPath.split("/");
        setOpen((prev) => {
          const next = new Set(prev);
          parts.slice(0, -1).forEach((_, i) => next.add(parts.slice(0, i + 1).join("/")));
          return next;
        });
      })
      .catch(() => setFile(null))
      .finally(() => setLoading(false));
  }, [openPath, projectId]);

  function toggle(p: string) {
    setOpen((prev) => {
      const n = new Set(prev);
      if (n.has(p)) n.delete(p);
      else n.add(p);
      return n;
    });
  }

  async function save() {
    if (!file) return;
    setSaving(true);
    try {
      const updated = await api<FileNode>(`/api/projects/${projectId}/files`, { method: "PUT", body: JSON.stringify({ path: file.path, content: draft }) });
      setFile(updated);
      setEditing(false);
      toast.success(`Saved ${file.name} (v${updated.version})`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!files.length) {
    return <EmptyState icon={FileCode2} title="No files yet" description="The Architect writes the first files in step 4. Start the pipeline to see the virtual file system fill up." />;
  }

  const meta = file ? agentMeta(file.agentRole) : null;

  return (
    <div className="panel grid min-h-[600px] overflow-hidden lg:grid-cols-[260px_1fr]">
      <div className="border-b border-white/8 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between border-b border-white/8 px-3 py-2 text-[11px] uppercase tracking-wider text-ink-500">
          <span>Explorer</span>
          <span>{files.length} files</span>
        </div>
        <div className="max-h-[300px] overflow-auto p-1.5 lg:max-h-[640px]">
          <Tree node={tree} depth={0} open={open} toggle={toggle} selected={openPath} onSelect={onOpen} />
        </div>
      </div>
      <div className="flex min-w-0 flex-col">
        {file ? (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b border-white/8 px-4 py-2 text-xs">
              <span className="font-mono text-ink-100">{file.path}</span>
              <span className="text-ink-500">{formatBytes(file.size)} · v{file.version} · {file.language}</span>
              {meta && file.agentRole && <span className="chip" style={{ borderColor: `${meta.color}55`, color: meta.color }}>{meta.emoji} {meta.name}</span>}
              <span className="text-ink-500">{timeAgo(file.updatedAt)}</span>
              <div className="ml-auto flex items-center gap-1">
                {editing ? (
                  <>
                    <button className="btn-ghost btn-sm" onClick={() => { setEditing(false); setDraft(file.content); }}><X size={13} /> Cancel</button>
                    <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? <Spinner className="h-3 w-3" /> : <Save size={13} />} Save</button>
                  </>
                ) : (
                  <button className="btn-secondary btn-sm" onClick={() => setEditing(true)}><Pencil size={13} /> Edit</button>
                )}
              </div>
            </div>
            <div className="relative min-h-0 flex-1 overflow-auto">
              {loading && <div className="absolute inset-0 grid place-items-center bg-ink-925/60"><Spinner /></div>}
              {editing ? (
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck={false} className="h-[600px] w-full resize-none bg-ink-925 p-4 font-mono text-[12.5px] leading-relaxed text-ink-100 outline-none" />
              ) : (
                <CodeView code={file.content} language={file.language} className="rounded-none border-0 max-h-[640px]" />
              )}
            </div>
          </>
        ) : (
          <div className="grid flex-1 place-items-center text-sm text-ink-500">{loading ? <Spinner /> : "Select a file"}</div>
        )}
      </div>
    </div>
  );
}
