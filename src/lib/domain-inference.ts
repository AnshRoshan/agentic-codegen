export type FieldType =
  | "serial"
  | "text"
  | "longtext"
  | "integer"
  | "numeric"
  | "boolean"
  | "timestamp"
  | "date"
  | "jsonb"
  | "enum"
  | "email"
  | "url"
  | "reference";

export interface EntityField {
  name: string;
  type: FieldType;
  label: string;
  required?: boolean;
  isPrimary?: boolean;
  isForeign?: boolean;
  references?: string;
  enumValues?: string[];
  defaultValue?: string;
  searchable?: boolean;
  inList?: boolean;
}

export interface Entity {
  name: string;
  varName: string;
  table: string;
  slug: string;
  label: string;
  labelPlural: string;
  icon: string;
  description: string;
  fields: EntityField[];
}

export interface Metric {
  key: string;
  label: string;
  entity: string;
  agg: "count" | "sum" | "avg" | "pct";
  field?: string;
  format: "number" | "currency" | "percent" | "duration";
  icon: string;
}

export type FeatureId =
  | "auth"
  | "charts"
  | "search"
  | "filters"
  | "export"
  | "upload"
  | "realtime"
  | "payments"
  | "notifications"
  | "calendar"
  | "kanban"
  | "comments"
  | "tags"
  | "roles"
  | "audit"
  | "forecasting"
  | "scheduling"
  | "reporting"
  | "map"
  | "chat";

export interface AppSpec {
  name: string;
  domain: string;
  description: string;
  entities: Entity[];
  metrics: Metric[];
  features: FeatureId[];
  primaryEntity: string;
  hasTimeSeries: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function pascal(s: string) {
  return s
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

export function camel(s: string) {
  const p = pascal(s);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

export function kebab(s: string) {
  return s
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase()
    .replace(/^-|-$/g, "");
}

export function snake(s: string) {
  return kebab(s).replace(/-/g, "_");
}

export function pluralize(word: string) {
  const w = word.toLowerCase();
  if (w === "activity") return "activities";
  if (w === "company") return "companies";
  if (/(s|x|z|ch|sh)$/.test(w)) return w + "es";
  if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + "ies";
  return w + "s";
}

export function titleCase(s: string) {
  return s
    .replace(/[-_]/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const ID: EntityField = { name: "id", type: "serial", label: "ID", isPrimary: true };
const CREATED: EntityField = { name: "created_at", type: "timestamp", label: "Created", defaultValue: "now()" };
const UPDATED: EntityField = { name: "updated_at", type: "timestamp", label: "Updated", defaultValue: "now()" };

function f(name: string, type: FieldType, opts: Partial<EntityField> = {}): EntityField {
  return { name, type, label: titleCase(name), inList: true, ...opts };
}

function fk(name: string, refTable: string, opts: Partial<EntityField> = {}): EntityField {
  return {
    name,
    type: "reference",
    label: titleCase(name.replace(/_id$/, "")),
    isForeign: true,
    references: refTable + ".id",
    inList: true,
    ...opts,
  };
}

function enumF(name: string, values: string[], def?: string): EntityField {
  return {
    name,
    type: "enum",
    label: titleCase(name),
    enumValues: values,
    defaultValue: def ?? values[0],
    inList: true,
  };
}

function makeEntity(
  singular: string,
  icon: string,
  description: string,
  fields: EntityField[]
): Entity {
  const name = pascal(singular);
  const table = snake(pluralize(singular));
  return {
    name,
    varName: camel(pluralize(singular)),
    table,
    slug: kebab(pluralize(singular)),
    label: titleCase(singular),
    labelPlural: titleCase(pluralize(singular)),
    icon,
    description,
    fields: [ID, ...fields, CREATED, UPDATED],
  };
}

// Default user entity included in all web apps
const USER_ENTITY = makeEntity("User", "👤", "App user accounts and profiles", [
  f("email", "email", { searchable: true }),
  f("fullName", "text", { searchable: true }),
  enumF("role", ["admin", "manager", "member"], "member"),
  f("avatarUrl", "url", { required: false }),
]);

// ─── Inference Function ───────────────────────────────────────────────────────

export function inferDomainFromPrompt(prompt: string): AppSpec {
  const p = prompt.toLowerCase();

  // 1. Sales CRM
  if (p.includes("crm") || p.includes("deal") || p.includes("pipeline") || p.includes("sales") || p.includes("lead")) {
    return {
      name: "Sales Force",
      domain: "crm",
      description: "Manage client companies, contact details, sales pipelines, and follow-up logs.",
      primaryEntity: "deals",
      hasTimeSeries: false,
      features: ["auth", "kanban", "search", "filters", "roles", "audit"],
      entities: [
        USER_ENTITY,
        makeEntity("Company", "🏢", "Organization profiles and meta-data", [
          f("name", "text", { searchable: true }),
          f("website", "url", { required: false }),
          enumF("industry", ["saas", "finance", "healthcare", "real_estate", "other"]),
          enumF("size", ["startup", "smb", "mid_market", "enterprise"], "smb"),
        ]),
        makeEntity("Contact", "🧑", "Individuals tied to companies", [
          f("firstName", "text", { searchable: true }),
          f("lastName", "text", { searchable: true }),
          f("email", "email", { searchable: true }),
          f("phone", "text", { required: false }),
          fk("companyId", "companies"),
        ]),
        makeEntity("Deal", "🤝", "Sales opportunities in the sales pipeline", [
          f("title", "text", { searchable: true }),
          f("value", "integer"),
          enumF("stage", ["lead", "qualified", "proposal", "negotiation", "won", "lost"], "lead"),
          f("closeDate", "date", { required: false }),
          fk("contactId", "contacts"),
          fk("ownerId", "users"),
        ]),
        makeEntity("Activity", "📋", "Engagement logs (meetings, calls, notes)", [
          enumF("type", ["call", "email", "meeting", "note"], "note"),
          f("notes", "longtext"),
          fk("dealId", "deals"),
          f("occurredAt", "date"),
        ]),
      ],
      metrics: [
        { key: "total_revenue", label: "Pipeline Value", entity: "deals", agg: "sum", field: "value", format: "currency", icon: "💰" },
        { key: "active_deals", label: "Active Deals", entity: "deals", agg: "count", format: "number", icon: "🤝" },
        { key: "avg_deal_size", label: "Average Value", entity: "deals", agg: "avg", field: "value", format: "currency", icon: "📈" },
        { key: "win_rate", label: "Win Rate", entity: "deals", agg: "pct", format: "percent", icon: "🏆" },
      ],
    };
  }

  // 2. Inventory Control
  if (p.includes("inventory") || p.includes("warehouse") || p.includes("stock") || p.includes("product") || p.includes("sku")) {
    return {
      name: "Stock Flow",
      domain: "inventory",
      description: "Track inventory, SKUs, multiple warehouses, and incoming/outgoing ledgers.",
      primaryEntity: "products",
      hasTimeSeries: false,
      features: ["auth", "search", "filters", "export", "upload", "notifications"],
      entities: [
        USER_ENTITY,
        makeEntity("Warehouse", "🏢", "Physical inventory storage buildings", [
          f("name", "text", { searchable: true }),
          f("location", "text"),
          f("capacitySqFt", "integer", { required: false }),
        ]),
        makeEntity("Product", "📦", "Catalog of trackable inventory SKUs", [
          f("name", "text", { searchable: true }),
          f("sku", "text", { searchable: true }),
          f("price", "integer"),
          f("category", "text", { searchable: true }),
          f("reorderThreshold", "integer", { defaultValue: "10" }),
        ]),
        makeEntity("StockLevel", "📊", "Current product count at specific locations", [
          fk("productId", "products"),
          fk("warehouseId", "warehouses"),
          f("quantity", "integer", { defaultValue: "0" }),
        ]),
        makeEntity("Movement", "🔄", "Stock ledger history log (Inbound, Outbound, Transfer)", [
          enumF("direction", ["inbound", "outbound", "transfer"]),
          f("quantity", "integer"),
          fk("productId", "products"),
          fk("warehouseId", "warehouses"),
          f("notes", "text", { required: false }),
        ]),
      ],
      metrics: [
        { key: "total_items", label: "Total Stock Items", entity: "stock_levels", agg: "sum", field: "quantity", format: "number", icon: "📦" },
        { key: "val_total", label: "Stock Valuation", entity: "products", agg: "sum", field: "price", format: "currency", icon: "💰" },
        { key: "low_stock", label: "Low Stock Alert SKU", entity: "products", agg: "count", format: "number", icon: "⚠️" },
      ],
    };
  }

  // 3. IoT Telemetry
  if (p.includes("iot") || p.includes("device") || p.includes("sensor") || p.includes("telemetry") || p.includes("reading")) {
    return {
      name: "IoT Nexus",
      domain: "iot",
      description: "Monitor device fleets, ingest sensor telemetry streams, and manage thresholds.",
      primaryEntity: "devices",
      hasTimeSeries: true,
      features: ["auth", "charts", "search", "filters", "realtime", "notifications"],
      entities: [
        USER_ENTITY,
        makeEntity("Device", "📡", "IoT sensor array gateways", [
          f("name", "text", { searchable: true }),
          f("serialNumber", "text", { searchable: true }),
          enumF("status", ["online", "offline", "maintenance"], "offline"),
          f("firmwareVersion", "text"),
          f("location", "text"),
        ]),
        makeEntity("Sensor", "🔌", "Component reporting telemetry values", [
          fk("deviceId", "devices"),
          f("metricName", "text"),
          f("unitOfMeasure", "text"),
          f("alertThreshold", "numeric"),
        ]),
        makeEntity("TelemetryReading", "📈", "Time-series database logs", [
          fk("sensorId", "sensors"),
          f("value", "numeric"),
          f("recordedAt", "date"),
        ]),
        makeEntity("Alert", "🚨", "Automated alert triggers", [
          fk("sensorId", "sensors"),
          enumF("severity", ["info", "warning", "critical"], "warning"),
          f("message", "text"),
          f("isAcknowledged", "boolean", { defaultValue: "false" }),
        ]),
      ],
      metrics: [
        { key: "device_count", label: "Active Fleets", entity: "devices", agg: "count", format: "number", icon: "📡" },
        { key: "alerts_pending", label: "Open Alerts", entity: "alerts", agg: "count", format: "number", icon: "🚨" },
        { key: "reading_rate", label: "Avg Telemetry Value", entity: "telemetry_readings", agg: "avg", field: "value", format: "number", icon: "⚡" },
      ],
    };
  }

  // 4. Support Helpdesk
  if (p.includes("ticket") || p.includes("support") || p.includes("helpdesk") || p.includes("sla") || p.includes("customer")) {
    return {
      name: "Desk Service",
      domain: "helpdesk",
      description: "Manage SLA priority policies, client tickets, assignees, and responses.",
      primaryEntity: "tickets",
      hasTimeSeries: false,
      features: ["auth", "search", "filters", "roles", "comments", "reporting"],
      entities: [
        USER_ENTITY,
        makeEntity("Ticket", "🎫", "Customer support service issues", [
          f("subject", "text", { searchable: true }),
          enumF("status", ["open", "pending", "resolved", "closed"], "open"),
          enumF("priority", ["low", "medium", "high", "urgent"], "medium"),
          f("description", "longtext"),
          fk("customerId", "users"),
          fk("assigneeId", "users"),
          f("slaDue", "date"),
        ]),
        makeEntity("ThreadReply", "💬", "Message threads on a ticket", [
          fk("ticketId", "tickets"),
          fk("authorId", "users"),
          f("content", "longtext"),
          f("isInternal", "boolean", { defaultValue: "false" }),
        ]),
        makeEntity("SlaPolicy", "📜", "Service level agreement definitions", [
          enumF("priority", ["low", "medium", "high", "urgent"], "medium"),
          f("responseTimeHours", "integer"),
          f("resolutionTimeHours", "integer"),
        ]),
      ],
      metrics: [
        { key: "open_tickets", label: "Open Tickets", entity: "tickets", agg: "count", format: "number", icon: "🎫" },
        { key: "unassigned", label: "Unassigned Tickets", entity: "tickets", agg: "count", format: "number", icon: "👤" },
        { key: "resolution_pct", label: "Resolution Rate", entity: "tickets", agg: "pct", format: "percent", icon: "✅" },
      ],
    };
  }

  // 5. Clinic Manager (Healthcare)
  if (p.includes("clinic") || p.includes("patient") || p.includes("appointment") || p.includes("doctor") || p.includes("medical") || p.includes("healthcare")) {
    return {
      name: "Clinic Hub",
      domain: "healthcare",
      description: "Patients, providers, clinical schedules, encounter records, and HIPPA logs.",
      primaryEntity: "appointments",
      hasTimeSeries: false,
      features: ["auth", "calendar", "search", "filters", "roles", "audit", "scheduling"],
      entities: [
        USER_ENTITY,
        makeEntity("Patient", "🧑‍⚕️", "Demographic details of clinical patients", [
          f("firstName", "text", { searchable: true }),
          f("lastName", "text", { searchable: true }),
          f("email", "email", { searchable: true }),
          f("phone", "text"),
          f("dateOfBirth", "date"),
          f("medicalRecordNumber", "text", { searchable: true }),
        ]),
        makeEntity("Provider", "🩺", "Doctors, clinicians, and practitioners", [
          f("fullName", "text", { searchable: true }),
          f("specialty", "text", { searchable: true }),
          f("licenseNumber", "text"),
          f("phone", "text", { required: false }),
        ]),
        makeEntity("Appointment", "📅", "Scheduled clinical slots and calendars", [
          fk("patientId", "patients"),
          fk("providerId", "providers"),
          f("scheduledAt", "date"),
          enumF("status", ["scheduled", "checked_in", "completed", "no_show", "cancelled"], "scheduled"),
          f("reason", "text", { required: false }),
        ]),
        makeEntity("Encounter", "📋", "Clinical summaries and diagnostic entries", [
          fk("appointmentId", "appointments"),
          fk("patientId", "patients"),
          f("diagnosisCode", "text", { searchable: true }),
          f("clinicalNotes", "longtext"),
        ]),
      ],
      metrics: [
        { key: "total_patients", label: "Registered Patients", entity: "patients", agg: "count", format: "number", icon: "🧑" },
        { key: "today_appointments", label: "Appointments Today", entity: "appointments", agg: "count", format: "number", icon: "📅" },
        { key: "no_show_rate", label: "No-Show Rate", entity: "appointments", agg: "pct", format: "percent", icon: "🚫" },
      ],
    };
  }

  // 6. E-Commerce
  if (p.includes("ecommerce") || p.includes("store") || p.includes("cart") || p.includes("checkout") || p.includes("stripe") || p.includes("payment")) {
    return {
      name: "SaaS Shop",
      domain: "ecommerce",
      description: "Manage product catalogs, category structures, Stripe orders, and inventories.",
      primaryEntity: "orders",
      hasTimeSeries: false,
      features: ["auth", "search", "filters", "payments", "upload", "reporting"],
      entities: [
        USER_ENTITY,
        makeEntity("Category", "🏷️", "Product classification groupings", [
          f("name", "text", { searchable: true }),
          f("slug", "text"),
          f("description", "text", { required: false }),
        ]),
        makeEntity("Product", "🛍️", "Catalog products available for sale", [
          f("name", "text", { searchable: true }),
          f("price", "integer"), // in cents
          f("sku", "text", { searchable: true }),
          fk("categoryId", "categories"),
          f("stockCount", "integer", { defaultValue: "10" }),
        ]),
        makeEntity("Order", "🛒", "Customer cart checkouts and balances", [
          fk("customerId", "users"),
          f("totalAmount", "integer"),
          enumF("status", ["pending", "paid", "shipped", "delivered", "cancelled"], "pending"),
          f("stripeSessionId", "text", { required: false }),
        ]),
        makeEntity("OrderItem", "📝", "Product items contained in an order", [
          fk("orderId", "orders"),
          fk("productId", "products"),
          f("quantity", "integer"),
          f("unitPrice", "integer"),
        ]),
      ],
      metrics: [
        { key: "revenue", label: "Total Revenue", entity: "orders", agg: "sum", field: "totalAmount", format: "currency", icon: "💰" },
        { key: "order_count", label: "Orders Shipped", entity: "orders", agg: "count", format: "number", icon: "📦" },
        { key: "avg_order", label: "Avg Cart Size", entity: "orders", agg: "avg", field: "totalAmount", format: "currency", icon: "🛒" },
      ],
    };
  }

  // 7. General Purpose / Fallback SaaS Template
  return {
    name: "SaaS Blueprint",
    domain: "custom",
    description: "Multi-tenant workspace model supporting tasks, analytics, profiles, and logs.",
    primaryEntity: "tasks",
    hasTimeSeries: false,
    features: ["auth", "search", "filters", "export", "roles", "audit"],
    entities: [
      USER_ENTITY,
      makeEntity("Workspace", "🏢", "Group workspace containers", [
        f("name", "text", { searchable: true }),
        f("subdomain", "text", { required: false }),
        enumF("plan", ["free", "growth", "enterprise"], "free"),
      ]),
      makeEntity("Task", "✅", "Work items inside a project or workspace", [
        f("title", "text", { searchable: true }),
        f("points", "integer", { defaultValue: "3" }),
        enumF("status", ["backlog", "todo", "in_progress", "review", "done"], "todo"),
        fk("workspaceId", "workspaces"),
        fk("assigneeId", "users"),
      ]),
      makeEntity("AuditLog", "🛡️", "System audit trails for compliance", [
        f("action", "text", { searchable: true }),
        f("ipAddress", "text"),
        fk("userId", "users"),
        f("meta", "jsonb", { required: false }),
      ]),
    ],
    metrics: [
      { key: "workspaces", label: "Active Workspaces", entity: "workspaces", agg: "count", format: "number", icon: "🏢" },
      { key: "total_tasks", label: "Total Tasks", entity: "tasks", agg: "count", format: "number", icon: "✅" },
      { key: "avg_points", label: "Avg Velocity", entity: "tasks", agg: "avg", field: "points", format: "number", icon: "⚡" },
    ],
  };
}
