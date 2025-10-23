import React, { useMemo } from "react";
import MicroProgressGrid from "./MicroProgressGrid.jsx";

const BADGE_BG = "rgba(255,255,255,0.12)";
const BADGE_TEXT = "#f8fafc";

function getInitial(name) {
  if (!name) return "?";
  return name.trim().charAt(0).toUpperCase();
}

function buildPatterns(guesses = [], rows = 3, cols = 5) {
  if (!Array.isArray(guesses) || guesses.length === 0) {
    return null;
  }

  return guesses
    .slice(-rows)
    .map((guess) => guess?.pattern || [])
    .map((pattern) =>
      Array.from({ length: cols }, (_, idx) => pattern?.[idx] ?? "idle")
    );
}

export default function MobilePlayerProgressCard({
  name,
  wins = 0,
  streak = 0,
  guesses = [],
  maxGuesses = 6,
  isActive = false,
  onSelect,
}) {
  const totalGuesses = guesses?.length ?? 0;
  const patterns = useMemo(
    () => buildPatterns(guesses, 3, 5),
    [guesses]
  );
  const fallbackFilled = !patterns ? totalGuesses * 5 : 0;

  const baseClasses =
    "flex-shrink-0 w-40 rounded-3xl border px-4 py-3 transition-all duration-200 backdrop-blur";
  const activeClasses =
    "border-violet-400 bg-violet-500/20 shadow-lg shadow-violet-500/30";
  const inactiveClasses = "border-white/10 bg-white/5";

  const Wrapper = onSelect ? "button" : "div";

  return (
    <Wrapper
      type={onSelect ? "button" : undefined}
      onClick={onSelect}
      className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-white grid place-items-center font-semibold">
          {getInitial(name)}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-white truncate">
            {name}
          </span>
          <span className="text-xs text-white/70">
            {totalGuesses}/{maxGuesses} guesses
          </span>
        </div>
      </div>

      <div className="mt-3">
        <MicroProgressGrid
          rows={3}
          cols={5}
          size={12}
          gap={3}
          radius={3}
          patterns={patterns}
          fallbackFilled={fallbackFilled}
        />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div
          className="flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
          style={{ backgroundColor: BADGE_BG, color: BADGE_TEXT }}
        >
          <span role="img" aria-hidden="true">
            🏆
          </span>
          <span>{wins}</span>
        </div>
        <div
          className="flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
          style={{ backgroundColor: BADGE_BG, color: BADGE_TEXT }}
        >
          <span role="img" aria-hidden="true">
            🔥
          </span>
          <span>{streak}</span>
        </div>
      </div>
    </Wrapper>
  );
}
