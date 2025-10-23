import React from "react";

function GameHeader({ mode, room, isHost, players }) {
  const getHeaderTitle = () => {
    switch (mode) {
      case "duel":
        return "Fewest guesses wins";
      case "battle":
        return "Battle Royale";
      default:
        return "Wordle Plus";
    }
  };

  const getHeaderClass = () => {
    switch (mode) {
      case "duel":
        return "px-4 pt-3 pb-2";
      case "battle":
        return "px-4 pt-4 pb-6";
      default:
        return "px-4 pt-3 pb-2";
    }
  };

  const getTitleClass = () => {
    switch (mode) {
      case "duel":
        return "text-base md:text-lg font-semibold text-center text-muted-foreground";
      case "battle":
        return "text-2xl font-bold text-slate-800 text-center mb-2";
      default:
        return "text-base md:text-lg font-semibold text-center text-muted-foreground";
    }
  };

  return (
    <header className={getHeaderClass()}>
      {mode === "duel" ? (
        <h2 className={getTitleClass()}>{getHeaderTitle()}</h2>
      ) : (
        <div className="max-w-7xl mx-auto">
          <h2 className={getTitleClass()}>{getHeaderTitle()}</h2>

          {/* Game Status - Only show to host, not to players */}
          {isHost && room?.battle?.secret && (
            <div className="text-center space-y-1">
              <p className="text-sm text-slate-600">
                Current Word:{" "}
                <span className="font-mono font-bold text-slate-800">
                  {room.battle.secret}
                </span>
              </p>
              {room?.battle?.started &&
                !room?.battle?.winner &&
                !room?.battle?.reveal && (
                  <p className="text-xs text-emerald-600 font-medium">
                    Game in progress...
                  </p>
                )}
              {room?.battle?.winner && (
                <p className="text-xs text-blue-600 font-medium">
                  Winner:{" "}
                  {players.find((p) => p.id === room.battle.winner)?.name ||
                    "Unknown"}
                </p>
              )}
              {room?.battle?.reveal && !room?.battle?.winner && (
                <p className="text-xs text-amber-600 font-medium">
                  No winner - word revealed
                </p>
              )}
            </div>
          )}

          {/* Game Status for Players - No word spoilers */}
          {!isHost && (
            <div className="text-center space-y-1">
              {room?.battle?.started &&
                !room?.battle?.winner &&
                !room?.battle?.reveal && (
                  <p className="text-xs text-emerald-600 font-medium">
                    Game in progress... Good luck!
                  </p>
                )}
              {room?.battle?.winner && (
                <p className="text-xs text-blue-600 font-medium">
                  Winner:{" "}
                  {players.find((p) => p.id === room.battle.winner)?.name ||
                    "Unknown"}
                </p>
              )}
              {room?.battle?.reveal && !room?.battle?.winner && (
                <p className="text-xs text-amber-600 font-medium">
                  No winner - word revealed
                </p>
              )}
              {!room?.battle?.started &&
                !room?.battle?.winner &&
                !room?.battle?.reveal && (
                  <p className="text-xs text-slate-600 font-medium">
                    Waiting for host to start the game...
                  </p>
                )}
            </div>
          )}
        </div>
      )}
    </header>
  );
}

export default GameHeader;
