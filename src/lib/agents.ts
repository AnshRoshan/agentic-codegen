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
    model: "gpt-4.5-turbo",
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
    model: "gpt-4.5-turbo",
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
    model: "gpt-4o-mini",
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
    model: "gpt-4o-mini",
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
    model: "gpt-4o",
  },
  testing: {
    role: "testing",
    name: "Testing",
    emoji: "🧪",
    tagline: "Writes unit tests, integration suites and reports",
    description:
      "Drafts validation assertions, mock route handlers, and end-to-end integration flows using Vitest and Playwright.",
    capabilities: [
      "Unit testing",
      "API mocking",
      "E2E simulation",
      "Coverage analysis",
      "Type checking",
    ],
    tools: ["create_file", "run_command", "analyze_coverage"],
    color: "#f43f5e",
    model: "gpt-4o-mini",
  },
  devops: {
    role: "devops",
    name: "DevOps",
    emoji: "🚀",
    tagline: "Containerises software and automates deployments",
    description:
      "Writes multi-stage Dockerfiles, Docker Compose stacks, and continuous integration pipelines for deployment.",
    capabilities: [
      "Containerisation",
      "CI/CD workflow",
      "Orchestration",
      "Resource allocation",
      "Security scanning",
    ],
    tools: ["create_file", "run_command", "audit_image"],
    color: "#f97316",
    model: "gpt-4o",
  },
};

export function agentMeta(role: string | null) {
  if (!role) return { name: "System", emoji: "👤", color: "#6b7280" };
  return AGENTS[role as AgentRole] || { name: role, emoji: "🤖", color: "#8b5cf6" };
}
