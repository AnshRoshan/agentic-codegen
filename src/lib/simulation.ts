// Simulation data for demonstrating the agent workflow
// In production, this would connect to actual LLM APIs and sandboxed environments

import { AgentRoleId, AGENT_DEFINITIONS } from "./agents";

export interface SimulatedTask {
  id: string;
  agentRole: AgentRoleId;
  title: string;
  description: string;
  files: Array<{ path: string; language: string; linesOfCode: number }>;
  commands: Array<{ cmd: string; description: string }>;
  durationEstimate: number; // seconds
}

export function generateGreenfieldTasks(
  prompt: string,
  techStack: Record<string, string>
): SimulatedTask[] {
  const tasks: SimulatedTask[] = [
    // Orchestrator tasks
    {
      id: "orch-1",
      agentRole: "orchestrator",
      title: "Analyze Requirements",
      description: `Parsing prompt and decomposing into actionable tasks:\n"${prompt.slice(0, 100)}..."`,
      files: [
        {
          path: "docs/requirements.md",
          language: "markdown",
          linesOfCode: 45,
        },
        {
          path: "docs/task-graph.md",
          language: "markdown",
          linesOfCode: 30,
        },
      ],
      commands: [],
      durationEstimate: 3,
    },

    // Architect tasks
    {
      id: "arch-1",
      agentRole: "architect",
      title: "Design System Architecture",
      description:
        "Creating high-level architecture with component boundaries, API contracts, and data flow diagrams",
      files: [
        {
          path: "docs/architecture.md",
          language: "markdown",
          linesOfCode: 120,
        },
        {
          path: "docs/api-contracts.yaml",
          language: "yaml",
          linesOfCode: 200,
        },
      ],
      commands: [],
      durationEstimate: 5,
    },
    {
      id: "arch-2",
      agentRole: "architect",
      title: "Create Project Structure",
      description: "Scaffolding project directory structure and configuration",
      files: [
        { path: "package.json", language: "json", linesOfCode: 35 },
        { path: "tsconfig.json", language: "json", linesOfCode: 25 },
        {
          path: "next.config.ts",
          language: "typescript",
          linesOfCode: 20,
        },
        { path: ".env.example", language: "env", linesOfCode: 12 },
        { path: ".gitignore", language: "text", linesOfCode: 30 },
      ],
      commands: [
        { cmd: "npm init -y", description: "Initialize package.json" },
        {
          cmd: "npm install next react react-dom typescript",
          description: "Install core dependencies",
        },
      ],
      durationEstimate: 4,
    },

    // Database tasks
    {
      id: "db-1",
      agentRole: "database",
      title: "Design Database Schema",
      description:
        "Creating database schema with tables, relationships, indexes, and constraints",
      files: [
        {
          path: "src/db/schema.ts",
          language: "typescript",
          linesOfCode: 180,
        },
        { path: "src/db/index.ts", language: "typescript", linesOfCode: 25 },
        {
          path: "drizzle.config.ts",
          language: "typescript",
          linesOfCode: 15,
        },
      ],
      commands: [
        {
          cmd: "npm install drizzle-orm pg",
          description: "Install ORM dependencies",
        },
        {
          cmd: "npm install -D drizzle-kit @types/pg",
          description: "Install ORM dev dependencies",
        },
      ],
      durationEstimate: 4,
    },
    {
      id: "db-2",
      agentRole: "database",
      title: "Generate Migrations & Seeds",
      description: "Creating migration files and seed data",
      files: [
        {
          path: "src/db/seed.ts",
          language: "typescript",
          linesOfCode: 80,
        },
        {
          path: "drizzle/0001_initial.sql",
          language: "sql",
          linesOfCode: 100,
        },
      ],
      commands: [
        {
          cmd: "npx drizzle-kit generate",
          description: "Generate migration files",
        },
        {
          cmd: "npx drizzle-kit push",
          description: "Push schema to database",
        },
      ],
      durationEstimate: 3,
    },

    // Backend tasks
    {
      id: "be-1",
      agentRole: "backend",
      title: "Implement API Routes",
      description: "Building RESTful API endpoints with validation and error handling",
      files: [
        {
          path: "src/app/api/[resource]/route.ts",
          language: "typescript",
          linesOfCode: 120,
        },
        {
          path: "src/lib/validations.ts",
          language: "typescript",
          linesOfCode: 60,
        },
        {
          path: "src/lib/errors.ts",
          language: "typescript",
          linesOfCode: 45,
        },
      ],
      commands: [
        {
          cmd: "npm install zod",
          description: "Install validation library",
        },
      ],
      durationEstimate: 6,
    },
    {
      id: "be-2",
      agentRole: "backend",
      title: "Add Authentication & Middleware",
      description:
        "Setting up auth flow, session management, and middleware stack",
      files: [
        {
          path: "src/lib/auth.ts",
          language: "typescript",
          linesOfCode: 90,
        },
        {
          path: "src/middleware.ts",
          language: "typescript",
          linesOfCode: 40,
        },
        {
          path: "src/app/api/auth/route.ts",
          language: "typescript",
          linesOfCode: 85,
        },
      ],
      commands: [
        {
          cmd: "npm install bcryptjs jsonwebtoken",
          description: "Install auth dependencies",
        },
      ],
      durationEstimate: 5,
    },

    // Frontend tasks
    {
      id: "fe-1",
      agentRole: "frontend",
      title: "Build Layout & Navigation",
      description: "Creating root layout, navigation bar, and responsive shell",
      files: [
        {
          path: "src/app/layout.tsx",
          language: "tsx",
          linesOfCode: 60,
        },
        {
          path: "src/components/Navbar.tsx",
          language: "tsx",
          linesOfCode: 85,
        },
        {
          path: "src/components/Sidebar.tsx",
          language: "tsx",
          linesOfCode: 75,
        },
        {
          path: "src/app/globals.css",
          language: "css",
          linesOfCode: 120,
        },
      ],
      commands: [
        {
          cmd: "npm install tailwindcss @tailwindcss/postcss",
          description: "Install Tailwind CSS",
        },
      ],
      durationEstimate: 5,
    },
    {
      id: "fe-2",
      agentRole: "frontend",
      title: "Create Pages & Components",
      description:
        "Building interactive pages with forms, data tables, and state management",
      files: [
        {
          path: "src/app/page.tsx",
          language: "tsx",
          linesOfCode: 100,
        },
        {
          path: "src/app/dashboard/page.tsx",
          language: "tsx",
          linesOfCode: 150,
        },
        {
          path: "src/components/DataTable.tsx",
          language: "tsx",
          linesOfCode: 120,
        },
        {
          path: "src/components/Forms.tsx",
          language: "tsx",
          linesOfCode: 90,
        },
        {
          path: "src/hooks/useApi.ts",
          language: "typescript",
          linesOfCode: 45,
        },
      ],
      commands: [],
      durationEstimate: 7,
    },

    // Testing tasks
    {
      id: "test-1",
      agentRole: "testing",
      title: "Write Unit Tests",
      description:
        "Creating unit tests for business logic, utilities, and API routes",
      files: [
        {
          path: "src/__tests__/api.test.ts",
          language: "typescript",
          linesOfCode: 150,
        },
        {
          path: "src/__tests__/utils.test.ts",
          language: "typescript",
          linesOfCode: 80,
        },
        {
          path: "vitest.config.ts",
          language: "typescript",
          linesOfCode: 20,
        },
      ],
      commands: [
        {
          cmd: "npm install -D vitest @testing-library/react",
          description: "Install testing framework",
        },
        { cmd: "npm run test", description: "Run test suite" },
      ],
      durationEstimate: 5,
    },
    {
      id: "test-2",
      agentRole: "testing",
      title: "Write E2E Tests",
      description: "Creating end-to-end tests for critical user flows",
      files: [
        {
          path: "e2e/flows.spec.ts",
          language: "typescript",
          linesOfCode: 120,
        },
        {
          path: "playwright.config.ts",
          language: "typescript",
          linesOfCode: 30,
        },
      ],
      commands: [
        {
          cmd: "npm install -D @playwright/test",
          description: "Install Playwright",
        },
        {
          cmd: "npx playwright test",
          description: "Run E2E tests",
        },
      ],
      durationEstimate: 4,
    },

    // DevOps tasks
    {
      id: "devops-1",
      agentRole: "devops",
      title: "Create Docker Configuration",
      description: "Building Dockerfile, docker-compose, and environment setup",
      files: [
        { path: "Dockerfile", language: "dockerfile", linesOfCode: 35 },
        {
          path: "docker-compose.yml",
          language: "yaml",
          linesOfCode: 45,
        },
        { path: ".dockerignore", language: "text", linesOfCode: 15 },
      ],
      commands: [
        {
          cmd: "docker build -t app .",
          description: "Build Docker image",
        },
      ],
      durationEstimate: 3,
    },
    {
      id: "devops-2",
      agentRole: "devops",
      title: "Set Up CI/CD Pipeline",
      description:
        "Creating GitHub Actions workflow for automated testing and deployment",
      files: [
        {
          path: ".github/workflows/ci.yml",
          language: "yaml",
          linesOfCode: 80,
        },
        {
          path: ".github/workflows/deploy.yml",
          language: "yaml",
          linesOfCode: 60,
        },
      ],
      commands: [],
      durationEstimate: 3,
    },
    {
      id: "devops-3",
      agentRole: "devops",
      title: "Build & Validate",
      description: "Running final build and validation checks",
      files: [],
      commands: [
        { cmd: "npm run build", description: "Production build" },
        { cmd: "npm run lint", description: "Lint check" },
        { cmd: "npm run typecheck", description: "TypeScript check" },
      ],
      durationEstimate: 4,
    },
  ];

  return tasks;
}

export function generateBrownfieldTasks(
  prompt: string,
  changeDescription: string
): SimulatedTask[] {
  return [
    {
      id: "bf-orch-1",
      agentRole: "orchestrator",
      title: "Analyze Codebase & Changes",
      description: `Parsing existing codebase and change request:\n"${changeDescription.slice(0, 100)}..."`,
      files: [
        {
          path: "docs/change-analysis.md",
          language: "markdown",
          linesOfCode: 40,
        },
      ],
      commands: [
        {
          cmd: "find src -name '*.ts' -o -name '*.tsx' | head -50",
          description: "Discover project files",
        },
        {
          cmd: "cat package.json",
          description: "Read project configuration",
        },
      ],
      durationEstimate: 4,
    },
    {
      id: "bf-arch-1",
      agentRole: "architect",
      title: "Plan Modifications",
      description:
        "Identifying affected files, dependencies, and potential breaking changes",
      files: [
        {
          path: "docs/modification-plan.md",
          language: "markdown",
          linesOfCode: 60,
        },
      ],
      commands: [],
      durationEstimate: 3,
    },
    {
      id: "bf-be-1",
      agentRole: "backend",
      title: "Apply Backend Changes",
      description: "Modifying API routes, business logic, and database queries",
      files: [
        {
          path: "src/app/api/[modified]/route.ts",
          language: "typescript",
          linesOfCode: 80,
        },
      ],
      commands: [
        { cmd: "npm run typecheck", description: "Verify types" },
      ],
      durationEstimate: 5,
    },
    {
      id: "bf-fe-1",
      agentRole: "frontend",
      title: "Apply Frontend Changes",
      description: "Updating components, pages, and UI logic",
      files: [
        {
          path: "src/components/[modified].tsx",
          language: "tsx",
          linesOfCode: 60,
        },
      ],
      commands: [],
      durationEstimate: 4,
    },
    {
      id: "bf-test-1",
      agentRole: "testing",
      title: "Update & Run Tests",
      description: "Updating test cases for modified functionality",
      files: [
        {
          path: "src/__tests__/[modified].test.ts",
          language: "typescript",
          linesOfCode: 50,
        },
      ],
      commands: [
        { cmd: "npm run test", description: "Run test suite" },
        { cmd: "npm run build", description: "Verify build" },
      ],
      durationEstimate: 4,
    },
  ];
}

// Architecture design patterns
export const ARCHITECTURE_TEMPLATES = {
  nextjs_fullstack: {
    overview: "Next.js App Router with Server Components, API routes, and PostgreSQL",
    components: [
      {
        name: "App Shell",
        type: "frontend",
        description: "Root layout, navigation, and theme provider",
      },
      {
        name: "Pages",
        type: "frontend",
        description: "Route-based pages with server/client components",
      },
      {
        name: "API Layer",
        type: "backend",
        description: "RESTful API routes under /api with validation",
      },
      {
        name: "Data Layer",
        type: "database",
        description: "Drizzle ORM with PostgreSQL, typed schemas",
      },
      {
        name: "Auth Module",
        type: "backend",
        description: "JWT-based auth with middleware protection",
      },
      {
        name: "Test Suite",
        type: "testing",
        description: "Vitest unit tests + Playwright E2E",
      },
    ],
    dataFlow: "Client → Server Component/API Route → Service Layer → Drizzle ORM → PostgreSQL",
  },
};
