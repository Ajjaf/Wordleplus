import React, { useEffect, useState } from "react";

const STORAGE_KEY = "pw.theme";

function useThemePreference() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark") return true;
    if (stored === "light") return false;
    return (
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? true
    );
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem(STORAGE_KEY, isDark ? "dark" : "light");
  }, [isDark]);

  return [isDark, setIsDark];
}

export default function ThemeToggle({ className = "" }) {
  const [isDark, setIsDark] = useThemePreference();

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <button
        onClick={() => setIsDark((prev) => !prev)}
        className="h-8 w-8 rounded-md border border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 shadow-sm grid place-items-center transition"
        title={isDark ? "Switch to light theme" : "Switch to dark theme"}
        aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      >
        <span className="text-slate-700 dark:text-slate-200">
          {isDark ? "🌙" : "☀️"}
        </span>
      </button>
      <span className="text-xs text-slate-600 dark:text-slate-300 uppercase tracking-[0.3em]">
        {isDark ? "Dark" : "Light"}
      </span>
    </div>
  );
}
