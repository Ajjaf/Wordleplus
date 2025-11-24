import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

/**
 * GameTimer - Unified timer component for all timed game modes
 * 
 * Displays countdown timer with visual progress bar
 */
export function GameTimer({
  deadline, // Timestamp in ms
  countdownEndsAt, // Alternative: countdown end timestamp
  label = "Time Remaining:",
  showProgress = true,
  size = "md", // "sm" | "md" | "lg"
  className = "",
  onExpire,
}) {
  const [remaining, setRemaining] = useState(() => {
    const target = deadline || countdownEndsAt;
    return target ? Math.max(0, target - Date.now()) : 0;
  });
  
  const [initialTotal, setInitialTotal] = useState(null);
  
  useEffect(() => {
    const target = deadline || countdownEndsAt;
    if (!target) {
      setRemaining(0);
      setInitialTotal(null);
      return;
    }
    
    const first = Math.max(0, target - Date.now());
    setRemaining(first);
    setInitialTotal((t) => (t == null ? first : t));
    
    const interval = setInterval(() => {
      const newRemaining = Math.max(0, target - Date.now());
      setRemaining(newRemaining);
      
      if (newRemaining === 0 && onExpire) {
        onExpire();
      }
    }, 250);
    
    return () => clearInterval(interval);
  }, [deadline, countdownEndsAt, onExpire]);
  
  if (!deadline && !countdownEndsAt) return null;
  
  const secs = Math.ceil(remaining / 1000);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const timerLabel = `${mm}:${ss}`;
  
  const pct =
    initialTotal && initialTotal > 0
      ? Math.max(0, Math.min(100, (remaining / initialTotal) * 100))
      : null;
  
  const low = remaining <= 10_000; // <= 10s
  const warn = remaining <= 20_000; // <= 20s
  
  const sizeClasses = {
    sm: {
      label: "text-[10px] uppercase tracking-[0.4em]",
      timer: "px-1.5 py-0.5 text-xs",
      bar: "h-3 max-w-[120px]",
    },
    md: {
      label: "text-sm",
      timer: "px-3 py-1",
      bar: "h-8 max-w-xl",
    },
    lg: {
      label: "text-base",
      timer: "px-4 py-1.5 text-base",
      bar: "h-10 max-w-2xl",
    },
  }[size];
  
  return (
    <div className={className}>
      <div className="flex items-center justify-center gap-2">
        <span className={`text-white/60 ${sizeClasses.label}`}>
          {label}
        </span>
        <span
          className={`font-mono rounded-xl ${
            low
              ? "bg-red-500/20 text-red-300 border border-red-500/30"
              : warn
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
              : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
          } ${sizeClasses.timer}`}
        >
          {timerLabel}
        </span>
      </div>
      
      {showProgress && pct !== null && (
        <div
          className={`mx-auto w-full overflow-hidden rounded-full bg-white/10 mt-2 ${sizeClasses.bar}`}
        >
          <motion.div
            className={`h-full rounded-full ${
              low
                ? "bg-gradient-to-r from-red-500 to-red-600"
                : warn
                ? "bg-gradient-to-r from-amber-500 to-amber-600"
                : "bg-gradient-to-r from-emerald-500 to-cyan-500"
            }`}
            style={{ width: `${pct}%` }}
            initial={{ width: "100%" }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      )}
    </div>
  );
}

export default GameTimer;

