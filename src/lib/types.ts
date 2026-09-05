// ─── Core domain types (client-side mirror of the DB schema) ────────────────

export type ProjectStatus =
  | "draft" | "planning" | "generating" | "building"
  | "testing" | "deploying" | "completed" | "failed"
  | "waiting_approval" | "paused";

export type AgentRole =
  | "orchestrator" | "architect" | "database"
  | "backend" | "frontend" | "testing" | "devops";

export type AgentStatus = "idle" | "working" | "waiting" | "completed" | "failed";
export type TaskStatus = "pending" | "in_progress" | "completed" | "failed" | "skipped" | "waiting_approval";
export type CheckpointStatus = "pending" | "approved" | "rejected";
export type DbTableStatus = "defined" | "migrating" | "created" | "seeded";

export interface EntityField {
  name: string; type: string; required?: boolean;
  enumValues?: string[]; references?: string;
}
export interface Entity {
  name: string; plural: string; slug: string; fields: EntityField[];
}
export interface PlanStep {
  index: number; agent: string; key: string; title: string; description: string;
}
export interface Architecture {
  overview: string; domain: string; domainLabel: string;
  entities: Entity[]; features: string[];
  components: Array<{ name: string; type: string; description: string; dependencies: string[] }>;
  dataFlow: string[];
}
export interface TechStack {
  frontend: string; backend: string; database: string;
  styling: string; testing: string; deployment: string;
}

export interface Project {
  id: string; name: string; description: string; prompt: string;
  mode: "greenfield" | "brownfield";
  status: ProjectStatus;
  domain: string; domainLabel: string; emoji: string;
  techStack: TechStack; architecture: Architecture | null;
  plan: PlanStep[];
  currentStep: number; totalSteps: number;
  autoApprove: boolean;
  generatedFiles: number; totalTasks: number; completedTasks: number;
  tokensIn: number; tokensOut: number; costMicros: number;
  llmCalls: number; toolCalls: number;
  repairIterations?: number;
  errorMessage: string | null;
  engineMode: "llm" | "simulation";
  settings: ProjectSettings;
  isRunning: boolean;
  pendingCheckpoints?: number;
  startedAt: string | null; completedAt: string | null;
  createdAt: string; updatedAt: string;
}

export interface ProjectSettings {
  agentModels?: Record<string, string>;
  maxStepsPerTask?: number;
  maxRetries?: number;
  maxRepairIterations?: number;
  budgetMicros?: number;
}

export interface Agent {
  id: string; projectId: string; role: AgentRole; name: string;
  status: AgentStatus; currentTask: string | null; progress: number;
  tokensIn: number; tokensOut: number; llmCalls: number; toolCalls: number;
  filesWritten: number; startedAt: string | null; completedAt: string | null;
}

export interface Task {
  id: string; projectId: string; agentRole: string; stepKey: string;
  title: string; description: string; status: TaskStatus; order: number;
  attempts?: number; error?: string | null; tokensIn?: number; tokensOut?: number; durationMs?: number;
  output: string | null; startedAt: string | null; completedAt: string | null;
}

export interface FileNode {
  id: string; projectId: string; agentRole: string | null;
  path: string; name: string; content: string;
  language: string | null; size: number; version: number;
  isModified: boolean; updatedAt: string;
}

export interface DbTable {
  id: string; projectId: string; name: string; status: DbTableStatus;
  columns: Array<{ name: string; type: string; nullable: boolean; isPrimary?: boolean; references?: string; defaultValue?: string }>;
  rowCount: number; sql: string | null;
}

export interface EnvVar {
  id: string; projectId: string; key: string; value: string;
  description: string; isSecret: boolean; isRequired: boolean; source: "agent" | "user";
}

export interface AgentMessage {
  id: string; projectId: string; agentRole: string | null;
  kind: "info" | "tool" | "file" | "success" | "warning" | "error" | "user";
  content: string; metadata?: Record<string, unknown>; createdAt: string;
}

export interface CommandExec {
  id: string; projectId: string; agentRole: string | null;
  command: string; stdout: string; stderr?: string; durationMs: number; exitCode: number; createdAt: string;
}

export interface Checkpoint {
  id: string; projectId: string; type: string;
  title: string; description: string; riskLevel: "low" | "medium" | "high";
  context: { summary?: string[]; diff?: string; command?: string; affected?: string[] };
  status: CheckpointStatus; note: string | null; createdAt: string; resolvedAt: string | null;
  agentRole?: string | null; stepIndex?: number;
}

export interface LlmCall {
  id: string; projectId: string; agentRole: string | null;
  model: string; provider?: string; promptTokens: number; completionTokens: number;
  purpose: string; costMicros: number; durationMs?: number; toolCalls?: number; status?: string; finishReason?: string | null; createdAt: string;
}

export interface WorkspaceData {
  agents: Agent[]; tasks: Task[]; files: FileNode[];
  tables: DbTable[]; env: EnvVar[]; checkpoints: Checkpoint[];
  commands: CommandExec[]; messages: AgentMessage[]; llmCalls: LlmCall[];
}

export const AGENT_ORDER: AgentRole[] = [
  "orchestrator", "architect", "database", "backend", "frontend", "testing", "devops",
];

export interface AgentDefinition {
  role: AgentRole; name: string; emoji: string; tagline: string;
  description: string; capabilities: string[]; tools: string[];
  color: string; model: string;
}

export const AGENTS: Record<AgentRole, AgentDefinition> = {
  orchestrator: {
    role: "orchestrator", name: "Orchestrator", emoji: "🎯",
    tagline: "Plans the work and keeps every agent in sync",
    description: "Reads your brief, infers the product domain, decomposes it into a dependency-ordered task graph and hands each task to a specialist.",
    capabilities: ["Requirement analysis", "Domain & entity inference", "Task graph creation", "Agent coordination", "Failure recovery"],
    tools: ["analyze_requirements", "create_task", "assign_agent", "check_status"],
    color: "#8b5cf6", model: "gpt-5",
  },
  architect: {
    role: "architect", name: "Architect", emoji: "📐",
    tagline: "Designs boundaries, contracts and the folder layout",
    description: "Chooses the stack, defines components and data flow, writes the architecture document and scaffolds the project skeleton.",
    capabilities: ["System design", "API contracts", "Folder structure", "Stack validation", "Design patterns"],
    tools: ["define_architecture", "create_file", "create_api_contract"],
    color: "#06b6d4", model: "gpt-5",
  },
  database: {
    role: "database", name: "Database", emoji: "🗄️",
    tagline: "Models data, writes migrations, seeds fixtures",
    description: "Turns entities into a normalised PostgreSQL schema with Drizzle ORM, generates SQL migrations and seed data.",
    capabilities: ["Schema design", "Relations & indexes", "Migrations", "Seed data", "Query optimisation"],
    tools: ["create_table", "run_migration", "seed_table", "create_file"],
    color: "#10b981", model: "gpt-4.1-mini",
  },
  backend: {
    role: "backend", name: "Backend", emoji: "⚙️",
    tagline: "Builds typed APIs, validation and auth",
    description: "Implements REST route handlers with Zod validation, pagination, auth guards and service-layer business logic.",
    capabilities: ["REST endpoints", "Input validation", "Auth & sessions", "Business rules", "Error handling"],
    tools: ["create_file", "set_env_var", "run_command"],
    color: "#f59e0b", model: "gpt-4.1-mini",
  },
  frontend: {
    role: "frontend", name: "Frontend", emoji: "🎨",
    tagline: "Ships accessible, responsive UI",
    description: "Generates React pages, data tables, forms and dashboards wired to the API with loading, empty and error states.",
    capabilities: ["Page composition", "Forms & tables", "State management", "Responsive layout", "Accessibility"],
    tools: ["create_file", "create_component", "run_command"],
    color: "#ec4899", model: "gpt-4.1-mini",
  },
  testing: {
    role: "testing", name: "QA & Testing", emoji: "🧪",
    tagline: "Writes tests and gates the pipeline",
    description: "Produces unit and integration tests for every endpoint and entity, executes the suite and reports coverage.",
    capabilities: ["Unit tests", "API integration tests", "Coverage reporting", "Regression detection", "Lint & typecheck"],
    tools: ["create_file", "run_command", "report_coverage"],
    color: "#84cc16", model: "gpt-4.1-mini",
  },
  devops: {
    role: "devops", name: "DevOps", emoji: "🚀",
    tagline: "Containers, CI and one-click deploys",
    description: "Writes the Dockerfile, compose stack and CI workflow, then builds the image and deploys behind a human approval gate.",
    capabilities: ["Containerisation", "CI/CD pipelines", "Secrets management", "Health checks", "Deployment"],
    tools: ["create_file", "run_command", "request_approval", "deploy"],
    color: "#f97316", model: "gpt-4.1-mini",
  },
};

export function agentMeta(role: string | null | undefined): AgentDefinition {
  return AGENTS[(role as AgentRole) ?? "orchestrator"] ?? AGENTS.orchestrator;
}

export const RUNNING_STATUSES = new Set<ProjectStatus>([
  "planning", "generating", "building", "testing", "deploying",
]);

export function uid(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
