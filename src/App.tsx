import { useState, useEffect } from "react";
import { getStoredConfig } from "@/lib/supabase";
import Setup from "@/pages/Setup";
import Dashboard from "@/pages/Dashboard";

function registerSW() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }
}

registerSW();

export default function App() {
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    setConfigured(!!getStoredConfig());
  }, []);

  if (configured === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!configured) {
    return <Setup onComplete={() => setConfigured(true)} />;
  }

  return <Dashboard onLogout={() => setConfigured(false)} />;
}
