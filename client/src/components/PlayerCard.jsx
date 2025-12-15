import React, { memo } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Rich player summary card used across duel/shared/battle views.
 * Supports optional state chips, host flag, and winner/active accents.
 */
function PlayerCard({
  name = "Player",
  wins = 0,
  streak = 0,
  avatar,
  host = false,
  className,
  rightExtras,
  size = "md", // "sm" | "md"
  isTyping = false,
  hasSecret = false,
  disconnected = false,
  highlight = "none", // "none" | "active" | "winner"
}) {
  const initials =
    (name || "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((x) => x[0]?.toUpperCase())
      .join("") || "?";

  const isActive = highlight === "active";
  const isWinner = highlight === "winner";

  const avatarSizing =
    size === "sm"
      ? "w-10 h-10 text-lg"
      : "w-12 h-12 sm:w-14 sm:h-14 text-xl sm:text-2xl";

  const nameSizing = size === "sm" ? "text-sm" : "text-base";

  return (
    <Card
      data-active={isActive}
      className={cn(
        "relative overflow-hidden transition-all duration-300",
        isActive
          ? "ring-2 ring-primary shadow-lg"
          : "opacity-85 hover:opacity-95",
        className
      )}
      style={{
        background: "var(--gradient-card)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex-shrink-0 rounded-xl grid place-items-center font-bold transition-all",
              avatarSizing,
              isActive
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted text-muted-foreground"
            )}
            aria-hidden
          >
            {avatar || initials}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-2">
              <h3
                className={cn(
                  "font-semibold text-foreground truncate",
                  nameSizing
                )}
              >
                {name}
              </h3>
              {isActive && (
                <Badge variant="default" className="text-[10px] px-2 py-0">
                  Active
                </Badge>
              )}
              {isWinner && (
                <Badge variant="outline" className="text-[10px] px-2 py-0">
                  Winner
                </Badge>
              )}
              {host && (
                <Badge variant="secondary" className="text-[10px] px-2 py-0">
                  Host
                </Badge>
              )}
              {disconnected && (
                <Badge variant="destructive" className="text-[10px] px-2 py-0">
                  Offline
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-muted-foreground">
              {isTyping && !disconnected && (
                <Badge variant="secondary" className="text-[10px] px-2 py-0">
                  Typing...
                </Badge>
              )}
              {hasSecret && !disconnected && (
                <Badge variant="secondary" className="text-[10px] px-2 py-0">
                  Secret set
                </Badge>
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Wins</span>
                <span className="font-semibold text-foreground">
                  {wins ?? 0}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Streak</span>
                <span className="font-semibold text-foreground">
                  {streak ?? 0}
                </span>
              </div>
            </div>
          </div>

          {rightExtras && <div className="shrink-0">{rightExtras}</div>}
        </div>
      </div>

      {isActive && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/0 via-primary to-primary/0" />
      )}
      {isWinner && !isActive && (
        <div className="absolute inset-0 border border-emerald-500/40 pointer-events-none rounded-xl" />
      )}
    </Card>
  );
}

// Memoize PlayerCard component to prevent unnecessary re-renders
export default memo(PlayerCard);
