"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState, useEffect, useCallback, createContext, useContext, useRef } from "react";
import { X, CheckCircle2, AlertTriangle, Info, XCircle } from "lucide-react";

// ─── EmptyState ───────────────────────────────────────────────────────────────

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center anim-fade">
      <div className="w-14 h-14 rounded-2xl border border-surface-700 bg-surface-900/60 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-surface-500" />
      </div>
      <h3 className="text-sm font-semibold text-surface-200 mb-1.5">{title}</h3>
      {description && (
        <p className="text-xs text-surface-500 max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

const STATUS_META: Record<
  string,
  { bg: string; text: string; border: string; label: string; dot?: boolean }
> = {
  draft:           { bg: "bg-surface-800/80",   text: "text-surface-400", border: "border-surface-700",      label: "Draft" },
  planning:        { bg: "bg-blue-500/10",       text: "text-blue-400",    border: "border-blue-500/25",      label: "Planning",        dot: true },
  generating:      { bg: "bg-indigo-500/10",     text: "text-indigo-300",  border: "border-indigo-500/25",    label: "Generating",      dot: true },
  building:        { bg: "bg-violet-500/10",     text: "text-violet-300",  border: "border-violet-500/25",    label: "Building",        dot: true },
  testing:         { bg: "bg-purple-500/10",     text: "text-purple-300",  border: "border-purple-500/25",    label: "Testing",         dot: true },
  completed:       { bg: "bg-emerald-500/10",    text: "text-emerald-400", border: "border-emerald-500/25",   label: "Completed" },
  failed:          { bg: "bg-red-500/10",        text: "text-red-400",     border: "border-red-500/25",       label: "Failed" },
  waiting_approval:{ bg: "bg-amber-500/10",      text: "text-amber-300",   border: "border-amber-500/25",     label: "Awaiting Approval", dot: true },
  idle:            { bg: "bg-surface-800/80",    text: "text-surface-500", border: "border-surface-700",      label: "Idle" },
  working:         { bg: "bg-amber-500/10",      text: "text-amber-300",   border: "border-amber-500/25",     label: "Working",         dot: true },
  reviewing:       { bg: "bg-blue-500/10",       text: "text-blue-300",    border: "border-blue-500/25",      label: "Reviewing",       dot: true },
  waiting:         { bg: "bg-surface-800/80",    text: "text-surface-500", border: "border-surface-700",      label: "Waiting" },
  hitl_paused:     { bg: "bg-amber-500/10",      text: "text-amber-300",   border: "border-amber-500/25",     label: "Paused",          dot: true },
  pending:         { bg: "bg-surface-800/60",    text: "text-surface-400", border: "border-surface-700",      label: "Pending" },
  in_progress:     { bg: "bg-amber-500/10",      text: "text-amber-300",   border: "border-amber-500/25",     label: "In Progress",     dot: true },
  approved:        { bg: "bg-emerald-500/10",    text: "text-emerald-400", border: "border-emerald-500/25",   label: "Approved" },
  rejected:        { bg: "bg-red-500/10",        text: "text-red-400",     border: "border-red-500/25",       label: "Rejected" },
  modified:        { bg: "bg-blue-500/10",       text: "text-blue-400",    border: "border-blue-500/25",      label: "Modified" },
  skipped:         { bg: "bg-surface-800/60",    text: "text-surface-400", border: "border-surface-700",      label: "Skipped" },
  greenfield:      { bg: "bg-emerald-500/10",    text: "text-emerald-400", border: "border-emerald-500/25",   label: "Greenfield" },
  brownfield:      { bg: "bg-amber-500/10",      text: "text-amber-400",   border: "border-amber-500/25",     label: "Brownfield" },
};

export function StatusBadge({
  status,
  size = "sm",
}: {
  status: string;
  size?: "xs" | "sm" | "md";
}) {
  const meta = STATUS_META[status] ?? STATUS_META.draft;
  const sizes = { xs: "text-[10px] px-1.5 py-0.5", sm: "text-[11px] px-2 py-0.5", md: "text-xs px-2.5 py-1" };
  return (
    <span className={`badge ${meta.bg} ${meta.text} border ${meta.border} ${sizes[size]}`}>
      {meta.dot && <span className="w-1.5 h-1.5 rounded-full bg-current anim-pulse" />}
      {meta.label}
    </span>
  );
}

// ─── ProgressBar ──────────────────────────────────────────────────────────────

export function ProgressBar({
  value,
  variant = "primary",
  className,
  showLabel,
}: {
  value: number;
  variant?: "primary" | "success" | "warning" | "danger";
  className?: string;
  showLabel?: boolean;
}) {
  const barClass = {
    primary: "",
    success: "done",
    warning: "warn",
    danger: "error",
  }[variant];

  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <div className="progress flex-1">
        <div
          className={`progress-bar ${barClass}`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-surface-500 tabular-nums w-8 text-right">
          {clampedValue}%
        </span>
      )}
    </div>
  );
}

// ─── Toast System ─────────────────────────────────────────────────────────────

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

const TOAST_ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const TOAST_STYLES: Record<ToastType, string> = {
  success: "border-emerald-500/30 bg-emerald-900/20",
  error:   "border-red-500/30     bg-red-900/20",
  warning: "border-amber-500/30   bg-amber-900/20",
  info:    "border-blue-500/30    bg-blue-900/20",
};

const TOAST_ICON_STYLES: Record<ToastType, string> = {
  success: "text-emerald-400",
  error:   "text-red-400",
  warning: "text-amber-400",
  info:    "text-blue-400",
};

interface ToastContextType {
  addToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
}

const ToastCtx = createContext<ToastContextType>({ addToast: () => {} });
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, title: string, message?: string, duration = 3500) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, title, message, duration }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const remove = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastCtx.Provider value={{ addToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((toast) => {
          const Icon = TOAST_ICONS[toast.type];
          return (
            <div
              key={toast.id}
              className={`anim-up flex items-start gap-3 px-4 py-3 rounded-xl border glass-panel ${TOAST_STYLES[toast.type]} min-w-[280px] max-w-sm shadow-xl`}
            >
              <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${TOAST_ICON_STYLES[toast.type]}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-100">{toast.title}</p>
                {toast.message && (
                  <p className="text-xs text-surface-400 mt-0.5">{toast.message}</p>
                )}
              </div>
              <button onClick={() => remove(toast.id)} className="text-surface-600 hover:text-surface-300 flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

// ─── useKeyboardShortcuts ─────────────────────────────────────────────────────

export function useKeyboardShortcuts(shortcuts: Record<string, () => void>) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      const key = [
        e.metaKey && "Meta",
        e.ctrlKey && "Ctrl",
        e.shiftKey && "Shift",
        e.altKey && "Alt",
        e.key !== "Meta" && e.key !== "Control" && e.key !== "Shift" && e.key !== "Alt" && e.key,
      ]
        .filter(Boolean)
        .join("+");

      if (shortcuts[key]) {
        e.preventDefault();
        shortcuts[key]();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts]);
}

// ─── Clipboard copy ───────────────────────────────────────────────────────────

export function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }, []);
  return { copy, copied };
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm anim-fade">
      <div className="glass-panel rounded-2xl p-6 max-w-md w-full mx-4 anim-scale shadow-2xl">
        <h3 className="text-base font-semibold text-surface-100 mb-2">{title}</h3>
        <p className="text-sm text-surface-400 mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <button className="btn btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
          <button
            className={`btn btn-sm ${danger ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className="anim-spin"
      style={{ animation: "spin-slow .7s linear infinite" }}
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity=".2" strokeWidth="2" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ─── Collapsible section ──────────────────────────────────────────────────────

export function Collapsible({
  title,
  children,
  defaultOpen = true,
  badge,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="panel overflow-hidden">
      <button
        className="panel-header w-full text-left hover:bg-surface-800/30 transition-colors cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <span className="panel-title flex items-center gap-2">
          <svg width="10" height="10" viewBox="0 0 10 10" className={`transition-transform ${open ? "rotate-90" : ""}`}>
            <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          {title}
        </span>
        {badge}
      </button>
      {open && <div className="anim-fade">{children}</div>}
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: T; label: string; icon?: LucideIcon; badge?: number }>;
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex gap-1 bg-surface-900/60 border border-surface-800 rounded-xl p-1 overflow-x-auto no-scrollbar">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
              active === tab.id
                ? "bg-surface-700/80 text-surface-100 shadow-sm"
                : "text-surface-500 hover:text-surface-200 hover:bg-surface-800/40"
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="text-[9px] font-bold bg-amber-500 text-black rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Kbd ──────────────────────────────────────────────────────────────────────

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd>{children}</kbd>;
}
