// components/Keyboard.jsx
import React, { useMemo, useState } from "react";
import { cn } from "../lib/utils";

// Exact palette to match Board.jsx
const BOARD_COLORS = {
  correct: { bg: "#6aaa64", fg: "#fff", border: "#6aaa64" }, // green
  present: { bg: "#c9b458", fg: "#fff", border: "#c9b458" }, // yellow
  absent: { bg: "#787c7e", fg: "#fff", border: "#787c7e" }, // gray
  // Idle matches Wordle keys:
  idleLight: { bg: "#d3d6da", fg: "#111", border: "#c4c7cb" },
  idleDark: { bg: "#565758", fg: "#fff", border: "#3a3a3c" },
};

export default function Keyboard({
  onKeyPress,
  letterStates = {}, // { A: 'correct' | 'present' | 'absent' }
  sticky = true,
  disabled = false, // <- NEW: disable all keys when not accepting input
  className,
}) {
  const rows = useMemo(
    () => [
      ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
      ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
      ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"],
    ],
    []
  );

  const press = (k) => {
    if (disabled || !onKeyPress) return;
    onKeyPress(k);
  };

  const Key = ({ label }) => {
    const state = letterStates[label] || "idle";
    const isAction = label === "ENTER" || label === "BACKSPACE";
    const aria =
      label === "BACKSPACE"
        ? "Backspace"
        : label === "ENTER"
        ? "Enter"
        : `Letter ${label}`;

    const [active, setActive] = useState(false);
    const [pressed, setPressed] = useState(false);

    // Use CSS variables for theming to ensure perfect dark mode contrast
    const idle = {
      bg:
        typeof window !== "undefined"
          ? getComputedStyle(document.documentElement)
              .getPropertyValue("--key-idle-bg")
              .trim() || BOARD_COLORS.idleLight.bg
          : BOARD_COLORS.idleLight.bg,
      fg:
        typeof window !== "undefined"
          ? getComputedStyle(document.documentElement)
              .getPropertyValue("--key-idle-fg")
              .trim() || BOARD_COLORS.idleLight.fg
          : BOARD_COLORS.idleLight.fg,
      border:
        typeof window !== "undefined"
          ? getComputedStyle(document.documentElement)
              .getPropertyValue("--key-idle-border")
              .trim() || BOARD_COLORS.idleLight.border
          : BOARD_COLORS.idleLight.border,
    };

    const swatch =
      state === "correct"
        ? BOARD_COLORS.correct
        : state === "present"
        ? BOARD_COLORS.present
        : state === "absent"
        ? {
            // Use darker styling for used incorrect letters
            bg:
              typeof window !== "undefined"
                ? getComputedStyle(document.documentElement)
                    .getPropertyValue("--key-used-bg")
                    .trim() || "#f1f5f9"
                : "#f1f5f9",
            fg:
              typeof window !== "undefined"
                ? getComputedStyle(document.documentElement)
                    .getPropertyValue("--key-used-fg")
                    .trim() || "#94a3b8"
                : "#94a3b8",
            border:
              typeof window !== "undefined"
                ? getComputedStyle(document.documentElement)
                    .getPropertyValue("--key-used-border")
                    .trim() || "#e2e8f0"
                : "#e2e8f0",
          }
        : idle;

    const handlePress = () => {
      if (disabled) return;
      setPressed(true);
      press(label);
      if (navigator.vibrate) navigator.vibrate(40);
      setTimeout(() => setPressed(false), 120);
    };

    return (
      <button
        type="button"
        aria-label={aria}
        aria-pressed={active ? "true" : "false"}
        aria-disabled={disabled ? "true" : "false"}
        disabled={disabled}
        data-state={state}
        onPointerDown={() => {
          if (disabled) return;
          setActive(true);
          handlePress();
        }}
        onPointerUp={() => setActive(false)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" && label === "ENTER") handlePress();
          if (e.key === "Backspace" && label === "BACKSPACE") handlePress();
        }}
        className={cn(
          "select-none rounded-md px-2 sm:px-2 py-3 sm:py-2.5 font-semibold",
          "leading-none uppercase tracking-wide",
          "transition-all duration-200 ease-out",
          "focus:outline-none focus-visible:ring-2 ring-offset-2 ring-offset-background ring-primary",
          "hover:scale-105 hover:shadow-lg",
          "active:scale-95 active:shadow-sm",
          isAction
            ? "text-[11px] sm:text-xs basis-[18%] sm:basis-[10%]"
            : "text-sm sm:text-base basis-[9%] sm:basis-[7%]",
          "min-h-[48px] sm:min-h-[40px] touch-manipulation",
          disabled && "opacity-40 cursor-not-allowed hover:scale-100 grayscale"
        )}
        style={{
          background: swatch.bg,
          color: swatch.fg,
          border: `1px solid ${swatch.border}`,
          transform: pressed
            ? "scale(0.9)"
            : active
            ? "scale(0.95)"
            : "scale(1)",
          transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow:
            state === "correct"
              ? "0 2px 8px rgba(106,170,100,0.35)"
              : state === "present"
              ? "0 2px 8px rgba(201,180,88,0.35)"
              : state === "absent"
              ? "0 1px 4px rgba(0,0,0,0.2)"
              : "inset 0 -2px 0 rgba(0,0,0,0.08)",
        }}
      >
        {label === "BACKSPACE" ? "Back" : label}
      </button>
    );
  };

  return (
    <div
      className={cn(
        sticky ? "fixed md:static bottom-0 left-0 right-0 z-30 md:z-auto" : "",
        className
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        className={cn(
          "mx-auto w-full max-w-7xl",
          sticky
            ? "md:bg-transparent border-t md:border-0 border-neutral-200/80 dark:border-neutral-800/30"
            : ""
        )}
      >
        <div className="px-1 pt-1 pb-2 md:px-2 md:p-0">
          {disabled && (
            <div className="text-center mb-2">
              <div className="text-xs text-muted-foreground font-medium">
                Waiting for your turn...
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2 md:gap-1 items-center justify-center">
            {rows.map((row, idx) => (
              <div
                key={idx}
                className={cn(
                  "w-full flex items-center justify-center gap-1.5 md:gap-1",
                  idx === 1 && "px-2 md:px-3",
                  idx === 2 && "px-0"
                )}
              >
                {row.map((k) => (
                  <Key key={k} label={k} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
