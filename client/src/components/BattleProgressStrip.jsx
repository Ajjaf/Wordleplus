import React from "react";
import MicroProgressGrid from "./mobile/MicroProgressGrid";
import PlayerAvatar from "./PlayerAvatar";

/**
 * NYT-style progress strip: avatar + visible 6-row mini grid per player.
 * No name text — just the avatar and pattern grid, at a comfortable size.
 */
export function BattleProgressStrip({ players = [], isMobile = false }) {
  if (!players.length) return null;

  const avatarSize = isMobile ? 36 : 44;
  const gridTile = isMobile ? 8 : 10;
  const gridGap = isMobile ? 1.5 : 2;
  const gridRows = 6;

  return (
    <div
      className="w-full flex-shrink-0 overflow-x-auto"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <style>{`.bps-scroll::-webkit-scrollbar{display:none}`}</style>

      <div
        className="bps-scroll flex justify-center gap-3 px-3 py-2"
        style={{ minWidth: "100%", width: "max-content", boxSizing: "border-box" }}
      >
        {players.map((player, i) => {
          const patterns = player.guesses?.map((g) => g.pattern || []) ?? [];
          const isDone = Boolean(player.done);

          return (
            <div
              key={player.id || i}
              className="flex-shrink-0 flex items-center gap-2 px-2.5 py-2 rounded-xl border border-white/[0.08]"
            >
              <PlayerAvatar
                avatarKey={player.profileAvatar}
                colour={player.profileColour}
                name={player.name}
                size={avatarSize}
                done={isDone}
              />

              <MicroProgressGrid
                rows={gridRows}
                cols={5}
                size={gridTile}
                gap={gridGap}
                radius={2}
                patterns={patterns.length ? patterns : null}
                fallbackFilled={0}
                showWrapper={false}
                showCellBorder={false}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default BattleProgressStrip;
