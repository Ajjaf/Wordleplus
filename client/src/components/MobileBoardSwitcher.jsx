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
  return (
    <div className={cn("w-full h-full flex items-center justify-center", className)}>
      <Board {...myBoard} />
    </div>
  );
}
