// Context Engineering: manages what the LLM sees, preventing context overflow
// and ensuring each agent gets the most relevant information for its task.

import type { AgentRoleId } from "./agents";

const MAX_CONTEXT_FILES = 40;
const MAX_FILE_CONTENT_CHARS = 2000;

// ─── File path relevance scoring ──────────────────────────────────────────────

const ROLE_PATH_WEIGHTS: Record<AgentRoleId, Array<{ pattern: RegExp; weight: number }>> = {
  orchestrator: [
    { pattern: /package\.json$/, weight: 10 },
    { pattern: /README/, weight: 8 },
    { pattern: /\.env/, weight: 6 },
  ],
  architect: [
    { pattern: /tsconfig|next\.config|package\.json/, weight: 10 },
    { pattern: /schema/, weight: 8 },
    { pattern: /layout\.tsx/, weight: 7 },
    { pattern: /src\/app\//, weight: 5 },
  ],
  database: [
    { pattern: /schema/, weight: 15 },
    { pattern: /drizzle|prisma|migration/, weight: 12 },
    { pattern: /db\//, weight: 10 },
    { pattern: /seed/, weight: 8 },
  ],
  backend: [
    { pattern: /route\.ts/, weight: 15 },
    { pattern: /api\//, weight: 12 },
    { pattern: /schema/, weight: 10 },
    { pattern: /middleware/, weight: 9 },
    { pattern: /lib\//, weight: 7 },
    { pattern: /auth/, weight: 8 },
  ],
  frontend: [
    { pattern: /page\.tsx/, weight: 15 },
    { pattern: /component/, weight: 12 },
    { pattern: /layout/, weight: 10 },
    { pattern: /globals\.css/, weight: 8 },
    { pattern: /hooks\//, weight: 7 },
  ],
  testing: [
    { pattern: /test|spec/, weight: 15 },
    { pattern: /route\.ts/, weight: 8 },
    { pattern: /schema/, weight: 7 },
    { pattern: /lib\//, weight: 6 },
  ],
  devops: [
    { pattern: /docker/i, weight: 15 },
    { pattern: /\.github|ci|cd/, weight: 12 },
    { pattern: /package\.json/, weight: 10 },
    { pattern: /\.env/, weight: 8 },
    { pattern: /Makefile|scripts/, weight: 7 },
  ],
};

function scoreFile(path: string, role: AgentRoleId): number {
  const weights = ROLE_PATH_WEIGHTS[role] ?? [];
  let score = 0;
  for (const w of weights) {
    if (w.pattern.test(path)) score += w.weight;
  }
  // Boost shallow files (more likely to be important config)
  const depth = path.split("/").length;
  score += Math.max(0, 5 - depth);
  return score;
}

// ─── Build context-aware file summary ─────────────────────────────────────────

export interface ContextFile {
  path: string;
  content: string;
  language: string;
  summary: string; // truncated/summarized for the prompt
}

export function buildAgentContext(
  role: AgentRoleId,
  allFiles: Array<{ path: string; content: string | null; language: string | null; type: string }>,
  taskTitle: string,
  taskDescription: string
): {
  relevantFiles: ContextFile[];
  fileTree: string;
  contextStats: { totalFiles: number; includedFiles: number; contextChars: number };
} {
  // Filter to actual files (not directories)
  const files = allFiles.filter((f) => f.type === "file" && f.content);

  // Score and sort by relevance to this agent's role
  const scored = files
    .map((f) => ({ ...f, score: scoreFile(f.path, role) }))
    .sort((a, b) => b.score - a.score);

  // Take top N most relevant files
  const selected = scored.slice(0, MAX_CONTEXT_FILES);

  // Build context files with smart truncation
  const relevantFiles: ContextFile[] = selected.map((f) => {
    const content = f.content ?? "";
    const truncated =
      content.length > MAX_FILE_CONTENT_CHARS
        ? content.slice(0, MAX_FILE_CONTENT_CHARS) + `\n... (${content.length - MAX_FILE_CONTENT_CHARS} chars truncated)`
        : content;
    return {
      path: f.path,
      content: truncated,
      language: f.language ?? "text",
      summary: `${f.path} (${content.length} chars, score: ${f.score})`,
    };
  });

  // Build a compact file tree string (always includes ALL files, even non-included ones)
  const fileTree = files
    .map((f) => {
      const included = selected.some((s) => s.path === f.path);
      return `${included ? "●" : "○"} ${f.path}`;
    })
    .join("\n");

  const contextChars = relevantFiles.reduce((sum, f) => sum + f.content.length, 0);

  return {
    relevantFiles,
    fileTree,
    contextStats: { totalFiles: files.length, includedFiles: relevantFiles.length, contextChars },
  };
}

// ─── Build structured system prompt with chain-of-thought ─────────────────────

export function buildStructuredPrompt(
  agentDef: { name: string; systemPrompt: string; role: AgentRoleId },
  projectName: string,
  projectPrompt: string,
  mode: "greenfield" | "brownfield",
  techStack: Record<string, string> | null,
  taskTitle: string,
  taskDescription: string,
  context: ReturnType<typeof buildAgentContext>,
  priorAgentOutputs: Array<{ agent: string; summary: string }>
): { system: string; user: string } {
  // Chain-of-Thought: instruct the model to reason before acting
  const cot = [
    "Before using any tool, think step-by-step:",
    "1. What does this task require?",
    "2. Which existing files are relevant? (check the context below)",
    "3. What new files/changes are needed?",
    "4. What is the correct order of operations?",
    "5. Are there any risks that need human approval?",
    "Only then proceed with tool calls.",
  ].join("\n");

  // Prior agent outputs (for context chain between agents)
  const priorContext = priorAgentOutputs.length > 0
    ? `\n\n## Prior Agent Results\n${priorAgentOutputs.map((p) => `**${p.agent}**: ${p.summary}`).join("\n")}`
    : "";

  // Relevant file contents (context window)
  const fileContext = context.relevantFiles.length > 0
    ? `\n\n## Relevant Existing Files (${context.contextStats.includedFiles}/${context.contextStats.totalFiles} included)\n${context.relevantFiles
        .map((f) => `### ${f.path}\n\`\`\`${f.language}\n${f.content}\n\`\`\``)
        .join("\n\n")}`
    : "";

  const system = [
    `# ${agentDef.name} Agent`,
    "",
    agentDef.systemPrompt,
    "",
    `## Project: "${projectName}"`,
    `Mode: ${mode}`,
    techStack ? `Tech stack: ${JSON.stringify(techStack)}` : "",
    "",
    `## Requirements`,
    projectPrompt,
    priorContext,
    "",
    `## Full File Tree`,
    "```",
    context.fileTree || "(empty project)",
    "```",
    fileContext,
    "",
    `## Reasoning Protocol`,
    cot,
    "",
    `## Tool Usage Rules`,
    "- write_file: Create complete, production-quality files. Never write placeholder/stub content.",
    "- read_file: Read an existing file's content before modifying it. Always read before edit.",
    "- create_db_table: Only for database schema tasks. Include proper types, constraints, indexes.",
    "- set_env_var: Declare every env var the app needs. Use 'secret' for credentials, 'vault_ref' for vault paths.",
    "- run_command: Log npm/build/test commands. Describe the purpose.",
    "- request_approval: ONLY for genuinely destructive or security-critical changes.",
    "",
    "When finished, respond with a 2-3 sentence summary of what you accomplished.",
  ].filter(Boolean).join("\n");

  const user = [
    `## Current Task: "${taskTitle}"`,
    taskDescription,
    "",
    "Complete this task now. Think step-by-step, then use tools.",
  ].join("\n");

  return { system, user };
}
