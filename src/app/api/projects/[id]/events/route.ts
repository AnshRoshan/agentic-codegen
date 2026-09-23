import { NextRequest } from "next/server";
import { db } from "@/db";
import { agentMessages, hitlCheckpoints, projects } from "@/db/schema";
import { and, asc, eq, gt } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Live run stream (SSE). Pushes project status, new agent messages and
// checkpoint updates as they happen so clients don't need fast polling.
// Frames: status | message | checkpoint | done, plus :heartbeat comments.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      let lastSeq = 0;
      let lastStatus = "";
      let lastCheckpointKey = "";
      let ticks = 0;

      const tick = async () => {
        if (closed) return;
        try {
          const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
          if (project) {
            const statusKey = `${project.status}:${project.currentStep}:${project.currentStep >= project.totalSteps}`;
            if (statusKey !== lastStatus) {
              lastStatus = statusKey;
              send("status", {
                status: project.status,
                currentStep: project.currentStep,
                totalSteps: project.totalSteps,
                generatedFiles: project.generatedFiles,
                completedTasks: project.completedTasks,
                totalTasks: project.totalTasks,
                tokensIn: project.tokensIn,
                tokensOut: project.tokensOut,
                costMicros: project.costMicros,
                llmCalls: project.llmCalls,
                errorMessage: project.errorMessage,
              });
            }
          }

          const msgs = await db
            .select()
            .from(agentMessages)
            .where(and(eq(agentMessages.projectId, id), gt(agentMessages.seq, lastSeq)))
            .orderBy(asc(agentMessages.seq))
            .limit(50);
          for (const m of msgs) {
            lastSeq = m.seq;
            send("message", m);
          }

          const cps = await db.select().from(hitlCheckpoints).where(eq(hitlCheckpoints.projectId, id));
          const cpKey = cps.map((c) => `${c.id}:${c.status}`).sort().join("|");
          if (cpKey !== lastCheckpointKey) {
            lastCheckpointKey = cpKey;
            send("checkpoint", { checkpoints: cps });
          }

          ticks += 1;
          if (ticks % 15 === 0) {
            if (closed) return;
            try { controller.enqueue(encoder.encode(": heartbeat\n\n")); } catch { closed = true; }
          }

          // Stop streaming once the run is finished for a while.
          if (project && ["completed", "failed", "draft", "paused"].includes(project.status) && ticks > 20 && !msgs.length) {
            send("done", { reason: "idle" });
            closed = true;
            clearInterval(timer);
            controller.close();
          }
        } catch {
          // transient DB error: keep the stream alive, retry next tick
        }
      };

      const timer = setInterval(tick, 1000);
      void tick();

      // Close cleanly when the client disconnects.
      _req.signal.addEventListener("abort", () => {
        if (closed) return;
        closed = true;
        clearInterval(timer);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
