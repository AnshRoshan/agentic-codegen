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

export function getPreset(id: string | null) {
  if (!id) return null;
  return PRESETS.find((p) => p.id === id) || null;
}
