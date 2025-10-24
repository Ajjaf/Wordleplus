import React from "react";
import Board from "../Board.jsx";
import { cn } from "../../lib/utils";

/**
 * Mobile-friendly wrapper around the main Board component.
 * Ensures the board scales dynamically on small screens without
 * drifting too far from the on-screen keyboard or overflowing it.
 */
export default function MobileBoard({
  className = "",
  boardClassName = "",
  minHeight = 300,
  maxHeight = 440,
  reservedBottom = 320,
  maxWidth = "min(420px, 92vw)",
  style = {},
  ...boardProps
}) {
  const heightExpression = `clamp(${minHeight}px, calc(100dvh - (${reservedBottom}px + env(safe-area-inset-bottom, 0px))), ${maxHeight}px)`;
  const computedMaxWidth =
    typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth;

  return (
    <div
      className={cn("w-full flex justify-center", className)}
      style={style}
    >
      <div
        className="w-full"
        style={{
          maxWidth: computedMaxWidth,
          height: heightExpression,
          minHeight,
        }}
      >
        <Board
          {...boardProps}
          className={cn("w-full h-full", boardClassName)}
        />
      </div>
    </div>
  );
}
