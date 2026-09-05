import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "EDL — Agentic Codebase Studio",
  description:
    "Production-grade agentic codebase generation. Universal domain inference, specialized AI crew, live Monaco editor, database designer, env-var vault, human-in-the-loop approvals, and full token/cost observability.",
  keywords: ["AI", "code generation", "agents", "Next.js", "greenfield", "brownfield", "EDL"],
  openGraph: {
    title: "EDL — Agentic Codebase Studio",
    description: "Generate any full-stack application with orchestrated AI agents.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#04070d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter+Display:wght@700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
