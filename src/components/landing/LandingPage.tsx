"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, EffectCoverflow, Pagination } from "swiper/modules";
import {
  ArrowRight,
  Bot,
  Boxes,
  CheckCircle2,
  ChevronDown,
  Database,
  Download,
  FileCode2,
  GitBranch,
  Play,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wallet,
  Workflow,
} from "lucide-react";
import { AGENT_ORDER, AGENTS } from "@/lib/agents";
import { PRESETS } from "@/lib/domain";
import { cn } from "@/lib/utils";

const HeroScene = dynamic(() => import("./HeroScene"), { ssr: false });

gsap.registerPlugin(ScrollTrigger);

// ─── Fake terminal stream shown in the hero ──────────────────────────────────

const DEMO_LINES: Array<{ role: string; text: string; kind?: "file" | "ok" | "warn" | "cmd" }> = [
  { role: "orchestrator", text: 'Reading brief: "Build a CRM with a kanban deal pipeline…"' },
  { role: "orchestrator", text: "Inferred domain Sales CRM · 5 entities · 7 features", kind: "ok" },
  { role: "architect", text: "Selected Next.js 16 · PostgreSQL · Drizzle · Tailwind v4" },
  { role: "architect", text: "Created package.json, tsconfig.json, src/app/layout.tsx", kind: "file" },
  { role: "database", text: "Defined tables companies, contacts, deals, activities" },
  { role: "database", text: "⏸ Waiting for human approval: database migration", kind: "warn" },
  { role: "database", text: "$ npx drizzle-kit push   ✓ 5 tables created", kind: "cmd" },
  { role: "backend", text: "Created src/app/api/deals/route.ts (+24 more)", kind: "file" },
  { role: "frontend", text: "Built dashboard, 4 list pages and 4 create forms" },
  { role: "testing", text: "$ npm test   ✓ 12 passed · 91% coverage", kind: "cmd" },
  { role: "devops", text: "Image built (148 MB) · CI workflow committed" },
  { role: "devops", text: "Deployed → https://sales-crm.agentic.app", kind: "ok" },
];

function LiveTerminal() {
  const [visible, setVisible] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setVisible((v) => (v >= DEMO_LINES.length ? 1 : v + 1)), 1400);
    return () => clearInterval(id);
  }, []);
  const lines = DEMO_LINES.slice(0, visible);
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="flex items-center gap-2 border-b border-white/8 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-mint-400/80" />
        <span className="ml-3 font-mono text-[11px] text-ink-400">forge — pipeline · sales-crm</span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-mint-400">
          <span className="status-dot bg-mint-400" data-live="true" /> live
        </span>
      </div>
      <div className="h-[268px] space-y-1.5 overflow-hidden p-4 font-mono text-[12px]">
        {lines.map((l, i) => {
          const a = AGENTS[l.role as keyof typeof AGENTS];
          return (
            <div key={i} className="flex gap-3 leading-relaxed">
              <span className="w-24 shrink-0 text-right" style={{ color: a.color }}>
                {a.name.toLowerCase()}
              </span>
              <span className={cn("text-ink-300", l.kind === "ok" && "text-mint-400", l.kind === "warn" && "text-amber-300", l.kind === "cmd" && "text-accent-400", l.kind === "file" && "text-ink-200")}>
                {l.text}
              </span>
            </div>
          );
        })}
        <div className="flex gap-3">
          <span className="w-24" />
          <span className="animate-blink text-brand-300">▍</span>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const root = useRef<HTMLDivElement>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".hero-el", { y: 30, opacity: 0, duration: 0.9, stagger: 0.12, ease: "power3.out", delay: 0.1 });
      gsap.utils.toArray<HTMLElement>(".reveal").forEach((el) => {
        gsap.to(el, {
          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 85%", once: true },
        });
      });
      gsap.utils.toArray<HTMLElement>(".step-line").forEach((el) => {
        gsap.from(el, {
          scaleY: 0,
          transformOrigin: "top",
          duration: 1.2,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 80%", once: true },
        });
      });
      gsap.utils.toArray<HTMLElement>(".counter").forEach((el) => {
        const target = Number(el.dataset.value ?? 0);
        const suffix = el.dataset.suffix ?? "";
        const obj = { v: 0 };
        gsap.to(obj, {
          v: target,
          duration: 1.8,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 90%", once: true },
          onUpdate: () => {
            el.textContent = `${Math.round(obj.v).toLocaleString()}${suffix}`;
          },
        });
      });
      gsap.to(".parallax-slow", { yPercent: -12, ease: "none", scrollTrigger: { trigger: root.current, start: "top top", end: "bottom bottom", scrub: 1 } });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className="relative overflow-x-clip">
      {/* Nav */}
      <header className="fixed inset-x-0 top-0 z-50">
        <div className="mx-auto mt-4 flex max-w-7xl items-center justify-between rounded-2xl px-4 py-3 glass sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="font-display text-lg font-semibold tracking-tight">Forge</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-ink-300 md:flex">
            <a href="#how" className="hover:text-ink-100">How it works</a>
            <a href="#agents" className="hover:text-ink-100">Agents</a>
            <a href="#features" className="hover:text-ink-100">Features</a>
            <a href="#presets" className="hover:text-ink-100">Presets</a>
            <a href="#faq" className="hover:text-ink-100">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="btn-ghost hidden sm:inline-flex">Dashboard</Link>
            <Link href="/dashboard?new=1" className="btn-primary">
              Start building <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative isolate min-h-[100svh] overflow-hidden noise">
        <div className="absolute inset-0 grid-bg [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
        <div className="absolute inset-0">
          <HeroScene />
        </div>
        <div className="pointer-events-none absolute -left-40 top-20 h-[520px] w-[520px] rounded-full bg-brand-600/25 blur-[140px]" />
        <div className="pointer-events-none absolute -right-40 bottom-0 h-[420px] w-[420px] rounded-full bg-accent-500/15 blur-[140px]" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-24 pt-36 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:pt-44">
          <div className="pointer-events-none">
            <div className="hero-el section-kicker pointer-events-auto">
              <Sparkles size={12} /> Agentic full-stack code generation
            </div>
            <h1 className="hero-el font-display text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              Describe the product.
              <br />
              <span className="text-gradient">Seven agents build it.</span>
            </h1>
            <p className="hero-el mt-6 max-w-xl text-lg leading-relaxed text-ink-300">
              Forge turns a plain-English brief into a deployable Next.js + PostgreSQL codebase. An orchestrator plans the work, specialists write
              the schema, API, UI, tests and infra — and you approve the risky steps before they happen.
            </p>
            <div className="hero-el pointer-events-auto mt-8 flex flex-wrap items-center gap-3">
              <Link href="/dashboard?new=1" className="btn-primary px-6 py-3 text-base">
                <Play size={16} /> Generate a project
              </Link>
              <a href="#how" className="btn-secondary px-6 py-3 text-base">
                See how it works
              </a>
            </div>
            <div className="hero-el mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-ink-400">
              <span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-mint-400" /> Typed API + Zod validation</span>
              <span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-mint-400" /> Drizzle schema & migrations</span>
              <span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-mint-400" /> Human-in-the-loop gates</span>
            </div>
          </div>
          <div className="hero-el relative lg:pl-6">
            <LiveTerminal />
            <div className="absolute -bottom-6 -left-4 hidden rounded-2xl glass px-4 py-3 text-xs md:block animate-float">
              <div className="text-ink-400">Files generated</div>
              <div className="font-display text-2xl font-semibold text-ink-100">54</div>
            </div>
            <div className="absolute -right-3 -top-6 hidden rounded-2xl glass px-4 py-3 text-xs md:block animate-float [animation-delay:-3s]">
              <div className="text-ink-400">Run cost</div>
              <div className="font-display text-2xl font-semibold text-mint-400">$0.19</div>
            </div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-6 flex justify-center">
          <a href="#how" className="flex flex-col items-center gap-1 text-[11px] uppercase tracking-[0.2em] text-ink-500">
            scroll <ChevronDown size={14} className="animate-bounce" />
          </a>
        </div>
      </section>

      {/* Marquee stack */}
      <div className="border-y border-white/6 bg-ink-925/60 py-4">
        <div className="flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_15%,black_85%,transparent)]">
          <div className="flex shrink-0 animate-marquee items-center gap-12 pr-12 text-sm text-ink-400">
            {[...Array(2)].map((_, k) =>
              ["Next.js 16", "React 19", "TypeScript", "PostgreSQL", "Drizzle ORM", "Tailwind v4", "Zod", "Vitest", "Docker", "GitHub Actions", "REST", "Session auth", "RBAC"].map((s) => (
                <span key={`${k}-${s}`} className="flex items-center gap-3 whitespace-nowrap font-medium">
                  <span className="h-1 w-1 rounded-full bg-brand-400" /> {s}
                </span>
              )),
            )}
          </div>
        </div>
      </div>

      {/* How it works */}
      <section id="how" className="relative mx-auto max-w-7xl px-4 py-28 sm:px-6">
        <div className="reveal mx-auto max-w-2xl text-center">
          <div className="section-kicker"><Workflow size={12} /> How it works</div>
          <h2 className="section-title">From brief to deployment in one pipeline</h2>
          <p className="mt-4 text-ink-400">
            Every project runs the same 14-step plan. Each step is executed by a specialised agent, produces real artefacts you can inspect, and pauses
            at checkpoints where a human should decide.
          </p>
        </div>
        <div className="mt-16 grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <ol className="relative space-y-8">
            <div className="step-line absolute left-[19px] top-4 bottom-4 w-px bg-gradient-to-b from-brand-500 via-accent-500 to-transparent" />
            {[
              { t: "Write a brief", d: "Describe the product in plain English or start from a preset. Forge infers the domain, entities and features." },
              { t: "Agents plan & build", d: "Orchestrator → Architect → Database → Backend → Frontend → Testing → DevOps. Every file, command and token is logged." },
              { t: "You approve the risky bits", d: "Schema migrations and production deploys stop at a checkpoint with a diff, risk level and one-click approve / reject." },
              { t: "Inspect, edit, download", d: "Browse the virtual file system, search code, edit env vars, read test output — then download the zip." },
            ].map((s, i) => (
              <li key={s.t} className="reveal relative flex gap-5 pl-1">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-brand-500/40 bg-ink-900 font-mono text-sm text-brand-300 ring-glow">{i + 1}</span>
                <div>
                  <h3 className="font-display text-lg font-semibold">{s.t}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-400">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="reveal panel relative overflow-hidden p-6">
            <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-brand-600/20 blur-3xl" />
            <div className="mb-5 flex items-center justify-between">
              <span className="text-sm font-medium text-ink-200">Execution plan</span>
              <span className="chip">14 steps · 7 agents</span>
            </div>
            <div className="space-y-2">
              {[
                ["orchestrator", "Analyse requirements", "Create task graph"],
                ["architect", "Design architecture", "Scaffold skeleton"],
                ["database", "Model schema ⏸", "Migrate & seed"],
                ["backend", "Auth & config", "Generate REST API"],
                ["frontend", "App shell & dashboard", "Resource pages"],
                ["testing", "Write tests", "Run quality gate"],
                ["devops", "Containerise ⏸", "Deploy"],
              ].map(([role, a, b]) => {
                const def = AGENTS[role as keyof typeof AGENTS];
                return (
                  <div key={role} className="grid grid-cols-[120px_1fr_1fr] items-center gap-2 rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2 text-xs">
                    <span className="flex items-center gap-2 font-medium" style={{ color: def.color }}>
                      <span>{def.emoji}</span>
                      {def.name}
                    </span>
                    <span className="rounded-md bg-white/5 px-2 py-1 text-ink-300">{a}</span>
                    <span className="rounded-md bg-white/5 px-2 py-1 text-ink-300">{b}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-[11px] text-ink-500">⏸ = human-in-the-loop checkpoint</p>
          </div>
        </div>
      </section>

      {/* Agents carousel */}
      <section id="agents" className="relative py-28">
        <div className="parallax-slow pointer-events-none absolute inset-x-0 top-0 h-full bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.14),transparent_60%)]" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="reveal mx-auto max-w-2xl text-center">
            <div className="section-kicker"><Bot size={12} /> The team</div>
            <h2 className="section-title">Seven specialists, one shared context</h2>
            <p className="mt-4 text-ink-400">Each agent has a narrow job, its own tools and a model sized to the task. They pass artefacts through a shared context engine so nothing is lost between hand-offs.</p>
          </div>
        </div>
        <div className="reveal mt-14">
          <Swiper
            modules={[EffectCoverflow, Pagination, Autoplay]}
            effect="coverflow"
            grabCursor
            centeredSlides
            loop
            slidesPerView="auto"
            autoplay={{ delay: 3200, disableOnInteraction: false }}
            coverflowEffect={{ rotate: 0, stretch: 0, depth: 160, modifier: 1.6, slideShadows: false }}
            pagination={{ clickable: true }}
            className="!pb-14"
          >
            {AGENT_ORDER.map((role) => {
              const a = AGENTS[role];
              return (
                <SwiperSlide key={role} className="!w-[320px] sm:!w-[380px]">
                  <div className="panel relative h-[360px] overflow-hidden p-6">
                    <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl" style={{ background: a.color, opacity: 0.22 }} />
                    <div className="flex items-center gap-3">
                      <span className="grid h-12 w-12 place-items-center rounded-2xl text-2xl" style={{ background: `${a.color}22`, border: `1px solid ${a.color}55` }}>{a.emoji}</span>
                      <div>
                        <div className="font-display text-lg font-semibold">{a.name}</div>
                        <div className="text-xs text-ink-400">{a.model}</div>
                      </div>
                    </div>
                    <p className="mt-4 text-sm font-medium text-ink-200">{a.tagline}</p>
                    <p className="mt-2 text-sm leading-relaxed text-ink-400">{a.description}</p>
                    <ul className="mt-4 flex flex-wrap gap-1.5">
                      {a.capabilities.map((c) => (
                        <li key={c} className="chip">{c}</li>
                      ))}
                    </ul>
                    <div className="absolute inset-x-6 bottom-5 flex flex-wrap gap-1 font-mono text-[10px] text-ink-500">
                      {a.tools.map((t) => (
                        <span key={t}>{t}()</span>
                      ))}
                    </div>
                  </div>
                </SwiperSlide>
              );
            })}
          </Swiper>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-28 sm:px-6">
        <div className="reveal mx-auto max-w-2xl text-center">
          <div className="section-kicker"><Boxes size={12} /> Everything you need to trust the output</div>
          <h2 className="section-title">Not a chat window. A workspace.</h2>
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { i: FileCode2, t: "Virtual file system", d: "Every generated file is versioned and browsable in a real tree with syntax highlighting, in-place editing and code search." },
            { i: Database, t: "Schema viewer", d: "See each table's columns, foreign keys and the exact CREATE TABLE SQL — plus migration status and seeded row counts." },
            { i: ShieldCheck, t: "Human-in-the-loop", d: "Blocking checkpoints for migrations and deploys with risk levels, diffs and notes. Toggle auto-approve when you trust it." },
            { i: Terminal, t: "Command log", d: "Installs, migrations, lint, tests, Docker builds — captured with stdout, exit codes and durations." },
            { i: Wallet, t: "Token & cost tracking", d: "Every model call is recorded per agent with prompt/completion tokens and USD cost so runs stay predictable." },
            { i: Download, t: "Download & duplicate", d: "Export the whole project as a zip with a .env template, or duplicate a project to try a different brief." },
            { i: GitBranch, t: "Environment variables", d: "Agents register the secrets the app needs; you fill in real values, mark secrets and add your own." },
            { i: Workflow, t: "Live activity stream", d: "A unified timeline of what each agent read, decided, wrote and ran — filterable by agent." },
            { i: Bot, t: "Bring your own model", d: "Point Forge at OpenAI, Azure, Anthropic or any OpenAI-compatible endpoint and test the connection in one click." },
          ].map((f) => (
            <div key={f.t} className="reveal group panel p-6 transition hover:border-brand-500/30 hover:bg-ink-900">
              <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-brand-500/15 text-brand-300 transition group-hover:scale-110">
                <f.i size={18} />
              </div>
              <h3 className="font-display text-base font-semibold">{f.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-400">{f.d}</p>
            </div>
          ))}
        </div>

        <div className="reveal mt-16 grid gap-4 rounded-3xl border border-white/8 bg-gradient-to-br from-ink-900 to-ink-925 p-8 sm:grid-cols-4">
          {[
            { v: 14, s: "", l: "pipeline steps" },
            { v: 50, s: "+", l: "files per project" },
            { v: 14, s: "", l: "domain packs" },
            { v: 100, s: "%", l: "typed & validated" },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <div className="counter font-display text-4xl font-semibold text-gradient" data-value={s.v} data-suffix={s.s}>0</div>
              <div className="mt-1 text-xs uppercase tracking-wider text-ink-400">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Presets carousel */}
      <section id="presets" className="relative py-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(6,182,212,0.12),transparent_60%)]" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="reveal flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-xl">
              <div className="section-kicker"><Sparkles size={12} /> Presets</div>
              <h2 className="section-title">Start from a real product brief</h2>
              <p className="mt-4 text-ink-400">Presets pre-fill the prompt — they are not templates. The same inference engine generates every project, so edit freely.</p>
            </div>
            <Link href="/dashboard?new=1" className="btn-secondary">Write your own brief <ArrowRight size={15} /></Link>
          </div>
        </div>
        <div className="reveal mt-12">
          <Swiper
            modules={[Pagination, Autoplay]}
            slidesPerView={1.15}
            spaceBetween={16}
            centeredSlides
            loop
            autoplay={{ delay: 2600, disableOnInteraction: false, pauseOnMouseEnter: true }}
            pagination={{ clickable: true }}
            breakpoints={{ 640: { slidesPerView: 2.2 }, 1024: { slidesPerView: 3.4 }, 1440: { slidesPerView: 4.2 } }}
            className="!pb-14"
          >
            {PRESETS.map((p) => (
              <SwiperSlide key={p.id}>
                <Link href={`/dashboard?new=1&preset=${p.id}`} className={cn("group block h-[250px] rounded-2xl border border-white/8 bg-gradient-to-br p-6 transition hover:border-white/20", p.gradient)}>
                  <div className="text-3xl">{p.emoji}</div>
                  <h3 className="mt-4 font-display text-lg font-semibold">{p.name}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-300">{p.description}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {p.tags.map((t) => (
                      <span key={t} className="chip">{t}</span>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-1 text-xs text-ink-200 opacity-0 transition group-hover:opacity-100">Use preset <ArrowRight size={12} /></div>
                </Link>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-4 py-28 sm:px-6">
        <div className="reveal text-center">
          <div className="section-kicker">FAQ</div>
          <h2 className="section-title">Questions, answered</h2>
        </div>
        <div className="reveal mt-12 space-y-3">
          {[
            ["Does it actually write code or just describe it?", "It writes real files: Drizzle schemas, route handlers with Zod validation, service layers, React pages, tests, a Dockerfile and a CI workflow. You can open every one in the workspace and download the zip."],
            ["What happens at a checkpoint?", "The pipeline pauses and the project status becomes 'Needs approval'. You see the proposed SQL or deploy command, a risk level and affected resources. Approve to continue, or reject to skip that step with a note. Auto-approve can be enabled per project."],
            ["Do I need an API key?", "No. The built-in generation engine runs entirely on the server and records simulated token usage and cost. If you add a provider key in Settings, Forge verifies the connection and reports it in the dashboard."],
            ["Can I change the generated project?", "Yes. Edit files in place (they are versioned), add or edit environment variables, reset a project to re-run it, or duplicate it to try a different brief."],
            ["What stack does the output use?", "Next.js 16 App Router, React 19, TypeScript, PostgreSQL with Drizzle ORM, Tailwind CSS v4, Vitest, Docker and GitHub Actions."],
          ].map(([q, a], i) => (
            <div key={q} className="panel overflow-hidden">
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
                <span className="font-medium text-ink-100">{q}</span>
                <ChevronDown size={16} className={cn("shrink-0 text-ink-400 transition", openFaq === i && "rotate-180")} />
              </button>
              <div className={cn("grid transition-all duration-300", openFaq === i ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                <div className="overflow-hidden">
                  <p className="px-5 pb-5 text-sm leading-relaxed text-ink-400">{a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <div className="reveal relative overflow-hidden rounded-3xl border border-brand-500/30 bg-gradient-to-br from-brand-600/30 via-ink-900 to-accent-500/20 p-10 text-center sm:p-16">
          <div className="absolute inset-0 grid-bg opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
          <div className="relative">
            <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Ship your next internal tool before lunch.</h2>
            <p className="mx-auto mt-4 max-w-xl text-ink-300">Open the dashboard, pick a preset or paste a brief, and watch the agents work.</p>
            <Link href="/dashboard?new=1" className="btn-primary mt-8 px-7 py-3.5 text-base">
              Open the dashboard <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/6 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-sm text-ink-500 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2"><Logo size={18} /> <span className="font-display font-semibold text-ink-300">Forge</span> · agentic codegen</div>
          <div className="flex gap-6">
            <Link href="/dashboard" className="hover:text-ink-200">Dashboard</Link>
            <Link href="/settings" className="hover:text-ink-200">Settings</Link>
            <a href="#how" className="hover:text-ink-200">How it works</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="#c4b5fd" />
          <stop offset="0.5" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <path d="M16 2 29 9.5v13L16 30 3 22.5v-13L16 2Z" stroke="url(#lg)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M16 9v14M10 12.5l6-3.5 6 3.5M10 19.5l6 3.5 6-3.5" stroke="url(#lg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
