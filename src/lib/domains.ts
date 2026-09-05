import type { Architecture, Entity, EntityField, TechStack } from "./types";

// ─── String helpers ─────────────────────────────────────────────────────────
export function pascal(s: string) {
  return s.replace(/[^a-zA-Z0-9]+/g, " ").trim().split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
}
export function camel(s: string) { const p = pascal(s); return p.charAt(0).toLowerCase() + p.slice(1); }
export function kebab(s: string) {
  return s.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase().replace(/^-|-$/g, "");
}
export function snake(s: string) { return kebab(s).replace(/-/g, "_"); }
export function pluralize(word: string) {
  const w = word.toLowerCase();
  if (/(s|x|z|ch|sh)$/.test(w)) return w + "es";
  if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + "ies";
  return w + "s";
}
export function titleCase(s: string) {
  return s.replace(/[-_]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const f = (name: string, type: string, opts: Partial<EntityField> = {}): EntityField =>
  ({ name, type, required: true, ...opts });

function entity(name: string, fields: EntityField[]): Entity {
  return { name: pascal(name), plural: pluralize(pascal(name)), slug: kebab(pluralize(name)), fields };
}

// ─── Domain packs ───────────────────────────────────────────────────────────
export interface DomainPack {
  id: string; label: string; emoji: string; keywords: string[];
  entities: Entity[]; features: string[]; overview: string;
}

export const DEFAULT_STACK: TechStack = {
  frontend: "Next.js 16 · React 19",
  backend: "Next.js API Routes · Zod",
  database: "PostgreSQL · Drizzle ORM",
  styling: "Tailwind CSS v4",
  testing: "Vitest + Playwright",
  deployment: "Docker · GitHub Actions",
};

export const DOMAIN_PACKS: DomainPack[] = [
  {
    id: "crm", label: "Sales CRM", emoji: "🤝",
    keywords: ["crm", "deal", "pipeline", "lead", "contact", "sales", "prospect"],
    entities: [
      entity("Company", [f("name", "string"), f("website", "string", { required: false }), f("industry", "string", { required: false }), f("size", "enum", { enumValues: ["startup", "smb", "mid_market", "enterprise"] })]),
      entity("Contact", [f("firstName", "string"), f("lastName", "string"), f("email", "string"), f("phone", "string", { required: false }), f("companyId", "reference", { references: "Company" })]),
      entity("Deal", [f("title", "string"), f("value", "number"), f("stage", "enum", { enumValues: ["lead", "qualified", "proposal", "negotiation", "won", "lost"] }), f("closeDate", "date", { required: false }), f("contactId", "reference", { references: "Contact" }), f("ownerId", "reference", { references: "User" })]),
      entity("Activity", [f("type", "enum", { enumValues: ["call", "email", "meeting", "note"] }), f("summary", "text"), f("dealId", "reference", { references: "Deal" }), f("occurredAt", "date")]),
      entity("User", [f("name", "string"), f("email", "string"), f("role", "enum", { enumValues: ["admin", "rep", "viewer"] })]),
    ],
    features: ["Kanban deal board", "Pipeline value metrics", "Win-rate reporting", "Owner assignment", "Activity timeline"],
    overview: "A CRM that manages companies, contacts and deals moving through a configurable pipeline with activity logging and revenue analytics.",
  },
  {
    id: "ecommerce", label: "E-Commerce Store", emoji: "🛒",
    keywords: ["shop", "store", "ecommerce", "e-commerce", "product", "cart", "checkout", "order", "marketplace"],
    entities: [
      entity("Product", [f("name", "string"), f("slug", "string"), f("price", "number"), f("compareAt", "number", { required: false }), f("stock", "number"), f("status", "enum", { enumValues: ["draft", "active", "archived"] })]),
      entity("Category", [f("name", "string"), f("slug", "string"), f("description", "text", { required: false })]),
      entity("Order", [f("number", "string"), f("status", "enum", { enumValues: ["pending", "paid", "fulfilled", "refunded", "cancelled"] }), f("total", "number"), f("customerId", "reference", { references: "Customer" })]),
      entity("OrderItem", [f("orderId", "reference", { references: "Order" }), f("productId", "reference", { references: "Product" }), f("quantity", "number"), f("unitPrice", "number")]),
      entity("Customer", [f("name", "string"), f("email", "string"), f("phone", "string", { required: false })]),
    ],
    features: ["Product catalog + search", "Cart & checkout flow", "Order tracking", "Inventory sync", "Discount codes"],
    overview: "A storefront with product catalog, cart, checkout and order management plus inventory tracking and admin analytics.",
  },
  {
    id: "saas", label: "SaaS Starter", emoji: "☁️",
    keywords: ["saas", "subscription", "billing", "tenant", "workspace", "team", "plan", "stripe"],
    entities: [
      entity("Workspace", [f("name", "string"), f("slug", "string"), f("plan", "enum", { enumValues: ["free", "pro", "enterprise"] })]),
      entity("Member", [f("workspaceId", "reference", { references: "Workspace" }), f("userId", "reference", { references: "User" }), f("role", "enum", { enumValues: ["owner", "admin", "member"] })]),
      entity("Subscription", [f("workspaceId", "reference", { references: "Workspace" }), f("status", "enum", { enumValues: ["trialing", "active", "past_due", "cancelled"] }), f("currentPeriodEnd", "date")]),
      entity("ApiKey", [f("workspaceId", "reference", { references: "Workspace" }), f("name", "string"), f("lastFour", "string")]),
      entity("User", [f("name", "string"), f("email", "string")]),
    ],
    features: ["Multi-tenant workspaces", "Stripe billing + trials", "Role-based access", "API keys", "Usage dashboards"],
    overview: "A multi-tenant SaaS foundation with workspaces, invitations, Stripe subscriptions, API keys and usage metering.",
  },
  {
    id: "helpdesk", label: "Support Desk", emoji: "🎫",
    keywords: ["ticket", "helpdesk", "support", "sla", "customer service", "queue", "help desk"],
    entities: [
      entity("Customer", [f("name", "string"), f("email", "string"), f("plan", "enum", { enumValues: ["free", "pro", "enterprise"] })]),
      entity("Ticket", [f("subject", "string"), f("body", "text"), f("status", "enum", { enumValues: ["open", "pending", "resolved", "closed"] }), f("priority", "enum", { enumValues: ["low", "normal", "high", "urgent"] }), f("customerId", "reference", { references: "Customer" }), f("assigneeId", "reference", { references: "User", required: false })]),
      entity("Reply", [f("ticketId", "reference", { references: "Ticket" }), f("body", "text"), f("isInternal", "boolean")]),
      entity("Macro", [f("title", "string"), f("body", "text"), f("category", "string")]),
      entity("User", [f("name", "string"), f("email", "string"), f("role", "enum", { enumValues: ["admin", "agent"] })]),
    ],
    features: ["Agent queue + SLA timers", "Canned macros", "Internal notes", "CSAT ratings", "Priority routing"],
    overview: "A support desk with ticket queues, SLA timers, macros, internal notes and satisfaction tracking.",
  },
  {
    id: "booking", label: "Booking & Scheduling", emoji: "📅",
    keywords: ["booking", "appointment", "schedule", "calendar", "reservation", "slot", "salon", "clinic"],
    entities: [
      entity("Service", [f("name", "string"), f("durationMin", "number"), f("price", "number"), f("bufferMin", "number", { required: false })]),
      entity("Staff", [f("name", "string"), f("email", "string"), f("specialty", "string", { required: false })]),
      entity("Booking", [f("serviceId", "reference", { references: "Service" }), f("staffId", "reference", { references: "Staff" }), f("customerName", "string"), f("startsAt", "date"), f("status", "enum", { enumValues: ["pending", "confirmed", "cancelled", "completed", "no_show"] })]),
      entity("Availability", [f("staffId", "reference", { references: "Staff" }), f("weekday", "number"), f("startTime", "string"), f("endTime", "string")]),
    ],
    features: ["Availability calendar", "Overlap prevention", "Reminders", "Staff schedules", "Cancellation flow"],
    overview: "A booking platform with services, staff availability, conflict-free scheduling and automated reminders.",
  },
  {
    id: "inventory", label: "Inventory Control", emoji: "📦",
    keywords: ["inventory", "warehouse", "stock", "sku", "reorder", "supplier"],
    entities: [
      entity("Product", [f("sku", "string"), f("name", "string"), f("category", "string"), f("unitCost", "number"), f("reorderPoint", "number")]),
      entity("Warehouse", [f("name", "string"), f("location", "string"), f("capacity", "number", { required: false })]),
      entity("StockLevel", [f("productId", "reference", { references: "Product" }), f("warehouseId", "reference", { references: "Warehouse" }), f("quantity", "number"), f("reserved", "number")]),
      entity("StockMovement", [f("productId", "reference", { references: "Product" }), f("warehouseId", "reference", { references: "Warehouse" }), f("type", "enum", { enumValues: ["inbound", "outbound", "transfer", "adjustment"] }), f("quantity", "number"), f("reference", "string", { required: false })]),
    ],
    features: ["Multi-warehouse stock", "Low-stock reorder alerts", "Movement ledger", "Stock valuation report", "CSV export"],
    overview: "An inventory system tracking products across warehouses with a full movement ledger, reserved quantities and reorder alerting.",
  },
  {
    id: "blog", label: "Blog / CMS", emoji: "✍️",
    keywords: ["blog", "cms", "article", "post", "content", "newsletter", "publish", "editorial"],
    entities: [
      entity("Post", [f("title", "string"), f("slug", "string"), f("excerpt", "text", { required: false }), f("body", "text"), f("status", "enum", { enumValues: ["draft", "scheduled", "published", "archived"] }), f("authorId", "reference", { references: "User" })]),
      entity("Tag", [f("name", "string"), f("slug", "string")]),
      entity("Comment", [f("postId", "reference", { references: "Post" }), f("authorName", "string"), f("body", "text"), f("status", "enum", { enumValues: ["pending", "approved", "spam"] })]),
      entity("User", [f("name", "string"), f("email", "string"), f("role", "enum", { enumValues: ["admin", "editor", "author"] })]),
    ],
    features: ["Markdown editor", "Scheduling", "Tagging + search", "Moderated comments", "SEO metadata"],
    overview: "A publishing CMS with drafting, scheduling, tagging, moderated comments and SEO controls.",
  },
  {
    id: "lms", label: "Learning Platform", emoji: "🎓",
    keywords: ["course", "lms", "learn", "lesson", "student", "quiz", "class", "education", "school"],
    entities: [
      entity("Course", [f("title", "string"), f("slug", "string"), f("description", "text"), f("level", "enum", { enumValues: ["beginner", "intermediate", "advanced"] }), f("price", "number")]),
      entity("Module", [f("courseId", "reference", { references: "Course" }), f("title", "string"), f("position", "number")]),
      entity("Lesson", [f("moduleId", "reference", { references: "Module" }), f("title", "string"), f("videoUrl", "string", { required: false }), f("durationMin", "number"), f("position", "number")]),
      entity("Enrollment", [f("courseId", "reference", { references: "Course" }), f("studentId", "reference", { references: "User" }), f("progress", "number"), f("status", "enum", { enumValues: ["active", "completed", "dropped"] })]),
      entity("User", [f("name", "string"), f("email", "string"), f("role", "enum", { enumValues: ["admin", "instructor", "student"] })]),
    ],
    features: ["Course builder", "Progress tracking", "Quizzes", "Certificates", "Student analytics"],
    overview: "A learning platform with courses, modules, lessons, enrollments, progress tracking and completion certificates.",
  },
  {
    id: "analytics", label: "Analytics Dashboard", emoji: "📊",
    keywords: ["analytics", "dashboard", "metric", "report", "kpi", "chart", "insight", "tracking"],
    entities: [
      entity("Event", [f("name", "string"), f("source", "string"), f("occurredAt", "date"), f("properties", "text", { required: false })]),
      entity("Dashboard", [f("title", "string"), f("description", "text", { required: false }), f("isShared", "boolean")]),
      entity("Widget", [f("dashboardId", "reference", { references: "Dashboard" }), f("title", "string"), f("type", "enum", { enumValues: ["line", "bar", "funnel", "table", "number"] }), f("query", "text")]),
      entity("Alert", [f("name", "string"), f("metric", "string"), f("threshold", "number"), f("isActive", "boolean")]),
    ],
    features: ["Event ingestion", "Drag-drop dashboards", "Funnel analysis", "Threshold alerts", "Scheduled exports"],
    overview: "An analytics suite with event capture, composable dashboards, funnels, threshold alerts and exports.",
  },
];

export const PRESETS = [
  { name: "Sales CRM", prompt: "Build a CRM with companies, contacts and a kanban deal pipeline with activity logging and win-rate reports.", domain: "crm", emoji: "🤝" },
  { name: "Storefront", prompt: "Build an e-commerce store with product catalog, cart, checkout and order tracking plus admin inventory.", domain: "ecommerce", emoji: "🛒" },
  { name: "Support Desk", prompt: "Build a support desk with ticket queues, SLA timers, macros and CSAT tracking.", domain: "helpdesk", emoji: "🎫" },
  { name: "Booking App", prompt: "Build a booking app with services, staff availability, conflict-free scheduling and reminders.", domain: "booking", emoji: "📅" },
  { name: "SaaS Starter", prompt: "Build a multi-tenant SaaS starter with workspaces, Stripe billing, roles and API keys.", domain: "saas", emoji: "☁️" },
  { name: "Course Platform", prompt: "Build a learning platform with courses, lessons, enrollments and progress tracking.", domain: "lms", emoji: "🎓" },
];

// ─── Inference ──────────────────────────────────────────────────────────────
export function inferDomain(prompt: string): DomainPack {
  const lower = prompt.toLowerCase();
  let best: DomainPack | null = null;
  let bestScore = 0;
  for (const pack of DOMAIN_PACKS) {
    let score = 0;
    for (const kw of pack.keywords) {
      if (lower.includes(kw)) score += kw.length > 5 ? 3 : 2;
    }
    if (score > bestScore) { bestScore = score; best = pack; }
  }
  if (best && bestScore >= 2) return best;
  // Custom fallback: derive entities from prompt nouns
  const words = Array.from(new Set(
    prompt.replace(/[^a-zA-Z ]/g, " ").split(/\s+/)
      .filter((w) => w.length > 3 && !["with", "that", "this", "from", "have", "will", "build", "create", "make", "generate", "plus", "management", "system", "application", "platform"].includes(w.toLowerCase()))
      .slice(0, 4)
  ));
  const customEntities: Entity[] = words.length >= 2
    ? words.map((w) => entity(pascal(w), [f("name", "string"), f("status", "enum", { enumValues: ["active", "archived"] }), f("notes", "text", { required: false })]))
    : [
        entity("Project", [f("name", "string"), f("status", "enum", { enumValues: ["active", "archived"] }), f("description", "text", { required: false })]),
        entity("TaskItem", [f("title", "string"), f("status", "enum", { enumValues: ["todo", "doing", "done"] }), f("projectId", "reference", { references: "Project" })]),
        entity("User", [f("name", "string"), f("email", "string")]),
      ];
  return {
    id: "custom", label: "Custom App", emoji: "✨",
    keywords: [], entities: customEntities,
    features: ["Dashboard overview", "CRUD management", "Search & filters", "CSV export", "Role-based access"],
    overview: "A custom application generated from your brief, with a typed API, database schema, dashboard UI and full test coverage.",
  };
}

export function buildArchitecture(_prompt: string, pack: DomainPack): Architecture {
  const names = pack.entities.map((e) => e.name);
  return {
    overview: pack.overview,
    domain: pack.id,
    domainLabel: pack.label,
    entities: pack.entities,
    features: pack.features,
    components: [
      { name: "Web App (App Router)", type: "frontend", description: `Server-rendered pages for ${names.slice(0, 3).join(", ")} plus a shared dashboard shell.`, dependencies: ["API Layer"] },
      { name: "API Layer", type: "backend", description: `Typed REST routes with Zod validation for ${pack.entities.length} resources, pagination and auth guards.`, dependencies: ["Database", "Auth"] },
      { name: "Database", type: "database", description: `PostgreSQL schema (${pack.entities.length} tables) managed by Drizzle with migrations and seed fixtures.`, dependencies: [] },
      { name: "Auth", type: "service", description: "Session auth with hashed credentials and role-based route guards.", dependencies: ["Database"] },
      { name: "Jobs & CI", type: "infra", description: "Seed jobs, GitHub Actions quality gate and Docker image build.", dependencies: ["API Layer"] },
    ],
    dataFlow: [
      "Browser requests a page → Next.js server component loads data via the service layer.",
      "Mutations POST to /api/* routes → Zod validates → Drizzle writes to PostgreSQL.",
      "Auth middleware attaches the session; RBAC guards enforce roles per resource.",
      "Background seed and migration jobs run through npm scripts in CI and on deploy.",
    ],
  };
}
