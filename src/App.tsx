import { useState } from "react";
import { StoreProvider, useStore } from "./lib/store";
import LandingPage from "./components/LandingPage";
import AppShell, { CreateProjectModal } from "./components/AppShell";
import DashboardPage from "./components/DashboardPage";
import WorkspacePage from "./components/WorkspacePage";
import ModelsPage from "./components/ModelsPage";
import SkillsPage from "./components/SkillsPage";
import SettingsPage from "./components/SettingsPage";

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
