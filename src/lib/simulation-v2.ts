// Enhanced simulation with file tree, database tables, env vars, and HITL

import { AgentRoleId } from "./agents";

export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: "file" | "directory";
  language?: string;
  content?: string;
  children?: FileNode[];
}

export interface DbTable {
  id: string;
  name: string;
  schema: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    default?: string;
    isPrimary?: boolean;
    isForeign?: boolean;
    references?: string;
  }>;
  indexes: Array<{
    name: string;
    columns: string[];
    unique?: boolean;
  }>;
  sql: string;
}

export interface EnvVar {
  id: string;
  key: string;
  value: string;
  type: "plain" | "secret" | "vault_ref";
  description?: string;
  isSecret: boolean;
  isRequired: boolean;
}

export interface HitlCheckpoint {
  id: string;
  type: "file_edit" | "db_migration" | "command_exec" | "deployment";
  title: string;
  description: string;
  riskLevel: "low" | "medium" | "high";
  context: {
    proposedChanges?: string;
    diff?: string;
    filePath?: string;
    command?: string;
    affectedTables?: string[];
  };
}

// Generate a complete file tree for a Next.js project
export function generateFileTree(projectName: string): FileNode[] {
  return [
    {
      id: "root",
      name: projectName,
      path: ".",
      type: "directory",
      children: [
        {
          id: "f1",
          name: "package.json",
          path: "package.json",
          type: "file",
          language: "json",
          content: JSON.stringify(
            {
              name: projectName.toLowerCase().replace(/\s+/g, "-"),
              version: "0.1.0",
              private: true,
              scripts: {
                dev: "next dev",
                build: "next build",
                start: "next start",
                lint: "eslint .",
                typecheck: "tsc --noEmit",
                test: "vitest",
                "test:e2e": "playwright test",
              },
              dependencies: {
                next: "^16.0.0",
                react: "^19.0.0",
                "react-dom": "^19.0.0",
                "drizzle-orm": "^0.45.0",
                pg: "^8.20.0",
                zod: "^3.23.0",
                tailwindcss: "^4.0.0",
              },
              devDependencies: {
                typescript: "^5.9.0",
                "@types/node": "^22.0.0",
                "@types/react": "^19.0.0",
                "@types/pg": "^8.18.0",
                "drizzle-kit": "^0.31.0",
                eslint: "^9.0.0",
                vitest: "^3.0.0",
                "@playwright/test": "^1.50.0",
              },
            },
            null,
            2
          ),
        },
        {
          id: "f2",
          name: "tsconfig.json",
          path: "tsconfig.json",
          type: "file",
          language: "json",
          content: JSON.stringify(
            {
              compilerOptions: {
                target: "ES2022",
                lib: ["dom", "dom.iterable", "ES2022"],
                allowJs: true,
                skipLibCheck: true,
                strict: true,
                noEmit: true,
                esModuleInterop: true,
                module: "esnext",
                moduleResolution: "bundler",
                resolveJsonModule: true,
                isolatedModules: true,
                jsx: "preserve",
                incremental: true,
                plugins: [{ name: "next" }],
                paths: { "@/*": ["./src/*"] },
              },
              include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
              exclude: ["node_modules"],
            },
            null,
            2
          ),
        },
        {
          id: "f3",
          name: "next.config.ts",
          path: "next.config.ts",
          type: "file",
          language: "typescript",
          content: `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;`,
        },
        {
          id: "f4",
          name: "drizzle.config.ts",
          path: "drizzle.config.ts",
          type: "file",
          language: "typescript",
          content: `import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});`,
        },
        {
          id: "f5",
          name: ".env.example",
          path: ".env.example",
          type: "file",
          language: "env",
          content: `# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mydb

# Auth
JWT_SECRET=your-secret-key-here
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000

# API Keys (optional)
OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_test_...`,
        },
        {
          id: "f6",
          name: ".gitignore",
          path: ".gitignore",
          type: "file",
          language: "text",
          content: `# Dependencies
node_modules
.pnpm-store

# Next.js
.next
out

# Environment
.env
.env.local
.env.production

# Database
drizzle/*.sql
drizzle/migrations

# Testing
coverage
.nyc_output

# IDE
.vscode
.idea
*.swp
*.swo

# OS
.DS_Store
Thumbs.db`,
        },
        {
          id: "d1",
          name: "src",
          path: "src",
          type: "directory",
          children: [
            {
              id: "d1-1",
              name: "app",
              path: "src/app",
              type: "directory",
              children: [
                {
                  id: "f7",
                  name: "layout.tsx",
                  path: "src/app/layout.tsx",
                  type: "file",
                  language: "tsx",
                  content: `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "${projectName}",
  description: "Generated by EDL",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}`,
                },
                {
                  id: "f8",
                  name: "page.tsx",
                  path: "src/app/page.tsx",
                  type: "file",
                  language: "tsx",
                  content: `export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-4xl font-bold">${projectName}</h1>
      <p className="mt-4 text-gray-600">
        Welcome to your new application!
      </p>
    </main>
  );
}`,
                },
                {
                  id: "f9",
                  name: "globals.css",
                  path: "src/app/globals.css",
                  type: "file",
                  language: "css",
                  content: `@import "tailwindcss";

:root {
  --foreground: #171717;
  --background: #ffffff;
}

body {
  color: var(--foreground);
  background: var(--background);
}`,
                },
                {
                  id: "d1-1-1",
                  name: "api",
                  path: "src/app/api",
                  type: "directory",
                  children: [
                    {
                      id: "d1-1-1-1",
                      name: "health",
                      path: "src/app/api/health",
                      type: "directory",
                      children: [
                        {
                          id: "f10",
                          name: "route.ts",
                          path: "src/app/api/health/route.ts",
                          type: "file",
                          language: "typescript",
                          content: `import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
}`,
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              id: "d1-2",
              name: "db",
              path: "src/db",
              type: "directory",
              children: [
                {
                  id: "f11",
                  name: "index.ts",
                  path: "src/db/index.ts",
                  type: "file",
                  language: "typescript",
                  content: `import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);`,
                },
                {
                  id: "f12",
                  name: "schema.ts",
                  path: "src/db/schema.ts",
                  type: "file",
                  language: "typescript",
                  content: `import { pgTable, text, timestamp, serial } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow(),
});`,
                },
              ],
            },
            {
              id: "d1-3",
              name: "lib",
              path: "src/lib",
              type: "directory",
              children: [
                {
                  id: "f13",
                  name: "utils.ts",
                  path: "src/lib/utils.ts",
                  type: "file",
                  language: "typescript",
                  content: `export function cn(...classes: (string | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}`,
                },
              ],
            },
            {
              id: "d1-4",
              name: "components",
              path: "src/components",
              type: "directory",
              children: [],
            },
          ],
        },
        {
          id: "d2",
          name: "drizzle",
          path: "drizzle",
          type: "directory",
          children: [],
        },
        {
          id: "d3",
          name: "e2e",
          path: "e2e",
          type: "directory",
          children: [
            {
              id: "f14",
              name: "example.spec.ts",
              path: "e2e/example.spec.ts",
              type: "file",
              language: "typescript",
              content: `import { test, expect } from "@playwright/test";

test("homepage has title", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/${projectName}/);
});`,
            },
          ],
        },
      ],
    },
  ];
}

// Generate database tables
export function generateDatabaseTables(): DbTable[] {
  return [
    {
      id: "tbl-users",
      name: "users",
      schema: "public",
      columns: [
        { name: "id", type: "serial", nullable: false, isPrimary: true },
        { name: "email", type: "text", nullable: false },
        { name: "name", type: "text", nullable: true },
        { name: "created_at", type: "timestamp", nullable: false, default: "now()" },
        { name: "updated_at", type: "timestamp", nullable: true },
      ],
      indexes: [
        { name: "users_email_idx", columns: ["email"], unique: true },
        { name: "users_created_idx", columns: ["created_at"] },
      ],
      sql: `CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);`,
    },
    {
      id: "tbl-posts",
      name: "posts",
      schema: "public",
      columns: [
        { name: "id", type: "serial", nullable: false, isPrimary: true },
        { name: "title", type: "text", nullable: false },
        { name: "content", type: "text", nullable: true },
        { name: "author_id", type: "integer", nullable: false, isForeign: true, references: "users.id" },
        { name: "published", type: "boolean", nullable: false, default: "false" },
        { name: "created_at", type: "timestamp", nullable: false, default: "now()" },
      ],
      indexes: [
        { name: "posts_author_idx", columns: ["author_id"] },
        { name: "posts_published_idx", columns: ["published", "created_at"] },
      ],
      sql: `CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  author_id INTEGER REFERENCES users(id),
  published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);`,
    },
  ];
}

// Generate environment variables
export function generateEnvironmentVariables(): EnvVar[] {
  return [
    {
      id: "env-1",
      key: "NODE_ENV",
      value: "development",
      type: "plain",
      description: "Application environment",
      isSecret: false,
      isRequired: true,
    },
    {
      id: "env-2",
      key: "DATABASE_URL",
      value: "postgresql://postgres:postgres@localhost:5432/mydb",
      type: "secret",
      description: "PostgreSQL connection string",
      isSecret: true,
      isRequired: true,
    },
    {
      id: "env-3",
      key: "JWT_SECRET",
      value: "super-secret-jwt-key-change-in-production",
      type: "secret",
      description: "Secret key for JWT signing",
      isSecret: true,
      isRequired: true,
    },
    {
      id: "env-4",
      key: "NEXTAUTH_URL",
      value: "http://localhost:3000",
      type: "plain",
      description: "NextAuth base URL",
      isSecret: false,
      isRequired: true,
    },
    {
      id: "env-5",
      key: "NEXTAUTH_SECRET",
      value: "op://vault/nextauth/secret", // Vault reference pattern like 1Password
      type: "vault_ref",
      description: "NextAuth secret from vault",
      isSecret: true,
      isRequired: true,
    },
    {
      id: "env-6",
      key: "OPENAI_API_KEY",
      value: "sk-...",
      type: "secret",
      description: "OpenAI API key for AI features",
      isSecret: true,
      isRequired: false,
    },
    {
      id: "env-7",
      key: "STRIPE_SECRET_KEY",
      value: "sk_test_...",
      type: "secret",
      description: "Stripe API secret key",
      isSecret: true,
      isRequired: false,
    },
    {
      id: "env-8",
      key: "REDIS_URL",
      value: "redis://localhost:6379",
      type: "plain",
      description: "Redis connection URL",
      isSecret: false,
      isRequired: false,
    },
  ];
}

// Generate HITL checkpoints
export function generateHitlCheckpoints(): HitlCheckpoint[] {
  return [
    {
      id: "hitl-1",
      type: "db_migration",
      title: "Database Migration Approval",
      description: "The Database Agent wants to apply a migration that creates the users and posts tables with indexes.",
      riskLevel: "medium",
      context: {
        proposedChanges: "Create users and posts tables with foreign key constraints",
        affectedTables: ["users", "posts"],
        diff: `+ CREATE TABLE users (
+   id SERIAL PRIMARY KEY,
+   email TEXT NOT NULL UNIQUE,
+   name TEXT,
+   created_at TIMESTAMP DEFAULT NOW()
+ );
+ 
+ CREATE TABLE posts (
+   id SERIAL PRIMARY KEY,
+   title TEXT NOT NULL,
+   author_id INTEGER REFERENCES users(id),
+   published BOOLEAN DEFAULT FALSE
+ );`,
      },
    },
    {
      id: "hitl-2",
      type: "command_exec",
      title: "Production Build Command",
      description: "The DevOps Agent wants to run npm run build for production deployment.",
      riskLevel: "low",
      context: {
        command: "npm run build",
      },
    },
    {
      id: "hitl-3",
      type: "file_edit",
      title: "Modify Authentication Logic",
      description: "The Backend Agent wants to modify the JWT validation middleware to add token expiration checks.",
      riskLevel: "high",
      context: {
        filePath: "src/lib/auth.ts",
        proposedChanges: "Add token expiration validation and refresh logic",
        diff: `@@ -10,6 +10,12 @@ export function verifyToken(token: string) {
   try {
     const decoded = jwt.verify(token, process.env.JWT_SECRET!);
+    // Check if token is expired
+    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
+      throw new Error("Token expired");
+    }
+    // Add refresh token logic
+    const refreshToken = generateRefreshToken(decoded.sub);
     return decoded;
   } catch (error) {
     return null;`,
      },
    },
  ];
}

// Flatten file tree for database insertion
export function flattenFileTree(
  nodes: FileNode[],
  projectId: string,
  agentId: string | null = null,
  parentId: string | null = null,
  result: Array<{
    id: string;
    projectId: string;
    agentId: string | null;
    parentId: string | null;
    name: string;
    path: string;
    type: string;
    content?: string;
    language?: string;
    size?: number;
  }> = []
): Array<{
  id: string;
  projectId: string;
  agentId: string | null;
  parentId: string | null;
  name: string;
  path: string;
  type: string;
  content?: string;
  language?: string;
  size?: number;
}> {
  for (const node of nodes) {
    const flatNode = {
      id: node.id,
      projectId,
      agentId,
      parentId,
      name: node.name,
      path: node.path,
      type: node.type,
      content: node.content,
      language: node.language,
      size: node.content ? Buffer.byteLength(node.content, "utf8") : undefined,
    };
    result.push(flatNode);

    if (node.children) {
      flattenFileTree(node.children, projectId, agentId, node.id, result);
    }
  }
  return result;
}
