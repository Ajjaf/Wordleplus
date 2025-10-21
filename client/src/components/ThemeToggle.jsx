import React, { useState, useEffect } from "react";
import { useTheme } from "../hooks/useTheme";

export default function ThemeToggle({ className = "" }) {
  const [isReady, setIsReady] = useState(false);

  // Ensure component is ready before using hooks
  useEffect(() => {
    setIsReady(true);
  }, []);

  if (!isReady) {
    return (
      <div className={`inline-flex items-center gap-1 ${className}`}>
        <div className="h-8 w-8 rounded-md border border-slate-300 bg-white/70 animate-pulse"></div>
        <div className="h-8 w-16 rounded-md border border-slate-300 bg-white/70 animate-pulse"></div>
      </div>
    );
  }

  return <ThemeToggleContent className={className} />;
}

function ThemeToggleContent({ className = "" }) {
  const { theme, setTheme, toggle } = useTheme();
  const next =
    theme === "dark" ? "light" : theme === "light" ? "system" : "dark";

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <button
        onClick={toggle}
        className="h-8 w-8 rounded-md border border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 shadow-sm grid place-items-center transition"
        title="Toggle theme"
        aria-label="Toggle theme"
      >
        <span className="text-slate-700 dark:text-slate-200">
          {theme === "dark" ? "🌙" : "☀️"}
        </span>
      </button>
      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        className="h-8 rounded-md border border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 text-xs px-2 text-slate-700 dark:text-slate-200"
        aria-label="Theme mode"
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>
    </div>
  );
}
