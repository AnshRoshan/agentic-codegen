import type { Architecture, Entity, EntityField, TechStack } from "@/db/schema";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function pascal(s: string) {
  return s
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
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
  if (/(s|x|z|ch|sh)$/.test(w)) return w + "es";
  if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + "ies";
  return w + "s";
}
export function titleCase(s: string) {
  return s
    .replace(/[-_]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const f = (
  name: string,
  type: string,
  opts: Partial<EntityField> = {},
): EntityField => ({ name, type, required: true, ...opts });

function entity(name: string, fields: EntityField[]): Entity {
  return {
    name: pascal(name),
    plural: pluralize(pascal(name)),
    slug: kebab(pluralize(name)),
    fields,
  };
}

// ─── Domain packs ─────────────────────────────────────────────────────────────

export interface DomainPack {
  id: string;
  label: string;
  emoji: string;
  keywords: string[];
  entities: Entity[];
  features: string[];
  overview: string;
}

export const DOMAIN_PACKS: DomainPack[] = [
  {
    id: "crm",
    label: "Sales CRM",
    emoji: "🤝",
    keywords: ["crm", "deal", "pipeline", "lead", "contact", "sales", "prospect"],
    entities: [
      entity("Company", [
        f("name", "string"),
        f("website", "string", { required: false }),
        f("industry", "string", { required: false }),
        f("size", "enum", { enumValues: ["startup", "smb", "mid_market", "enterprise"] }),
      ]),
      entity("Contact", [
        f("firstName", "string"),
        f("lastName", "string"),
        f("email", "string"),
        f("phone", "string", { required: false }),
        f("companyId", "reference", { references: "Company" }),
      ]),
      entity("Deal", [
        f("title", "string"),
        f("value", "number"),
        f("stage", "enum", { enumValues: ["lead", "qualified", "proposal", "negotiation", "won", "lost"] }),
        f("closeDate", "date", { required: false }),
        f("contactId", "reference", { references: "Contact" }),
        f("ownerId", "reference", { references: "User" }),
      ]),
      entity("Activity", [
        f("type", "enum", { enumValues: ["call", "email", "meeting", "note"] }),
        f("summary", "text"),
        f("dealId", "reference", { references: "Deal" }),
        f("occurredAt", "date"),
      ]),
    ],
    features: ["Kanban deal board", "Pipeline value metrics", "Win-rate reporting", "Owner assignment", "Activity timeline"],
    overview: "A CRM that manages companies, contacts and deals moving through a configurable pipeline with activity logging and revenue analytics.",
  },
  {
    id: "inventory",
    label: "Inventory Control",
    emoji: "📦",
    keywords: ["inventory", "warehouse", "stock", "sku", "reorder", "supplier"],
    entities: [
      entity("Product", [
        f("sku", "string"),
        f("name", "string"),
        f("category", "string"),
        f("unitCost", "number"),
        f("reorderPoint", "number"),
      ]),
      entity("Warehouse", [
        f("name", "string"),
        f("location", "string"),
        f("capacity", "number", { required: false }),
      ]),
      entity("StockLevel", [
        f("productId", "reference", { references: "Product" }),
        f("warehouseId", "reference", { references: "Warehouse" }),
        f("quantity", "number"),
        f("reserved", "number"),
      ]),
      entity("StockMovement", [
        f("productId", "reference", { references: "Product" }),
        f("warehouseId", "reference", { references: "Warehouse" }),
        f("type", "enum", { enumValues: ["inbound", "outbound", "transfer", "adjustment"] }),
        f("quantity", "number"),
        f("reference", "string", { required: false }),
      ]),
    ],
    features: ["Multi-warehouse stock", "Low-stock reorder alerts", "Movement ledger", "Stock valuation report", "CSV export"],
    overview: "An inventory system tracking products across warehouses with a full movement ledger, reserved quantities and reorder alerting.",
  },
  {
    id: "helpdesk",
    label: "Support Desk",
    emoji: "🎫",
    keywords: ["ticket", "helpdesk", "support", "sla", "customer service", "agent queue"],
    entities: [
      entity("Customer", [f("name", "string"), f("email", "string"), f("plan", "enum", { enumValues: ["free", "pro", "enterprise"] })]),
      entity("Ticket", [
        f("subject", "string"),
        f("body", "text"),
        f("status", "enum", { enumValues: ["open", "pending", "resolved", "closed"] }),
        f("priority", "enum", { enumValues: ["low", "medium", "high", "urgent"] }),
        f("customerId", "reference", { references: "Customer" }),
        f("assigneeId", "reference", { references: "User", required: false }),
      ]),
      entity("Reply", [
        f("ticketId", "reference", { references: "Ticket" }),
        f("body", "text"),
        f("isInternal", "boolean"),
        f("authorId", "reference", { references: "User" }),
      ]),
      entity("SlaPolicy", [
        f("name", "string"),
        f("priority", "enum", { enumValues: ["low", "medium", "high", "urgent"] }),
        f("firstResponseMinutes", "number"),
        f("resolutionMinutes", "number"),
      ]),
    ],
    features: ["Ticket queue with filters", "SLA breach tracking", "Threaded replies", "Internal notes", "Response-time dashboard"],
    overview: "A helpdesk with prioritised tickets, threaded replies, SLA policies and response-time analytics.",
  },
  {
    id: "ecommerce",
    label: "E-commerce Store",
    emoji: "🛍️",
    keywords: ["ecommerce", "e-commerce", "shop", "store", "cart", "checkout", "order", "catalog"],
    entities: [
      entity("Product", [
        f("name", "string"),
        f("slug", "string"),
        f("description", "text"),
        f("price", "number"),
        f("stock", "number"),
        f("imageUrl", "string", { required: false }),
      ]),
      entity("Category", [f("name", "string"), f("slug", "string")]),
      entity("Order", [
        f("orderNumber", "string"),
        f("customerEmail", "string"),
        f("status", "enum", { enumValues: ["pending", "paid", "shipped", "delivered", "cancelled"] }),
        f("total", "number"),
      ]),
      entity("OrderItem", [
        f("orderId", "reference", { references: "Order" }),
        f("productId", "reference", { references: "Product" }),
        f("quantity", "number"),
        f("unitPrice", "number"),
      ]),
    ],
    features: ["Product catalog with search", "Cart & checkout", "Stripe payments", "Order management", "Admin dashboard"],
    overview: "A storefront with a product catalog, cart, checkout and an order-management back office.",
  },
  {
    id: "project-mgmt",
    label: "Project Management",
    emoji: "✅",
    keywords: ["kanban", "task", "sprint", "project management", "todo", "board", "issue", "backlog"],
    entities: [
      entity("Project", [f("name", "string"), f("key", "string"), f("description", "text", { required: false })]),
      entity("Task", [
        f("title", "string"),
        f("description", "text", { required: false }),
        f("status", "enum", { enumValues: ["backlog", "todo", "in_progress", "review", "done"] }),
        f("priority", "enum", { enumValues: ["low", "medium", "high"] }),
        f("projectId", "reference", { references: "Project" }),
        f("assigneeId", "reference", { references: "User", required: false }),
        f("dueDate", "date", { required: false }),
      ]),
      entity("Comment", [f("taskId", "reference", { references: "Task" }), f("body", "text"), f("authorId", "reference", { references: "User" })]),
      entity("Sprint", [f("name", "string"), f("projectId", "reference", { references: "Project" }), f("startDate", "date"), f("endDate", "date")]),
    ],
    features: ["Drag-and-drop kanban", "Sprint planning", "Comments & mentions", "Burndown chart", "Role-based access"],
    overview: "A project tracker with boards, sprints, comments and velocity reporting.",
  },
  {
    id: "healthcare",
    label: "Clinic Manager",
    emoji: "🏥",
    keywords: ["clinic", "patient", "doctor", "appointment", "medical", "hospital", "health"],
    entities: [
      entity("Patient", [f("firstName", "string"), f("lastName", "string"), f("dateOfBirth", "date"), f("email", "string", { required: false }), f("phone", "string")]),
      entity("Provider", [f("name", "string"), f("specialty", "string"), f("licenseNumber", "string")]),
      entity("Appointment", [
        f("patientId", "reference", { references: "Patient" }),
        f("providerId", "reference", { references: "Provider" }),
        f("scheduledAt", "date"),
        f("status", "enum", { enumValues: ["scheduled", "checked_in", "completed", "no_show", "cancelled"] }),
        f("reason", "text", { required: false }),
      ]),
      entity("Encounter", [f("appointmentId", "reference", { references: "Appointment" }), f("diagnosisCode", "string"), f("notes", "text")]),
    ],
    features: ["Calendar scheduling", "No-show analytics", "Encounter notes", "Audit trail", "Role-based access"],
    overview: "A clinic system handling patients, providers, appointment scheduling and clinical encounter records with compliance auditing.",
  },
  {
    id: "iot",
    label: "IoT Telemetry",
    emoji: "📡",
    keywords: ["iot", "sensor", "device", "telemetry", "reading", "fleet", "threshold"],
    entities: [
      entity("Device", [f("serial", "string"), f("name", "string"), f("location", "string"), f("status", "enum", { enumValues: ["online", "offline", "maintenance"] })]),
      entity("Sensor", [f("deviceId", "reference", { references: "Device" }), f("metric", "string"), f("unit", "string")]),
      entity("Reading", [f("sensorId", "reference", { references: "Sensor" }), f("value", "number"), f("recordedAt", "date")]),
      entity("Alert", [
        f("sensorId", "reference", { references: "Sensor" }),
        f("severity", "enum", { enumValues: ["info", "warning", "critical"] }),
        f("message", "text"),
        f("acknowledged", "boolean"),
      ]),
    ],
    features: ["Real-time charts", "Threshold alerting", "Device uptime metrics", "Alert acknowledgement", "Location filtering"],
    overview: "A telemetry platform ingesting time-series readings from a device fleet with threshold alerting and uptime dashboards.",
  },
  {
    id: "education",
    label: "Learning Platform",
    emoji: "🎓",
    keywords: ["course", "student", "lesson", "learning", "school", "lms", "quiz", "teacher"],
    entities: [
      entity("Course", [f("title", "string"), f("description", "text"), f("level", "enum", { enumValues: ["beginner", "intermediate", "advanced"] }), f("instructorId", "reference", { references: "User" })]),
      entity("Lesson", [f("courseId", "reference", { references: "Course" }), f("title", "string"), f("content", "text"), f("order", "number")]),
      entity("Enrollment", [f("courseId", "reference", { references: "Course" }), f("studentId", "reference", { references: "User" }), f("progress", "number")]),
      entity("Quiz", [f("lessonId", "reference", { references: "Lesson" }), f("question", "text"), f("answer", "string")]),
    ],
    features: ["Course catalog", "Progress tracking", "Quizzes & grading", "Instructor dashboard", "Certificates"],
    overview: "A learning platform with courses, lessons, enrollments, quizzes and progress tracking.",
  },
  {
    id: "finance",
    label: "Finance Tracker",
    emoji: "💰",
    keywords: ["budget", "expense", "invoice", "finance", "accounting", "transaction", "payment", "ledger"],
    entities: [
      entity("Account", [f("name", "string"), f("type", "enum", { enumValues: ["checking", "savings", "credit", "cash"] }), f("balance", "number"), f("currency", "string")]),
      entity("Transaction", [
        f("accountId", "reference", { references: "Account" }),
        f("amount", "number"),
        f("type", "enum", { enumValues: ["income", "expense", "transfer"] }),
        f("categoryId", "reference", { references: "Category" }),
        f("memo", "string", { required: false }),
        f("occurredAt", "date"),
      ]),
      entity("Category", [f("name", "string"), f("monthlyBudget", "number", { required: false })]),
      entity("Invoice", [f("number", "string"), f("clientName", "string"), f("amount", "number"), f("status", "enum", { enumValues: ["draft", "sent", "paid", "overdue"] }), f("dueDate", "date")]),
    ],
    features: ["Budget vs actual", "Recurring transactions", "Invoice PDF export", "Cash-flow chart", "Multi-currency"],
    overview: "A finance tool tracking accounts, categorised transactions, budgets and invoices with cash-flow reporting.",
  },
  {
    id: "hr",
    label: "HR Portal",
    emoji: "🧑‍💼",
    keywords: ["employee", "hr", "leave", "payroll", "onboarding", "recruit", "candidate"],
    entities: [
      entity("Employee", [f("firstName", "string"), f("lastName", "string"), f("email", "string"), f("departmentId", "reference", { references: "Department" }), f("title", "string"), f("startDate", "date")]),
      entity("Department", [f("name", "string"), f("managerId", "reference", { references: "Employee", required: false })]),
      entity("LeaveRequest", [f("employeeId", "reference", { references: "Employee" }), f("type", "enum", { enumValues: ["vacation", "sick", "parental", "unpaid"] }), f("startDate", "date"), f("endDate", "date"), f("status", "enum", { enumValues: ["pending", "approved", "rejected"] })]),
      entity("Review", [f("employeeId", "reference", { references: "Employee" }), f("period", "string"), f("rating", "number"), f("notes", "text")]),
    ],
    features: ["Org chart", "Leave approval workflow", "Performance reviews", "Onboarding checklists", "Headcount reports"],
    overview: "An HR portal managing employees, departments, leave requests and performance reviews.",
  },
  {
    id: "events",
    label: "Event Ticketing",
    emoji: "🎟️",
    keywords: ["event", "ticket sales", "venue", "attendee", "booking", "conference", "rsvp"],
    entities: [
      entity("Event", [f("title", "string"), f("description", "text"), f("venueId", "reference", { references: "Venue" }), f("startsAt", "date"), f("capacity", "number")]),
      entity("Venue", [f("name", "string"), f("address", "string"), f("capacity", "number")]),
      entity("Attendee", [f("name", "string"), f("email", "string")]),
      entity("Booking", [f("eventId", "reference", { references: "Event" }), f("attendeeId", "reference", { references: "Attendee" }), f("seats", "number"), f("status", "enum", { enumValues: ["reserved", "confirmed", "cancelled"] })]),
    ],
    features: ["Seat capacity management", "QR check-in", "Waitlists", "Payment integration", "Attendance reports"],
    overview: "An event platform with venues, ticket bookings, capacity control and check-in.",
  },
  {
    id: "cms",
    label: "Content CMS",
    emoji: "📝",
    keywords: ["blog", "cms", "article", "post", "content", "publish", "editor", "newsletter"],
    entities: [
      entity("Post", [f("title", "string"), f("slug", "string"), f("body", "text"), f("status", "enum", { enumValues: ["draft", "scheduled", "published", "archived"] }), f("authorId", "reference", { references: "User" }), f("publishedAt", "date", { required: false })]),
      entity("Tag", [f("name", "string"), f("slug", "string")]),
      entity("Comment", [f("postId", "reference", { references: "Post" }), f("authorName", "string"), f("body", "text"), f("approved", "boolean")]),
      entity("Media", [f("url", "string"), f("altText", "string", { required: false }), f("mimeType", "string")]),
    ],
    features: ["Rich-text editor", "Scheduled publishing", "Tagging & search", "Comment moderation", "SEO metadata"],
    overview: "A content platform with an editor, scheduled publishing, media library and moderated comments.",
  },
  {
    id: "logistics",
    label: "Fleet & Logistics",
    emoji: "🚚",
    keywords: ["shipment", "delivery", "fleet", "route", "logistics", "driver", "vehicle", "tracking"],
    entities: [
      entity("Vehicle", [f("plate", "string"), f("model", "string"), f("capacityKg", "number"), f("status", "enum", { enumValues: ["available", "on_route", "maintenance"] })]),
      entity("Driver", [f("name", "string"), f("licenseNumber", "string"), f("phone", "string")]),
      entity("Shipment", [f("trackingCode", "string"), f("origin", "string"), f("destination", "string"), f("weightKg", "number"), f("status", "enum", { enumValues: ["created", "picked_up", "in_transit", "delivered", "failed"] })]),
      entity("Route", [f("vehicleId", "reference", { references: "Vehicle" }), f("driverId", "reference", { references: "Driver" }), f("scheduledDate", "date"), f("stops", "number")]),
    ],
    features: ["Live shipment tracking", "Route planning", "Driver assignment", "Proof of delivery", "Fleet utilisation"],
    overview: "A logistics system coordinating vehicles, drivers, routes and shipment tracking.",
  },
  {
    id: "capacity-forecast",
    label: "Capacity Forecast",
    emoji: "📈",
    keywords: ["capacity", "forecast", "utilization", "utilisation", "allocation", "resource planning", "demand"],
    entities: [
      entity("Resource", [f("name", "string"), f("type", "enum", { enumValues: ["person", "team", "machine"] }), f("capacityHours", "number")]),
      entity("Period", [f("label", "string"), f("startDate", "date"), f("endDate", "date"), f("granularity", "enum", { enumValues: ["week", "month", "quarter"] })]),
      entity("Demand", [f("periodId", "reference", { references: "Period" }), f("resourceId", "reference", { references: "Resource" }), f("scenario", "enum", { enumValues: ["baseline", "optimistic", "pessimistic"] }), f("forecastHours", "number"), f("actualHours", "number", { required: false })]),
      entity("Allocation", [f("periodId", "reference", { references: "Period" }), f("resourceId", "reference", { references: "Resource" }), f("hours", "number")]),
    ],
    features: ["Utilisation trend charts", "Scenario comparison", "Over-allocation warnings", "Forecast variance", "CSV export"],
    overview: "A capacity planning tool that compares forecasted demand against allocated resource capacity across scenarios.",
  },
];

// Generic nouns that can become entities when found in a prompt
const GENERIC_ENTITIES: Record<string, EntityField[]> = {
  user: [f("name", "string"), f("email", "string"), f("role", "enum", { enumValues: ["admin", "member", "viewer"] })],
  customer: [f("name", "string"), f("email", "string"), f("phone", "string", { required: false })],
  recipe: [f("title", "string"), f("ingredients", "text"), f("steps", "text"), f("servings", "number")],
  workout: [f("name", "string"), f("durationMinutes", "number"), f("caloriesBurned", "number"), f("performedAt", "date")],
  property: [f("address", "string"), f("price", "number"), f("bedrooms", "number"), f("status", "enum", { enumValues: ["listed", "under_offer", "sold"] })],
  listing: [f("title", "string"), f("price", "number"), f("description", "text")],
  booking: [f("startsAt", "date"), f("endsAt", "date"), f("status", "enum", { enumValues: ["pending", "confirmed", "cancelled"] })],
  review: [f("rating", "number"), f("body", "text")],
  message: [f("body", "text"), f("sentAt", "date")],
  notification: [f("title", "string"), f("body", "text"), f("read", "boolean")],
  subscription: [f("plan", "enum", { enumValues: ["free", "pro", "team"] }), f("status", "enum", { enumValues: ["active", "past_due", "cancelled"] }), f("renewsAt", "date")],
  document: [f("title", "string"), f("content", "text"), f("version", "number")],
  note: [f("title", "string"), f("body", "text"), f("pinned", "boolean")],
  habit: [f("name", "string"), f("frequency", "enum", { enumValues: ["daily", "weekly"] }), f("streak", "number")],
  restaurant: [f("name", "string"), f("cuisine", "string"), f("address", "string")],
  menu: [f("name", "string"), f("price", "number"), f("category", "string")],
  reservation: [f("partySize", "number"), f("reservedAt", "date"), f("status", "enum", { enumValues: ["pending", "seated", "cancelled"] })],
  vendor: [f("name", "string"), f("contactEmail", "string")],
  team: [f("name", "string"), f("slug", "string")],
  goal: [f("title", "string"), f("targetValue", "number"), f("currentValue", "number"), f("deadline", "date")],
  playlist: [f("name", "string"), f("isPublic", "boolean")],
  song: [f("title", "string"), f("artist", "string"), f("durationSeconds", "number")],
  movie: [f("title", "string"), f("year", "number"), f("rating", "number")],
  book: [f("title", "string"), f("author", "string"), f("isbn", "string")],
  plant: [f("name", "string"), f("species", "string"), f("lastWateredAt", "date")],
  pet: [f("name", "string"), f("species", "string"), f("birthDate", "date")],
  trip: [f("destination", "string"), f("startDate", "date"), f("endDate", "date"), f("budget", "number")],
  expense: [f("amount", "number"), f("category", "string"), f("spentAt", "date")],
  job: [f("title", "string"), f("company", "string"), f("status", "enum", { enumValues: ["applied", "interview", "offer", "rejected"] })],
  candidate: [f("name", "string"), f("email", "string"), f("stage", "enum", { enumValues: ["applied", "screen", "interview", "offer", "hired"] })],
  poll: [f("question", "string"), f("closesAt", "date")],
  vote: [f("choice", "string")],
  campaign: [f("name", "string"), f("budget", "number"), f("status", "enum", { enumValues: ["draft", "active", "paused", "ended"] })],
  asset: [f("name", "string"), f("serial", "string"), f("assignedTo", "string", { required: false })],
  incident: [f("title", "string"), f("severity", "enum", { enumValues: ["sev1", "sev2", "sev3"] }), f("status", "enum", { enumValues: ["open", "mitigated", "resolved"] })],
  feature: [f("title", "string"), f("votes", "number"), f("status", "enum", { enumValues: ["idea", "planned", "shipped"] })],
  feedback: [f("body", "text"), f("sentiment", "enum", { enumValues: ["positive", "neutral", "negative"] })],
};

// ─── Inference ────────────────────────────────────────────────────────────────

export interface InferenceResult {
  domain: string;
  domainLabel: string;
  emoji: string;
  entities: Entity[];
  features: string[];
  overview: string;
  name: string;
}

export function inferDomain(prompt: string, providedName?: string): InferenceResult {
  const text = prompt.toLowerCase();

  let best: DomainPack | null = null;
  let bestScore = 0;
  for (const pack of DOMAIN_PACKS) {
    let score = 0;
    for (const kw of pack.keywords) {
      if (text.includes(kw)) score += kw.length > 5 ? 2 : 1;
    }
    if (score > bestScore) {
      best = pack;
      bestScore = score;
    }
  }

  const entities: Entity[] = best && bestScore >= 2 ? best.entities.map((e) => ({ ...e })) : [];
  const existing = new Set(entities.map((e) => e.name.toLowerCase()));

  // Add generic entities mentioned in the prompt
  for (const [noun, fields] of Object.entries(GENERIC_ENTITIES)) {
    const re = new RegExp(`\\b${noun}(s|es)?\\b`, "i");
    if (re.test(text) && !existing.has(noun)) {
      entities.push(entity(noun, fields));
      existing.add(noun);
    }
    if (entities.length >= 7) break;
  }

  // Ensure there is always a User entity for auth
  if (!existing.has("user")) {
    entities.unshift(entity("user", GENERIC_ENTITIES.user));
  }

  // Free-form fallback: derive an entity from the prompt subject if nothing matched
  if (entities.length <= 1) {
    const m = text.match(/(?:for|manage|track|tracking|managing|of)\s+([a-z]+)/);
    const noun = m?.[1] && m[1].length > 3 && m[1] !== "users" ? m[1].replace(/s$/, "") : "item";
    entities.push(entity(noun, [f("title", "string"), f("description", "text", { required: false }), f("status", "enum", { enumValues: ["active", "archived"] }), f("ownerId", "reference", { references: "User" })]));
  }

  // Extract feature hints from the prompt
  const featureHints: Array<[RegExp, string]> = [
    [/search/, "Full-text search"],
    [/filter/, "Advanced filtering"],
    [/csv|export/, "CSV export"],
    [/chart|dashboard|analytics|metric/, "Analytics dashboard"],
    [/notification|email/, "Email notifications"],
    [/role|permission|rbac/, "Role-based access control"],
    [/real-?time|live/, "Real-time updates"],
    [/kanban|drag/, "Drag-and-drop board"],
    [/calendar/, "Calendar view"],
    [/audit/, "Audit trail"],
    [/payment|stripe|billing/, "Stripe billing"],
    [/upload|image|file/, "File uploads"],
    [/auth|login|sign/, "Authentication"],
    [/api/, "Public REST API"],
    [/dark mode/, "Dark mode"],
    [/mobile|responsive/, "Responsive mobile layout"],
    [/pdf/, "PDF generation"],
    [/i18n|multi-?language|localis|localiz/, "Internationalisation"],
  ];
  const features = new Set<string>(best && bestScore >= 2 ? best.features : []);
  for (const [re, label] of featureHints) if (re.test(text)) features.add(label);
  if (!features.has("Authentication")) features.add("Authentication");
  if (features.size < 4) {
    features.add("Analytics dashboard");
    features.add("Role-based access control");
  }

  const domain = best && bestScore >= 2 ? best.id : "custom";
  const domainLabel = best && bestScore >= 2 ? best.label : "Custom Application";
  const emoji = best && bestScore >= 2 ? best.emoji : "✨";
  const overview =
    best && bestScore >= 2
      ? best.overview
      : `A custom full-stack application built around ${entities
          .filter((e) => e.name !== "User")
          .map((e) => e.plural.toLowerCase())
          .join(", ")} with authentication and an analytics dashboard.`;

  const name =
    providedName?.trim() ||
    (domain !== "custom" ? domainLabel : titleCase(entities.filter((e) => e.name !== "User")[0]?.plural ?? "App") + " App");

  return { domain, domainLabel, emoji, entities: entities.slice(0, 8), features: Array.from(features).slice(0, 8), overview, name };
}

export const DEFAULT_STACK: TechStack = {
  frontend: "Next.js 16 · React 19 · TypeScript",
  backend: "Next.js Route Handlers · Zod",
  database: "PostgreSQL · Drizzle ORM",
  styling: "Tailwind CSS v4",
  testing: "Vitest · Testing Library",
  deployment: "Docker · GitHub Actions",
};

export function buildArchitecture(inf: InferenceResult): Architecture {
  const components: Architecture["components"] = [
    { name: "Web App (Next.js)", type: "frontend", description: "App Router pages, layouts and client components", dependencies: ["REST API"] },
    { name: "REST API", type: "backend", description: "Route handlers with Zod validation and auth guards", dependencies: ["Service Layer"] },
    { name: "Service Layer", type: "service", description: "Business rules, pagination and authorization", dependencies: ["PostgreSQL"] },
    { name: "Auth Service", type: "service", description: "Session-based auth with hashed passwords and RBAC", dependencies: ["PostgreSQL"] },
    { name: "PostgreSQL", type: "database", description: `${inf.entities.length} tables managed via Drizzle migrations`, dependencies: [] },
    { name: "CI / CD", type: "infra", description: "GitHub Actions → Docker image → container host", dependencies: ["Web App (Next.js)"] },
  ];
  return {
    overview: inf.overview,
    domain: inf.domain,
    domainLabel: inf.domainLabel,
    entities: inf.entities,
    features: inf.features,
    components,
    dataFlow: [
      "Browser renders server components and hydrates interactive islands",
      "Client mutations call /api/* route handlers with JSON bodies",
      "Handlers validate input with Zod, then delegate to the service layer",
      "Services query PostgreSQL through Drizzle with typed schemas",
      "Responses are cached per-route and revalidated on writes",
    ],
  };
}

// ─── Presets shown in the UI ─────────────────────────────────────────────────

export interface Preset {
  id: string;
  name: string;
  emoji: string;
  description: string;
  tags: string[];
  prompt: string;
  gradient: string;
}

export const PRESETS: Preset[] = [
  {
    id: "crm",
    name: "Sales CRM",
    emoji: "🤝",
    description: "Contacts, companies, a kanban deal pipeline and activity logging.",
    tags: ["Pipeline", "Kanban", "Analytics"],
    gradient: "from-emerald-500/30 to-teal-500/10",
    prompt:
      "Build a CRM to manage companies, contacts, and sales deals moving through a pipeline (lead, qualified, proposal, negotiation, won, lost). Log calls, emails and meetings as activities against deals. Include a kanban deal board with drag and drop, pipeline value metrics, win rate reporting, owner assignment, and email notifications on stage change.",
  },
  {
    id: "inventory",
    name: "Inventory Control",
    emoji: "📦",
    description: "Multi-warehouse stock levels, movement ledger and reorder alerts.",
    tags: ["Warehouse", "Stock", "CSV"],
    gradient: "from-amber-500/30 to-orange-500/10",
    prompt:
      "Build an inventory management system to track products with SKUs across multiple warehouses, record stock levels with reserved quantities, log inbound, outbound and transfer movements, and trigger low-stock reorder alerts. Include search, filtering by category and warehouse, stock valuation reporting and CSV export.",
  },
  {
    id: "helpdesk",
    name: "Support Desk",
    emoji: "🎫",
    description: "Tickets, SLA policies, threaded replies and response metrics.",
    tags: ["Tickets", "SLA", "Threads"],
    gradient: "from-rose-500/30 to-pink-500/10",
    prompt:
      "Build a customer support helpdesk with tickets that have status, priority and assignee, threaded public and internal replies, and SLA policies defining response and resolution targets per priority. Track first response time, resolution rate and SLA breaches on a dashboard. Include search, filters and email notifications.",
  },
  {
    id: "iot",
    name: "IoT Telemetry",
    emoji: "📡",
    description: "Device fleet, time-series readings and threshold alerting.",
    tags: ["Real-time", "Sensors", "Alerts"],
    gradient: "from-cyan-500/30 to-blue-500/10",
    prompt:
      "Build an IoT monitoring platform that registers devices and sensors with online/offline status, ingests time-series readings with metric, value and unit, and raises alerts on threshold breaches with info, warning and critical severity. Include real-time dashboards with charts, device uptime metrics, an alert acknowledgement workflow and filtering by location.",
  },
  {
    id: "healthcare",
    name: "Clinic Manager",
    emoji: "🏥",
    description: "Patients, providers, appointments and clinical encounters.",
    tags: ["Scheduling", "Records", "Audit"],
    gradient: "from-violet-500/30 to-purple-500/10",
    prompt:
      "Build a clinic management system with patient records, provider profiles by specialty, appointment scheduling with status tracking (scheduled, checked in, completed, no-show, cancelled) and clinical encounter notes with diagnosis codes. Include a calendar view, no-show rate metrics, role-based access control and an audit trail.",
  },
  {
    id: "capacity-forecast",
    name: "Capacity Forecast",
    emoji: "📈",
    description: "Resource planning with demand scenarios and utilisation analytics.",
    tags: ["Forecasting", "Scenarios", "Charts"],
    gradient: "from-sky-500/30 to-indigo-500/10",
    prompt:
      "Build a capacity forecasting and resource planning application. Track resources with capacity in hours, define planning periods by week, month or quarter, record forecasted and actual demand per period with baseline, optimistic and pessimistic scenarios, allocate capacity against demand and compute utilisation and forecast variance. Include utilisation trend charts, over-allocation warnings, scenario comparison, role-based access and CSV export.",
  },
  {
    id: "ecommerce",
    name: "E-commerce Store",
    emoji: "🛍️",
    description: "Catalog, cart, checkout and an order-management back office.",
    tags: ["Catalog", "Checkout", "Orders"],
    gradient: "from-fuchsia-500/30 to-rose-500/10",
    prompt:
      "Build an e-commerce store with a product catalog organised into categories, product search, a shopping cart, Stripe checkout, and order management with statuses (pending, paid, shipped, delivered, cancelled). Include an admin dashboard with revenue charts, low-stock warnings and image uploads for products.",
  },
  {
    id: "project-mgmt",
    name: "Project Tracker",
    emoji: "✅",
    description: "Kanban boards, sprints, comments and burndown charts.",
    tags: ["Kanban", "Sprints", "Teams"],
    gradient: "from-lime-500/30 to-emerald-500/10",
    prompt:
      "Build a project management tool with projects, tasks on a drag-and-drop kanban board (backlog, todo, in progress, review, done), sprints with start and end dates, task comments with mentions, assignees and due dates. Include a burndown chart, role-based access and real-time updates.",
  },
];

export function domainEmoji(domain: string | null | undefined) {
  return DOMAIN_PACKS.find((d) => d.id === domain)?.emoji ?? "✨";
}
