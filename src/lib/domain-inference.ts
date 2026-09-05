// ─────────────────────────────────────────────────────────────────────────────
// Domain Inference Engine
// Takes ANY free-form prompt and infers a complete application specification:
// entities, fields, relationships, metrics, and features.
// This is what lets EDL generate any app type — not just fixed templates.
// ─────────────────────────────────────────────────────────────────────────────

export type FieldType =
  | "serial" | "text" | "longtext" | "integer" | "numeric"
  | "boolean" | "timestamp" | "date" | "jsonb" | "enum" | "email" | "url";

export interface EntityField {
  name: string;              // snake_case column
  type: FieldType;
  label: string;
  required?: boolean;
  isPrimary?: boolean;
  isForeign?: boolean;
  references?: string;       // "users.id"
  enumValues?: string[];
  defaultValue?: string;
  searchable?: boolean;
  inList?: boolean;          // show in table view
}

export interface Entity {
  name: string;              // PascalCase singular  -> "CapacityPlan"
  varName: string;           // camelCase plural     -> "capacityPlans"
  table: string;             // snake_case plural    -> "capacity_plans"
  slug: string;              // kebab plural         -> "capacity-plans"
  label: string;             // "Capacity Plan"
  labelPlural: string;       // "Capacity Plans"
  icon: string;
  description: string;
  fields: EntityField[];
}

export interface Metric {
  key: string;
  label: string;
  entity: string;            // table it derives from
  agg: "count" | "sum" | "avg" | "pct";
  field?: string;
  format: "number" | "currency" | "percent" | "duration";
  icon: string;
}

export type FeatureId =
  | "auth" | "charts" | "search" | "filters" | "export" | "upload"
  | "realtime" | "payments" | "notifications" | "calendar" | "kanban"
  | "comments" | "tags" | "roles" | "audit" | "forecasting" | "scheduling"
  | "reporting" | "map" | "chat";

export interface AppSpec {
  name: string;
  domain: string;
  description: string;
  entities: Entity[];
  metrics: Metric[];
  features: FeatureId[];
  primaryEntity: string;     // table name
  hasTimeSeries: boolean;
}

// ─── String helpers ──────────────────────────────────────────────────────────

const IRREGULAR: Record<string, string> = {
  person: "people", child: "children", man: "men", woman: "women",
  datum: "data", analysis: "analyses", index: "indices", status: "statuses",
};

export function pluralize(w: string): string {
  const lower = w.toLowerCase();
  if (IRREGULAR[lower]) return IRREGULAR[lower];
  // Already plural (ends in 's' but not a singular like class/status/analysis/bus)
  if (/s$/.test(lower) && !/(ss|us|is)$/.test(lower)) return w;
  if (/(s|x|z|ch|sh)$/.test(lower)) return w + "es";
  if (/[^aeiou]y$/.test(lower)) return w.slice(0, -1) + "ies";
  return w + "s";
}

export function pascal(s: string): string {
  return s.split(/[\s_\-]+/).filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("");
}
export function camel(s: string): string {
  const p = pascal(s); return p.charAt(0).toLowerCase() + p.slice(1);
}
export function snake(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[\s\-]+/g, "_").toLowerCase();
}
export function kebab(s: string): string {
  return snake(s).replace(/_/g, "-");
}
export function titleCase(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/[\s_\-]+/).filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

// ─── Reusable field builders ─────────────────────────────────────────────────

const ID: EntityField = { name: "id", type: "serial", label: "ID", isPrimary: true };
const CREATED: EntityField = { name: "created_at", type: "timestamp", label: "Created", defaultValue: "now()" };
const UPDATED: EntityField = { name: "updated_at", type: "timestamp", label: "Updated" };

function f(name: string, type: FieldType, opts: Partial<EntityField> = {}): EntityField {
  return { name, type, label: titleCase(name), inList: true, ...opts };
}
function fk(name: string, refTable: string, opts: Partial<EntityField> = {}): EntityField {
  return { name, type: "integer", label: titleCase(name.replace(/_id$/, "")), isForeign: true, references: refTable + ".id", inList: true, ...opts };
}
function enumF(name: string, values: string[], def?: string): EntityField {
  return { name, type: "enum", label: titleCase(name), enumValues: values, defaultValue: def ?? values[0], inList: true };
}

function makeEntity(
  singular: string, icon: string, description: string, fields: EntityField[]
): Entity {
  const P = pascal(singular);
  const plural = pluralize(snake(singular));
  return {
    name: P,
    varName: camel(plural),
    table: plural,
    slug: kebab(plural),
    label: titleCase(singular),
    labelPlural: titleCase(plural.replace(/_/g, " ")),
    icon,
    description,
    fields: [ID, ...fields, CREATED, UPDATED],
  };
}

const USER_ENTITY = makeEntity("user", "👤", "Application user accounts and authentication", [
  f("email", "email", { required: true, searchable: true }),
  f("name", "text", { searchable: true }),
  f("password_hash", "text", { required: true, inList: false }),
  enumF("role", ["admin", "manager", "member", "viewer"], "member"),
  f("avatar_url", "url", { inList: false }),
  f("is_active", "boolean", { defaultValue: "true" }),
]);

// ─── Domain concept packs ────────────────────────────────────────────────────

interface DomainPack {
  id: string;
  keywords: RegExp;
  weight?: number;
  icon: string;
  build: () => { entities: Entity[]; metrics: Metric[]; features: FeatureId[]; hasTimeSeries?: boolean };
}

const PACKS: DomainPack[] = [
  // ── Capacity planning / forecasting / resource management ──
  {
    id: "capacity-forecast",
    weight: 3,
    icon: "📈",
    keywords: /capacity|forecast|utilization|utilisation|resource plan|headcount|workload|demand plan|supply plan|staffing|allocation|scenario/i,
    build: () => {
      const resources = makeEntity("resource", "🧰", "A person, team, machine, or asset that has finite capacity", [
        f("name", "text", { required: true, searchable: true }),
        enumF("resource_type", ["person", "team", "machine", "facility", "budget"], "person"),
        f("department", "text", { searchable: true }),
        f("capacity_units", "numeric", { required: true }),
        enumF("unit", ["hours", "fte", "units", "seats", "currency"], "hours"),
        f("cost_per_unit", "numeric"),
        f("skills", "jsonb", { inList: false }),
        f("is_active", "boolean", { defaultValue: "true" }),
      ]);
      const periods = makeEntity("period", "🗓️", "A planning window (week, month, quarter)", [
        f("label", "text", { required: true, searchable: true }),
        f("start_date", "date", { required: true }),
        f("end_date", "date", { required: true }),
        enumF("granularity", ["week", "month", "quarter", "year"], "month"),
        f("is_closed", "boolean", { defaultValue: "false" }),
      ]);
      const demand = makeEntity("demand", "📊", "Forecasted or committed demand for a period", [
        fk("period_id", "periods", { required: true }),
        f("driver", "text", { required: true, searchable: true }),
        f("forecast_units", "numeric", { required: true }),
        f("actual_units", "numeric"),
        f("confidence", "numeric"),
        enumF("scenario", ["baseline", "optimistic", "pessimistic"], "baseline"),
        f("notes", "longtext", { inList: false }),
      ]);
      const allocations = makeEntity("allocation", "🧮", "Assignment of resource capacity to demand in a period", [
        fk("resource_id", "resources", { required: true }),
        fk("period_id", "periods", { required: true }),
        fk("demand_id", "demands"),
        f("allocated_units", "numeric", { required: true }),
        f("utilization_pct", "numeric"),
        enumF("status", ["planned", "committed", "at_risk", "over_allocated"], "planned"),
      ]);
      const snapshots = makeEntity("capacity_snapshot", "📸", "Point-in-time roll-up used for trend charts and variance analysis", [
        fk("period_id", "periods", { required: true }),
        f("total_capacity", "numeric", { required: true }),
        f("total_allocated", "numeric", { required: true }),
        f("total_demand", "numeric"),
        f("available_units", "numeric"),
        f("utilization_pct", "numeric"),
        f("variance_pct", "numeric"),
        f("captured_at", "timestamp", { defaultValue: "now()" }),
      ]);
      return {
        entities: [USER_ENTITY, resources, periods, demand, allocations, snapshots],
        metrics: [
          { key: "total_capacity", label: "Total Capacity", entity: "capacity_snapshots", agg: "sum", field: "total_capacity", format: "number", icon: "🧰" },
          { key: "allocated", label: "Allocated", entity: "allocations", agg: "sum", field: "allocated_units", format: "number", icon: "🧮" },
          { key: "utilization", label: "Utilization", entity: "capacity_snapshots", agg: "avg", field: "utilization_pct", format: "percent", icon: "📈" },
          { key: "at_risk", label: "At-Risk Allocations", entity: "allocations", agg: "count", format: "number", icon: "⚠️" },
          { key: "forecast_variance", label: "Forecast Variance", entity: "capacity_snapshots", agg: "avg", field: "variance_pct", format: "percent", icon: "🎯" },
        ],
        features: ["auth", "charts", "forecasting", "reporting", "filters", "export", "roles", "scheduling"],
        hasTimeSeries: true,
      };
    },
  },

  // ── Inventory / warehouse ──
  {
    id: "inventory",
    icon: "📦",
    keywords: /inventor|warehouse|stock|sku|supply chain|procure|purchase order|reorder/i,
    build: () => {
      const products = makeEntity("product", "📦", "Stock keeping unit", [
        f("sku", "text", { required: true, searchable: true }),
        f("name", "text", { required: true, searchable: true }),
        f("description", "longtext", { inList: false }),
        f("category", "text", { searchable: true }),
        f("unit_cost", "numeric"),
        f("unit_price", "numeric"),
        f("reorder_point", "integer"),
      ]);
      const warehouses = makeEntity("warehouse", "🏭", "Physical storage location", [
        f("name", "text", { required: true, searchable: true }),
        f("code", "text", { required: true }),
        f("address", "text", { inList: false }),
        f("capacity_units", "integer"),
      ]);
      const stock = makeEntity("stock_level", "📊", "Quantity of a product at a warehouse", [
        fk("product_id", "products", { required: true }),
        fk("warehouse_id", "warehouses", { required: true }),
        f("quantity", "integer", { required: true, defaultValue: "0" }),
        f("reserved", "integer", { defaultValue: "0" }),
        enumF("status", ["in_stock", "low", "out_of_stock", "backordered"], "in_stock"),
      ]);
      const movements = makeEntity("movement", "🔁", "Inbound/outbound stock transaction", [
        fk("product_id", "products", { required: true }),
        fk("warehouse_id", "warehouses", { required: true }),
        enumF("movement_type", ["inbound", "outbound", "transfer", "adjustment"], "inbound"),
        f("quantity", "integer", { required: true }),
        f("reference", "text", { searchable: true }),
        f("occurred_at", "timestamp", { defaultValue: "now()" }),
      ]);
      return {
        entities: [USER_ENTITY, products, warehouses, stock, movements],
        metrics: [
          { key: "total_skus", label: "Total SKUs", entity: "products", agg: "count", format: "number", icon: "📦" },
          { key: "stock_value", label: "Stock Value", entity: "stock_levels", agg: "sum", field: "quantity", format: "currency", icon: "💰" },
          { key: "low_stock", label: "Low Stock Items", entity: "stock_levels", agg: "count", format: "number", icon: "⚠️" },
          { key: "movements", label: "Movements (30d)", entity: "movements", agg: "count", format: "number", icon: "🔁" },
        ],
        features: ["auth", "charts", "search", "filters", "export", "reporting", "roles"],
        hasTimeSeries: true,
      };
    },
  },

  // ── CRM / sales ──
  {
    id: "crm",
    icon: "🤝",
    keywords: /crm|lead|pipeline|deal|opportunit|customer relation|sales team|contact manage|prospect/i,
    build: () => {
      const contacts = makeEntity("contact", "👥", "A person at a company", [
        f("first_name", "text", { required: true, searchable: true }),
        f("last_name", "text", { required: true, searchable: true }),
        f("email", "email", { searchable: true }),
        f("phone", "text"),
        f("job_title", "text"),
      ]);
      const companies = makeEntity("company", "🏢", "Customer or prospect organization", [
        f("name", "text", { required: true, searchable: true }),
        f("domain", "url"),
        f("industry", "text", { searchable: true }),
        f("employee_count", "integer"),
        f("annual_revenue", "numeric"),
      ]);
      const deals = makeEntity("deal", "💼", "Sales opportunity moving through the pipeline", [
        f("title", "text", { required: true, searchable: true }),
        fk("company_id", "companies"),
        fk("owner_id", "users"),
        f("value", "numeric", { required: true }),
        enumF("stage", ["lead", "qualified", "proposal", "negotiation", "won", "lost"], "lead"),
        f("probability", "integer"),
        f("expected_close", "date"),
      ]);
      const activities = makeEntity("activity", "📝", "Call, email, or meeting logged against a deal", [
        fk("deal_id", "deals"),
        fk("contact_id", "contacts"),
        enumF("activity_type", ["call", "email", "meeting", "note"], "note"),
        f("subject", "text", { required: true, searchable: true }),
        f("body", "longtext", { inList: false }),
        f("occurred_at", "timestamp", { defaultValue: "now()" }),
      ]);
      return {
        entities: [USER_ENTITY, companies, contacts, deals, activities],
        metrics: [
          { key: "pipeline_value", label: "Pipeline Value", entity: "deals", agg: "sum", field: "value", format: "currency", icon: "💰" },
          { key: "open_deals", label: "Open Deals", entity: "deals", agg: "count", format: "number", icon: "💼" },
          { key: "win_rate", label: "Win Rate", entity: "deals", agg: "pct", format: "percent", icon: "🏆" },
          { key: "activities", label: "Activities (7d)", entity: "activities", agg: "count", format: "number", icon: "📝" },
        ],
        features: ["auth", "charts", "search", "filters", "kanban", "export", "roles", "notifications"],
        hasTimeSeries: true,
      };
    },
  },

  // ── Helpdesk / support ──
  {
    id: "helpdesk",
    icon: "🎫",
    keywords: /helpdesk|help desk|support ticket|service desk|incident|itsm|customer support|complaint/i,
    build: () => {
      const tickets = makeEntity("ticket", "🎫", "Support request from a customer", [
        f("subject", "text", { required: true, searchable: true }),
        f("body", "longtext", { inList: false }),
        enumF("status", ["open", "in_progress", "waiting", "resolved", "closed"], "open"),
        enumF("priority", ["low", "normal", "high", "urgent"], "normal"),
        fk("assignee_id", "users"),
        f("requester_email", "email", { searchable: true }),
        f("resolved_at", "timestamp"),
        f("first_response_mins", "integer"),
      ]);
      const replies = makeEntity("reply", "💬", "Message on a ticket thread", [
        fk("ticket_id", "tickets", { required: true }),
        fk("author_id", "users"),
        f("body", "longtext", { required: true, inList: false }),
        f("is_internal", "boolean", { defaultValue: "false" }),
      ]);
      const slas = makeEntity("sla_policy", "⏱️", "Response and resolution targets", [
        f("name", "text", { required: true, searchable: true }),
        enumF("applies_to_priority", ["low", "normal", "high", "urgent"], "normal"),
        f("response_target_mins", "integer", { required: true }),
        f("resolution_target_mins", "integer", { required: true }),
      ]);
      return {
        entities: [USER_ENTITY, tickets, replies, slas],
        metrics: [
          { key: "open_tickets", label: "Open Tickets", entity: "tickets", agg: "count", format: "number", icon: "🎫" },
          { key: "avg_response", label: "Avg First Response", entity: "tickets", agg: "avg", field: "first_response_mins", format: "duration", icon: "⏱️" },
          { key: "resolved_today", label: "Resolved Today", entity: "tickets", agg: "count", format: "number", icon: "✅" },
          { key: "sla_breach", label: "SLA Breaches", entity: "tickets", agg: "count", format: "number", icon: "🚨" },
        ],
        features: ["auth", "charts", "search", "filters", "comments", "notifications", "roles", "reporting"],
        hasTimeSeries: true,
      };
    },
  },

  // ── HR / people ──
  {
    id: "hr",
    icon: "🧑‍💼",
    keywords: /\bhr\b|human resource|employee|payroll|onboarding|recruit|applicant|leave request|time off|performance review/i,
    build: () => {
      const employees = makeEntity("employee", "🧑‍💼", "Staff member record", [
        f("full_name", "text", { required: true, searchable: true }),
        f("work_email", "email", { required: true, searchable: true }),
        f("department", "text", { searchable: true }),
        f("job_title", "text"),
        fk("manager_id", "employees"),
        f("hire_date", "date"),
        f("salary", "numeric", { inList: false }),
        enumF("employment_status", ["active", "on_leave", "terminated"], "active"),
      ]);
      const leave = makeEntity("leave_request", "🌴", "Time-off request and approval", [
        fk("employee_id", "employees", { required: true }),
        enumF("leave_type", ["vacation", "sick", "parental", "unpaid"], "vacation"),
        f("start_date", "date", { required: true }),
        f("end_date", "date", { required: true }),
        f("days", "numeric"),
        enumF("status", ["pending", "approved", "rejected"], "pending"),
      ]);
      const reviews = makeEntity("review", "⭐", "Performance review cycle entry", [
        fk("employee_id", "employees", { required: true }),
        fk("reviewer_id", "employees"),
        f("period_label", "text", { required: true }),
        f("rating", "integer"),
        f("feedback", "longtext", { inList: false }),
        enumF("status", ["draft", "submitted", "acknowledged"], "draft"),
      ]);
      return {
        entities: [USER_ENTITY, employees, leave, reviews],
        metrics: [
          { key: "headcount", label: "Headcount", entity: "employees", agg: "count", format: "number", icon: "🧑‍💼" },
          { key: "pending_leave", label: "Pending Leave", entity: "leave_requests", agg: "count", format: "number", icon: "🌴" },
          { key: "avg_rating", label: "Avg Review Rating", entity: "reviews", agg: "avg", field: "rating", format: "number", icon: "⭐" },
          { key: "attrition", label: "Attrition", entity: "employees", agg: "pct", format: "percent", icon: "📉" },
        ],
        features: ["auth", "charts", "search", "filters", "roles", "calendar", "export", "audit"],
        hasTimeSeries: true,
      };
    },
  },

  // ── Finance / budgeting / invoicing ──
  {
    id: "finance",
    icon: "💰",
    keywords: /budget|expense|invoic|accounting|financ|ledger|billing|transaction|revenue track|cash flow/i,
    build: () => {
      const accounts = makeEntity("account", "🏦", "Chart-of-accounts entry", [
        f("code", "text", { required: true, searchable: true }),
        f("name", "text", { required: true, searchable: true }),
        enumF("account_type", ["asset", "liability", "equity", "revenue", "expense"], "expense"),
        f("balance", "numeric", { defaultValue: "0" }),
      ]);
      const budgets = makeEntity("budget", "🎯", "Planned spend for a category and period", [
        f("name", "text", { required: true, searchable: true }),
        fk("account_id", "accounts"),
        f("period_label", "text", { required: true }),
        f("planned_amount", "numeric", { required: true }),
        f("actual_amount", "numeric", { defaultValue: "0" }),
        f("variance", "numeric"),
      ]);
      const transactions = makeEntity("transaction", "💳", "Individual financial movement", [
        fk("account_id", "accounts", { required: true }),
        f("description", "text", { required: true, searchable: true }),
        f("amount", "numeric", { required: true }),
        enumF("direction", ["debit", "credit"], "debit"),
        f("occurred_at", "timestamp", { defaultValue: "now()" }),
        f("reference", "text", { searchable: true }),
      ]);
      const invoices = makeEntity("invoice", "🧾", "Customer invoice", [
        f("number", "text", { required: true, searchable: true }),
        f("customer_name", "text", { required: true, searchable: true }),
        f("total", "numeric", { required: true }),
        enumF("status", ["draft", "sent", "paid", "overdue", "void"], "draft"),
        f("issued_on", "date"),
        f("due_on", "date"),
      ]);
      return {
        entities: [USER_ENTITY, accounts, budgets, transactions, invoices],
        metrics: [
          { key: "revenue", label: "Revenue", entity: "transactions", agg: "sum", field: "amount", format: "currency", icon: "💰" },
          { key: "budget_used", label: "Budget Used", entity: "budgets", agg: "pct", format: "percent", icon: "🎯" },
          { key: "outstanding", label: "Outstanding Invoices", entity: "invoices", agg: "sum", field: "total", format: "currency", icon: "🧾" },
          { key: "overdue", label: "Overdue", entity: "invoices", agg: "count", format: "number", icon: "⚠️" },
        ],
        features: ["auth", "charts", "export", "filters", "reporting", "roles", "audit", "payments"],
        hasTimeSeries: true,
      };
    },
  },

  // ── Healthcare ──
  {
    id: "healthcare",
    icon: "🏥",
    keywords: /patient|clinic|hospital|medical|health record|appointment schedul|prescription|diagnos|doctor/i,
    build: () => {
      const patients = makeEntity("patient", "🧑‍🦽", "Patient demographic and contact record", [
        f("full_name", "text", { required: true, searchable: true }),
        f("date_of_birth", "date"),
        enumF("sex", ["female", "male", "other", "undisclosed"], "undisclosed"),
        f("phone", "text"),
        f("email", "email", { searchable: true }),
        f("mrn", "text", { searchable: true }),
      ]);
      const providers = makeEntity("provider", "🩺", "Clinician or practitioner", [
        f("full_name", "text", { required: true, searchable: true }),
        f("specialty", "text", { searchable: true }),
        f("license_number", "text"),
      ]);
      const appointments = makeEntity("appointment", "📅", "Scheduled patient visit", [
        fk("patient_id", "patients", { required: true }),
        fk("provider_id", "providers", { required: true }),
        f("scheduled_at", "timestamp", { required: true }),
        f("duration_mins", "integer", { defaultValue: "30" }),
        enumF("status", ["scheduled", "checked_in", "completed", "no_show", "cancelled"], "scheduled"),
        f("reason", "text", { searchable: true }),
      ]);
      const encounters = makeEntity("encounter", "📋", "Clinical note from a visit", [
        fk("appointment_id", "appointments"),
        fk("patient_id", "patients", { required: true }),
        f("chief_complaint", "text", { searchable: true }),
        f("notes", "longtext", { inList: false }),
        f("diagnosis_code", "text"),
      ]);
      return {
        entities: [USER_ENTITY, patients, providers, appointments, encounters],
        metrics: [
          { key: "patients", label: "Active Patients", entity: "patients", agg: "count", format: "number", icon: "🧑‍🦽" },
          { key: "today_appts", label: "Appointments Today", entity: "appointments", agg: "count", format: "number", icon: "📅" },
          { key: "no_show", label: "No-Show Rate", entity: "appointments", agg: "pct", format: "percent", icon: "🚫" },
          { key: "avg_duration", label: "Avg Visit Length", entity: "appointments", agg: "avg", field: "duration_mins", format: "duration", icon: "⏱️" },
        ],
        features: ["auth", "calendar", "search", "filters", "roles", "audit", "scheduling", "reporting"],
        hasTimeSeries: true,
      };
    },
  },

  // ── Education / LMS ──
  {
    id: "education",
    icon: "🎓",
    keywords: /course|student|lms|learning|school|curriculum|enrol|grade book|classroom|lesson|quiz/i,
    build: () => {
      const courses = makeEntity("course", "📚", "A course offered on the platform", [
        f("title", "text", { required: true, searchable: true }),
        f("code", "text", { searchable: true }),
        f("description", "longtext", { inList: false }),
        fk("instructor_id", "users"),
        f("credits", "integer"),
        enumF("status", ["draft", "published", "archived"], "draft"),
      ]);
      const students = makeEntity("student", "🧑‍🎓", "Learner profile", [
        f("full_name", "text", { required: true, searchable: true }),
        f("email", "email", { required: true, searchable: true }),
        f("cohort", "text", { searchable: true }),
        f("enrolled_on", "date"),
      ]);
      const enrollments = makeEntity("enrollment", "📝", "Student registered in a course", [
        fk("student_id", "students", { required: true }),
        fk("course_id", "courses", { required: true }),
        enumF("status", ["active", "completed", "dropped"], "active"),
        f("progress_pct", "numeric", { defaultValue: "0" }),
        f("final_grade", "numeric"),
      ]);
      const lessons = makeEntity("lesson", "🎬", "Unit of content inside a course", [
        fk("course_id", "courses", { required: true }),
        f("title", "text", { required: true, searchable: true }),
        f("content", "longtext", { inList: false }),
        f("sort_order", "integer", { defaultValue: "0" }),
        f("duration_mins", "integer"),
      ]);
      return {
        entities: [USER_ENTITY, courses, students, enrollments, lessons],
        metrics: [
          { key: "active_students", label: "Active Students", entity: "students", agg: "count", format: "number", icon: "🧑‍🎓" },
          { key: "courses", label: "Published Courses", entity: "courses", agg: "count", format: "number", icon: "📚" },
          { key: "completion", label: "Completion Rate", entity: "enrollments", agg: "pct", format: "percent", icon: "🏁" },
          { key: "avg_grade", label: "Average Grade", entity: "enrollments", agg: "avg", field: "final_grade", format: "number", icon: "⭐" },
        ],
        features: ["auth", "charts", "search", "filters", "upload", "roles", "reporting"],
        hasTimeSeries: true,
      };
    },
  },

  // ── Logistics / fleet ──
  {
    id: "logistics",
    icon: "🚚",
    keywords: /logistic|shipment|fleet|delivery|route plan|freight|dispatch|courier|tracking number/i,
    build: () => {
      const vehicles = makeEntity("vehicle", "🚚", "Fleet vehicle", [
        f("registration", "text", { required: true, searchable: true }),
        enumF("vehicle_type", ["van", "truck", "bike", "car"], "van"),
        f("capacity_kg", "numeric"),
        enumF("status", ["available", "in_transit", "maintenance"], "available"),
      ]);
      const drivers = makeEntity("driver", "🧑‍✈️", "Driver assigned to vehicles", [
        f("full_name", "text", { required: true, searchable: true }),
        f("license_number", "text"),
        f("phone", "text"),
        f("is_available", "boolean", { defaultValue: "true" }),
      ]);
      const shipments = makeEntity("shipment", "📦", "Consignment moving from origin to destination", [
        f("tracking_number", "text", { required: true, searchable: true }),
        f("origin", "text", { required: true, searchable: true }),
        f("destination", "text", { required: true, searchable: true }),
        fk("vehicle_id", "vehicles"),
        fk("driver_id", "drivers"),
        f("weight_kg", "numeric"),
        enumF("status", ["pending", "picked_up", "in_transit", "delivered", "failed"], "pending"),
        f("eta", "timestamp"),
        f("delivered_at", "timestamp"),
      ]);
      const routes = makeEntity("route", "🗺️", "Planned multi-stop route", [
        f("name", "text", { required: true, searchable: true }),
        fk("vehicle_id", "vehicles"),
        f("stops", "jsonb", { inList: false }),
        f("distance_km", "numeric"),
        f("planned_for", "date"),
      ]);
      return {
        entities: [USER_ENTITY, vehicles, drivers, shipments, routes],
        metrics: [
          { key: "in_transit", label: "In Transit", entity: "shipments", agg: "count", format: "number", icon: "🚚" },
          { key: "on_time", label: "On-Time Rate", entity: "shipments", agg: "pct", format: "percent", icon: "⏱️" },
          { key: "fleet_util", label: "Fleet Utilization", entity: "vehicles", agg: "pct", format: "percent", icon: "📈" },
          { key: "distance", label: "Distance (km)", entity: "routes", agg: "sum", field: "distance_km", format: "number", icon: "🗺️" },
        ],
        features: ["auth", "charts", "search", "filters", "map", "realtime", "reporting", "roles"],
        hasTimeSeries: true,
      };
    },
  },

  // ── Real estate ──
  {
    id: "realestate",
    icon: "🏠",
    keywords: /real estate|propert|listing|rental|tenant|lease|landlord|apartment/i,
    build: () => {
      const properties = makeEntity("property", "🏠", "Property listing", [
        f("title", "text", { required: true, searchable: true }),
        f("address", "text", { required: true, searchable: true }),
        enumF("property_type", ["apartment", "house", "condo", "commercial", "land"], "apartment"),
        f("bedrooms", "integer"),
        f("bathrooms", "numeric"),
        f("area_sqm", "numeric"),
        f("price", "numeric", { required: true }),
        enumF("status", ["available", "under_offer", "sold", "rented"], "available"),
      ]);
      const tenants = makeEntity("tenant", "🧑", "Renter / occupant", [
        f("full_name", "text", { required: true, searchable: true }),
        f("email", "email", { searchable: true }),
        f("phone", "text"),
      ]);
      const leases = makeEntity("lease", "📄", "Rental agreement", [
        fk("property_id", "properties", { required: true }),
        fk("tenant_id", "tenants", { required: true }),
        f("monthly_rent", "numeric", { required: true }),
        f("start_date", "date", { required: true }),
        f("end_date", "date"),
        enumF("status", ["active", "expiring", "ended"], "active"),
      ]);
      return {
        entities: [USER_ENTITY, properties, tenants, leases],
        metrics: [
          { key: "listings", label: "Active Listings", entity: "properties", agg: "count", format: "number", icon: "🏠" },
          { key: "occupancy", label: "Occupancy", entity: "leases", agg: "pct", format: "percent", icon: "🔑" },
          { key: "rent_roll", label: "Monthly Rent Roll", entity: "leases", agg: "sum", field: "monthly_rent", format: "currency", icon: "💰" },
          { key: "avg_price", label: "Avg Price", entity: "properties", agg: "avg", field: "price", format: "currency", icon: "📈" },
        ],
        features: ["auth", "charts", "search", "filters", "upload", "map", "export"],
        hasTimeSeries: false,
      };
    },
  },

  // ── IoT / telemetry / monitoring ──
  {
    id: "iot",
    icon: "📡",
    keywords: /iot|sensor|telemetry|device monitor|iot dashboard|time series|observability|metric collect/i,
    build: () => {
      const devices = makeEntity("device", "📡", "Registered device or sensor", [
        f("name", "text", { required: true, searchable: true }),
        f("serial", "text", { required: true, searchable: true }),
        enumF("device_type", ["sensor", "gateway", "actuator", "camera"], "sensor"),
        f("location", "text", { searchable: true }),
        enumF("status", ["online", "offline", "degraded", "maintenance"], "online"),
        f("last_seen_at", "timestamp"),
      ]);
      const readings = makeEntity("reading", "📈", "Time-series measurement from a device", [
        fk("device_id", "devices", { required: true }),
        f("metric", "text", { required: true, searchable: true }),
        f("value", "numeric", { required: true }),
        f("unit", "text"),
        f("recorded_at", "timestamp", { required: true, defaultValue: "now()" }),
      ]);
      const alerts = makeEntity("alert", "🚨", "Threshold breach or anomaly", [
        fk("device_id", "devices", { required: true }),
        f("message", "text", { required: true, searchable: true }),
        enumF("severity", ["info", "warning", "critical"], "warning"),
        enumF("status", ["open", "acknowledged", "resolved"], "open"),
        f("triggered_at", "timestamp", { defaultValue: "now()" }),
      ]);
      return {
        entities: [USER_ENTITY, devices, readings, alerts],
        metrics: [
          { key: "devices_online", label: "Devices Online", entity: "devices", agg: "count", format: "number", icon: "📡" },
          { key: "readings", label: "Readings (24h)", entity: "readings", agg: "count", format: "number", icon: "📈" },
          { key: "open_alerts", label: "Open Alerts", entity: "alerts", agg: "count", format: "number", icon: "🚨" },
          { key: "uptime", label: "Fleet Uptime", entity: "devices", agg: "pct", format: "percent", icon: "✅" },
        ],
        features: ["auth", "charts", "realtime", "notifications", "filters", "reporting"],
        hasTimeSeries: true,
      };
    },
  },

  // ── Events / booking ──
  {
    id: "events",
    icon: "🎟️",
    keywords: /event|booking|reservation|ticketing|venue|conference|rsvp|attendee|appointment book/i,
    build: () => {
      const events = makeEntity("event", "🎟️", "Scheduled event with capacity", [
        f("title", "text", { required: true, searchable: true }),
        f("description", "longtext", { inList: false }),
        f("venue", "text", { searchable: true }),
        f("starts_at", "timestamp", { required: true }),
        f("ends_at", "timestamp"),
        f("capacity", "integer", { required: true }),
        f("price", "numeric"),
        enumF("status", ["draft", "published", "sold_out", "cancelled", "completed"], "draft"),
      ]);
      const attendees = makeEntity("attendee", "🧑", "Person attending an event", [
        f("full_name", "text", { required: true, searchable: true }),
        f("email", "email", { required: true, searchable: true }),
        f("phone", "text"),
      ]);
      const bookings = makeEntity("booking", "✅", "Reservation linking attendee to event", [
        fk("event_id", "events", { required: true }),
        fk("attendee_id", "attendees", { required: true }),
        f("seats", "integer", { defaultValue: "1" }),
        enumF("status", ["reserved", "confirmed", "checked_in", "cancelled"], "reserved"),
        f("amount_paid", "numeric"),
        f("reference", "text", { searchable: true }),
      ]);
      return {
        entities: [USER_ENTITY, events, attendees, bookings],
        metrics: [
          { key: "upcoming", label: "Upcoming Events", entity: "events", agg: "count", format: "number", icon: "🎟️" },
          { key: "bookings", label: "Total Bookings", entity: "bookings", agg: "count", format: "number", icon: "✅" },
          { key: "fill_rate", label: "Fill Rate", entity: "events", agg: "pct", format: "percent", icon: "📈" },
          { key: "revenue", label: "Revenue", entity: "bookings", agg: "sum", field: "amount_paid", format: "currency", icon: "💰" },
        ],
        features: ["auth", "calendar", "charts", "search", "payments", "notifications", "export"],
        hasTimeSeries: true,
      };
    },
  },

  // ── Project / task management ──
  {
    id: "project-mgmt",
    icon: "✅",
    keywords: /task manage|kanban|project manage|sprint|backlog|todo|issue track|scrum|agile board/i,
    build: () => {
      const projectsE = makeEntity("project", "📁", "Container for tasks", [
        f("name", "text", { required: true, searchable: true }),
        f("description", "longtext", { inList: false }),
        fk("owner_id", "users"),
        enumF("status", ["planning", "active", "on_hold", "completed"], "planning"),
        f("due_date", "date"),
      ]);
      const boards = makeEntity("board_column", "🗂️", "Kanban column", [
        fk("project_id", "projects"),
        f("name", "text", { required: true }),
        f("sort_order", "integer", { defaultValue: "0" }),
        f("wip_limit", "integer"),
      ]);
      const taskE = makeEntity("task", "✅", "Unit of work", [
        fk("project_id", "projects", { required: true }),
        fk("column_id", "board_columns"),
        fk("assignee_id", "users"),
        f("title", "text", { required: true, searchable: true }),
        f("description", "longtext", { inList: false }),
        enumF("priority", ["low", "medium", "high", "urgent"], "medium"),
        enumF("status", ["todo", "in_progress", "review", "done"], "todo"),
        f("estimate_hours", "numeric"),
        f("due_date", "date"),
      ]);
      const comments = makeEntity("comment", "💬", "Discussion on a task", [
        fk("task_id", "tasks", { required: true }),
        fk("author_id", "users"),
        f("body", "longtext", { required: true, inList: false }),
      ]);
      return {
        entities: [USER_ENTITY, projectsE, boards, taskE, comments],
        metrics: [
          { key: "open_tasks", label: "Open Tasks", entity: "tasks", agg: "count", format: "number", icon: "✅" },
          { key: "velocity", label: "Completed (7d)", entity: "tasks", agg: "count", format: "number", icon: "🚀" },
          { key: "overdue", label: "Overdue", entity: "tasks", agg: "count", format: "number", icon: "⚠️" },
          { key: "active_projects", label: "Active Projects", entity: "projects", agg: "count", format: "number", icon: "📁" },
        ],
        features: ["auth", "kanban", "search", "filters", "comments", "tags", "notifications", "charts"],
        hasTimeSeries: true,
      };
    },
  },

  // ── Content / blog / CMS ──
  {
    id: "cms",
    icon: "📝",
    keywords: /blog|cms|article|content manage|publish|newsletter|editorial|post/i,
    build: () => {
      const posts = makeEntity("post", "📝", "Article or blog post", [
        f("title", "text", { required: true, searchable: true }),
        f("slug", "text", { required: true, searchable: true }),
        f("excerpt", "text"),
        f("body", "longtext", { inList: false }),
        fk("author_id", "users"),
        enumF("status", ["draft", "review", "published", "archived"], "draft"),
        f("published_at", "timestamp"),
        f("view_count", "integer", { defaultValue: "0" }),
      ]);
      const categories = makeEntity("category", "🗂️", "Taxonomy for posts", [
        f("name", "text", { required: true, searchable: true }),
        f("slug", "text", { required: true }),
        f("description", "text", { inList: false }),
      ]);
      const comments = makeEntity("comment", "💬", "Reader comment", [
        fk("post_id", "posts", { required: true }),
        f("author_name", "text", { required: true, searchable: true }),
        f("author_email", "email"),
        f("body", "longtext", { required: true, inList: false }),
        enumF("status", ["pending", "approved", "spam"], "pending"),
      ]);
      return {
        entities: [USER_ENTITY, posts, categories, comments],
        metrics: [
          { key: "published", label: "Published Posts", entity: "posts", agg: "count", format: "number", icon: "📝" },
          { key: "views", label: "Total Views", entity: "posts", agg: "sum", field: "view_count", format: "number", icon: "👁️" },
          { key: "pending_comments", label: "Pending Comments", entity: "comments", agg: "count", format: "number", icon: "💬" },
          { key: "drafts", label: "Drafts", entity: "posts", agg: "count", format: "number", icon: "✏️" },
        ],
        features: ["auth", "search", "filters", "upload", "comments", "tags", "roles", "charts"],
        hasTimeSeries: true,
      };
    },
  },

  // ── E-commerce ──
  {
    id: "ecommerce",
    icon: "🛍️",
    keywords: /e-?commerce|online store|shopping cart|checkout|storefront|catalog|order manage|marketplace/i,
    build: () => {
      const products = makeEntity("product", "🛍️", "Sellable item", [
        f("name", "text", { required: true, searchable: true }),
        f("sku", "text", { searchable: true }),
        f("description", "longtext", { inList: false }),
        f("price", "numeric", { required: true }),
        f("compare_at_price", "numeric"),
        f("stock", "integer", { defaultValue: "0" }),
        f("category", "text", { searchable: true }),
        f("image_url", "url", { inList: false }),
        enumF("status", ["draft", "active", "archived"], "draft"),
      ]);
      const customers = makeEntity("customer", "🧑", "Shopper account", [
        f("email", "email", { required: true, searchable: true }),
        f("full_name", "text", { searchable: true }),
        f("phone", "text"),
        f("total_spent", "numeric", { defaultValue: "0" }),
      ]);
      const orders = makeEntity("order", "🧾", "Purchase order", [
        f("number", "text", { required: true, searchable: true }),
        fk("customer_id", "customers"),
        f("subtotal", "numeric", { required: true }),
        f("shipping", "numeric", { defaultValue: "0" }),
        f("total", "numeric", { required: true }),
        enumF("status", ["pending", "paid", "fulfilled", "shipped", "delivered", "refunded", "cancelled"], "pending"),
        f("placed_at", "timestamp", { defaultValue: "now()" }),
      ]);
      const orderItems = makeEntity("order_item", "📦", "Line item inside an order", [
        fk("order_id", "orders", { required: true }),
        fk("product_id", "products", { required: true }),
        f("quantity", "integer", { required: true, defaultValue: "1" }),
        f("unit_price", "numeric", { required: true }),
        f("line_total", "numeric"),
      ]);
      return {
        entities: [USER_ENTITY, products, customers, orders, orderItems],
        metrics: [
          { key: "revenue", label: "Revenue", entity: "orders", agg: "sum", field: "total", format: "currency", icon: "💰" },
          { key: "orders", label: "Orders", entity: "orders", agg: "count", format: "number", icon: "🧾" },
          { key: "aov", label: "Avg Order Value", entity: "orders", agg: "avg", field: "total", format: "currency", icon: "📈" },
          { key: "low_stock", label: "Low Stock", entity: "products", agg: "count", format: "number", icon: "⚠️" },
        ],
        features: ["auth", "charts", "search", "filters", "payments", "upload", "export", "notifications"],
        hasTimeSeries: true,
      };
    },
  },

  // ── Analytics dashboard ──
  {
    id: "analytics",
    icon: "📊",
    keywords: /analytic|dashboard|kpi|business intelligence|\bbi\b|metric dashboard|report dashboard|insight/i,
    build: () => {
      const sources = makeEntity("data_source", "🔌", "Connected upstream data source", [
        f("name", "text", { required: true, searchable: true }),
        enumF("source_type", ["postgres", "api", "csv", "webhook"], "api"),
        f("connection_ref", "text", { inList: false }),
        enumF("sync_status", ["idle", "syncing", "error"], "idle"),
        f("last_synced_at", "timestamp"),
      ]);
      const metricsE = makeEntity("metric", "📊", "Tracked KPI definition", [
        f("key", "text", { required: true, searchable: true }),
        f("label", "text", { required: true, searchable: true }),
        fk("source_id", "data_sources"),
        enumF("unit", ["count", "currency", "percent", "duration"], "count"),
        f("target_value", "numeric"),
      ]);
      const datapoints = makeEntity("datapoint", "📈", "Time-series value for a metric", [
        fk("metric_id", "metrics", { required: true }),
        f("value", "numeric", { required: true }),
        f("dimension", "text", { searchable: true }),
        f("recorded_at", "timestamp", { required: true, defaultValue: "now()" }),
      ]);
      const dashboards = makeEntity("dashboard", "🖥️", "Saved collection of widgets", [
        f("name", "text", { required: true, searchable: true }),
        fk("owner_id", "users"),
        f("layout", "jsonb", { inList: false }),
        f("is_public", "boolean", { defaultValue: "false" }),
      ]);
      return {
        entities: [USER_ENTITY, sources, metricsE, datapoints, dashboards],
        metrics: [
          { key: "tracked_metrics", label: "Tracked Metrics", entity: "metrics", agg: "count", format: "number", icon: "📊" },
          { key: "datapoints", label: "Datapoints", entity: "datapoints", agg: "count", format: "number", icon: "📈" },
          { key: "sources", label: "Connected Sources", entity: "data_sources", agg: "count", format: "number", icon: "🔌" },
          { key: "target_hit", label: "Targets Met", entity: "metrics", agg: "pct", format: "percent", icon: "🎯" },
        ],
        features: ["auth", "charts", "filters", "export", "realtime", "reporting", "roles"],
        hasTimeSeries: true,
      };
    },
  },

  // ── AI chat ──
  {
    id: "ai-chat",
    icon: "🤖",
    keywords: /chatbot|ai chat|llm app|conversation|assistant app|prompt librar|rag\b/i,
    build: () => {
      const conversations = makeEntity("conversation", "💬", "Chat thread", [
        f("title", "text", { required: true, searchable: true }),
        fk("user_id", "users"),
        f("model", "text", { defaultValue: "'gpt-4o-mini'" }),
        f("system_prompt", "longtext", { inList: false }),
        f("token_count", "integer", { defaultValue: "0" }),
        f("is_archived", "boolean", { defaultValue: "false" }),
      ]);
      const messages = makeEntity("message", "✉️", "Single turn in a conversation", [
        fk("conversation_id", "conversations", { required: true }),
        enumF("role", ["system", "user", "assistant", "tool"], "user"),
        f("content", "longtext", { required: true, inList: false }),
        f("tokens", "integer"),
        f("latency_ms", "integer"),
      ]);
      const prompts = makeEntity("prompt_template", "📋", "Reusable prompt preset", [
        f("name", "text", { required: true, searchable: true }),
        f("body", "longtext", { required: true, inList: false }),
        f("category", "text", { searchable: true }),
        f("use_count", "integer", { defaultValue: "0" }),
      ]);
      return {
        entities: [USER_ENTITY, conversations, messages, prompts],
        metrics: [
          { key: "conversations", label: "Conversations", entity: "conversations", agg: "count", format: "number", icon: "💬" },
          { key: "messages", label: "Messages", entity: "messages", agg: "count", format: "number", icon: "✉️" },
          { key: "tokens", label: "Tokens Used", entity: "conversations", agg: "sum", field: "token_count", format: "number", icon: "🔢" },
          { key: "latency", label: "Avg Latency", entity: "messages", agg: "avg", field: "latency_ms", format: "duration", icon: "⏱️" },
        ],
        features: ["auth", "chat", "realtime", "search", "charts", "export"],
        hasTimeSeries: true,
      };
    },
  },

  // ── Restaurant / hospitality ──
  {
    id: "restaurant",
    icon: "🍽️",
    keywords: /restaurant|menu|kitchen|food order|dining|cafe|pos system|table reserv/i,
    build: () => {
      const menuItems = makeEntity("menu_item", "🍽️", "Dish available on the menu", [
        f("name", "text", { required: true, searchable: true }),
        f("description", "text", { inList: false }),
        f("category", "text", { searchable: true }),
        f("price", "numeric", { required: true }),
        f("is_available", "boolean", { defaultValue: "true" }),
        f("prep_time_mins", "integer"),
      ]);
      const tablesE = makeEntity("dining_table", "🪑", "Physical table in the venue", [
        f("label", "text", { required: true, searchable: true }),
        f("seats", "integer", { required: true }),
        enumF("status", ["free", "occupied", "reserved", "cleaning"], "free"),
      ]);
      const orders = makeEntity("order", "🧾", "Customer order", [
        fk("table_id", "dining_tables"),
        f("order_number", "text", { required: true, searchable: true }),
        f("total", "numeric", { required: true, defaultValue: "0" }),
        enumF("status", ["open", "preparing", "served", "paid", "cancelled"], "open"),
        f("placed_at", "timestamp", { defaultValue: "now()" }),
      ]);
      const orderLines = makeEntity("order_line", "📋", "Item within an order", [
        fk("order_id", "orders", { required: true }),
        fk("menu_item_id", "menu_items", { required: true }),
        f("quantity", "integer", { required: true, defaultValue: "1" }),
        f("notes", "text"),
      ]);
      return {
        entities: [USER_ENTITY, menuItems, tablesE, orders, orderLines],
        metrics: [
          { key: "open_orders", label: "Open Orders", entity: "orders", agg: "count", format: "number", icon: "🧾" },
          { key: "revenue", label: "Revenue Today", entity: "orders", agg: "sum", field: "total", format: "currency", icon: "💰" },
          { key: "table_util", label: "Table Utilization", entity: "dining_tables", agg: "pct", format: "percent", icon: "🪑" },
          { key: "avg_ticket", label: "Avg Ticket", entity: "orders", agg: "avg", field: "total", format: "currency", icon: "📈" },
        ],
        features: ["auth", "realtime", "charts", "search", "payments", "roles"],
        hasTimeSeries: true,
      };
    },
  },

  // ── Fitness / health tracking ──
  {
    id: "fitness",
    icon: "🏋️",
    keywords: /fitness|workout|gym|exercise|training plan|nutrition|calorie|habit track/i,
    build: () => {
      const exercises = makeEntity("exercise", "🏋️", "Exercise definition", [
        f("name", "text", { required: true, searchable: true }),
        f("muscle_group", "text", { searchable: true }),
        enumF("difficulty", ["beginner", "intermediate", "advanced"], "beginner"),
        f("equipment", "text"),
      ]);
      const workouts = makeEntity("workout", "📅", "A training session", [
        fk("user_id", "users"),
        f("name", "text", { required: true, searchable: true }),
        f("performed_on", "date", { required: true }),
        f("duration_mins", "integer"),
        f("calories_burned", "integer"),
        f("notes", "text", { inList: false }),
      ]);
      const sets = makeEntity("exercise_set", "🔢", "Individual set logged in a workout", [
        fk("workout_id", "workouts", { required: true }),
        fk("exercise_id", "exercises", { required: true }),
        f("reps", "integer"),
        f("weight_kg", "numeric"),
        f("set_number", "integer", { defaultValue: "1" }),
      ]);
      const goals = makeEntity("goal", "🎯", "Target the user is working toward", [
        fk("user_id", "users"),
        f("title", "text", { required: true, searchable: true }),
        f("target_value", "numeric"),
        f("current_value", "numeric", { defaultValue: "0" }),
        f("target_date", "date"),
        enumF("status", ["active", "achieved", "abandoned"], "active"),
      ]);
      return {
        entities: [USER_ENTITY, exercises, workouts, sets, goals],
        metrics: [
          { key: "workouts", label: "Workouts (30d)", entity: "workouts", agg: "count", format: "number", icon: "🏋️" },
          { key: "volume", label: "Total Volume", entity: "exercise_sets", agg: "sum", field: "weight_kg", format: "number", icon: "🔢" },
          { key: "calories", label: "Calories Burned", entity: "workouts", agg: "sum", field: "calories_burned", format: "number", icon: "🔥" },
          { key: "goal_progress", label: "Goal Progress", entity: "goals", agg: "pct", format: "percent", icon: "🎯" },
        ],
        features: ["auth", "charts", "calendar", "search", "reporting"],
        hasTimeSeries: true,
      };
    },
  },
];

// ─── Feature keyword detection (applies on top of pack features) ─────────────

const FEATURE_HINTS: Array<{ id: FeatureId; re: RegExp }> = [
  { id: "auth",          re: /auth|login|sign.?in|sign.?up|user account|permission|sso|jwt/i },
  { id: "roles",         re: /role|permission|rbac|admin panel|access control|multi.?tenant/i },
  { id: "charts",        re: /chart|graph|visuali|trend|analytic|dashboard|report/i },
  { id: "search",        re: /search|find|lookup|query|filter/i },
  { id: "filters",       re: /filter|facet|sort|segment/i },
  { id: "export",        re: /export|csv|excel|download|pdf|report generat/i },
  { id: "upload",        re: /upload|attach|file|image|photo|document|media/i },
  { id: "realtime",      re: /real.?time|live|websocket|streaming|push|instant/i },
  { id: "payments",      re: /payment|stripe|checkout|billing|subscription|invoice|paypal/i },
  { id: "notifications", re: /notif|alert|email send|reminder|slack|webhook|sms/i },
  { id: "calendar",      re: /calendar|schedul|appointment|booking|availability|timeslot/i },
  { id: "kanban",        re: /kanban|board|drag.?and.?drop|swimlane|column/i },
  { id: "comments",      re: /comment|discussion|thread|reply|note/i },
  { id: "tags",          re: /tag|label|categor|taxonomy/i },
  { id: "audit",         re: /audit|history|changelog|activity log|compliance|track change/i },
  { id: "forecasting",   re: /forecast|predict|projection|scenario|what.?if|trend analysis|capacity plan/i },
  { id: "scheduling",    re: /schedul|allocat|assign|roster|shift|plan/i },
  { id: "reporting",     re: /report|summary|insight|kpi|metric|analysis/i },
  { id: "map",           re: /map|geo|location|route|address|gps|latitude/i },
  { id: "chat",          re: /chat|messag|conversation|llm|ai assistant/i },
];

// ─── Generic entity extraction (for prompts that match no pack) ──────────────

const STOPWORDS = new Set([
  "the","a","an","and","or","for","with","that","this","app","application","system","platform",
  "website","site","tool","build","create","make","manage","management","track","tracking","simple",
  "web","full","stack","fullstack","need","want","should","can","will","allow","user","users",
  "page","pages","dashboard","data","using","use","support","feature","features","able","where",
  "which","from","into","their","them","also","each","have","has","new","view","list","add",
]);

function extractGenericEntities(prompt: string): Entity[] {
  const found = new Map<string, number>();

  // "manage X", "track X", "list of X", "X management", "store X"
  const patterns = [
    /(?:manage|track|store|record|catalog|list|register|log)\s+(?:the\s+|all\s+|their\s+)?([a-z][a-z\s]{2,28}?)(?:\s+(?:and|with|for|that|to|in|by|from)\b|[.,]|$)/gi,
    /\b([a-z][a-z]{2,20})\s+(?:management|tracker|tracking|registry|catalog|directory)\b/gi,
    /\blist\s+of\s+([a-z][a-z\s]{2,24}?)(?:\s+(?:and|with|for)\b|[.,]|$)/gi,
  ];

  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(prompt)) !== null) {
      const raw = m[1].trim().toLowerCase();
      for (const word of raw.split(/\s+/)) {
        const clean = word.replace(/[^a-z]/g, "");
        if (clean.length >= 3 && !STOPWORDS.has(clean)) {
          found.set(clean, (found.get(clean) ?? 0) + 1);
        }
      }
    }
  }

  // Fallback: pick the most meaningful nouns in the prompt
  if (found.size === 0) {
    for (const word of prompt.toLowerCase().split(/[^a-z]+/)) {
      if (word.length >= 4 && !STOPWORDS.has(word)) {
        found.set(word, (found.get(word) ?? 0) + 1);
      }
    }
  }

  const top = [...found.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map((e) => e[0]);
  if (top.length === 0) top.push("record");

  return top.map((noun) =>
    makeEntity(noun, "📄", `Core ${noun} record inferred from the requirements`, [
      f("name", "text", { required: true, searchable: true }),
      f("description", "longtext", { inList: false }),
      enumF("status", ["draft", "active", "archived"], "active"),
      f("owner", "text", { searchable: true }),
      f("amount", "numeric"),
      f("due_date", "date"),
    ])
  );
}

// ─── Name inference ──────────────────────────────────────────────────────────

function inferAppName(prompt: string, fallback: string): string {
  const quoted = prompt.match(/["“']([A-Za-z0-9][A-Za-z0-9 \-&]{2,40})["”']/);
  if (quoted) return titleCase(quoted[1]);
  const called = prompt.match(/\b(?:called|named)\s+([A-Za-z0-9][A-Za-z0-9 \-&]{2,32})/i);
  if (called) return titleCase(called[1].trim());
  return fallback;
}

// ─── Main inference entry point ──────────────────────────────────────────────

export function inferAppSpec(prompt: string, providedName?: string): AppSpec {
  const text = prompt || "";

  // Score each pack by keyword hits
  let best: DomainPack | null = null;
  let bestScore = 0;
  for (const pack of PACKS) {
    const matches = text.match(new RegExp(pack.keywords.source, "gi"));
    const score = (matches?.length ?? 0) * (pack.weight ?? 1);
    if (score > bestScore) { bestScore = score; best = pack; }
  }

  let entities: Entity[];
  let metrics: Metric[];
  let features: FeatureId[];
  let domain: string;
  let hasTimeSeries: boolean;

  if (best && bestScore > 0) {
    const built = best.build();
    entities = built.entities;
    metrics = built.metrics;
    features = built.features;
    domain = best.id;
    hasTimeSeries = built.hasTimeSeries ?? false;
  } else {
    // Universal fallback — infer entities straight from the prompt
    const generic = extractGenericEntities(text);
    entities = [USER_ENTITY, ...generic];
    const primary = generic[0];
    metrics = [
      { key: "total", label: `Total ${primary.labelPlural}`, entity: primary.table, agg: "count", format: "number", icon: "📄" },
      { key: "active", label: "Active", entity: primary.table, agg: "count", format: "number", icon: "✅" },
      { key: "users", label: "Users", entity: "users", agg: "count", format: "number", icon: "👤" },
      { key: "value", label: "Total Value", entity: primary.table, agg: "sum", field: "amount", format: "currency", icon: "💰" },
    ];
    features = ["auth", "search", "filters", "charts", "export"];
    domain = "custom";
    hasTimeSeries = false;
  }

  // Layer on features detected directly in the prompt
  for (const hint of FEATURE_HINTS) {
    if (hint.re.test(text) && !features.includes(hint.id)) features.push(hint.id);
  }

  const primaryEntity = entities.find((e) => e.table !== "users")?.table ?? entities[0].table;

  return {
    name: inferAppName(text, providedName || "Generated App"),
    domain,
    description: text.slice(0, 400),
    entities,
    metrics,
    features,
    primaryEntity,
    hasTimeSeries,
  };
}

export const DOMAIN_PACK_IDS = PACKS.map((p) => ({ id: p.id, icon: p.icon }));
