import { Suspense } from "react";
import { Workspace } from "@/components/workspace/Workspace";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="min-h-screen bg-ink-950" />}>
      <Workspace id={id} />
    </Suspense>
  );
}
