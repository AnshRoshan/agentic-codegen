export type AgentRole =
  | "orchestrator"
  | "architect"
  | "database"
  | "backend"
  | "frontend"
  | "testing"
  | "devops";

export interface AgentDefinition {
  role: AgentRole;
  name: string;
  emoji: string;
  tagline: string;
  description: string;
  capabilities: string[];
  tools: string[];
  color: string;
  model: string;
}

export const AGENT_ORDER: AgentRole[] = [
  "orchestrator",
  "architect",
  "database",
  "backend",
  "frontend",
  "testing",
  "devops",
];

export const AGENTS: Record<AgentRole, AgentDefinition> = {
  orchestrator: {
    role: "orchestrator",
    name: "Orchestrator",
    emoji: "🎯",
    tagline: "Plans the work and keeps every agent in sync",
    description:
      "Reads your brief, infers the product domain, decomposes it into a dependency-ordered task graph and hands each task to a specialist.",
    capabilities: [
      "Requirement analysis",
      "Domain & entity inference",
      "Task graph creation",
      "Agent coordination",
      "Failure recovery",
    ],
    tools: ["analyze_requirements", "create_task", "assign_agent", "check_status"],
    color: "#8b5cf6",
    model: "gpt-4.1",
  },
  architect: {
    role: "architect",
    name: "Architect",
    emoji: "📐",
    tagline: "Designs boundaries, contracts and the folder layout",
    description:
      "Chooses the stack, defines components and data flow, writes the architecture document and scaffolds the project skeleton.",
    capabilities: [
      "System design",
      "API contracts",
      "Folder structure",
      "Stack validation",
      "Design patterns",
    ],
    tools: ["define_architecture", "create_file", "create_api_contract"],
    color: "#06b6d4",
    model: "gpt-4.1",
  },
  database: {
    role: "database",
    name: "Database",
    emoji: "🗄️",
    tagline: "Models data, writes migrations, seeds fixtures",
    description:
      "Turns entities into a normalised PostgreSQL schema with Drizzle ORM, generates SQL migrations and seed data.",
    capabilities: [
      "Schema design",
      "Relations & indexes",
      "Migrations",
      "Seed data",
      "Query optimisation",
    ],
    tools: ["create_table", "run_migration", "seed_table", "create_file"],
    color: "#10b981",
    model: "gpt-4.1-mini",
  },
  backend: {
    role: "backend",
    name: "Backend",
    emoji: "⚙️",
    tagline: "Builds typed APIs, validation and auth",
    description:
      "Implements REST route handlers with Zod validation, pagination, auth guards and service-layer business logic.",
    capabilities: [
      "REST endpoints",
      "Input validation",
      "Auth & sessions",
      "Business rules",
      "Error handling",
    ],
    tools: ["create_file", "set_env_var", "run_command"],
    color: "#f59e0b",
    model: "gpt-4.1-mini",
  },
  frontend: {
    role: "frontend",
    name: "Frontend",
    emoji: "🎨",
    tagline: "Ships accessible, responsive UI",
    description:
      "Generates React pages, data tables, forms and dashboards wired to the API with loading, empty and error states.",
    capabilities: [
      "Page composition",
      "Forms & tables",
      "State management",
      "Responsive layout",
      "Accessibility",
    ],
    tools: ["create_file", "create_component", "run_command"],
    color: "#ec4899",
    model: "gpt-4.1-mini",
  },
  testing: {
    role: "testing",
    name: "QA & Testing",
    emoji: "🧪",
    tagline: "Writes tests and gates the pipeline",
    description:
      "Produces unit and integration tests for every endpoint and entity, executes the suite and reports coverage.",
    capabilities: [
      "Unit tests",
      "API integration tests",
      "Coverage reporting",
      "Regression detection",
      "Lint & typecheck",
    ],
    tools: ["create_file", "run_command", "report_coverage"],
    color: "#84cc16",
    model: "gpt-4.1-mini",
  },
  devops: {
    role: "devops",
    name: "DevOps",
    emoji: "🚀",
    tagline: "Containers, CI and one-click deploys",
    description:
      "Writes the Dockerfile, compose stack and CI workflow, then builds the image and deploys behind a human approval gate.",
    capabilities: [
      "Containerisation",
      "CI/CD pipelines",
      "Secrets management",
      "Health checks",
      "Deployment",
    ],
    tools: ["create_file", "run_command", "request_approval", "deploy"],
    color: "#f97316",
    model: "gpt-4.1-mini",
  },
};

export function agentMeta(role: string | null | undefined): AgentDefinition {
  return AGENTS[(role as AgentRole) ?? "orchestrator"] ?? AGENTS.orchestrator;
}
