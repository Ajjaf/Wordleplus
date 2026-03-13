import React from "react";
import Board from "./Board";
import PlayerAvatar from "./PlayerAvatar";

function SpectateCard({ player, room }) {
  const isHost = player?.id === room?.hostId;

  return (
    <div
      className="rounded-xl border p-3 h-full flex flex-col"
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor: "var(--card-border)",
        color: "var(--card-text)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <PlayerAvatar
          avatarKey={isHost ? null : player?.profileAvatar}
          colour={isHost ? null : player?.profileColour}
          name={player?.name}
          size={32}
        />
        <div className="min-w-0">
          <div
            className="text-sm font-semibold truncate"
            style={{ color: "var(--card-text)" }}
          >
            {player?.name || "—"}{" "}
            {isHost && (
              <span className="text-xs text-blue-600 font-medium">(Host)</span>
            )}
          </div>
          <div className="text-xs" style={{ color: "var(--card-text-muted)" }}>
            {isHost
              ? "Spectating"
              : player?.done
              ? "Done"
              : `${player?.guesses?.length ?? 0}/6`}
          </div>
        </div>
      </div>

      {/* Board (fills remaining space) */}
      <div className="mt-2 flex-1 min-h-[260px] grid place-items-center">
        <div className="w-full h-full">
          <Board
            guesses={player?.guesses || []}
            activeGuess=""
            // Let Board size itself using its ResizeObserver
            // (do NOT pass fixed tile; no autoFit={false})
            maxTile={90}
            minTile={38}
            isOwnBoard={false}
            className="w-full h-full"
          />
        </div>
      </div>
    </div>
  );
}

export default SpectateCard;
