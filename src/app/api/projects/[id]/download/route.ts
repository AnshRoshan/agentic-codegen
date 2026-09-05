import JSZip from "jszip";
import { fail, handler } from "@/lib/server/http";
import { allFilesWithContent, getProject } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

export const GET = handler<{ id: string }>(async (_req, { id }) => {
  const p = await getProject(id);
  if (!p) return fail(404, "Project not found");
  const files = await allFilesWithContent(id);
  const zip = new JSZip();
  const folder = p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
  for (const f of files) zip.file(`${folder}/${f.path}`, f.content);
  zip.file(`${folder}/FORGE.json`, JSON.stringify({ project: p.name, prompt: p.prompt, domain: p.domainLabel, architecture: p.architecture, generatedAt: new Date().toISOString(), files: files.length }, null, 2));
  const buf = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return new Response(Buffer.from(buf), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${folder}.zip"`,
      "Cache-Control": "no-store",
    },
  });
});
