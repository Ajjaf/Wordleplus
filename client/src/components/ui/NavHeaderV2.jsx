import { motion } from "framer-motion";
import { Moon, Sun, User, Copy, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function NavHeaderV2({
  onHomeClick,
  right = null,
  modeLabel = null,
  roomId = null,
}) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("pw.theme");
    if (stored === "dark") return true;
    if (stored === "light") return false;
    return (
      window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? true
    );
  });
  const [copied, setCopied] = useState(false);
  const copyResetTimeout = useRef(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.toggle("dark", isDark);
    localStorage.setItem("pw.theme", isDark ? "dark" : "light");
  }, [isDark]);

  const handleCopyRoomId = async () => {
    if (!roomId) return;

    try {
      await navigator.clipboard?.writeText?.(roomId);
      setCopied(true);
      if (copyResetTimeout.current) {
        clearTimeout(copyResetTimeout.current);
      }
      copyResetTimeout.current = setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Swallow clipboard errors silently to avoid noisy UX
    }
  };

  useEffect(() => {
    setCopied(false);
  }, [roomId]);

  useEffect(() => {
    return () => {
      if (copyResetTimeout.current) {
        clearTimeout(copyResetTimeout.current);
      }
    };
  }, []);

  return (
    <motion.nav
      className="sticky top-0 z-50 backdrop-blur-lg border-b border-white/10"
      style={{
        background: "rgba(11, 11, 16, 0.8)",
        boxShadow: "0 1px 0 0 rgba(124, 58, 237, 0.3)",
      }}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20 relative">
          <motion.button
            type="button"
            onClick={onHomeClick}
            className="flex items-center gap-3 hover:opacity-90 active:scale-[0.98] transition"
            whileHover={{ scale: 1.02 }}
            aria-label="Go to Home"
          >
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
              <span className="text-white font-bold text-lg md:text-xl">W</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              WordlePlus
            </h1>
          </motion.button>

          {modeLabel && (
            <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 hidden sm:flex items-center">
              <p className="text-xs sm:text-sm font-semibold tracking-[0.3em] uppercase text-white/70 text-center">
                {modeLabel}
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 md:gap-4">
            {right}
            {roomId && (
              <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-white/80 border border-white/20 rounded-md pl-2 pr-1 h-8">
                <span className="font-mono tracking-wider">{roomId}</span>
                <button
                  type="button"
                  onClick={handleCopyRoomId}
                  className="h-7 w-7 rounded bg-white/10 hover:bg-white/20 border border-white/10 text-white transition flex items-center justify-center"
                  aria-label={copied ? "Room id copied" : "Copy room id"}
                  title={copied ? "Copied!" : "Copy room id"}
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  <span className="sr-only">
                    {copied ? "Room id copied" : "Copy room id"}
                  </span>
                </button>
              </div>
            )}
            <motion.button
              onClick={() => setIsDark((prev) => !prev)}
              className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center border border-white/10 transition-all"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? (
                <Sun className="w-5 h-5 text-yellow-400" />
              ) : (
                <Moon className="w-5 h-5 text-blue-400" />
              )}
            </motion.button>

            <motion.button
              className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center border border-white/20"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              aria-label="User profile"
            >
              <User className="w-5 h-5 text-white" />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
