import type { AppSpec } from "./domain-inference";
import { generateCodebase } from "./codegen";

export interface McpTool {
  name: string;
  description: string;
  argumentsSchema: Record<string, any>;
  returnsSchema: Record<string, any>;
}

export interface McpServer {
  id: string;
  name: string;
  emoji: string;
  status: "active" | "inactive";
  description: string;
  tools: McpTool[];
}

export const MCP_SERVERS: McpServer[] = [
  {
    id: "filesystem",
    name: "Filesystem Tool Server",
    emoji: "📁",
    status: "active",
    description: "Enables agents to securely read, write, edit, and search source code files within the workspace sandbox.",
    tools: [
      {
        name: "list_directory",
        description: "List all files and subdirectories recursively in the project directory.",
        argumentsSchema: {
          path: { type: "string", description: "Target subdirectory (default project root)" }
        },
        returnsSchema: {
          files: { type: "array", description: "List of files with metadata" }
        }
      },
      {
        name: "read_file",
        description: "Retrieve the full text content of a file in the workspace.",
        argumentsSchema: {
          filePath: { type: "string", description: "Relative path to file", required: true }
        },
        returnsSchema: {
          content: { type: "string", description: "Complete file string contents" }
        }
      },
      {
        name: "write_file",
        description: "Create or replace file content.",
        argumentsSchema: {
          filePath: { type: "string", description: "Relative path to write", required: true },
          content: { type: "string", description: "New file contents", required: true }
        },
        returnsSchema: {
          success: { type: "boolean" },
          size: { type: "number" }
        }
      }
    ]
  },
  {
    id: "postgres-db",
    name: "PostgreSQL Schema Engine",
    emoji: "🗄️",
    status: "active",
    description: "Exposes raw SQL querying, database schema inspections, migration pushes, and row seed insertions.",
    tools: [
      {
        name: "list_tables",
        description: "List all active tables in the PostgreSQL database.",
        argumentsSchema: {},
        returnsSchema: {
          tables: { type: "array", description: "Array of tables with column list and row count" }
        }
      },
      {
        name: "execute_query",
        description: "Run raw read-only SQL queries on the active PostgreSQL database schema.",
        argumentsSchema: {
          sql: { type: "string", description: "Valid PostgreSQL query", required: true }
        },
        returnsSchema: {
          rows: { type: "array", description: "Returned table query records" },
          rowCount: { type: "number" }
        }
      }
    ]
  },
  {
    id: "shell-executor",
    name: "Unix Terminal Runner",
    emoji: "📟",
    status: "active",
    description: "Allows running approved build, compilation, test execution, and deployment commands.",
    tools: [
      {
        name: "execute_command",
        description: "Runs a safe terminal CLI command in the background shell.",
        argumentsSchema: {
          command: { type: "string", description: "CLI command (e.g. npm test, npm install)", required: true }
        },
        returnsSchema: {
          stdout: { type: "string" },
          stderr: { type: "string" },
          exitCode: { type: "number" },
          durationMs: { type: "number" }
        }
      }
    ]
  },
  {
    id: "github-manager",
    name: "GitHub API Client",
    emoji: "🚀",
    status: "active",
    description: "Handles committing codebases, branching, and submitting pull requests to remote repositories.",
    tools: [
      {
        name: "create_pull_request",
        description: "Propose a new branch merge pull-request on GitHub.",
        argumentsSchema: {
          title: { type: "string", description: "PR title", required: true },
          body: { type: "string", description: "PR description", required: true },
          branch: { type: "string", description: "Working branch", required: true }
        },
        returnsSchema: {
          prUrl: { type: "string" },
          success: { type: "boolean" }
        }
      }
    ]
  }
];

// Execute a tool simulation locally based on current workspace files and databases!
export function executeMcpToolSim(
  serverId: string,
  toolName: string,
  args: Record<string, any>,
  spec: AppSpec,
  editedFiles?: Record<string, string>
): { ok: boolean; data?: any; error?: string } {
  try {
    // Generate virtual workspace files
    const codebase = generateCodebase(spec);
    const virtualFiles: Record<string, string> = {};
    codebase.forEach((f) => {
      virtualFiles[f.path] = editedFiles?.[f.path] || f.content;
    });

    if (serverId === "filesystem") {
      if (toolName === "list_directory") {
        const files = Object.keys(virtualFiles).map((p) => ({
          path: p,
          size: virtualFiles[p].length,
          type: p.includes("/") ? "file" : "root-file"
        }));
        return { ok: true, data: { files } };
      }

      if (toolName === "read_file") {
        const path = args.filePath;
        if (virtualFiles[path]) {
          return { ok: true, data: { content: virtualFiles[path] } };
        }
        return { ok: false, error: `File not found: "${path}"` };
      }

      if (toolName === "write_file") {
        return { ok: true, data: { success: true, size: (args.content || "").length } };
      }
    }

    if (serverId === "postgres-db") {
      if (toolName === "list_tables") {
        const tablesList = spec.entities.map((ent) => ({
          name: ent.table,
          columns: ent.fields.map((f) => `${f.name} (${f.type})`),
          approximateRowCount: 2
        }));
        return { ok: true, data: { tables: tablesList } };
      }

      if (toolName === "execute_query") {
        const rawSql = (args.sql || "").toLowerCase().trim();
        // Return a mock dataset that corresponds to select tables!
        const entityMatches = spec.entities.find((e) => rawSql.includes(e.table));
        if (entityMatches) {
          const fields = entityMatches.fields.filter(f => f.inList !== false).slice(0, 4);
          const mockRow1: Record<string, any> = {};
          const mockRow2: Record<string, any> = {};

          fields.forEach((col) => {
            if (col.isPrimary) {
              mockRow1[col.name] = `${entityMatches.slug.slice(0, 3)}_1`;
              mockRow2[col.name] = `${entityMatches.slug.slice(0, 3)}_2`;
            } else if (col.type === "integer" || col.type === "numeric") {
              mockRow1[col.name] = 1250;
              mockRow2[col.name] = 4800;
            } else if (col.type === "boolean") {
              mockRow1[col.name] = true;
              mockRow2[col.name] = false;
            } else {
              mockRow1[col.name] = `Demo ${col.label} Val A`;
              mockRow2[col.name] = `Demo ${col.label} Val B`;
            }
          });

          return {
            ok: true,
            data: {
              rows: [mockRow1, mockRow2],
              rowCount: 2,
              headers: fields.map((col) => col.name)
            }
          };
        }

        if (rawSql.includes("users")) {
          return {
            ok: true,
            data: {
              rows: [
                { id: "usr_1", email: "alice@company.com", fullName: "Alice Henderson", role: "admin" },
                { id: "usr_2", email: "bob@company.com", fullName: "Bob Chen", role: "manager" }
              ],
              rowCount: 2,
              headers: ["id", "email", "fullName", "role"]
            }
          };
        }

        return {
          ok: true,
          data: {
            rows: [{ message: "Query compiled and executed successfully. 0 affected rows." }],
            rowCount: 0,
            headers: ["message"]
          }
        };
      }
    }

    if (serverId === "shell-executor") {
      if (toolName === "execute_command") {
        const cmd = args.command || "";
        if (cmd.includes("test")) {
          return {
            ok: true,
            data: {
              stdout: "✓ src/tests/validation.test.ts (2 passed)\nTest Files: 1 passed (1 total)\nTests: 2 passed (2 total)\nTime: 1.1s (in thread)\nPASS",
              stderr: "",
              exitCode: 0,
              durationMs: 1100
            }
          };
        }
        if (cmd.includes("install")) {
          return {
            ok: true,
            data: {
              stdout: "added 412 packages in 9.2s\nFound 0 vulnerabilities.",
              stderr: "",
              exitCode: 0,
              durationMs: 9200
            }
          };
        }
        if (cmd.includes("push") || cmd.includes("drizzle")) {
          return {
            ok: true,
            data: {
              stdout: "Reading schema from src/db/schema.ts\n✓ Schema synced with PostgreSQL database.\n5 tables up to date.",
              stderr: "",
              exitCode: 0,
              durationMs: 1200
            }
          };
        }
        return {
          ok: true,
          data: {
            stdout: `$ ${cmd}\nCommand executed successfully.`,
            stderr: "",
            exitCode: 0,
            durationMs: 400
          }
        };
      }
    }

    if (serverId === "github-manager") {
      if (toolName === "create_pull_request") {
        return {
          ok: true,
          data: {
            prUrl: `https://github.com/AnshRoshan/generated-app/pull/1`,
            success: true
          }
        };
      }
    }

    return { ok: false, error: `Tool "${toolName}" or Server "${serverId}" not implemented.` };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}
