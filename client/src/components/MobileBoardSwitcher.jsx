import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import Board from "./Board.jsx";

export default function MobileBoardSwitcher({
  myBoard,
  opponentBoard,
  currentView = "me", // "me" | "opponent"
  onViewChange,
  className = "",
}) {
  const [view, setView] = useState(currentView);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const switchView = (newView) => {
    if (newView === view || isTransitioning) return;

    setIsTransitioning(true);
    setView(newView);
    onViewChange?.(newView);

    // Reset transition state
    setTimeout(() => setIsTransitioning(false), 300);
  };

  const currentBoard = view === "me" ? myBoard : opponentBoard;
  const currentPlayer = view === "me" ? myBoard.player : opponentBoard.player;

  return (
    <div className={cn("relative w-full h-full", className)}>
      {/* Progress Indicator */}
      <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10">
        <div className="flex items-center gap-2 bg-black/80 text-white px-3 py-1 rounded-full text-xs">
          <div className="flex items-center gap-1">
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                view === "me" ? "bg-blue-400" : "bg-gray-400"
              )}
            />
            <span className="font-medium">You</span>
            <span className="text-gray-300">
              ({myBoard.guesses?.length || 0}/6)
            </span>
          </div>
          <div className="w-px h-3 bg-gray-500" />
          <div className="flex items-center gap-1">
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                view === "opponent" ? "bg-blue-400" : "bg-gray-400"
              )}
            />
            <span className="font-medium">Opponent</span>
            <span className="text-gray-300">
              ({opponentBoard.guesses?.length || 0}/6)
            </span>
          </div>
        </div>
      </div>

      {/* Board Container */}
      <div className="relative w-full h-full overflow-hidden">
        <div
          className={cn(
            "absolute inset-0 transition-transform duration-300 ease-in-out",
            view === "me" ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {/* My Board */}
          <div className="w-full h-full flex flex-col">
            <div className="flex-1 flex items-center justify-center p-4">
              <Board {...myBoard} />
            </div>
          </div>
        </div>

        <div
          className={cn(
            "absolute inset-0 transition-transform duration-300 ease-in-out",
            view === "opponent" ? "translate-x-0" : "translate-x-full"
          )}
        >
          {/* Opponent Board */}
          <div className="w-full h-full flex flex-col">
            <div className="flex-1 flex items-center justify-center p-4">
              <Board {...opponentBoard} />
            </div>
          </div>
        </div>
      </div>

      {/* Floating Toggle Button - 48px minimum touch target */}
      <button
        onClick={() => switchView(view === "me" ? "opponent" : "me")}
        className={cn(
          "absolute bottom-4 right-4 min-w-[48px] min-h-[48px] w-12 h-12 rounded-full",
          "bg-blue-600 hover:bg-blue-700 text-white",
          "shadow-lg hover:shadow-xl transition-all duration-200",
          "flex items-center justify-center text-lg font-bold",
          "z-20 touch-manipulation"
        )}
        disabled={isTransitioning}
        aria-label={view === "me" ? "View opponent's board" : "View your board"}
      >
        {view === "me" ? "👤" : "🧑‍💻"}
      </button>

      {/* Swipe Indicators */}
      <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 z-10">
        <div className="flex items-center gap-1 bg-black/60 text-white px-2 py-1 rounded-full text-xs">
          <span>← Swipe to switch →</span>
        </div>
      </div>
    </div>
  );
}
