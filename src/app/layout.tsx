import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Forge — Agentic Full-Stack Code Generation",
  description:
    "Describe the product. Seven specialist AI agents plan the architecture, model the database, write the API, build the UI, test it and ship it — with you approving the risky steps.",
  keywords: ["AI agents", "code generation", "full-stack", "Next.js", "PostgreSQL"],
};

export const viewport: Viewport = { themeColor: "#06070c", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Sora:wght@500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
