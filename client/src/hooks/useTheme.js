import { useEffect, useState, useCallback } from "react";

const LS_KEY = "pw.theme"; // 'light' | 'dark' | 'system'

export function useTheme() {
  // Initialize with a safe default and update after mount
  const [theme, setTheme] = useState("system");
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize theme after component mounts
  useEffect(() => {
    const savedTheme = localStorage.getItem(LS_KEY) || "system";
    setTheme(savedTheme);
    setIsInitialized(true);
  }, []);

  const apply = useCallback((t) => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;
    const systemDark = window.matchMedia?.(
      "(prefers-color-scheme: dark)"
    )?.matches;
    const shouldDark = t === "dark" || (t === "system" && systemDark);
    root.classList.toggle("dark", shouldDark);
  }, []);

  useEffect(() => {
    if (!isInitialized) return;

    apply(theme);
    localStorage.setItem(LS_KEY, theme);
  }, [theme, apply, isInitialized]);

  useEffect(() => {
    if (!isInitialized || theme !== "system") return;

    // Live update if user switches OS theme while on 'system'
    const m = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    m.addEventListener?.("change", onChange);
    return () => m.removeEventListener?.("change", onChange);
  }, [theme, apply, isInitialized]);

  const toggle = useCallback(() => {
    if (!isInitialized) return;
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, [isInitialized]);

  return { theme, setTheme, toggle };
}
