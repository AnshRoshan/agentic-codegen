"use client";

import { useState, useMemo, useCallback } from "react";
import Editor from "@monaco-editor/react";
import {
  Eye,
  Code2,
  Settings,
  RefreshCw,
  Download,
  X,
  Folder,
  ChevronRight,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

interface FileNode {
  id: string;
  name: string;
  path: string;
  type: string;
  language: string | null;
  content: string | null;
  size: number | null;
  isGenerated: boolean | null;
  isModified: boolean | null;
}

interface CodeWorkspaceProps {
  projectId: string;
  projectName: string;
  fileNodes: FileNode[];
  onOpenSettings: () => void;
  onRefresh: () => void;
}

interface TreeNode extends FileNode {
  children: TreeNode[];
}

function buildTree(nodes: FileNode[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  for (const node of nodes) nodeMap.set(node.id, { ...node, children: [] });
  for (const node of nodes) {
    const treeNode = nodeMap.get(node.id)!;
    const parentPath = node.path.split("/").slice(0, -1).join("/");
    const parent = nodes.find((n) => n.path === parentPath && n.type === "directory");
    if (parent) {
      nodeMap.get(parent.id)?.children.push(treeNode);
    } else {
      roots.push(treeNode);
    }
  }
  const sortFn = (a: TreeNode, b: TreeNode) =>
    a.type !== b.type ? (a.type === "directory" ? -1 : 1) : a.name.localeCompare(b.name);
  const sortTree = (arr: TreeNode[]) => {
    arr.sort(sortFn);
    arr.forEach((n) => n.children.length && sortTree(n.children));
  };
  sortTree(roots);
  return roots;
}

function monacoLanguage(lang: string | null | undefined): string {
  const map: Record<string, string> = {
    typescript: "typescript",
    tsx: "typescript",
    javascript: "javascript",
    jsx: "javascript",
    json: "json",
    css: "css",
    markdown: "markdown",
    sql: "sql",
    dockerfile: "dockerfile",
    yaml: "yaml",
    env: "ini",
    text: "plaintext",
    html: "html",
  };
  return map[lang ?? ""] ?? "plaintext";
}

function fileIcon(language: string | null | undefined): string {
  const icons: Record<string, string> = {
    typescript: "📘",
    tsx: "⚛️",
    javascript: "📒",
    jsx: "⚛️",
    json: "📋",
    css: "🎨",
    markdown: "📝",
    sql: "🗄️",
    dockerfile: "🐳",
    yaml: "⚙️",
    env: "🔐",
    text: "📄",
  };
  return icons[language ?? ""] ?? "📄";
}

function FileTreeRow({
  node,
  depth,
  expanded,
  onToggle,
  onOpen,
  activePath,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onOpen: (node: FileNode) => void;
  activePath?: string;
}) {
  const isExpanded = expanded.has(node.id);
  const isActive = activePath === node.path;
  return (
    <div>
      <div
        className={`flex items-center gap-1.5 px-2 py-[5px] cursor-pointer hover:bg-white/5 transition-colors text-[13px] ${
          isActive ? "bg-primary-500/15 text-primary-300" : "text-surface-300"
        }`}
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
        onClick={() => (node.type === "directory" ? onToggle(node.id) : onOpen(node))}
      >
        {node.type === "directory" ? (
          <>
            <span className="w-3.5 text-surface-500">
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </span>
            <Folder className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          </>
        ) : (
          <>
            <span className="w-3.5" />
            <span className="text-xs">{fileIcon(node.language)}</span>
          </>
        )}
        <span className="truncate flex-1">{node.name}</span>
        {node.isModified && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
      </div>
      {isExpanded &&
        node.children.map((c) => (
          <FileTreeRow
            key={c.id}
            node={c}
            depth={depth + 1}
            expanded={expanded}
            onToggle={onToggle}
            onOpen={onOpen}
            activePath={activePath}
          />
        ))}
    </div>
  );
}

export default function CodeWorkspace({
  projectId,
  projectName,
  fileNodes,
  onOpenSettings,
  onRefresh,
}: CodeWorkspaceProps) {
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(fileNodes.filter((f) => f.type === "directory").map((f) => f.id))
  );
  const [openTabs, setOpenTabs] = useState<FileNode[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"code" | "preview">("code");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const tree = useMemo(() => buildTree(fileNodes), [fileNodes]);
  const activeFile = openTabs.find((t) => t.path === activePath) ?? null;

  const openFile = useCallback((node: FileNode) => {
    setOpenTabs((prev) => (prev.some((t) => t.path === node.path) ? prev : [...prev, node]));
    setActivePath(node.path);
    setViewMode("code");
    setHasUnsaved(false);
    setEditContent(node.content ?? "");
  }, []);

  const closeTab = (path: string) => {
    setOpenTabs((prev) => {
      const next = prev.filter((t) => t.path !== path);
      if (activePath === path) {
        setActivePath(next.length ? next[next.length - 1].path : null);
      }
      return next;
    });
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [editContent, setEditContent] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const handleDownload = () => {
    window.location.href = `/api/projects/${projectId}/download`;
  };

  const handleEditorChange = (value: string | undefined) => {
    setEditContent(value ?? "");
    setHasUnsaved(true);
  };

  const handleSave = async () => {
    if (!activeFile || !hasUnsaved) return;
    setSaving(true);
    await fetch(`/api/projects/${projectId}/files`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId: activeFile.id, content: editContent }),
    });
    onRefresh();
    setSaving(false);
    setHasUnsaved(false);
  };

  // pick a default file to display if none open yet
  const displayFile =
    activeFile ??
    (fileNodes.find((f) => f.path === "src/app/page.tsx" && f.type === "file") ||
      fileNodes.find((f) => f.type === "file"));

  const editorValue = activeFile ? (hasUnsaved ? editContent : activeFile.content ?? "") : displayFile?.content ?? "";

  const totalFiles = fileNodes.filter((f) => f.type === "file").length;

  return (
    <div className="h-full flex flex-col bg-[#0d1117] rounded-xl border border-surface-700 overflow-hidden">
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-800 bg-surface-900">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-md text-surface-400 hover:bg-surface-800 hover:text-surface-200 transition-colors"
            title="Toggle file explorer"
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setViewMode("preview")}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === "preview"
                ? "bg-primary-500/20 text-primary-400"
                : "text-surface-400 hover:bg-surface-800 hover:text-surface-200"
            }`}
            title="Preview"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("code")}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === "code"
                ? "bg-primary-500/20 text-primary-400"
                : "text-surface-400 hover:bg-surface-800 hover:text-surface-200"
            }`}
            title="Code"
          >
            <Code2 className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-md text-surface-400 hover:bg-surface-800 hover:text-surface-200 transition-colors"
            title="AI Provider Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Breadcrumb / address bar */}
        <div className="flex-1 mx-3 flex items-center gap-2 bg-surface-950 border border-surface-800 rounded-lg px-3 py-1.5 max-w-xl">
          <button onClick={onRefresh} className="text-surface-500 hover:text-surface-300">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-surface-500 font-mono truncate">
            /{projectName.toLowerCase().replace(/\s+/g, "-")}
            {displayFile ? `/${displayFile.path}` : ""}
          </span>
        </div>

        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-500 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Download
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* File explorer sidebar */}
        {sidebarOpen && (
          <div className="w-56 border-r border-surface-800 flex flex-col bg-surface-900/50">
            <div className="px-3 py-2 border-b border-surface-800 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-surface-500 tracking-wider">FILES</span>
              <span className="text-[10px] text-surface-600">{totalFiles}</span>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {tree.map((node) => (
                <FileTreeRow
                  key={node.id}
                  node={node}
                  depth={0}
                  expanded={expanded}
                  onToggle={toggleExpand}
                  onOpen={openFile}
                  activePath={activePath ?? undefined}
                />
              ))}
              {fileNodes.length === 0 && (
                <p className="text-center text-surface-600 text-xs py-6 px-3">
                  Files will appear here as agents generate them
                </p>
              )}
            </div>
          </div>
        )}

        {/* Main editor area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tabs */}
          {openTabs.length > 0 && (
            <div className="flex items-center bg-surface-900 border-b border-surface-800 overflow-x-auto">
              {openTabs.map((tab) => (
                <div
                  key={tab.path}
                  onClick={() => {
                    setActivePath(tab.path);
                    setViewMode("code");
                  }}
                  className={`flex items-center gap-2 px-3 py-2 text-xs border-r border-surface-800 cursor-pointer whitespace-nowrap ${
                    activePath === tab.path && viewMode === "code"
                      ? "bg-[#0d1117] text-surface-100"
                      : "text-surface-500 hover:bg-surface-800/50"
                  }`}
                >
                  <span>{fileIcon(tab.language)}</span>
                  {tab.name}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.path);
                    }}
                    className="hover:bg-surface-700 rounded p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {viewMode === "preview" ? (
              <LivePreview fileNodes={fileNodes} projectName={projectName} />
            ) : displayFile ? (
              <>
                {/* Save bar */}
                {hasUnsaved && activeFile && (
                  <div className="flex items-center justify-between px-3 py-1.5 bg-amber-900/20 border-b border-amber-500/20 text-xs text-amber-300">
                    <span>Unsaved changes</span>
                    <button
                      className="btn btn-xs bg-amber-600 text-white hover:bg-amber-500"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? "Saving…" : "Save (Ctrl+S)"}
                    </button>
                  </div>
                )}
                <div className="flex-1 overflow-hidden">
                  <Editor
                    key={displayFile.path}
                    height="100%"
                    theme="vs-dark"
                    language={monacoLanguage(displayFile.language)}
                    value={editorValue}
                    onChange={handleEditorChange}
                    options={{
                      readOnly: false,
                      minimap: { enabled: fileNodes.filter(f => f.type === "file").length > 10 },
                      fontSize: 13,
                      scrollBeyondLastLine: false,
                      padding: { top: 12, bottom: 12 },
                      wordWrap: "on",
                      lineNumbers: "on",
                      renderLineHighlight: "line",
                      cursorBlinking: "smooth",
                      smoothScrolling: true,
                      fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
                      fontLigatures: true,
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-surface-600 text-sm">
                Select a file from the explorer to edit
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LivePreview({
  fileNodes,
  projectName,
}: {
  fileNodes: FileNode[];
  projectName: string;
}) {
  const pageFiles = fileNodes.filter(
    (f) => f.type === "file" && /page\.(tsx|jsx)$/.test(f.path)
  );
  const apiFiles = fileNodes.filter((f) => f.type === "file" && f.path.includes("/api/") && f.path.endsWith("route.ts"));
  const componentFiles = fileNodes.filter(
    (f) => f.type === "file" && f.path.startsWith("src/components/")
  );

  const routeFrom = (p: string) => {
    const m = p.match(/src\/app\/(.*)\/page\.(tsx|jsx)$/);
    if (!m) return "/";
    return "/" + m[1].replace(/^page\.(tsx|jsx)$/, "");
  };

  const apiRoute = (p: string) => {
    const m = p.match(/src\/app\/api\/(.*)\/route\.ts$/);
    if (!m) return "/api";
    return "/api/" + m[1];
  };

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-[#0a0e1a] to-[#020712] p-6">
      <div className="max-w-4xl mx-auto">
        {/* Browser chrome */}
        <div className="rounded-t-xl bg-surface-800 border border-surface-700 border-b-0 px-3 py-2 flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
          <div className="flex-1 mx-3 flex items-center gap-2 bg-surface-950 rounded-md px-3 py-1 border border-surface-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-surface-400 font-mono">localhost:3000</span>
          </div>
        </div>

        {/* Preview canvas */}
        <div className="rounded-b-xl bg-white overflow-hidden border border-surface-700 shadow-2xl min-h-[500px]">
          {/* Mock landing / app UI */}
          <div className="p-8 md:p-12 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white min-h-[500px]">
            <nav className="flex justify-between items-center mb-16">
              <span className="text-lg font-bold">{projectName}</span>
              <div className="flex gap-3 text-sm">
                <span className="text-slate-400">Sign in</span>
                <span className="px-4 py-1.5 bg-indigo-600 rounded-lg text-white">
                  Get started
                </span>
              </div>
            </nav>
            <div className="max-w-2xl">
              <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
                {projectName}
              </h1>
              <p className="text-lg text-slate-400 leading-relaxed">
                A preview scaffolded from the generated file tree. Deploy the download to see
                the fully rendered app running locally.
              </p>
              <div className="mt-8 flex gap-3">
                <div className="px-5 py-2.5 bg-indigo-600 rounded-lg text-sm font-medium">
                  Try demo →
                </div>
                <div className="px-5 py-2.5 border border-slate-700 rounded-lg text-sm font-medium">
                  Documentation
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Discovered routes summary */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-surface-800 bg-surface-900/40 p-4">
            <p className="text-[10px] uppercase tracking-wider text-surface-500 mb-2">
              Discovered Pages
            </p>
            {pageFiles.length === 0 ? (
              <p className="text-xs text-surface-600">No pages yet</p>
            ) : (
              <div className="space-y-1">
                {pageFiles.map((p) => (
                  <div key={p.id} className="text-xs font-mono text-surface-300">
                    <span className="text-primary-400">GET</span>{" "}
                    <span className="text-emerald-400">{routeFrom(p.path)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-surface-800 bg-surface-900/40 p-4">
            <p className="text-[10px] uppercase tracking-wider text-surface-500 mb-2">
              API Endpoints
            </p>
            {apiFiles.length === 0 ? (
              <p className="text-xs text-surface-600">No API routes yet</p>
            ) : (
              <div className="space-y-1">
                {apiFiles.map((p) => (
                  <div key={p.id} className="text-xs font-mono text-surface-300">
                    <span className="text-amber-400">API</span>{" "}
                    <span className="text-blue-400">{apiRoute(p.path)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <p className="text-[11px] text-surface-600 mt-3 text-center">
          🎨 Design mockup · Download & <code className="text-surface-400">npm run dev</code> for the actual running app
        </p>
      </div>
    </div>
  );
}
