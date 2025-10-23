import React from "react";
import { cn } from "@/lib/utils";
import Board from "./Board.jsx";

export default function MobileBoardSwitcher({
  myBoard,
  opponentBoard,
  currentView = "me",
  onViewChange,
  className = "",
}) {
  const hasOpponentBoard = Boolean(opponentBoard && Object.keys(opponentBoard).length);
  const activeBoard =
    currentView === "opponent" && hasOpponentBoard ? opponentBoard : myBoard;

  return (
    <div className={cn("relative w-full h-full flex items-center justify-center", className)}>
      <Board {...activeBoard} />

      {hasOpponentBoard && typeof onViewChange === "function" && (
        <div className="absolute top-2 right-2 flex items-center rounded-full border border-white/20 bg-white/10 backdrop-blur px-1 py-1 text-[11px] text-white/80">
          <button
            type="button"
            onClick={() => onViewChange("me")}
            className={`px-2 py-1 rounded-full transition ${
              currentView === "me" ? "bg-violet-500 text-white" : "hover:bg-white/10"
            }`}
          >
            You
          </button>
          <button
            type="button"
            onClick={() => onViewChange("opponent")}
            className={`px-2 py-1 rounded-full transition ${
              currentView === "opponent" ? "bg-violet-500 text-white" : "hover:bg-white/10"
            }`}
          >
            Opp
          </button>
        </div>
      )}
    </div>
  );
}
