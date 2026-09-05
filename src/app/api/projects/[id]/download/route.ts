import { eq } from "drizzle-orm";
import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { environmentVariables, fileNodes, projects } from "@/db/schema";
import { kebab } from "@/lib/domain";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const [project] = await db.select().from(projects).where(eq(projects.id, id));
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [files, env] = await Promise.all([
    db.select().from(fileNodes).where(eq(fileNodes.projectId, id)),
    db.select().from(environmentVariables).where(eq(environmentVariables.projectId, id)),
  ]);
  if (!files.length) return NextResponse.json({ error: "No files generated yet" }, { status: 400 });

  const zip = new JSZip();
  const root = zip.folder(kebab(project.name))!;
  for (const f of files) root.file(f.path, f.content);
  if (env.length) root.file(".env", env.map((e) => `${e.key}=${e.isSecret ? "" : e.value}`).join("\n") + "\n");

  const buffer = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return new NextResponse(new Blob([buffer as BlobPart]), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${kebab(project.name)}.zip"`,
    },
  });
}
