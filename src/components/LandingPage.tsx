import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight, Bot, Boxes, CheckCircle2, ChevronDown, Database, FileCode2,
  GitBranch, Play, ShieldCheck, Sparkles, Terminal, Workflow, Zap, Layers, Search,
} from "lucide-react";
import { AGENT_ORDER, AGENTS } from "../lib/types";
import { PRESETS } from "../lib/domains";
import { formatContext, AI_MODELS } from "../lib/models";
import { useStore } from "../lib/store";
import { Logo } from "./ui";
import { cn } from "../utils/cn";

// ─── Live terminal preview (right side of hero — the ONLY hero visual) ──────
const DEMO_LINES = [
  { role: "orchestrator", text: 'Reading brief: "Build a CRM with a kanban deal pipeline…"', kind: "" },
  { role: "orchestrator", text: "Inferred domain Sales CRM · 5 entities · 5 features", kind: "ok" },
  { role: "architect", text: "Selected Next.js 16 · PostgreSQL · Drizzle · Tailwind v4", kind: "" },
  { role: "architect", text: "Created package.json, tsconfig.json, src/app/layout.tsx", kind: "file" },
  { role: "database", text: "Defined tables companies, contacts, deals, activities", kind: "" },
  { role: "database", text: "⏸ Waiting for approval: database migration", kind: "warn" },
  { role: "database", text: "$ npx drizzle-kit push   ✓ 5 tables created", kind: "cmd" },
  { role: "backend", text: "Created src/app/api/deals/route.ts (+14 more)", kind: "file" },
  { role: "frontend", text: "Built dashboard, 4 list pages and 4 create forms", kind: "" },
  { role: "testing", text: "$ npm test   ✓ 12 passed · 91% coverage", kind: "cmd" },
  { role: "devops", text: "Image built (148 MB) · CI workflow committed", kind: "" },
  { role: "devops", text: "Deployed → https://sales-crm.agentic.app", kind: "ok" },
];

function LiveTerminal() {
  const [visible, setVisible] = useState(3);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = setInterval(() => setVisible((v) => (v >= DEMO_LINES.length ? 2 : v + 1)), 1300);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { ref.current?.scrollTo({ top: 9999, behavior: "smooth" }); }, [visible]);
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        <span className="ml-3 font-mono text-[11px] text-ink-400">forge — pipeline · sales-crm</span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
          <span className="status-dot bg-emerald-400" data-live="true" /> live
        </span>
      </div>
      <div ref={ref} className="h-[264px] space-y-1.5 overflow-hidden p-4 font-mono text-[12px]">
        {DEMO_LINES.slice(0, visible).map((l, i) => {
          const a = AGENTS[l.role as keyof typeof AGENTS];
          return (
            <div key={i} className="flex gap-3 leading-relaxed">
              <span className="w-[86px] shrink-0 text-right text-[11px] font-semibold" style={{ color: a.color }}>
                {a.name.toLowerCase()}
              </span>
              <span className={cn("text-ink-300",
                l.kind === "ok" && "text-emerald-400",
                l.kind === "warn" && "text-amber-300",
                l.kind === "cmd" && "text-cyan-300",
                l.kind === "file" && "text-ink-200")}>
                {l.text}
              </span>
            </div>
          );
        })}
        <div className="flex gap-3">
          <span className="w-[86px]" />
          <span className="animate-blink text-violet-300">▍</span>
        </div>
      </div>
      <div className="flex items-center gap-4 border-t border-white/[0.07] px-4 py-2.5 text-[11px] text-ink-400">
        <span><span className="font-semibold text-ink-200">54</span> files</span>
        <span><span className="font-semibold text-ink-200">5</span> tables</span>
        <span><span className="font-semibold text-ink-200">$0.42</span> run cost</span>
        <span className="ml-auto text-emerald-400">● 14/14 steps</span>
      </div>
    </div>
  );
}

// ─── Pipeline mini strip ────────────────────────────────────────────────────
function PipelineStrip() {
  const steps = ["Analyse", "Plan", "Architect", "Schema", "API", "UI", "Test", "Deploy"];
  return (
    <div className="glass mt-3 flex items-center gap-1 overflow-x-auto rounded-xl px-3 py-2.5">
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <span className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium",
            i < 5 ? "bg-emerald-400/10 text-emerald-300" : i === 5 ? "bg-violet-500/20 text-violet-200" : "text-ink-500")}>
            {i < 5 ? <CheckCircle2 size={12} /> : i === 5 ? <span className="status-dot bg-violet-400" data-live="true" /> : <span className="h-3 w-3 rounded-full border border-white/15" />}
            {s}
          </span>
          {i < steps.length - 1 && <span className="h-px w-3 shrink-0 bg-white/10" />}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Reveal on scroll ───────────────────────────────────────────────────────
function useReveal() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const els = root.current?.querySelectorAll(".reveal");
    if (!els) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          (e.target as HTMLElement).style.opacity = "1";
          (e.target as HTMLElement).style.transform = "translateY(0)";
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return root;
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { setView, createFromPreset, projects } = useStore();
  const root = useReveal();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [prompt, setPrompt] = useState("");

  const startFromPrompt = () => {
    if (!prompt.trim()) { setView("dashboard"); return; }
    // create project via store through dashboard — store in session for prefill
    sessionStorage.setItem("forge-prefill", prompt);
    setView("dashboard");
  };

  const faqs = [
    { q: "Is the generated code real and runnable?", a: "Yes. Every run produces a complete Next.js 16 + PostgreSQL codebase — package.json, Drizzle schema and migrations, typed API routes with Zod validation, pages, tests, Dockerfile and CI workflow. You can download it as a zip, push it to GitHub, and run npm install → db:push → dev." },
    { q: "How do the human approval gates work?", a: "Two steps pause the pipeline by default: database migration and production deploy. You review the exact SQL diff or release plan, then approve or reject with an optional note. Rejected steps are skipped, approved steps resume automatically. You can enable auto-approve per project for trusted runs." },
    { q: "Which AI models power the agents?", a: "The orchestrator and architect default to a frontier reasoning model, while high-volume specialists (backend, frontend, testing) use fast, cheap models. The Model Catalog lists 12 supported models with context windows and per-token pricing, and every run tracks tokens and cost per agent." },
    { q: "What are Skills and MCP servers?", a: "Skills are versioned knowledge packs (Next.js App Router, Drizzle, Zod, Tailwind v4…) that agents load per task. MCP servers are live tool integrations — filesystem, Postgres, GitHub, sandbox shell — that let agents read, write, migrate and execute inside an isolated workspace." },
    { q: "Can I edit the generated code?", a: "Absolutely. The Files tab is a full code browser with syntax-highlighted viewing and in-place editing. Edits are versioned, and the terminal, database viewer and environment tabs stay in sync with the pipeline state." },
  ];

  const stats = [
    { v: "54", label: "avg. files per run" },
    { v: "14", label: "pipeline steps" },
    { v: "7", label: "specialist agents" },
    { v: "$0.42", label: "median run cost" },
  ];

  return (
    <div ref={root} className="relative min-h-screen overflow-x-clip">
      {/* Nav */}
      <header className="fixed inset-x-0 top-0 z-50">
        <div className="glass mx-auto mt-4 flex max-w-6xl items-center justify-between rounded-2xl px-4 py-2.5 sm:px-5">
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-2.5">
            <Logo />
            <span className="font-display text-[17px] font-semibold tracking-tight">Forge</span>
          </button>
          <nav className="hidden items-center gap-6 text-[13.5px] text-ink-300 md:flex">
            <a href="#how" className="transition hover:text-white">How it works</a>
            <a href="#agents" className="transition hover:text-white">Agents</a>
            <a href="#workspace" className="transition hover:text-white">Workspace</a>
            <a href="#presets" className="transition hover:text-white">Presets</a>
            <a href="#faq" className="transition hover:text-white">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={() => setView("dashboard")} className="btn-ghost hidden sm:inline-flex">Dashboard</button>
            <button onClick={() => setView("dashboard")} className="btn-primary">
              Start building <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO — clean, single visual, no overlapping 3D ── */}
      <section className="noise relative isolate overflow-hidden">
        {/* Calm background: faint grid + two soft orbs. Nothing animated over content. */}
        <div className="grid-bg absolute inset-0 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_35%,black_25%,transparent_75%)]" />
        <div className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-violet-600/[0.13] blur-[120px]" />
        <div className="pointer-events-none absolute right-[-120px] top-[420px] h-[320px] w-[320px] rounded-full bg-cyan-500/[0.07] blur-[110px]" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-32 sm:px-6 lg:grid-cols-[1fr_1fr] lg:pt-40">
          <div>
            <div className="section-kicker"><Sparkles size={12} /> Agentic full-stack code generation</div>
            <h1 className="mt-5 font-display text-[44px] font-bold leading-[1.04] tracking-tight sm:text-[56px]">
              Describe the product.
              <br />
              <span className="text-gradient">Seven agents build it.</span>
            </h1>
            <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-ink-300">
              Forge turns a plain-English brief into a deployable Next.js + PostgreSQL
              codebase. An orchestrator plans the work, specialists write the schema,
              API, UI, tests and infra — and you approve the risky steps before they happen.
            </p>
            {/* Prompt-first CTA */}
            <div className="glass mt-7 flex items-center gap-2 rounded-xl p-2 pl-4">
              <Search size={16} className="shrink-0 text-ink-500" />
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && startFromPrompt()}
                placeholder='Try "Build a CRM with a kanban deal pipeline…"'
                className="w-full bg-transparent text-[14px] text-ink-100 outline-none placeholder:text-ink-500"
              />
              <button onClick={startFromPrompt} className="btn-primary shrink-0">
                <Play size={14} /> Generate
              </button>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-ink-400">
              <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-400" /> Typed API + Zod validation</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-400" /> Drizzle schema & migrations</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-400" /> Human-in-the-loop gates</span>
            </div>
            <div className="mt-7 flex gap-7">
              {stats.map((s) => (
                <div key={s.label}>
                  <div className="font-display text-[22px] font-bold">{s.v}</div>
                  <div className="text-[12px] text-ink-400">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <LiveTerminal />
            <PipelineStrip />
            <div className="mt-3 flex items-center gap-2 text-[12px] text-ink-500">
              <ShieldCheck size={13} className="text-amber-300" />
              Schema & deploy steps pause for your approval — nothing risky runs blind.
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="reveal mx-auto max-w-2xl text-center">
          <div className="section-kicker"><Workflow size={12} /> How it works</div>
          <h2 className="mt-4 font-display text-[32px] font-bold tracking-tight sm:text-[38px]">From sentence to deploy in four moves</h2>
          <p className="mt-3 text-[15px] text-ink-300">One pipeline, seven specialists, two approval gates. You watch it happen — or step in when it matters.</p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {[
            { icon: <Sparkles size={18} />, step: "01", title: "Describe", desc: "Write a brief or pick a preset. The orchestrator infers your domain, entities and feature set." },
            { icon: <GitBranch size={18} />, step: "02", title: "Plan", desc: "Work is decomposed into a 14-step task graph and assigned to specialist agents in order." },
            { icon: <Bot size={18} />, step: "03", title: "Generate", desc: "Agents write schema, API, UI, tests and infra — streaming files, logs and commands live." },
            { icon: <ShieldCheck size={18} />, step: "04", title: "Approve & ship", desc: "Review the SQL diff and release plan at two gates, then deploy with one click." },
          ].map((c) => (
            <div key={c.step} className="reveal card card-hover p-5">
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/15 text-violet-300">{c.icon}</span>
                <span className="font-mono text-[12px] text-ink-500">{c.step}</span>
              </div>
              <h3 className="mt-4 text-[15px] font-semibold">{c.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-400">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── AGENTS ── */}
      <section id="agents" className="relative border-y border-white/[0.06] bg-white/[0.012]">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="reveal mx-auto max-w-2xl text-center">
            <div className="section-kicker"><Bot size={12} /> The crew</div>
            <h2 className="mt-4 font-display text-[32px] font-bold tracking-tight sm:text-[38px]">Seven specialists, zero hand-holding</h2>
            <p className="mt-3 text-[15px] text-ink-300">Each agent owns its tools, its model and its slice of the pipeline.</p>
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {AGENT_ORDER.map((role) => {
              const a = AGENTS[role];
              return (
                <div key={role} className="reveal card card-hover p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl text-[20px]" style={{ background: `${a.color}1a` }}>{a.emoji}</span>
                    <div>
                      <div className="text-[14.5px] font-semibold">{a.name}</div>
                      <div className="font-mono text-[11px]" style={{ color: a.color }}>{a.model}</div>
                    </div>
                  </div>
                  <p className="mt-3 text-[13px] text-ink-300">{a.tagline}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {a.tools.slice(0, 3).map((t) => (
                      <span key={t} className="chip font-mono !text-[10.5px]">{t}</span>
                    ))}
                  </div>
                </div>
              );
            })}
            {/* 8th card: models CTA */}
            <button onClick={() => setView("models")} className="reveal card card-hover flex flex-col items-start justify-between p-5 text-left">
              <div>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-500/15 text-cyan-300"><Zap size={18} /></span>
                <div className="mt-3 text-[14.5px] font-semibold">12 models in the catalog</div>
                <p className="mt-1 text-[13px] text-ink-400">Compare context, price, speed and quality across OpenAI, Anthropic, Google and more.</p>
              </div>
              <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-cyan-300">Browse catalog <ArrowRight size={14} /></span>
            </button>
          </div>
        </div>
      </section>

      {/* ── WORKSPACE PREVIEW ── */}
      <section id="workspace" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="reveal mx-auto max-w-2xl text-center">
          <div className="section-kicker"><Layers size={12} /> Mission control</div>
          <h2 className="mt-4 font-display text-[32px] font-bold tracking-tight sm:text-[38px]">A workspace built like an IDE, not a blog</h2>
          <p className="mt-3 text-[15px] text-ink-300">Sidebar navigation, tabbed panels, live inspector. Everything one click away — nothing duplicated, nothing buried in scroll.</p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { icon: <Workflow size={17} />, title: "Pipeline board", desc: "Horizontal stepper, task graph and per-agent status in one glanceable view." },
            { icon: <FileCode2 size={17} />, title: "Code browser", desc: "File tree, syntax-highlighted viewer and version history with in-place edits." },
            { icon: <Database size={17} />, title: "Database viewer", desc: "Tables, columns, row counts and the exact SQL behind every migration." },
            { icon: <Terminal size={17} />, title: "Live terminal", desc: "Every command the agents run — installs, migrations, tests, builds — with output." },
            { icon: <ShieldCheck size={17} />, title: "Approval inbox", desc: "Risk-rated checkpoints with diffs, affected tables and one-click decisions." },
            { icon: <Boxes size={17} />, title: "Cost & tokens", desc: "Per-agent token usage, LLM call log and running cost down to the micro-dollar." },
          ].map((f) => (
            <div key={f.title} className="reveal card card-hover flex gap-3.5 p-5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-ink-200">{f.icon}</span>
              <div>
                <div className="text-[14px] font-semibold">{f.title}</div>
                <div className="mt-1 text-[13px] leading-relaxed text-ink-400">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="reveal mt-8 text-center">
          <button onClick={() => setView("dashboard")} className="btn-primary px-6 py-3 text-[15px]">
            <Play size={16} /> Open the workspace {projects.length > 0 && `(${projects.length} project${projects.length > 1 ? "s" : ""} ready)`}
          </button>
        </div>
      </section>

      {/* ── PRESETS ── */}
      <section id="presets" className="border-y border-white/[0.06] bg-white/[0.012]">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="reveal mx-auto max-w-2xl text-center">
            <div className="section-kicker"><Sparkles size={12} /> Start from a preset</div>
            <h2 className="mt-4 font-display text-[32px] font-bold tracking-tight sm:text-[38px]">Six domains, tuned end to end</h2>
            <p className="mt-3 text-[15px] text-ink-300">Each preset ships with entities, features and architecture packs the agents already understand.</p>
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PRESETS.map((p, i) => (
              <button key={p.name} onClick={() => createFromPreset(i)} className="reveal card card-hover group p-5 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[26px]">{p.emoji}</span>
                  <span className="btn-secondary btn-sm opacity-0 transition group-hover:opacity-100">Use preset <ArrowRight size={13} /></span>
                </div>
                <div className="mt-3 text-[15px] font-semibold">{p.name}</div>
                <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-400">{p.prompt}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── MODELS STRIP ── */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="reveal flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="section-kicker"><Zap size={12} /> Model catalog</div>
            <h2 className="mt-4 font-display text-[30px] font-bold tracking-tight">Pick the right brain per agent</h2>
          </div>
          <button onClick={() => setView("models")} className="btn-secondary">Compare all {AI_MODELS.length} models <ArrowRight size={14} /></button>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {AI_MODELS.slice(0, 4).map((m) => (
            <div key={m.id} className="reveal card p-4">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-semibold">{m.name}</span>
                <span className="chip !text-[10.5px]">{m.provider}</span>
              </div>
              <div className="mt-2 font-mono text-[11.5px] text-ink-400">{formatContext(m.contextTokens)} · ${m.inputPer1M}/${m.outputPer1M} per 1M</div>
              <div className="mt-2 text-[12px] text-ink-300">{m.bestFor.slice(0, 2).join(" · ")}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="border-t border-white/[0.06] bg-white/[0.012]">
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
          <div className="reveal text-center">
            <div className="section-kicker">FAQ</div>
            <h2 className="mt-4 font-display text-[30px] font-bold tracking-tight">Questions, answered</h2>
          </div>
          <div className="mt-8 space-y-2.5">
            {faqs.map((f, i) => (
              <div key={i} className="reveal card overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
                  <span className="text-[14.5px] font-semibold">{f.q}</span>
                  <ChevronDown size={17} className={cn("shrink-0 text-ink-400 transition", openFaq === i && "rotate-180")} />
                </button>
                {openFaq === i && <p className="px-5 pb-5 text-[13.5px] leading-relaxed text-ink-300">{f.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA + FOOTER ── */}
      <section className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
        <div className="reveal glass relative overflow-hidden rounded-3xl px-8 py-14 text-center">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-[240px] w-[520px] -translate-x-1/2 rounded-full bg-violet-600/25 blur-[100px]" />
          <h2 className="relative font-display text-[30px] font-bold tracking-tight sm:text-[36px]">Your next codebase is one sentence away.</h2>
          <p className="relative mx-auto mt-3 max-w-md text-[14.5px] text-ink-300">Spin up a project, watch seven agents build it, and approve the moments that matter.</p>
          <button onClick={() => setView("dashboard")} className="btn-primary relative mx-auto mt-6 px-7 py-3 text-[15px]">
            Start building free <ArrowRight size={16} />
          </button>
        </div>
        <footer className="flex flex-col items-center justify-between gap-4 py-10 text-[12.5px] text-ink-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <Logo size={26} />
            <span className="font-semibold text-ink-300">Forge</span> — agentic full-stack code generation
          </div>
          <div className="flex gap-5">
            <button onClick={() => setView("dashboard")} className="hover:text-ink-300">Dashboard</button>
            <button onClick={() => setView("models")} className="hover:text-ink-300">Models</button>
            <button onClick={() => setView("skills")} className="hover:text-ink-300">Skills & MCP</button>
            <button onClick={() => setView("settings")} className="hover:text-ink-300">Settings</button>
          </div>
        </footer>
      </section>
    </div>
  );
}
