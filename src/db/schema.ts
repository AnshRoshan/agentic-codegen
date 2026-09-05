import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const projectStatusEnum = pgEnum("project_status", [
  "draft",
  "planning",
  "generating",
  "building",
  "testing",
  "deploying",
  "completed",
  "failed",
  "waiting_approval",
  "paused",
]);

export const agentRoleEnum = pgEnum("agent_role", [
  "orchestrator",
  "architect",
  "database",
  "backend",
  "frontend",
  "testing",
  "devops",
]);

export const agentStatusEnum = pgEnum("agent_status", [
  "idle",
  "working",
  "waiting",
  "completed",
  "failed",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "pending",
  "in_progress",
  "completed",
  "failed",
  "skipped",
  "waiting_approval",
]);

export const hitlStatusEnum = pgEnum("hitl_status", ["pending", "approved", "rejected"]);

export const commandStatusEnum = pgEnum("command_status", ["running", "completed", "failed"]);

export const dbTableStatusEnum = pgEnum("db_table_status", ["defined", "migrating", "created", "seeded"]);

export const aiProviderEnum = pgEnum("ai_provider", [
  "openai",
  "anthropic",
  "google",
  "azure",
  "custom",
]);

// ─── Shared JSON types ────────────────────────────────────────────────────────

export type EntityField = {
  name: string;
  type: string;
  required?: boolean;
  enumValues?: string[];
  references?: string;
};

export type Entity = {
  name: string;
  plural: string;
  slug: string;
  fields: EntityField[];
};

export type PlanStep = {
  index: number;
  agent: string;
  key: string;
  title: string;
  description: string;
};

export type Architecture = {
  overview: string;
  domain: string;
  domainLabel: string;
  entities: Entity[];
  features: string[];
  components: Array<{
    name: string;
    type: string;
    description: string;
    dependencies: string[];
  }>;
  dataFlow: string[];
};

export type TechStack = {
  frontend: string;
  backend: string;
  database: string;
  styling: string;
  testing: string;
  deployment: string;
};

export type ProjectSettings = {
  /** Per-agent model override (role -> model id). Falls back to global settings. */
  agentModels?: Record<string, string>;
  /** Max LLM/tool steps per task before the agent is cut off. */
  maxStepsPerTask?: number;
  /** Max retries per task on failure. */
  maxRetries?: number;
  /** Max repair passes after the quality gate reports diagnostics. */
  maxRepairIterations?: number;
  /** Hard budget in micro-dollars; run pauses when exceeded. */
  budgetMicros?: number;
};

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    prompt: text("prompt").notNull(),
    mode: text("mode").notNull().default("greenfield"),
    status: projectStatusEnum("status").notNull().default("draft"),
    domain: text("domain"),
    domainLabel: text("domain_label"),
    emoji: text("emoji").default("✨"),
    techStack: jsonb("tech_stack").$type<TechStack>(),
    architecture: jsonb("architecture").$type<Architecture>(),
    plan: jsonb("plan").$type<PlanStep[]>(),
    settings: jsonb("settings").$type<ProjectSettings>(),
    /** "llm" when a provider is configured, otherwise "simulation". */
    engineMode: text("engine_mode").notNull().default("simulation"),
    currentStep: integer("current_step").notNull().default(0),
    totalSteps: integer("total_steps").notNull().default(0),
    autoApprove: boolean("auto_approve").notNull().default(false),
    generatedFiles: integer("generated_files").notNull().default(0),
    totalTasks: integer("total_tasks").notNull().default(0),
    completedTasks: integer("completed_tasks").notNull().default(0),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    costMicros: integer("cost_micros").notNull().default(0),
    llmCalls: integer("llm_calls").notNull().default(0),
    toolCalls: integer("tool_calls").notNull().default(0),
    repairIterations: integer("repair_iterations").notNull().default(0),
    errorMessage: text("error_message"),
    /** Run lock: set while a background loop owns this project. */
    runId: text("run_id"),
    runHeartbeatAt: timestamp("run_heartbeat_at"),
    /** Set by the API to ask the running loop to stop after the current step. */
    pauseRequested: boolean("pause_requested").notNull().default(false),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("projects_status_idx").on(t.status), index("projects_updated_idx").on(t.updatedAt)],
);

// ─── Agents ───────────────────────────────────────────────────────────────────

export const agents = pgTable(
  "agents",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    role: agentRoleEnum("role").notNull(),
    name: text("name").notNull(),
    model: text("model"),
    status: agentStatusEnum("status").notNull().default("idle"),
    currentTask: text("current_task"),
    progress: integer("progress").notNull().default(0),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    llmCalls: integer("llm_calls").notNull().default(0),
    toolCalls: integer("tool_calls").notNull().default(0),
    filesWritten: integer("files_written").notNull().default(0),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("agents_project_role_uq").on(t.projectId, t.role)],
);

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    agentId: text("agent_id").references(() => agents.id, { onDelete: "set null" }),
    agentRole: text("agent_role").notNull(),
    stepKey: text("step_key").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    status: taskStatusEnum("status").notNull().default("pending"),
    order: integer("order").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    output: text("output"),
    error: text("error"),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    durationMs: integer("duration_ms").notNull().default(0),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("tasks_project_order_idx").on(t.projectId, t.order)],
);

// ─── Virtual File System ──────────────────────────────────────────────────────

export const fileNodes = pgTable(
  "file_nodes",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    agentRole: text("agent_role"),
    path: text("path").notNull(),
    name: text("name").notNull(),
    content: text("content").notNull().default(""),
    language: text("language"),
    size: integer("size").notNull().default(0),
    version: integer("version").notNull().default(1),
    isModified: boolean("is_modified").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("file_nodes_project_path_uq").on(t.projectId, t.path)],
);

// ─── Generated Database Tables ────────────────────────────────────────────────

export type DbColumn = {
  name: string;
  type: string;
  nullable: boolean;
  isPrimary?: boolean;
  references?: string;
  defaultValue?: string;
};

export const dbTables = pgTable(
  "db_tables",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    status: dbTableStatusEnum("status").notNull().default("defined"),
    columns: jsonb("columns").$type<DbColumn[]>(),
    rowCount: integer("row_count").notNull().default(0),
    sql: text("sql"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("db_tables_project_name_uq").on(t.projectId, t.name)],
);

// ─── Environment Variables ────────────────────────────────────────────────────

export const environmentVariables = pgTable(
  "environment_variables",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    key: text("key").notNull(),
    value: text("value").notNull().default(""),
    description: text("description"),
    isSecret: boolean("is_secret").notNull().default(false),
    isRequired: boolean("is_required").notNull().default(true),
    source: text("source").notNull().default("agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("env_project_key_uq").on(t.projectId, t.key)],
);

// ─── Agent Messages / Activity ────────────────────────────────────────────────

export const agentMessages = pgTable(
  "agent_messages",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    agentRole: text("agent_role"),
    kind: text("kind").notNull().default("info"),
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    seq: integer("seq").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("messages_project_seq_idx").on(t.projectId, t.seq)],
);

// ─── Command Executions ───────────────────────────────────────────────────────

export const commandExecutions = pgTable(
  "command_executions",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    agentRole: text("agent_role"),
    command: text("command").notNull(),
    workingDir: text("working_dir").default("/workspace"),
    status: commandStatusEnum("status").notNull().default("completed"),
    stdout: text("stdout"),
    stderr: text("stderr"),
    exitCode: integer("exit_code").default(0),
    durationMs: integer("duration_ms").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("commands_project_idx").on(t.projectId, t.createdAt)],
);

// ─── Human-in-the-Loop Checkpoints ────────────────────────────────────────────

export type CheckpointContext = {
  summary?: string[];
  diff?: string;
  command?: string;
  affected?: string[];
};

export const hitlCheckpoints = pgTable(
  "hitl_checkpoints",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    agentRole: text("agent_role"),
    stepIndex: integer("step_index").notNull().default(0),
    type: text("type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    riskLevel: text("risk_level").notNull().default("low"),
    status: hitlStatusEnum("status").notNull().default("pending"),
    context: jsonb("context").$type<CheckpointContext>(),
    resolutionNote: text("resolution_note"),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("checkpoints_project_status_idx").on(t.projectId, t.status)],
);

// ─── LLM Call Log ─────────────────────────────────────────────────────────────

export const llmCalls = pgTable(
  "llm_calls",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    agentRole: text("agent_role"),
    model: text("model").notNull(),
    provider: text("provider").notNull(),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    costMicros: integer("cost_micros").notNull().default(0),
    toolCalls: integer("tool_calls").notNull().default(0),
    durationMs: integer("duration_ms").notNull().default(0),
    purpose: text("purpose"),
    status: text("status").notNull().default("ok"),
    finishReason: text("finish_reason"),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("llm_calls_project_idx").on(t.projectId, t.createdAt)],
);

// ─── AI Provider Settings (singleton, id = "default") ────────────────────────

export const aiSettings = pgTable("ai_settings", {
  id: text("id").primaryKey().default("default"),
  provider: aiProviderEnum("provider").notNull().default("openai"),
  apiKey: text("api_key"),
  baseUrl: text("base_url"),
  model: text("model").notNull().default("gpt-4.1-mini"),
  /** Model used for orchestrator/architect (planning-heavy) steps. */
  plannerModel: text("planner_model"),
  agentModels: jsonb("agent_models").$type<Record<string, string>>(),
  azureResourceName: text("azure_resource_name"),
  azureApiVersion: text("azure_api_version"),
  temperature: integer("temperature").notNull().default(20),
  maxStepsPerTask: integer("max_steps_per_task").notNull().default(12),
  maxRetries: integer("max_retries").notNull().default(2),
  maxRepairIterations: integer("max_repair_iterations").notNull().default(2),
  budgetMicros: integer("budget_micros").notNull().default(5_000_000),
  autoApproveDefault: boolean("auto_approve_default").notNull().default(false),
  isConfigured: boolean("is_configured").notNull().default(false),
  lastTestedAt: timestamp("last_tested_at"),
  lastTestStatus: text("last_test_status"),
  lastTestMessage: text("last_test_message"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type Project = typeof projects.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type FileNode = typeof fileNodes.$inferSelect;
export type DbTable = typeof dbTables.$inferSelect;
export type EnvironmentVariable = typeof environmentVariables.$inferSelect;
export type AgentMessage = typeof agentMessages.$inferSelect;
export type CommandExecution = typeof commandExecutions.$inferSelect;
export type HitlCheckpoint = typeof hitlCheckpoints.$inferSelect;
export type LlmCall = typeof llmCalls.$inferSelect;
export type AiSettings = typeof aiSettings.$inferSelect;
