"use client";
import { useState } from "react";
import { StoreProvider, useStore } from "@/lib/store";
import LandingPage from "./LandingPage";
import AppShell, { CreateProjectModal } from "./AppShell";
import DashboardPage from "./DashboardPage";
import WorkspacePage from "./WorkspacePage";
import ModelsPage from "./ModelsPage";
import SkillsPage from "./SkillsPage";
import SettingsPage from "./SettingsPage";

function Shell() {
  const { view } = useStore();
  const [modal, setModal] = useState(false);

  if (view === "landing") return <LandingPage />;

  return (
    <AppShell onNew={() => setModal(true)}>
      {view === "dashboard" && <DashboardPage onNew={() => setModal(true)} />}
      {view === "workspace" && <WorkspacePage />}
      {view === "models" && <ModelsPage />}
      {view === "skills" && <SkillsPage />}
      {view === "settings" && <SettingsPage />}
      <CreateProjectModal open={modal} onClose={() => setModal(false)} />
    </AppShell>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
