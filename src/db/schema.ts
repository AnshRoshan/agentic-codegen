import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const projectModeEnum = pgEnum("project_mode", [
  "greenfield",
  "brownfield",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "draft",
  "planning",
  "generating",
  "building",
  "testing",
  "completed",
  "failed",
  "waiting_approval", // HITL checkpoint
]);

export const agentRoleEnum = pgEnum("agent_role", [
  "orchestrator",
  "architect",
  "backend",
  "frontend",
  "database",
  "testing",
  "devops",
]);

export const agentStatusEnum = pgEnum("agent_status", [
  "idle",
  "planning",
  "working",
  "reviewing",
  "completed",
  "failed",
  "waiting",
  "hitl_paused", // Human-in-the-loop paused
]);

export const taskStatusEnum = pgEnum("task_status", [
  "pending",
  "in_progress",
  "completed",
  "failed",
  "skipped",
  "waiting_approval",
]);

export const commandStatusEnum = pgEnum("command_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "timeout",
]);

export const fileActionEnum = pgEnum("file_action", [
  "create",
  "modify",
  "delete",
  "rename",
]);

export const hitlStatusEnum = pgEnum("hitl_status", [
  "pending",
  "approved",
  "rejected",
  "modified",
  "timeout",
]);

export const envVarTypeEnum = pgEnum("env_var_type", [
  "plain",
  "secret",
  "vault_ref",
]);

export const dbTableStatusEnum = pgEnum("db_table_status", [
  "defined",
  "migrating",
  "created",
  "seeded",
  "error",
]);

export const aiProviderEnum = pgEnum("ai_provider", [
  "openai",
  "azure",
  "custom",
]);

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  mode: projectModeEnum("mode").notNull().default("greenfield"),
  status: projectStatusEnum("status").notNull().default("draft"),
  prompt: text("prompt").notNull(),
  techStack: jsonb("tech_stack").$type<{
    frontend?: string;
    backend?: string;
    database?: string;
    testing?: string;
    deployment?: string;
  }>(),
  sourceRepo: text("source_repo"), // for brownfield: git URL or uploaded path
  templateId: text("template_id"), // greenfield template key (saas-dashboard, todo-app, etc.)
  architecture: jsonb("architecture").$type<{
    overview?: string;
    components?: Array<{
      name: string;
      type: string;
      description: string;
      dependencies?: string[];
    }>;
    dataFlow?: string;
  }>(),
  generatedFiles: integer("generated_files").default(0),
  totalTasks: integer("total_tasks").default(0),
  completedTasks: integer("completed_tasks").default(0),
  // ─── Token / cost tracking (project-level aggregates) ────
  totalTokensIn: integer("total_tokens_in").default(0),
  totalTokensOut: integer("total_tokens_out").default(0),
  totalCostUsd: text("total_cost_usd").default("0"),    // string to avoid float precision
  totalLlmCalls: integer("total_llm_calls").default(0),
  totalToolCalls: integer("total_tool_calls").default(0),
  cacheHits: integer("cache_hits").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Agents ───────────────────────────────────────────────────────────────────

export const agents = pgTable("agents", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  role: agentRoleEnum("role").notNull(),
  name: text("name").notNull(),
  status: agentStatusEnum("status").notNull().default("idle"),
  systemPrompt: text("system_prompt"),
  currentTask: text("current_task"),
  progress: integer("progress").default(0), // 0-100
  context: jsonb("context").$type<Record<string, unknown>>(),
  output: text("output"),
  errorMessage: text("error_message"),
  // ─── Per-agent token tracking ────
  tokensIn: integer("tokens_in").default(0),
  tokensOut: integer("tokens_out").default(0),
  costUsd: text("cost_usd").default("0"),
  llmCalls: integer("llm_calls").default(0),
  toolCalls: integer("tool_calls").default(0),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  agentId: text("agent_id").references(() => agents.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  description: text("description"),
  status: taskStatusEnum("status").notNull().default("pending"),
  priority: integer("priority").default(0),
  dependencies: jsonb("dependencies").$type<string[]>(), // task IDs
  output: text("output"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── File Operations ──────────────────────────────────────────────────────────

export const fileOperations = pgTable("file_operations", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  agentId: text("agent_id").references(() => agents.id, {
    onDelete: "set null",
  }),
  taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
  action: fileActionEnum("action").notNull(),
  filePath: text("file_path").notNull(),
  content: text("content"),
  diff: text("diff"), // for brownfield modifications
  language: text("language"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Command Executions ───────────────────────────────────────────────────────

export const commandExecutions = pgTable("command_executions", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  agentId: text("agent_id").references(() => agents.id, {
    onDelete: "set null",
  }),
  command: text("command").notNull(),
  workingDir: text("working_dir"),
  status: commandStatusEnum("status").notNull().default("queued"),
  stdout: text("stdout"),
  stderr: text("stderr"),
  exitCode: integer("exit_code"),
  durationMs: integer("duration_ms"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Agent Messages / Logs ────────────────────────────────────────────────────

export const agentMessages = pgTable("agent_messages", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  agentId: text("agent_id").references(() => agents.id, {
    onDelete: "set null",
  }),
  role: text("role").notNull(), // "agent", "system", "user", "tool"
  content: text("content").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Virtual File System ──────────────────────────────────────────────────────

export const fileNodes = pgTable("file_nodes", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  agentId: text("agent_id").references(() => agents.id, {
    onDelete: "set null",
  }),
  parentId: text("parent_id"), // references fileNodes.id but defined as plain text to avoid circular ref
  name: text("name").notNull(),
  path: text("path").notNull(), // full path like "src/app/page.tsx"
  type: text("type").notNull(), // "file" | "directory"
  content: text("content"), // for files only
  language: text("language"), // typescript, css, etc.
  size: integer("size"), // bytes
  isGenerated: boolean("is_generated").default(false),
  isModified: boolean("is_modified").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Database Schema / Tables ─────────────────────────────────────────────────

export const dbTables = pgTable("db_tables", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  agentId: text("agent_id").references(() => agents.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  schema: text("schema").notNull().default("public"),
  status: dbTableStatusEnum("status").notNull().default("defined"),
  columns: jsonb("columns").$type<
    Array<{
      name: string;
      type: string;
      nullable: boolean;
      default?: string;
      isPrimary?: boolean;
      isForeign?: boolean;
      references?: string;
    }>
  >(),
  indexes: jsonb("indexes").$type<
    Array<{
      name: string;
      columns: string[];
      unique?: boolean;
    }>
  >(),
  rowCount: integer("row_count").default(0),
  sql: text("sql"), // CREATE TABLE statement
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Environment Variables ────────────────────────────────────────────────────

export const environmentVariables = pgTable("environment_variables", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  key: text("key").notNull(),
  value: text("value"), // encrypted for secrets
  type: envVarTypeEnum("type").notNull().default("plain"),
  vaultPath: text("vault_path"), // for vault_ref type: op://vault/item/field
  description: text("description"),
  isSecret: boolean("is_secret").default(false),
  isRequired: boolean("is_required").default(true),
  source: text("source").default("agent"), // agent, user, vault
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Human-in-the-Loop Checkpoints ────────────────────────────────────────────

export const hitlCheckpoints = pgTable("hitl_checkpoints", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  agentId: text("agent_id").references(() => agents.id, {
    onDelete: "set null",
  }),
  taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
  status: hitlStatusEnum("status").notNull().default("pending"),
  type: text("type").notNull(), // "file_edit", "db_migration", "command_exec", "deployment"
  title: text("title").notNull(),
  description: text("description"),
  riskLevel: text("risk_level").default("low"), // "low" | "medium" | "high"
  isBlocking: boolean("is_blocking").default(false), // only blocking checkpoints pause the pipeline
  context: jsonb("context").$type<{
    proposedChanges?: string;
    diff?: string;
    filePath?: string;
    command?: string;
    affectedTables?: string[];
    riskLevel?: "low" | "medium" | "high";
  }>(),
  // Approval metadata
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  modifications: text("modifications"), // user modifications to the proposal
  // Timeout
  timeoutAt: timestamp("timeout_at"),
  autoAction: text("auto_action"), // "approve" | "reject" on timeout
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── LLM Call Log (every generateText call is recorded) ──────────────────────

export const llmCalls = pgTable("llm_calls", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  agentId: text("agent_id").references(() => agents.id, { onDelete: "set null" }),
  taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
  model: text("model").notNull(),
  provider: text("provider").notNull(), // openai, azure, custom
  // Token usage
  promptTokens: integer("prompt_tokens").default(0),
  completionTokens: integer("completion_tokens").default(0),
  totalTokens: integer("total_tokens").default(0),
  // Cost (calculated from model pricing)
  costUsd: text("cost_usd").default("0"),
  // Context
  systemPromptLength: integer("system_prompt_length"),
  userPromptLength: integer("user_prompt_length"),
  responseLength: integer("response_length"),
  // Tool chain
  toolCallCount: integer("tool_call_count").default(0),
  toolNames: jsonb("tool_names").$type<string[]>(),
  stepCount: integer("step_count").default(1),
  // Cache
  cached: boolean("cached").default(false),
  cacheKey: text("cache_key"),
  // Timing
  durationMs: integer("duration_ms"),
  finishReason: text("finish_reason"), // stop, tool_calls, length, etc.
  // Error
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── AI Provider Settings (singleton row, id="default") ──────────────────────

export const aiSettings = pgTable("ai_settings", {
  id: text("id").primaryKey().default("default"),
  provider: aiProviderEnum("provider").notNull().default("openai"),
  apiKey: text("api_key"),
  baseUrl: text("base_url"), // custom / azure resource base
  model: text("model").default("gpt-4o-mini"), // model id or azure deployment name
  azureResourceName: text("azure_resource_name"),
  azureApiVersion: text("azure_api_version").default("2025-01-01-preview"),
  isConfigured: boolean("is_configured").default(false),
  lastTestedAt: timestamp("last_tested_at"),
  lastTestStatus: text("last_test_status"), // "success" | "failure"
  lastTestMessage: text("last_test_message"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Type exports ─────────────────────────────────────────────────────────────

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type FileOperation = typeof fileOperations.$inferSelect;
export type FileNode = typeof fileNodes.$inferSelect;
export type CommandExecution = typeof commandExecutions.$inferSelect;
export type AgentMessage = typeof agentMessages.$inferSelect;
export type DbTable = typeof dbTables.$inferSelect;
export type EnvironmentVariable = typeof environmentVariables.$inferSelect;
export type HitlCheckpoint = typeof hitlCheckpoints.$inferSelect;
export type AiSettings = typeof aiSettings.$inferSelect;
export type LlmCall = typeof llmCalls.$inferSelect;
