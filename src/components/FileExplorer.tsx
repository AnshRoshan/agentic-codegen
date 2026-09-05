"use client";

import { useState, useMemo } from "react";
import { Folder, File, ChevronRight, ChevronDown } from "lucide-react";

interface FileNode {
  id: string;
  name: string;
  path: string;
  type: "file" | "directory" | string;
  language?: string | null;
  content?: string | null;
  size?: number | null;
  isGenerated?: boolean | null;
  isModified?: boolean | null;
}

interface FileExplorerProps {
  fileNodes: FileNode[];
  onSelectFile?: (node: FileNode) => void;
  selectedPath?: string;
}

interface TreeNode extends FileNode {
  children: TreeNode[];
}

// Build tree from flat list
function buildTree(nodes: FileNode[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // First pass: create all nodes
  for (const node of nodes) {
    nodeMap.set(node.id, { ...node, children: [] });
  }

  // Second pass: build hierarchy
  for (const node of nodes) {
    const treeNode = nodeMap.get(node.id)!;
    // Find parent by path
    const parentPath = node.path.split("/").slice(0, -1).join("/");
    const parent = nodes.find((n) => n.path === parentPath && n.type === "directory");
    
    if (parent) {
      const parentNode = nodeMap.get(parent.id);
      if (parentNode) {
        parentNode.children.push(treeNode);
      }
    } else if (node.path !== ".") {
      // Only add to roots if not the root node itself
      roots.push(treeNode);
    } else {
      // This is the root node
      roots.push(treeNode);
    }
  }

  // Sort: directories first, then alphabetically
  const sortNodes = (a: TreeNode, b: TreeNode) => {
    if (a.type !== b.type) {
      return a.type === "directory" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  };

  const sortTree = (nodes: TreeNode[]) => {
    nodes.sort(sortNodes);
    for (const node of nodes) {
      if (node.children.length > 0) {
        sortTree(node.children);
      }
    }
  };

  sortTree(roots);
  return roots;
}

// Language icon mapping
function getLanguageIcon(language: string | null | undefined): string {
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

function FileTreeNode({
  node,
  depth,
  expanded,
  onToggle,
  onSelect,
  selectedPath,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (node: FileNode) => void;
  selectedPath?: string;
}) {
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedPath === node.path;
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer hover:bg-surface-700/50 transition-colors ${
          isSelected ? "bg-primary-500/20 text-primary-300" : "text-surface-300"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => {
          if (node.type === "directory") {
            onToggle(node.id);
          } else {
            onSelect(node);
          }
        }}
      >
        {node.type === "directory" ? (
          <>
            <span className="w-4 h-4 flex items-center justify-center text-surface-500">
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </span>
            <Folder className="w-4 h-4 text-amber-400 flex-shrink-0" />
          </>
        ) : (
          <>
            <span className="w-4 flex-shrink-0" />
            <span className="text-sm flex-shrink-0">
              {getLanguageIcon(node.language)}
            </span>
          </>
        )}
        <span className="text-sm truncate flex-1">{node.name}</span>
        {node.isModified && (
          <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title="Modified" />
        )}
        {node.isGenerated && !node.isModified && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" title="Generated" />
        )}
      </div>
      {isExpanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              selectedPath={selectedPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileExplorer({
  fileNodes,
  onSelectFile,
  selectedPath,
}: FileExplorerProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["root"]));
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);

  const tree = useMemo(() => buildTree(fileNodes), [fileNodes]);

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpanded(newExpanded);
  };

  const handleSelect = (node: FileNode) => {
    setSelectedFile(node);
    onSelectFile?.(node);
  };

  const totalFiles = fileNodes.filter((n) => n.type === "file").length;
  const totalDirs = fileNodes.filter((n) => n.type === "directory").length;

  return (
    <div className="h-full flex flex-col bg-surface-900 rounded-xl border border-surface-700 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-surface-700 flex items-center justify-between">
        <span className="text-xs font-medium text-surface-400 uppercase tracking-wider">
          File Explorer
        </span>
        <span className="text-xs text-surface-500">
          {totalFiles} files, {totalDirs} dirs
        </span>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto">
        {tree.map((node) => (
          <FileTreeNode
            key={node.id}
            node={node}
            depth={0}
            expanded={expanded}
            onToggle={toggleExpand}
            onSelect={handleSelect}
            selectedPath={selectedPath ?? selectedFile?.path}
          />
        ))}
        {fileNodes.length === 0 && (
          <p className="text-center text-surface-500 py-8 text-sm">
            No files yet
          </p>
        )}
      </div>

      {/* Selected file preview */}
      {selectedFile && selectedFile.content && (
        <div className="border-t border-surface-700 max-h-64">
          <div className="px-3 py-2 bg-surface-800 border-b border-surface-700 flex items-center justify-between">
            <span className="text-xs font-medium text-surface-300">
              {selectedFile.name}
            </span>
            <span className="text-xs text-surface-500">
              {selectedFile.size ?? 0} bytes
            </span>
          </div>
          <pre className="p-3 text-xs text-surface-300 font-mono overflow-auto max-h-48 bg-surface-950">
            {selectedFile.content.slice(0, 2000)}
            {selectedFile.content.length > 2000 && "\n\n... (truncated)"}
          </pre>
        </div>
      )}
    </div>
  );
}
