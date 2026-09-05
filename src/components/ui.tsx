import React from "react";
import type { ProjectStatus } from "../lib/types";
import { cn } from "../utils/cn";

// ─── Status badge ───────────────────────────────────────────────────────────
const STATUS_STYLE: Record<ProjectStatus, string> = {
  draft: "border-white/15 bg-white/5 text-ink-300",
  planning: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  generating: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  building: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  testing: "border-lime-400/30 bg-lime-400/10 text-lime-200",
  deploying: "border-orange-400/30 bg-orange-400/10 text-orange-200",
  completed: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  failed: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  waiting_approval: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  paused: "border-white/15 bg-white/5 text-ink-300",
};

const STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: "Draft", planning: "Planning", generating: "Generating",
  building: "Building", testing: "Testing", deploying: "Deploying",
  completed: "Completed", failed: "Failed",
  waiting_approval: "Needs approval", paused: "Paused",
};

export function StatusBadge({ status, className }: { status: ProjectStatus; className?: string }) {
  return (
    <span className={cn("chip", STATUS_STYLE[status], className)}>
      <span className={cn("status-dot",
        status === "completed" && "bg-emerald-400",
        status === "failed" && "bg-rose-400",
        status === "waiting_approval" && "bg-amber-400",
        ["planning", "generating", "building", "testing", "deploying"].includes(status) && "bg-violet-400",
        (status === "draft" || status === "paused") && "bg-ink-500",
      )}
        data-live={["planning", "generating", "building", "testing", "deploying"].includes(status)}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

// ─── Progress ───────────────────────────────────────────────────────────────
export function Progress({ value, className, barClass }: { value: number; className?: string; barClass?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]", className)}>
      <div
        className={cn("h-full rounded-full bg-gradient-to-r from-violet-500 via-violet-400 to-cyan-400 transition-all duration-500", barClass)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

// ─── Spinner ────────────────────────────────────────────────────────────────
export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("h-4 w-4 animate-spin", className)} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ─── Toggle ─────────────────────────────────────────────────────────────────
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="group inline-flex items-center gap-2.5"
      role="switch" aria-checked={checked}
    >
      <span className={cn(
        "relative h-[22px] w-[38px] rounded-full transition-colors",
        checked ? "bg-violet-500" : "bg-white/10 border border-white/10"
      )}>
        <span className={cn(
          "absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all",
          checked ? "left-[18px]" : "left-[2px]"
        )} />
      </span>
      {label && <span className="text-[13px] text-ink-300 group-hover:text-white">{label}</span>}
    </button>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────────
export function Empty({ icon, title, hint, action }: { icon: React.ReactNode; title: string; hint: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-6 py-12 text-center">
      <div className="mb-1 grid h-11 w-11 place-items-center rounded-xl bg-white/[0.05] text-ink-400">{icon}</div>
      <div className="text-[14px] font-semibold text-ink-100">{title}</div>
      <div className="max-w-sm text-[13px] leading-relaxed text-ink-400">{hint}</div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

// ─── Section card ───────────────────────────────────────────────────────────
export function SectionCard({ title, subtitle, right, children, className }: {
  title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("card p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-semibold tracking-tight text-ink-100">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[12.5px] text-ink-400">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

// ─── Modal ──────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, subtitle, children, wide }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode; wide?: boolean;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={cn("glass relative max-h-[90vh] w-full overflow-y-auto rounded-2xl p-6", wide ? "max-w-2xl" : "max-w-lg")}>
        <div className="mb-5">
          <h2 className="font-display text-[18px] font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-1 text-[13px] text-ink-400">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Logo ───────────────────────────────────────────────────────────────────
export function Logo({ size = 34 }: { size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-xl font-display font-bold text-white"
      style={{
        width: size, height: size, fontSize: size * 0.45,
        background: "linear-gradient(140deg, #8b5cf6, #6d28d9 60%, #4c1d95)",
        boxShadow: "0 4px 16px rgba(124,58,237,0.4), inset 0 1px 0 rgba(255,255,255,0.25)",
      }}
    >
      F
    </span>
  );
}

// ─── Meter (speed/quality bars) ─────────────────────────────────────────────
export function Meter({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="inline-flex items-center gap-[3px]">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={cn("h-[5px] w-[14px] rounded-full", i < value ? "bg-violet-400" : "bg-white/10")} />
      ))}
    </span>
  );
}
