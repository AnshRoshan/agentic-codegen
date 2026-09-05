"use client";

import { useState } from "react";
import { Lock, Eye, EyeOff, Key, Shield, Plus, Trash2, Edit3, Check, X, ExternalLink, Copy } from "lucide-react";
import { EmptyState, ConfirmDialog, useCopyToClipboard } from "./ui";

interface EnvVar {
  id: string;
  key: string;
  value: string | null;
  type: "plain" | "secret" | "vault_ref";
  description: string | null;
  isSecret: boolean;
  isRequired: boolean;
  vaultPath?: string | null;
  source?: string | null;
}

interface EnvironmentVariablesProps {
  projectId: string;
  envVars: EnvVar[];
  onRefresh: () => void;
}

const TYPE_INFO = {
  plain:     { label: "Plain",     icon: "📝", color: "text-surface-400",  bg: "bg-surface-800",     border: "border-surface-700" },
  secret:    { label: "Secret",    icon: "🔐", color: "text-amber-400",    bg: "bg-amber-900/15",    border: "border-amber-700/40" },
  vault_ref: { label: "Vault Ref", icon: "🏦", color: "text-blue-400",     bg: "bg-blue-900/15",     border: "border-blue-700/40" },
};

function EnvVarRow({
  v,
  showSecrets,
  onEdit,
  onDelete,
}: {
  v: EnvVar;
  showSecrets: boolean;
  onEdit: (v: EnvVar) => void;
  onDelete: (id: string) => void;
}) {
  const { copy, copied } = useCopyToClipboard();
  const typeInfo = TYPE_INFO[v.type];
  const masked = "•".repeat(16);

  return (
    <tr>
      <td>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-1.5 py-0.5 rounded border ${typeInfo.bg} ${typeInfo.border} ${typeInfo.color}`}>
            {typeInfo.icon}
          </span>
          <code className="text-surface-200 text-xs font-mono">{v.key}</code>
          {v.isRequired && (
            <span className="text-[9px] text-red-400 border border-red-500/30 bg-red-500/10 rounded px-1">req</span>
          )}
        </div>
        {v.description && (
          <p className="text-xs text-surface-600 mt-0.5 ml-8 max-w-[220px] truncate">{v.description}</p>
        )}
      </td>
      <td>
        {v.type === "vault_ref" ? (
          <span className="flex items-center gap-1 text-xs text-blue-400 font-mono">
            <ExternalLink className="w-3 h-3" />
            {v.value ?? "op://vault/…"}
          </span>
        ) : v.isSecret && !showSecrets ? (
          <span className="text-xs font-mono text-surface-600">{masked}</span>
        ) : (
          <span className={`text-xs font-mono ${v.isSecret ? "text-amber-300" : "text-surface-300"} max-w-[200px] truncate block`}>
            {v.value ?? "(not set)"}
          </span>
        )}
      </td>
      <td className="text-xs text-surface-500 capitalize">{v.source ?? "agent"}</td>
      <td>
        <div className="flex items-center gap-1">
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => copy(v.value ?? "")}
            data-tip={copied ? "Copied!" : "Copy value"}
          >
            <Copy className="w-3 h-3" />
          </button>
          <button className="btn btn-ghost btn-xs" onClick={() => onEdit(v)} data-tip="Edit">
            <Edit3 className="w-3 h-3" />
          </button>
          <button
            className="btn btn-ghost btn-xs text-red-500 hover:text-red-400"
            onClick={() => onDelete(v.id)}
            data-tip="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function AddEditForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<EnvVar>;
  onSave: (data: Partial<EnvVar>) => void;
  onCancel: () => void;
}) {
  const [key, setKey] = useState(initial?.key ?? "");
  const [value, setValue] = useState(initial?.value ?? "");
  const [type, setType] = useState<"plain" | "secret" | "vault_ref">(initial?.type ?? "plain");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isRequired, setIsRequired] = useState(initial?.isRequired ?? true);

  return (
    <div className="p-4 border-t border-surface-800 bg-surface-900/50 anim-fade">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="label">Key</label>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
            className="input mono text-xs"
            placeholder="DATABASE_URL"
          />
        </div>
        <div>
          <label className="label">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="input text-xs">
            <option value="plain">Plain — visible config value</option>
            <option value="secret">Secret — encrypted at rest</option>
            <option value="vault_ref">Vault Ref — op://vault/path</option>
          </select>
        </div>
        <div>
          <label className="label">Value {type === "vault_ref" && "(vault path)"}</label>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="input mono text-xs"
            type={type === "secret" ? "password" : "text"}
            placeholder={
              type === "vault_ref"
                ? "op://vault/item/field"
                : type === "secret"
                ? "super-secret-value"
                : "http://localhost:3000"
            }
          />
        </div>
        <div>
          <label className="label">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input text-xs"
            placeholder="What this variable controls…"
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-surface-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isRequired}
            onChange={(e) => setIsRequired(e.target.checked)}
            className="rounded"
          />
          Required for startup
        </label>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
          <button
            className="btn btn-primary btn-sm"
            disabled={!key.trim()}
            onClick={() => onSave({ key, value, type, description, isRequired })}
          >
            <Check className="w-3.5 h-3.5" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EnvironmentVariables({ projectId, envVars, onRefresh }: EnvironmentVariablesProps) {
  const [showSecrets, setShowSecrets] = useState(false);
  const [filter, setFilter] = useState<"all" | "required" | "secrets">("all");
  const [showForm, setShowForm] = useState(false);
  const [editingVar, setEditingVar] = useState<EnvVar | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const filtered = envVars.filter((v) => {
    if (filter === "required") return v.isRequired;
    if (filter === "secrets") return v.isSecret || v.type !== "plain";
    return true;
  });

  const save = async (data: Partial<EnvVar>, id?: string) => {
    if (id) {
      await fetch(`/api/projects/${projectId}/env/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } else {
      await fetch(`/api/projects/${projectId}/env`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    }
    setShowForm(false);
    setEditingVar(null);
    onRefresh();
  };

  const doDelete = async (id: string) => {
    await fetch(`/api/projects/${projectId}/env/${id}`, { method: "DELETE" });
    setConfirmDelete(null);
    onRefresh();
  };

  const exportEnv = () => {
    const lines = envVars.map((v) =>
      v.description
        ? `# ${v.description}\n${v.key}=${showSecrets && v.value ? v.value : v.isSecret ? "" : v.value ?? ""}`
        : `${v.key}=${v.isSecret ? "" : v.value ?? ""}`
    );
    const blob = new Blob([lines.join("\n\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ".env.example";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col panel overflow-hidden">
      {/* Header */}
      <div className="panel-header bg-gradient-to-r from-emerald-500/5 to-transparent">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Key className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-surface-100 text-sm">Environment & Secrets</span>
          <span className="text-xs text-surface-600">
            {envVars.length} vars · {envVars.filter((v) => v.isSecret).length} secrets
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSecrets(!showSecrets)}
            className="btn btn-ghost btn-xs"
            data-tip={showSecrets ? "Hide secrets" : "Reveal secrets"}
          >
            {showSecrets ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
          <button onClick={exportEnv} className="btn btn-secondary btn-xs" data-tip="Export .env.example">
            Export
          </button>
          <button
            onClick={() => { setEditingVar(null); setShowForm(!showForm); }}
            className="btn btn-primary btn-xs"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-surface-800 bg-surface-900/40">
        {(["all", "required", "secrets"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-[11px] px-2.5 py-1 rounded-md capitalize transition-colors ${
              filter === f
                ? "bg-surface-700 text-surface-100 font-medium"
                : "text-surface-500 hover:text-surface-300"
            }`}
          >
            {f} ({f === "all" ? envVars.length : f === "required" ? envVars.filter(v => v.isRequired).length : envVars.filter(v => v.isSecret || v.type !== "plain").length})
          </button>
        ))}
      </div>

      {/* Add/edit form inline */}
      {showForm && !editingVar && (
        <AddEditForm onSave={(d) => save(d)} onCancel={() => setShowForm(false)} />
      )}
      {editingVar && (
        <AddEditForm
          initial={editingVar}
          onSave={(d) => save(d, editingVar.id)}
          onCancel={() => setEditingVar(null)}
        />
      )}

      {/* Table */}
      <div className="scroll flex-1">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Shield}
            title="No variables here"
            description="Add environment variables that agents and the app will use at runtime."
            action={
              <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
                <Plus className="w-3.5 h-3.5" />
                Add first variable
              </button>
            }
          />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Value</th>
                <th>Source</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <EnvVarRow
                  key={v.id}
                  v={v}
                  showSecrets={showSecrets}
                  onEdit={(vr) => { setEditingVar(vr); setShowForm(false); }}
                  onDelete={(id) => setConfirmDelete(id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer note */}
      <div className="px-4 py-2 border-t border-surface-800 bg-surface-950/30 flex items-center gap-2">
        <Lock className="w-3 h-3 text-surface-600" />
        <p className="text-[10px] text-surface-600">
          Secret values are stored encrypted. Vault refs (op://) are resolved at runtime only.
        </p>
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete environment variable?"
        message="This will permanently remove the variable from the project. Running agents may fail if they depend on it."
        confirmLabel="Delete"
        danger
        onConfirm={() => confirmDelete && doDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
