import { useState } from "react";
import { ThemeProvider } from "./theme";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Dashboard from "./components/Dashboard";
import PredictForm from "./components/PredictForm";
import ExposureForm from "./components/ExposureForm";
import HealthRiskForm from "./components/HealthRiskForm";
import HealthReport from "./components/HealthReport";
import { AqiProvider } from "./aqiContext";
import "./App.css";

const PAGES = [
  { id: 0, label: "Dashboard",    subtitle: "City AQI overview & AI insights" },
  { id: 1, label: "Predict AQI",  subtitle: "AI-powered air quality forecast" },
  { id: 2, label: "Exposure",     subtitle: "7-day cumulative exposure analysis" },
  { id: 3, label: "Health Risk",  subtitle: "Personalised risk assessment" },
  { id: 4, label: "Health Report", subtitle: "AI-generated comprehensive report" },
];

export default function App() {
  const [page, setPage]         = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const current = PAGES[page];

  const handleSelect = (id) => {
    setPage(id);
    setMobileOpen(false);
  };

  return (
    <ThemeProvider>
      <AqiProvider>
      <div className="app-shell">
        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
              zIndex: 99, backdropFilter: "blur(2px)",
            }}
            onClick={() => setMobileOpen(false)}
          />
        )}

        <Sidebar
          active={page}
          onSelect={handleSelect}
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          mobileOpen={mobileOpen}
        />

        <div className="main-area">
          <Header
            title={current.label}
            subtitle={current.subtitle}
            onMenuClick={() => setMobileOpen((o) => !o)}
          />

          <main className="page-content page-enter" key={page}>
            {page === 0 && <Dashboard />}
            {page === 1 && <PredictForm />}
            {page === 2 && <ExposureForm />}
            {page === 3 && <HealthRiskForm />}
            {page === 4 && <HealthReport />}
          </main>
        </div>
      </div>
      </AqiProvider>
    </ThemeProvider>
  );
}
