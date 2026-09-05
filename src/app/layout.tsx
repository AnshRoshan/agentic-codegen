import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Forge — Agentic Full-Stack Code Generation",
  description:
    "Describe the product. A team of seven specialised AI agents plans the architecture, models the database, writes the API, builds the UI, tests it and ships it — with you approving the risky steps.",
  keywords: ["AI agents", "code generation", "full-stack", "Next.js", "PostgreSQL"],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen font-sans">
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: { background: "#141829", border: "1px solid rgba(255,255,255,0.08)", color: "#eef1f9" },
          }}
        />
      </body>
    </html>
  );
}
