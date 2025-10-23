import React, { useMemo } from "react";
import MicroProgressGrid from "./MicroProgressGrid.jsx";

const BADGE_BG = "rgba(255,255,255,0.12)";
const BADGE_TEXT = "#f8fafc";
const DISPLAY_ROWS = 5;
const DISPLAY_COLS = 5;

function getInitial(name) {
  if (!name) return "?";
  return name.trim().charAt(0).toUpperCase();
}

function buildPatterns(guesses = [], rows = DISPLAY_ROWS, cols = DISPLAY_COLS) {
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
  maxGuesses = DISPLAY_ROWS,
  isActive = false,
  onSelect,
}) {
  const totalGuesses = guesses?.length ?? 0;
  const rowsToShow = Math.max(
    1,
    Math.min(DISPLAY_ROWS, maxGuesses || DISPLAY_ROWS)
  );
  const patterns = useMemo(
    () => buildPatterns(guesses, rowsToShow, DISPLAY_COLS),
    [guesses, rowsToShow]
  );
  const fallbackFilled = !patterns
    ? Math.min(totalGuesses, rowsToShow) * DISPLAY_COLS
    : 0;

  const baseClasses =
    "flex w-full max-w-[11rem] items-center gap-2 rounded-2xl border px-2.5 py-2 transition-all duration-200";
  const activeClasses =
    "border-violet-400 bg-violet-500/15 shadow-md shadow-violet-500/25";
  const inactiveClasses = "border-white/15 bg-white/10";

  const Wrapper = onSelect ? "button" : "div";

  return (
    <Wrapper
      type={onSelect ? "button" : undefined}
      onClick={onSelect}
      className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
    >
      <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-white font-semibold">
        {getInitial(name)}
        <span
          className={`absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full border-2 border-white ${
            isActive ? "bg-emerald-400" : "bg-slate-400/70"
          }`}
        />
      </div>

      <div className="flex flex-1 items-center justify-center">
        <MicroProgressGrid
          rows={rowsToShow}
          cols={DISPLAY_COLS}
          size={9}
          gap={1.5}
          radius={2}
          patterns={patterns}
          fallbackFilled={fallbackFilled}
          showWrapper={false}
          showCellBorder={false}
        />
      </div>

      <div className="flex flex-col items-stretch gap-1.5">
        <div
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm"
          style={{ backgroundColor: BADGE_BG, color: BADGE_TEXT }}
        >
          <span role="img" aria-hidden="true">🏆</span>
          <span>{wins}</span>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm"
          style={{ backgroundColor: BADGE_BG, color: BADGE_TEXT }}
        >
          <span role="img" aria-hidden="true">🔥</span>
          <span>{streak}</span>
        </div>
      </div>
    </Wrapper>
  );
}
