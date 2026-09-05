export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function formatCost(micros: number) {
  const usd = micros / 1_000_000;
  if (usd < 0.01 && usd > 0) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

export function formatBytes(bytes: number) {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function formatDuration(ms: number) {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

export function timeAgo(date: string | Date) {
  const diff = Date.now() - new Date(date).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export const STATUS_META: Record<string, { label: string; color: string; bg: string; live?: boolean }> = {
  draft: { label: "Draft", color: "text-ink-300", bg: "bg-ink-700/60" },
  planning: { label: "Planning", color: "text-brand-300", bg: "bg-brand-500/15", live: true },
  generating: { label: "Generating", color: "text-accent-400", bg: "bg-accent-500/15", live: true },
  building: { label: "Building", color: "text-amber-400", bg: "bg-amber-400/15", live: true },
  testing: { label: "Testing", color: "text-lime-300", bg: "bg-lime-400/15", live: true },
  deploying: { label: "Deploying", color: "text-orange-300", bg: "bg-orange-400/15", live: true },
  waiting_approval: { label: "Needs approval", color: "text-amber-300", bg: "bg-amber-400/20", live: true },
  paused: { label: "Paused", color: "text-ink-300", bg: "bg-ink-700/60" },
  completed: { label: "Completed", color: "text-mint-400", bg: "bg-mint-400/15" },
  failed: { label: "Failed", color: "text-rose-400", bg: "bg-rose-400/15" },
};

export const RUNNING_STATUSES = new Set(["planning", "generating", "building", "testing", "deploying"]);

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}
