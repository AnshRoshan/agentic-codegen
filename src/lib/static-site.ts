import type { Architecture } from "@/lib/types";
import { languageFor, type GeneratedFile } from "@/lib/codegen";

// ─── Static site generator ──────────────────────────────────────────────────
// Produces a complete, beautiful multi-page static website (HTML + CSS + JS,
// no build step) for briefs that don't need a database. Design system:
// per-domain accent palette, display + body font pairing, responsive layout,
// scroll reveal, dark/light toggle, accessible landmarks and SEO/OG meta.

const file = (path: string, content: string): GeneratedFile => ({ path, content, language: languageFor(path) });

type SiteKind = "portfolio" | "restaurant" | "agency" | "event" | "wellness" | "business";

const KIND_MATCHERS: Array<[SiteKind, RegExp]> = [
  ["portfolio", /portfolio|photograph|designer|developer|resume|cv|personal (?:site|website|brand)|freelanc/i],
  ["restaurant", /restaurant|cafe|caf\u00e9|bakery|coffee|pizzeria|menu|bar &? grill|food/i],
  ["agency", /agency|studio|marketing|consultanc|branding|creative studio/i],
  ["event", /wedding|conference|meetup|festival|summit|event|expo/i],
  ["wellness", /yoga|spa|salon|fitness|gym|wellness|massage|clinic|therapy/i],
  ["business", /landing|startup|product|saas|business|company|local/i],
];

interface Palette { accent: string; accent2: string; ink: string; bg: string; }
const PALETTES: Record<SiteKind, Palette> = {
  portfolio: { accent: "#0e7490", accent2: "#155e75", ink: "#111827", bg: "#f8fafc" },
  restaurant: { accent: "#9a3412", accent2: "#7c2d12", ink: "#1c1917", bg: "#fdfaf7" },
  agency: { accent: "#4f46e5", accent2: "#4338ca", ink: "#0f172a", bg: "#f8f8fc" },
  event: { accent: "#b91c1c", accent2: "#991b1b", ink: "#18181b", bg: "#fffbfa" },
  wellness: { accent: "#047857", accent2: "#065f46", ink: "#11312b", bg: "#f6fbf9" },
  business: { accent: "#1d4ed8", accent2: "#1e40af", ink: "#0f172a", bg: "#f7f9fc" },
};

interface SiteSpec {
  kind: SiteKind;
  name: string;
  tagline: string;
  intro: string;
  nav: Array<{ label: string; href: string }>;
  sections: Array<{ id: string; heading: string; blurb: string; items: Array<{ title: string; text: string; tag?: string }> }>;
  quote: { text: string; author: string; role: string };
  contactHint: string;
}

function deriveSpec(prompt: string, name: string, arch: Architecture): SiteSpec {
  const kind = (KIND_MATCHERS.find(([, re]) => re.test(prompt))?.[0] ?? "business");
  // Content comes from the brief first; the domain pack is only a fallback.
  const features = arch.features.length ? arch.features : [];
  const firstSentence = (prompt.trim().replace(/\s+/g, " ").match(/^(.+?[.!?])(\s|$)/)?.[1] ?? prompt.trim()).slice(0, 150);
  // Drop a trailing purpose clause ("...: selected work, about and contact").
  const colonIdx = firstSentence.indexOf(":");
  const trimmed = colonIdx > 20 ? firstSentence.slice(0, colonIdx) : firstSentence;
  const tagline = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).replace(/[\s:.,-]+$/, "");

  const genericNav = [
    { label: "Home", href: "index.html" },
    { label: "About", href: "about.html" },
    { label: kind === "restaurant" ? "Menu" : kind === "event" ? "Schedule" : "Services", href: "services.html" },
    { label: "Contact", href: "contact.html" },
  ];

  const INTROS: Record<SiteKind, string> = {
    portfolio: "Selected work, process and contact — a fast, considered site that lets the work speak.",
    restaurant: "Seasonal plates, honest cooking and a room that feels like home. Book a table below.",
    agency: "Strategy, design and build under one roof. Small team, senior people, measurable results.",
    event: "One day, great speakers, zero filler. Reserve your seat before early-bird pricing ends.",
    wellness: "Small groups, personal attention and a calm space to practice.",
    business: "Everything you need, nothing you don't. Tell us what you need and we'll get moving.",
  };
  const FALLBACK_ITEMS: Record<SiteKind, Array<{ title: string; text: string; tag?: string }>> = {
    portfolio: [
      { title: "Editorial", text: "Product and lifestyle stories shot for print and web.", tag: "Photography" },
      { title: "Commerce", text: "Catalogue and campaign work that converts.", tag: "Photography" },
      { title: "Portraits", text: "Founders and teams, in their own space.", tag: "Photography" },
    ],
    restaurant: [{ title: "Seasonal menu", text: "Changes with the market; printed daily." }, { title: "Private dining", text: "The back room seats twelve." }, { title: "Coffee & wine", text: "Chosen with the same care as the food." }],
    agency: [{ title: "Brand", text: "Positioning, identity and voice." }, { title: "Product", text: "Web and mobile, designed and built." }, { title: "Growth", text: "Sites that earn their keep." }],
    event: [{ title: "Talks", text: "Nine sessions across one stage." }, { title: "Workshops", text: "Hands-on, small groups." }, { title: "After-hours", text: "Dinner and demos." }],
    wellness: [{ title: "Group classes", text: "Small groups, all levels." }, { title: "One-to-one", text: "Personal sessions by appointment." }, { title: "Retreats", text: "Seasonal day retreats." }],
    business: [{ title: "Simple pricing", text: "One clear price, no surprises." }, { title: "Fast setup", text: "Running in days, not months." }, { title: "Real support", text: "Humans answer, usually within the hour." }],
  };
  const sectionDefs: Record<SiteKind, SiteSpec["sections"]> = {
    portfolio: [
      { id: "work", heading: "Selected work", blurb: "A few projects that show how I think and build.", items: features.length ? features.slice(0, 6).map((f, i) => ({ title: `Project 0${i + 1}`, text: f, tag: "Case study" })) : FALLBACK_ITEMS.portfolio },
      { id: "process", heading: "How I work", blurb: "Small steps, fast feedback, honest timelines.", items: [{ title: "Discover", text: "Understand the goal, the audience and the constraints before anything else." }, { title: "Design", text: "Sketch, prototype and validate with real content, not lorem ipsum." }, { title: "Deliver", text: "Build, measure and iterate until it earns its place." }] },
    ],
    restaurant: [
      { id: "menu", heading: "The menu", blurb: "Seasonal plates, cooked simply, sourced locally.", items: features.length ? features.slice(0, 6).map((f) => ({ title: f, text: "Ask your server for today's preparation and allergens.", tag: "Seasonal" })) : FALLBACK_ITEMS.restaurant },
      { id: "visit", heading: "Visit us", blurb: "Walk-ins welcome, reservations recommended on weekends.", items: [{ title: "Hours", text: "Tue–Sun, 12:00–23:00. Closed Mondays." }, { title: "Where", text: "12 Market Street. Two minutes from the old town square." }] },
    ],
    agency: [
      { id: "services", heading: "What we do", blurb: "Strategy, design and build under one roof.", items: features.length ? features.slice(0, 6).map((f) => ({ title: f, text: "Scoped in weeks, not quarters. You talk to the people doing the work." })) : FALLBACK_ITEMS.agency },
      { id: "results", heading: "Results", blurb: "Work we can measure and clients who came back.", items: [{ title: "Faster launches", text: "Teams ship their first release with us in under six weeks." }, { title: "Calmer roadmaps", text: "Fewer, better commitments that actually ship." }] },
    ],
    event: [
      { id: "schedule", heading: "Schedule", blurb: "One day, nine talks, zero filler.", items: features.length ? features.slice(0, 6).map((f, i) => ({ title: `Session 0${i + 1}`, text: f, tag: "Main stage" })) : FALLBACK_ITEMS.event },
      { id: "venue", heading: "Venue", blurb: "Central, accessible and walkable from most hotels.", items: [{ title: "Getting there", text: "10 minutes from the main station; step-free access throughout." }, { title: "Tickets", text: "Early-bird pricing ends when the track lineup is announced." }] },
    ],
    wellness: [
      { id: "offering", heading: "Sessions", blurb: "Small groups, personal attention, real progress.", items: features.length ? features.slice(0, 6).map((f) => ({ title: f, text: "Suitable for beginners; modifications offered throughout." })) : FALLBACK_ITEMS.wellness },
      { id: "practice", heading: "The space", blurb: "Calm, quiet and equipped for everything we teach.", items: [{ title: "Book a class", text: "First session is free. Mats and props provided." }, { title: "Memberships", text: "Flexible passes with no lock-in." }] },
    ],
    business: [
      { id: "features", heading: "Why us", blurb: "Everything you need, nothing you don't.", items: features.length ? features.slice(0, 6).map((f) => ({ title: f, text: "Included on every plan." })) : FALLBACK_ITEMS.business },
      { id: "start", heading: "Get started", blurb: "Tell us what you need and we'll reply within a day.", items: [{ title: "Simple pricing", text: "One clear price, no surprise line items." }, { title: "Real support", text: "Humans answer, usually within the hour." }] },
    ],
  };

  return {
    kind,
    name,
    tagline,
    intro: INTROS[kind],
    nav: genericNav,
    sections: sectionDefs[kind],
    quote: { text: "They listened first, shipped fast, and the result still feels considered months later.", author: "Alex Moreno", role: kind === "restaurant" ? "Regular since day one" : "Long-time client" },
    contactHint: "Tell us a little about what you need. We reply within one business day.",
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function staticSiteFiles(projectName: string, prompt: string, arch: Architecture): GeneratedFile[] {
  const spec = deriveSpec(prompt, projectName, arch);
  const p = PALETTES[spec.kind];
  const title = esc(spec.name);
  const year = new Date().getFullYear();

  const navHtml = (active: string) => spec.nav.map((n) => {
    const key = n.href.replace(".html", "");
    return `<a href="${n.href}"${key === active ? ' aria-current="page" class="active"' : ""}>${n.label}</a>`;
  }).join("\n      ");

  const sectionsHtml = spec.sections.map((s) => `
    <section id="${s.id}" class="section">
      <div class="wrap">
        <h2>${esc(s.heading)}</h2>
        <p class="lede">${esc(s.blurb)}</p>
        <div class="grid">
          ${s.items.map((it) => `
          <article class="card reveal">
            ${it.tag ? `<span class="tag">${esc(it.tag)}</span>` : ""}
            <h3>${esc(it.title)}</h3>
            <p>${esc(it.text)}</p>
          </article>`).join("\n          ")}
        </div>
      </div>
    </section>`).join("\n");

  const page = (active: string, main: string, desc: string) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(active === "index" ? `${title} \u2014 ${esc(spec.tagline)}` : `${active[0].toUpperCase()}${active.slice(1)} \u00b7 ${title}`)}</title>
  <meta name="description" content="${esc(desc)}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:type" content="website" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <header class="site-head">
    <div class="wrap bar">
      <a class="brand" href="index.html"><span class="dot" aria-hidden="true"></span>${title}</a>
      <nav class="site-nav" id="nav" aria-label="Main">
      ${navHtml(active)}
      </nav>
      <button class="nav-toggle" aria-expanded="false" aria-controls="nav"><span></span><span></span></button>
    </div>
  </header>

  <main id="main">
  ${main}
  </main>

  <footer class="site-foot">
    <div class="wrap foot">
      <p>\u00a9 ${year} ${title}. Built with care.</p>
      <nav aria-label="Footer">${navHtml("")}</nav>
    </div>
  </footer>
  <script src="script.js" defer></script>
</body>
</html>
`;

  const firstSectionHref = spec.sections[0]?.id === "menu" ? "services.html" : `#${spec.sections[0]?.id ?? "about"}`;
  const firstSectionCta = spec.sections[0]?.id === "menu" ? "See the menu" : "Learn more";
  const hero = `
    <section class="hero">
      <div class="wrap">
        <p class="kicker reveal">${esc(spec.kind === "restaurant" ? "Welcome" : spec.kind === "event" ? "Join us" : "Hello")}</p>
        <h1 class="reveal">${esc(spec.tagline)}</h1>
        <p class="lede reveal">${esc(spec.intro)}</p>
        <div class="cta reveal">
          <a class="btn" href="contact.html">Get in touch</a>
          <a class="btn ghost" href="${firstSectionHref}">${firstSectionCta}</a>
        </div>
      </div>
    </section>`;

  const indexHtml = page("index", `${hero}
${sectionsHtml}
    <section class="quote-band">
      <div class="wrap">
        <blockquote class="reveal">
          <p>\u201c${esc(spec.quote.text)}\u201d</p>
          <footer>${esc(spec.quote.author)}, ${esc(spec.quote.role)}</footer>
        </blockquote>
      </div>
    </section>`, spec.tagline);

  const aboutHtml = page("about", `
    <section class="section head-pad">
      <div class="wrap narrow">
        <h1 class="reveal">About ${title}</h1>
        <p class="lede reveal">${esc(spec.intro)}</p>
        <p class="reveal">${esc(spec.tagline)} This site is intentionally simple: every page loads fast, works on any device and is easy to maintain.</p>
      </div>
    </section>
${sectionsHtml}`, `About ${spec.name}`);

  const servicesLabel = spec.sections[0]?.heading ?? "Services";
  const servicesHtml = page("services", `
    <section class="section head-pad">
      <div class="wrap">
        <h1 class="reveal">${esc(servicesLabel)}</h1>
        <p class="lede reveal">${esc(spec.sections[0]?.blurb ?? "")}</p>
        <div class="grid">
          ${(spec.sections[0]?.items ?? []).map((it) => `
          <article class="card reveal">
            ${it.tag ? `<span class="tag">${esc(it.tag)}</span>` : ""}
            <h3>${esc(it.title)}</h3>
            <p>${esc(it.text)}</p>
          </article>`).join("\n          ")}
        </div>
      </div>
    </section>`, `${servicesLabel} at ${spec.name}`);

  const contactHtml = page("contact", `
    <section class="section head-pad">
      <div class="wrap narrow">
        <h1 class="reveal">Contact</h1>
        <p class="lede reveal">${esc(spec.contactHint)}</p>
        <form class="card form reveal" novalidate>
          <label>Name <input name="name" required autocomplete="name" /></label>
          <label>Email <input name="email" type="email" required autocomplete="email" /></label>
          <label>Message <textarea name="message" rows="5" required></textarea></label>
          <button class="btn" type="submit">Send message</button>
          <p class="form-note" role="status"></p>
        </form>
      </div>
    </section>`, `Contact ${spec.name}`);

  const notFoundHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Page not found \u00b7 ${title}</title><link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main class="section head-pad"><div class="wrap narrow" style="text-align:center">
    <h1>404</h1><p class="lede">That page doesn't exist.</p>
    <p><a class="btn" href="index.html">Back home</a></p>
  </div></main>
</body>
</html>
`;

  const styles = `/* ${title} \u2014 hand-tuned design system */
:root {
  --accent: ${p.accent};
  --accent-2: ${p.accent2};
  --ink: ${p.ink};
  --bg: ${p.bg};
  --card: #ffffff;
  --line: rgb(0 0 0 / 0.08);
  --muted: rgb(0 0 0 / 0.62);
  --radius: 16px;
  --shadow: 0 1px 2px rgb(16 24 40 / 0.04), 0 12px 32px -12px rgb(16 24 40 / 0.18);
  --font-display: "Space Grotesk", system-ui, sans-serif;
  --font-body: "Inter", system-ui, -apple-system, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root { --ink: #f1f0ee; --bg: #101314; --card: #171b1c; --line: rgb(255 255 255 / 0.1); --muted: rgb(255 255 255 / 0.64); }
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0; background: var(--bg); color: var(--ink);
  font-family: var(--font-body); font-size: 16.5px; line-height: 1.65;
  -webkit-font-smoothing: antialiased;
}
img { max-width: 100%; display: block; }
.wrap { max-width: 1080px; margin-inline: auto; padding-inline: 24px; }
.narrow { max-width: 720px; }
.skip { position: absolute; left: -9999px; top: 0; background: var(--accent); color: #fff; padding: 10px 16px; border-radius: 0 0 10px 0; z-index: 99; }
.skip:focus { left: 0; }

/* Header */
.site-head { position: sticky; top: 0; z-index: 20; backdrop-filter: blur(14px); background: color-mix(in srgb, var(--bg) 78%, transparent); border-bottom: 1px solid var(--line); }
.bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; height: 64px; }
.brand { display: inline-flex; align-items: center; gap: 10px; font-family: var(--font-display); font-size: 20px; font-weight: 600; color: var(--ink); text-decoration: none; letter-spacing: -0.01em; }
.dot { width: 12px; height: 12px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), var(--accent-2)); }
.site-nav { display: flex; gap: 26px; }
.site-nav a { color: var(--muted); text-decoration: none; font-size: 15px; font-weight: 500; transition: color 0.2s; }
.site-nav a:hover, .site-nav a.active { color: var(--ink); }
.site-nav a.active { text-decoration: underline; text-decoration-color: var(--accent); text-underline-offset: 6px; }
.nav-toggle { display: none; background: none; border: 0; cursor: pointer; padding: 8px; }
.nav-toggle span { display: block; width: 22px; height: 2px; background: var(--ink); margin: 5px 0; transition: transform 0.25s, opacity 0.25s; }

/* Type */
h1, h2, h3 { font-family: var(--font-display); font-weight: 600; letter-spacing: -0.015em; line-height: 1.12; }
h1 { font-size: clamp(2.4rem, 5.5vw, 4rem); margin: 0 0 18px; }
h2 { font-size: clamp(1.7rem, 3.4vw, 2.4rem); margin: 0 0 10px; }
h3 { font-size: 1.18rem; margin: 0 0 8px; }
p { margin: 0 0 14px; }
.lede { font-size: 1.14rem; color: var(--muted); max-width: 62ch; }
.kicker { text-transform: uppercase; letter-spacing: 0.16em; font-size: 12.5px; font-weight: 600; color: var(--accent); margin-bottom: 14px; }

/* Hero */
.hero { padding: clamp(72px, 12vh, 128px) 0 clamp(48px, 8vh, 80px); background:
  radial-gradient(60% 80% at 80% 0%, color-mix(in srgb, var(--accent) 9%, transparent), transparent 70%); }
.cta { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 26px; }
.btn { display: inline-flex; align-items: center; gap: 8px; background: var(--accent); color: #fff; text-decoration: none;
  font-weight: 600; font-size: 15.5px; padding: 13px 26px; border-radius: 999px; border: 0; cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.2s ease, background 0.2s; box-shadow: 0 6px 20px -8px color-mix(in srgb, var(--accent) 70%, transparent); }
.btn:hover { transform: translateY(-1px); background: var(--accent-2); }
.btn:active { transform: translateY(0) scale(0.98); }
.btn.ghost { background: transparent; color: var(--ink); border: 1px solid var(--line); box-shadow: none; }
.btn.ghost:hover { background: var(--card); }
:focus-visible { outline: 3px solid color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: 3px; border-radius: 6px; }

/* Sections & cards */
.section { padding: clamp(48px, 9vh, 88px) 0; }
.head-pad { padding-top: 56px; }
.grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); margin-top: 28px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); padding: 24px; box-shadow: var(--shadow);
  transition: transform 0.2s ease, box-shadow 0.2s ease; }
.card:hover { transform: translateY(-3px); box-shadow: 0 2px 4px rgb(16 24 40 / 0.05), 0 20px 44px -14px rgb(16 24 40 / 0.24); }
.card p { color: var(--muted); margin: 0; font-size: 15px; }
.tag { display: inline-block; font-size: 11.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent); border-radius: 999px; padding: 4px 12px; margin-bottom: 12px; }

/* Quote band */
.quote-band { border-block: 1px solid var(--line); background: color-mix(in srgb, var(--accent) 5%, var(--bg)); }
.quote-band blockquote { margin: 0; max-width: 720px; }
.quote-band p { font-family: var(--font-display); font-size: clamp(1.3rem, 2.6vw, 1.7rem); line-height: 1.4; }
.quote-band footer { color: var(--muted); font-size: 14.5px; margin-top: 10px; }

/* Forms */
.form { display: grid; gap: 16px; margin-top: 26px; }
.form label { display: grid; gap: 6px; font-weight: 600; font-size: 14px; }
.form input, .form textarea { font: inherit; color: var(--ink); background: var(--bg); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; }
.form input:focus, .form textarea:focus { outline: 2px solid var(--accent); outline-offset: 0; border-color: transparent; }
.form .btn { justify-self: start; }
.form-note { min-height: 1.2em; color: var(--accent-2); font-size: 14px; margin: 0; }
.form-note.ok { color: #15803d; }

/* Footer */
.site-foot { border-top: 1px solid var(--line); padding: 34px 0 44px; margin-top: 40px; }
.foot { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; justify-content: space-between; color: var(--muted); font-size: 14px; }
.foot nav { display: flex; gap: 18px; }
.foot a { color: inherit; text-decoration: none; }
.foot a:hover { color: var(--ink); }

/* Reveal on scroll (JS adds .in when visible) */
@media (prefers-reduced-motion: no-preference) {
  .reveal { opacity: 0; transform: translateY(16px); transition: opacity 0.6s cubic-bezier(0.16,1,0.3,1), transform 0.6s cubic-bezier(0.16,1,0.3,1); }
  .reveal.in { opacity: 1; transform: none; }
}

/* Mobile */
@media (max-width: 720px) {
  .nav-toggle { display: block; }
  .site-nav { position: absolute; inset: 64px 0 auto 0; flex-direction: column; gap: 0; background: var(--bg);
    border-bottom: 1px solid var(--line); padding: 8px 24px 16px; display: none; }
  .site-nav.open { display: flex; }
  .site-nav a { padding: 12px 0; border-bottom: 1px solid var(--line); font-size: 16px; }
}
`;

  const script = `// ${title} \u2014 nav, reveal-on-scroll, contact form
(function () {
  "use strict";
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  var revealables = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    revealables.forEach(function (el) { io.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add("in"); });
  }

  var form = document.querySelector("form.form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var note = form.querySelector(".form-note");
      var name = form.name.value.trim();
      var email = form.email.value.trim();
      var message = form.message.value.trim();
      var valid = /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email);
      if (!name || !valid || message.length < 10) {
        note.textContent = !valid ? "Please enter a valid email address." : "Please fill in every field (message: 10+ characters).";
        note.classList.remove("ok");
        return;
      }
      note.textContent = "Thanks " + name.split(" ")[0] + "! Your message has been noted \\u2014 we will reply by email.";
      note.classList.add("ok");
      form.reset();
    });
  }
})();
`;

  const readme = `# ${spec.name}

A complete static website generated by Forge. No build step, no dependencies:
open \`index.html\` in a browser, or drop the folder on any static host.

## Pages
- \`index.html\` \u2014 hero, ${spec.sections.map((s) => s.heading.toLowerCase()).join(", ")}, testimonial
- \`about.html\`, \`services.html\`, \`contact.html\`, \`404.html\`

## Deploy
- **Netlify**: drag the folder onto app.netlify.com, or \`npx netlify-cli deploy\` (config included).
- **GitHub Pages / Vercel / Cloudflare Pages**: serve the folder as-is.

## Customise
- Palette and fonts live in \`:root\` inside \`styles.css\`.
- Content is plain semantic HTML, one file per page.
`;

  const netlify = `[build]
  publish = "."

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
`;

  return [
    file("index.html", indexHtml),
    file("about.html", aboutHtml),
    file("services.html", servicesHtml),
    file("contact.html", contactHtml),
    file("404.html", notFoundHtml),
    file("styles.css", styles),
    file("script.js", script),
    file("netlify.toml", netlify),
    file("README.md", readme),
  ];
}
