"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Settings, Sparkles, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/landing/LandingPage";
import { cn } from "@/lib/utils";

const NAV: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/dashboard", label: "Projects", icon: LayoutDashboard },
  { href: "/settings", label: "AI Settings", icon: Settings },
];

export function AppShell({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-ink-950">
      <header className="sticky top-0 z-40 border-b border-white/6 bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Logo size={22} />
            <span className="font-display text-base font-semibold tracking-tight">Forge</span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="tab" data-active={pathname.startsWith(n.href)}>
                <n.icon size={15} /> <span className="hidden sm:inline">{n.label}</span>
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {right}
            <Link href="/dashboard?new=1" className="btn-primary btn-sm">
              <Sparkles size={13} /> New project
            </Link>
          </div>
        </div>
      </header>
      <main className={cn("mx-auto max-w-[1600px] px-4 py-6 sm:px-6")}>{children}</main>
    </div>
  );
}
