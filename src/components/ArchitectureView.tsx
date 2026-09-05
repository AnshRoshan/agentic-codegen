"use client";

import { motion } from "motion/react";
import { AGENT_DEFINITIONS, GREENFIELD_PIPELINE, type AgentRoleId } from "@/lib/agents";
import { FadeIn, Stagger, StaggerItem } from "./motion/primitives";
import {
  Cpu, Database, Cloud, Zap, Shield, GitBranch,
  MessageSquare, Layers, Bot, Sparkles, BookOpen, ArrowRight,
} from "lucide-react";

export default function ArchitectureView() {
  return (
    <div className="space-y-10 pb-16">
      {/* ── HERO ── */}
      <FadeIn>
        <div className="text-center pt-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/30 text-xs text-primary-300 mb-4">
            <BookOpen className="w-3 h-3" />System architecture
          </div>
          <h1 className="font-display text-4xl md:text-5xl mb-3">
            <span className="text-gradient">How EDL builds any application</span>
          </h1>
          <p className="text-lg text-surface-400 max-w-2xl mx-auto">
            Universal domain inference · specialised agent crew · tool-calling · caching · full observability.
          </p>
        </div>
      </FadeIn>

      {/* ── BIG PICTURE ── */}
      <FadeIn delay={0.1}>
        <div className="glass-card p-6 md:p-8">
          <p className="label mb-4">The pipeline</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { icon: MessageSquare, label: "Prompt", desc: "Free-form description of any application" },
              { icon: Sparkles, label: "Inference", desc: "20 domain packs + generic fallback derive a spec" },
              { icon: Bot, label: "Agent crew", desc: "7 specialists with role-scoped tools & context" },
              { icon: Layers, label: "Codebase", desc: "Complete Next.js + Drizzle + tests + Docker" },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * i, duration: 0.4 }}
                  className="relative p-4 rounded-xl border border-surface-800 bg-surface-900/40"
                >
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-violet-500 flex items-center justify-center mb-3">
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-sm font-semibold text-surface-100 mb-1">{s.label}</p>
                  <p className="text-xs text-surface-500 leading-relaxed">{s.desc}</p>
                  {i < 3 && (
                    <ArrowRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-600" />
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </FadeIn>

      {/* ── AGENT CREW ── */}
      <FadeIn delay={0.15}>
        <div>
          <div className="flex items-baseline justify-between mb-5">
            <div>
              <h2 className="text-xl font-semibold text-surface-100">Agent crew</h2>
              <p className="text-sm text-surface-500 mt-1">Each agent has its own system prompt, tools, and context window.</p>
            </div>
          </div>
          <Stagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {GREENFIELD_PIPELINE.map((role) => {
              const def = AGENT_DEFINITIONS[role as AgentRoleId];
              return (
                <StaggerItem key={role}>
                  <div className="glass-card p-4 h-full">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl leading-none flex-shrink-0">{def.emoji}</div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm text-surface-100">{def.name}</h3>
                        <p className="text-[11px] text-surface-500 mt-0.5 line-clamp-2">{def.description}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {def.tools.slice(0, 4).map((t) => (
                            <span key={t} className="badge text-[9px] bg-surface-800 text-surface-400 border-surface-700">{t}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              );
            })}
          </Stagger>
        </div>
      </FadeIn>

      {/* ── LAYERS ── */}
      <FadeIn delay={0.2}>
        <div>
          <h2 className="text-xl font-semibold text-surface-100 mb-5">Production systems</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SystemCard
              icon={Sparkles}
              iconClass="from-primary-500 to-violet-500"
              title="Prompt Engineering"
              points={[
                "Chain-of-thought reasoning protocol",
                "Role-scoped system prompts per agent",
                "Prior agent outputs chained as context",
                "Tool usage rules and anti-patterns baked in",
              ]}
            />
            <SystemCard
              icon={Layers}
              iconClass="from-cyan-500 to-blue-500"
              title="Context Engineering"
              points={[
                "Role-aware file relevance scoring",
                "Windowed to top 40 files, 2KB each",
                "Full file tree always visible",
                "Smart truncation with byte accounting",
              ]}
            />
            <SystemCard
              icon={Zap}
              iconClass="from-amber-500 to-orange-500"
              title="Tool Chain"
              points={[
                "write_file, read_file, create_db_table, set_env_var, run_command, request_approval",
                "Multi-step loop up to 12 tool calls per task",
                "onStepFinish token accumulation",
                "Every tool call logged with args",
              ]}
            />
            <SystemCard
              icon={Cpu}
              iconClass="from-emerald-500 to-teal-500"
              title="Cost & Token Tracking"
              points={[
                "Pricing for 20+ models (OpenAI, Claude, Gemini, DeepSeek)",
                "Per-agent + per-project accumulators",
                "Every LLM call recorded in llm_calls table",
                "Cache hits, cost, tokens, duration, finish reason",
              ]}
            />
            <SystemCard
              icon={Database}
              iconClass="from-rose-500 to-pink-500"
              title="Prompt Cache"
              points={[
                "SHA-256 keyed on (system + user + model)",
                "LRU eviction · 30-minute TTL",
                "Zero-cost hits still logged for audit",
                "Configurable max entries",
              ]}
            />
            <SystemCard
              icon={Shield}
              iconClass="from-violet-500 to-fuchsia-500"
              title="Human-in-the-Loop"
              points={[
                "Blocking vs illustrative checkpoints",
                "Risk levels: low / medium / high",
                "Approve · Modify · Reject flows",
                "Diff preview for every proposed change",
              ]}
            />
            <SystemCard
              icon={GitBranch}
              iconClass="from-blue-500 to-indigo-500"
              title="Graph Engineering"
              points={[
                "Dynamic task graph per project (23-29 tasks)",
                "Priority-ordered execution",
                "Task dependencies stored on every task",
                "Assembly-line + parallel branches",
              ]}
            />
            <SystemCard
              icon={Cloud}
              iconClass="from-orange-500 to-red-500"
              title="Universal Generator"
              points={[
                "20 domain packs + generic entity extraction",
                "Drizzle schema, Zod validation, REST API",
                "Per-entity UI list + form",
                "Docker, CI, tests, README, seed script",
              ]}
            />
          </div>
        </div>
      </FadeIn>

      {/* ── BYO MODEL ── */}
      <FadeIn delay={0.25}>
        <div className="glass-card p-6 md:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">🔌</span>
              <h3 className="text-lg font-semibold text-surface-100">Bring your own model</h3>
            </div>
            <p className="text-sm text-surface-400 max-w-3xl leading-relaxed">
              Configure any provider from the <strong className="text-surface-200">Settings</strong> panel: OpenAI,
              Azure OpenAI (resource + deployment + api-version), or any OpenAI-compatible endpoint (Groq, Together,
              OpenRouter, Ollama, LM Studio). Every agent step invokes <code>generateText</code> with real tool-calling
              via the Vercel AI SDK. Without a key, the pipeline falls back to deterministic simulation so exploration
              is always free.
            </p>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}

function SystemCard({
  icon: Icon, iconClass, title, points,
}: {
  icon: typeof Sparkles;
  iconClass: string;
  title: string;
  points: string[];
}) {
  return (
    <div className="glass-card p-5 border-glow">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${iconClass} flex items-center justify-center shadow-lg`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <h3 className="text-sm font-semibold text-surface-100">{title}</h3>
      </div>
      <ul className="space-y-1.5">
        {points.map((p) => (
          <li key={p} className="text-xs text-surface-400 flex items-start gap-1.5 leading-relaxed">
            <span className="text-primary-500 mt-0.5">→</span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
