"use client";

import { X, type LucideIcon } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { cn, STATUS_META } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.draft;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium", meta.bg, meta.color, className)}>
      <span className="status-dot bg-current" data-live={meta.live ? "true" : "false"} />
      {meta.label}
    </span>
  );
}

export function Modal({ open, onClose, title, children, width = "max-w-2xl" }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; width?: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-ink-950/80 p-4 backdrop-blur-sm sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal className={cn("panel relative my-8 w-full shadow-2xl shadow-black/60", width)}>
        {title && (
          <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
            <h2 className="font-display text-lg font-semibold">{title}</h2>
            <button onClick={onClose} className="btn-ghost btn-icon" aria-label="Close">
              <X size={16} />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-white/5 text-ink-400">
        <Icon size={22} />
      </div>
      <h3 className="font-display text-base font-semibold text-ink-100">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-ink-400">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-brand-400", className)} />;
}

export function Progress({ value, className, color = "bg-brand-500" }: { value: number; className?: string; color?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/8", className)}>
      <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Stat({ label, value, sub, icon: Icon, accent = "text-brand-300" }: { label: string; value: ReactNode; sub?: ReactNode; icon?: LucideIcon; accent?: string }) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-ink-400">{label}</span>
        {Icon && <Icon size={15} className={accent} />}
      </div>
      <div className="mt-2 font-display text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-ink-400">{sub}</div>}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2 text-sm text-ink-300">
      <span className={cn("relative h-5 w-9 rounded-full transition", checked ? "bg-brand-500" : "bg-ink-700")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition", checked ? "left-[18px]" : "left-0.5")} />
      </span>
      {label}
    </button>
  );
}
