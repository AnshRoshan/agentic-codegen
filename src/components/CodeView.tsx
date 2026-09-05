"use client";

import { Highlight, themes, type Language } from "prism-react-renderer";
import { cn } from "@/lib/utils";

const LANG_MAP: Record<string, Language> = {
  typescript: "tsx",
  tsx: "tsx",
  javascript: "jsx",
  json: "json",
  css: "css",
  markdown: "markdown",
  yaml: "yaml",
  sql: "sql",
  bash: "bash",
  docker: "docker",
  text: "markup",
};

export function CodeView({ code, language = "typescript", className, showLines = true, highlight = [] }: { code: string; language?: string | null; className?: string; showLines?: boolean; highlight?: number[] }) {
  const lang = LANG_MAP[language ?? "text"] ?? "tsx";
  return (
    <Highlight theme={themes.nightOwl} code={code} language={lang}>
      {({ tokens, getLineProps, getTokenProps }) => (
        <pre className={cn("code-block p-4", className)} style={{ background: "transparent" }}>
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line })} className={cn("table-row", highlight.includes(i + 1) && "bg-brand-500/15")}>
              {showLines && <span className="table-cell select-none pr-4 text-right text-ink-600">{i + 1}</span>}
              <span className="table-cell whitespace-pre">
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </span>
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  );
}
