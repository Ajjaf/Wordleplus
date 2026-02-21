import React from "react";
import { motion } from "framer-motion";
import { cn } from "../lib/utils";
import MicroProgressGrid from "./mobile/MicroProgressGrid";

function initials(name = "") {
  return (
    (name || "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || "")
      .join("") || "?"
  );
}

/**
 * BattleProgressStrip
 * Horizontal scrollable row of compact opponent progress cards shown above
 * the game board in Battle Royale / AI Battle modes.
 *
 * - No scrollbar (hidden via CSS)
 * - Card count adapts to available width (natural overflow → scroll)
 * - Tile rows shown: 3 on mobile, 6 on desktop
 * - Each card: avatar + name + guess count + mini tile grid
 */
export function BattleProgressStrip({ players = [], isMobile = false, maxGuesses = 6 }) {
  if (!players.length) return null;

  const rows    = isMobile ? 3 : 4;
  const size    = isMobile ? 5 : 6;
  const gap     = 1.5;
  const avatarSz = isMobile ? 15 : 18;
  const avatarFs = isMobile ? 6  : 7;
  const nameFsStyle = { fontSize: isMobile ? 9 : 10 };
  const countFsStyle = { fontSize: 8 };
  const nameMaxW = isMobile ? 48 : 62;

  return (
    <div
      className="w-full flex-shrink-0 overflow-x-auto"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      {/* webkit scrollbar — inline style on the outer div handles Firefox/IE,
          this rule handles Chrome/Safari */}
      <style>{`.bps-scroll::-webkit-scrollbar{display:none}`}</style>

      {/*
        minWidth: "100%" ensures the inner div is at least as wide as the outer
        container, so justify-center can center the cards when there are few.
        width: "max-content" lets it grow wider when there are many cards,
        triggering the overflow-x-auto scroll on the outer div.
      */}
      <div
        className="bps-scroll flex justify-center gap-1.5 px-2 pb-1"
        style={{ minWidth: "100%", width: "max-content", boxSizing: "border-box" }}
      >
        {players.map((player, i) => {
          const guessCount = player.guesses?.length ?? 0;
          const patterns   = player.guesses?.map((g) => g.pattern || []) ?? [];
          const isDone     = Boolean(player.done);

          return (
            <motion.div
              key={player.id || i}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.18, ease: "easeOut" }}
              className={cn(
                // items-center centers both the name row and tile grid horizontally
                "flex-shrink-0 flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl",
                "bg-white/[0.04] border border-white/[0.07] backdrop-blur-sm",
                isDone && "border-emerald-500/20 bg-emerald-950/20"
              )}
            >
              {/* Name row — centered by parent items-center */}
              <div className="flex items-center gap-1.5">
                <div
                  className="rounded-full bg-white/[0.08] text-white/50 font-bold grid place-items-center flex-shrink-0"
                  style={{ width: avatarSz, height: avatarSz, fontSize: avatarFs }}
                >
                  {initials(player.name)}
                </div>
                <div className="flex flex-col leading-none gap-[2px]" style={{ maxWidth: nameMaxW }}>
                  <span
                    className="text-white/70 font-medium truncate block"
                    style={nameFsStyle}
                  >
                    {player.name}
                  </span>
                  <span
                    className={cn(
                      "block",
                      isDone ? "text-emerald-400/80" : "text-white/25"
                    )}
                    style={countFsStyle}
                  >
                    {isDone ? "✓" : `${guessCount}/${maxGuesses}`}
                  </span>
                </div>
              </div>

              {/* Mini tile grid — centered by parent items-center */}
              <MicroProgressGrid
                rows={rows}
                cols={5}
                size={size}
                gap={gap}
                radius={1}
                patterns={patterns.length ? patterns : null}
                fallbackFilled={0}
                showWrapper={false}
                showCellBorder={false}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default BattleProgressStrip;
