import { Suspense } from "react";
import { Dashboard } from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-ink-950" />}>
      <Dashboard />
    </Suspense>
  );
}
