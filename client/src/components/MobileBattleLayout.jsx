import React, { useState } from "react";
import Board from "./Board.jsx";
import PlayerProgressCard from "./PlayerProgressCard.jsx";
import { cn } from "@/lib/utils";

export default function MobileBattleLayout({
  me,
  otherPlayers,
  currentGuess,
  shakeKey,
  showActiveError,
  letterStates,
  canGuessBattle,
  onKeyPress,
  className = "",
}) {
  const [showOtherPlayers, setShowOtherPlayers] = useState(false);
  const myGuesses = me?.guesses || [];
  const latestGuessWord = myGuesses.length
    ? (myGuesses[myGuesses.length - 1]?.guess || "").toUpperCase()
    : "";
  const normalizedCurrentGuess = (currentGuess || "").toUpperCase();
  const activeGuessForMobile =
    canGuessBattle && normalizedCurrentGuess && normalizedCurrentGuess !== latestGuessWord
      ? currentGuess
      : "";

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Progress Indicator */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full" />
          <span className="text-sm font-medium">Your Progress</span>
          <span className="text-xs text-slate-500">
            ({me?.guesses?.length || 0}/6)
          </span>
        </div>
        <button
          onClick={() => setShowOtherPlayers(!showOtherPlayers)}
          className="text-xs px-2 py-1 bg-slate-200 rounded hover:bg-slate-300 transition-colors"
        >
          {showOtherPlayers ? "Hide" : "Show"} Others (
          {otherPlayers?.length || 0})
        </button>
      </div>

      {/* Main Board Area */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <Board
            guesses={me?.guesses || []}
            activeGuess={activeGuessForMobile}
            errorShakeKey={shakeKey}
            errorActiveRow={showActiveError}
            maxTile={120}
            minTile={40}
          />
        </div>
      </div>

      {/* Other Players (Collapsible) */}
      {showOtherPlayers && (
        <div className="border-t bg-slate-50 max-h-32 overflow-y-auto">
          <div className="p-2">
            <h3 className="text-xs font-medium text-slate-600 mb-2 px-2">
              Other Players
            </h3>
            <div className="space-y-1">
              {otherPlayers?.map((player) => (
                <PlayerProgressCard
                  key={player.id}
                  player={player}
                  isMe={false}
                  className="text-xs"
                  compact={true}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Floating Toggle for Other Players - 48px minimum touch target */}
      <button
        onClick={() => setShowOtherPlayers(!showOtherPlayers)}
        className={cn(
          "fixed bottom-20 left-4 min-w-[48px] min-h-[48px] w-12 h-12 rounded-full",
          "bg-slate-600 hover:bg-slate-700 text-white",
          "shadow-lg hover:shadow-xl transition-all duration-200",
          "flex items-center justify-center text-lg font-bold",
          "z-20 touch-manipulation"
        )}
        aria-label={showOtherPlayers ? "Hide other players" : "Show other players"}
      >
        {showOtherPlayers ? "👥" : "👤"}
      </button>
    </div>
  );
}
