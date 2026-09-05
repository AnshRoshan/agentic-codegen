"use client";

import { useEffect, useRef, useState } from "react";
import { FileCode2, Search } from "lucide-react";
import { Spinner } from "@/components/ui";
import { api } from "@/lib/utils";

interface Result { path: string; language: string | null; matches: Array<{ line: number; text: string }> }

export function SearchPalette({ open, onClose, projectId, onOpenFile }: { open: boolean; onClose: () => void; projectId: string; onOpenFile: (path: string) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 30);
    else {
      setQ("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open || q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      api<{ results: Result[] }>(`/api/projects/${projectId}/search?q=${encodeURIComponent(q)}`)
        .then((r) => setResults(r.results))
        .finally(() => setLoading(false));
    }, 220);
    return () => clearTimeout(t);
  }, [q, open, projectId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-ink-950/70 p-4 pt-[12vh] backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel w-full max-w-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center gap-3 border-b border-white/8 px-4">
          <Search size={16} className="text-ink-500" />
          <input ref={input} className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-500" placeholder="Search generated code and file paths…" value={q} onChange={(e) => setQ(e.target.value)} />
          {loading ? <Spinner /> : <span className="kbd">esc</span>}
        </div>
        <div className="max-h-[50vh] overflow-auto">
          {q.trim().length < 2 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-500">Type at least 2 characters — e.g. <span className="font-mono text-ink-300">requireSession</span> or <span className="font-mono text-ink-300">route.ts</span></p>
          ) : results.length === 0 && !loading ? (
            <p className="px-4 py-6 text-center text-sm text-ink-500">No matches for “{q}”</p>
          ) : (
            results.map((r) => (
              <button key={r.path} onClick={() => onOpenFile(r.path)} className="block w-full border-b border-white/5 px-4 py-2.5 text-left hover:bg-white/5">
                <div className="flex items-center gap-2 font-mono text-xs text-ink-100"><FileCode2 size={12} className="text-brand-300" /> {r.path} <span className="ml-auto text-ink-500">{r.matches.length} match{r.matches.length === 1 ? "" : "es"}</span></div>
                {r.matches.slice(0, 3).map((m) => (
                  <div key={m.line} className="mt-1 truncate font-mono text-[11px] text-ink-400"><span className="mr-2 text-ink-600">{m.line}</span>{m.text}</div>
                ))}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
