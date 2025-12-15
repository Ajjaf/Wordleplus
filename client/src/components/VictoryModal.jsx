import React, { useEffect, useRef, memo, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Trophy, Crown, X, RefreshCw, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// Enhanced Tiles component with animations
const Tiles = memo(function Tiles({ word = "", size = "md", animated = false }) {
  const letters = (word || "").toUpperCase().padEnd(5).slice(0, 5).split("");
  const sizeClasses = {
    sm: "h-8 w-8 text-sm",
    md: "h-12 w-12 text-base",
    lg: "h-14 w-14 text-lg",
  };
  
  return (
    <div className="flex items-center justify-center">
      <div className="flex gap-1.5">
        {letters.map((ch, i) => (
          <motion.div
            key={i}
            initial={animated ? { opacity: 0, scale: 0.8 } : false}
            animate={animated ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            className={cn(
              "grid place-items-center rounded-md font-bold text-white",
              sizeClasses[size],
              "bg-[#6aaa64] border border-[#6aaa64]"
            )}
          >
            {ch.trim()}
          </motion.div>
        ))}
      </div>
    </div>
  );
});

// Stats calculation utilities
function calculatePlayerStats(player, opponentSecret) {
  if (!player || !opponentSecret) {
    return {
      guessCount: 0,
      solveGuess: null,
      solved: false,
    };
  }

  const guesses = player.guesses || [];
  const guessCount = guesses.length;
  const solveGuess = guesses.findIndex((g) => g.guess === opponentSecret) + 1;
  const solved = solveGuess > 0;

  return {
    guessCount,
    solveGuess: solved ? solveGuess : null,
    solved,
  };
}

// Accessible, animated modal
function VictoryModal({
  open,
  onOpenChange,
  mode,
  winnerName = "",
  winnerId = null,
  leftName,
  rightName,
  leftSecret,
  rightSecret,
  leftPlayerId = null,
  rightPlayerId = null,
  leftPlayer = null, // Full player object with guesses, wins, streak
  rightPlayer = null, // Full player object with guesses, wins, streak
  battleSecret,
  onPlayAgain,
  showPlayAgain = true, // duel=true, battle=false
}) {
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement;
    setTimeout(() => {
      const btn = dialogRef.current?.querySelector("[data-autofocus]");
      (btn || dialogRef.current)?.focus();
    }, 0);

    const onKey = (e) => {
      if (e.key === "Escape") onOpenChange?.(false);
      if (e.key === "Tab") {
        const f = dialogRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!f || !f.length) return;
        const list = Array.from(f).filter(
          (el) => !el.hasAttribute("disabled") && el.getAttribute("tabindex") !== "-1"
        );
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          last.focus(); e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus(); e.preventDefault();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused.current?.focus?.();
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  const onOverlayClick = (e) => {
    if (e.target === overlayRef.current) onOpenChange?.(false);
  };

  // Calculate stats for duel mode
  const duelStats = useMemo(() => {
    if (mode !== "duel" || !leftPlayer || !rightPlayer || !leftSecret || !rightSecret) {
      return null;
    }

    const leftStats = calculatePlayerStats(leftPlayer, rightSecret);
    const rightStats = calculatePlayerStats(rightPlayer, leftSecret);

    // Determine winner based on who solved first or fewer guesses
    let actualWinner = winnerId;
    if (!actualWinner) {
      if (leftStats.solved && !rightStats.solved) actualWinner = leftPlayerId;
      else if (rightStats.solved && !leftStats.solved) actualWinner = rightPlayerId;
      else if (leftStats.solved && rightStats.solved) {
        actualWinner = leftStats.solveGuess < rightStats.solveGuess 
          ? leftPlayerId 
          : rightStats.solveGuess < leftStats.solveGuess 
          ? rightPlayerId 
          : "draw";
      }
    }

    return {
      left: leftStats,
      right: rightStats,
      winner: actualWinner,
    };
  }, [mode, leftPlayer, rightPlayer, leftSecret, rightSecret, winnerId, leftPlayerId, rightPlayerId]);

  const title =
    mode === "daily"
      ? "🎉 Puzzle Solved!"
      : winnerName
      ? `${winnerName} wins`
      : "Round complete";

  return (
    <div
      ref={overlayRef}
      onMouseDown={onOverlayClick}
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm animate-[fadeIn_160ms_ease-out]"
      aria-hidden="true"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="victory-title"
        tabIndex={-1}
        className="w-full max-w-2xl mx-4 rounded-xl bg-white dark:bg-neutral-900 shadow-2xl outline-none ring-1 ring-black/10 animate-[popIn_200ms_cubic-bezier(0.2,0.8,0.2,1)] overflow-hidden max-h-[90vh] overflow-y-auto"
      >
        {/* Gradient background overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-amber-500/10 pointer-events-none" />
        
        <div className="relative p-4 sm:p-6 md:p-8">
          {/* Title with trophy icon */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="flex items-center justify-center gap-3 mb-6"
          >
            {mode !== "daily" && winnerName && (
              <motion.div
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 3
                }}
              >
                <Trophy className="w-8 h-8 text-amber-500" />
              </motion.div>
            )}
            <h3 id="victory-title" className="text-2xl sm:text-3xl font-bold tracking-tight text-center">
              {title}
            </h3>
            {mode !== "daily" && winnerName && (
              <motion.div
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, -5, 5, 0]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 3
                }}
              >
                <Trophy className="w-8 h-8 text-amber-500" />
              </motion.div>
            )}
          </motion.div>

          {mode === "daily" ? (
            <div className="mt-4">
              <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg">
                <p className="text-center text-lg font-semibold">
                  Congratulations, {winnerName || "Player"}!
                </p>
                <p className="text-center text-sm text-muted-foreground mt-2">
                  You solved today's Daily Challenge!
                </p>
                <p className="text-center text-xs text-muted-foreground mt-3">
                  Come back tomorrow for a new puzzle! 🌟
                </p>
              </div>
            </div>
          ) : mode === "duel" ? (
            <DuelResults
              leftName={leftName}
              rightName={rightName}
              leftSecret={leftSecret}
              rightSecret={rightSecret}
              leftPlayer={leftPlayer}
              rightPlayer={rightPlayer}
              winnerId={duelStats?.winner || winnerId}
              leftPlayerId={leftPlayerId}
              rightPlayerId={rightPlayerId}
              stats={duelStats}
            />
          ) : mode === "shared" ? (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">Secret word:</p>
              <Tiles word={battleSecret} />
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Congrats <span className="font-semibold">{winnerName}</span> solved the shared puzzle!
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">Secret word:</p>
              <Tiles word={battleSecret} />
            </div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.45 }}
            className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3"
          >
            <Button
              variant="secondary"
              onClick={() => onOpenChange?.(false)}
              className="flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <X className="w-4 h-4" />
              Close
            </Button>
            {showPlayAgain && onPlayAgain && (
              <Button
                data-autofocus
                onClick={onPlayAgain}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 w-full sm:w-auto"
              >
                <RefreshCw className="w-4 h-4" />
                Play Again
              </Button>
            )}
          </motion.div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes popIn {
          0% { opacity: 0; transform: translateY(6px) scale(.96) }
          100% { opacity: 1; transform: translateY(0) scale(1) }
        }
      `}</style>
    </div>
  );
}

// Enhanced Avatar component
function Avatar({ name, isWinner = false, size = "md" }) {
  const initials = (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
  
  const sizeClasses = {
    sm: "h-10 w-10 sm:h-12 sm:w-12 text-sm sm:text-base",
    md: "h-14 w-14 sm:h-16 sm:w-16 text-lg sm:text-xl",
    lg: "h-18 w-18 sm:h-20 sm:w-20 text-xl sm:text-2xl",
  };

  return (
    <div
      className={cn(
        "rounded-full grid place-items-center font-bold text-white relative",
        sizeClasses[size],
        isWinner
          ? "bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 shadow-lg shadow-amber-500/50 ring-2 ring-amber-400"
          : "bg-gradient-to-br from-slate-400 to-slate-600 opacity-75"
      )}
    >
      {initials || "?"}
      {isWinner && (
        <div className="absolute -top-1 -right-1 bg-amber-500 rounded-full p-1">
          <Crown className="w-4 h-4 text-white" />
        </div>
      )}
    </div>
  );
}

// Duel Results Component with enhanced design
function DuelResults({
  leftName,
  rightName,
  leftSecret,
  rightSecret,
  leftPlayer,
  rightPlayer,
  winnerId,
  leftPlayerId,
  rightPlayerId,
  stats,
}) {
  const leftIsWinner = winnerId === leftPlayerId;
  const rightIsWinner = winnerId === rightPlayerId;
  const isDraw = winnerId === "draw" || (!leftIsWinner && !rightIsWinner);

  return (
    <div className="space-y-4">
      {/* Left Player Card */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
        className={cn(
          "relative p-4 sm:p-5 md:p-6 rounded-xl border-2 transition-all",
          leftIsWinner
            ? "bg-gradient-to-br from-amber-50/50 to-yellow-50/50 dark:from-amber-900/20 dark:to-yellow-900/20 border-amber-400 shadow-lg shadow-amber-500/20"
            : "bg-muted/50 border-border opacity-75"
        )}
      >
        {leftIsWinner && (
          <div className="absolute -top-2 -right-2 sm:-top-3 sm:-right-3 bg-amber-500 text-white px-2 py-1 sm:px-3 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-1 shadow-lg">
            <Trophy className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            <span className="hidden sm:inline">Winner</span>
          </div>
        )}
        <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
          <Avatar name={leftName} isWinner={leftIsWinner} size="md" />
          <div className="flex-1 min-w-0 w-full sm:w-auto">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-2">
              <p className="font-bold text-base sm:text-lg">{leftName}</p>
              {leftPlayer?.wins !== undefined && (
                <span className="text-xs text-muted-foreground">
                  ({leftPlayer.wins} wins
                  {leftPlayer.streak > 0 && (
                    <span className="ml-1 inline-flex items-center gap-0.5">
                      <Zap className="w-3 h-3 text-amber-500" />
                      {leftPlayer.streak} streak
                    </span>
                  )}
                  )
                </span>
              )}
            </div>
            <div className="flex justify-center sm:justify-start">
              <Tiles word={leftSecret} size="md" animated={true} />
            </div>
            {stats && (
              <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-muted-foreground">
                <span>
                  {stats.left.solved
                    ? `Solved in ${stats.left.solveGuess} guess${stats.left.solveGuess !== 1 ? "es" : ""}`
                    : `${stats.left.guessCount} guess${stats.left.guessCount !== 1 ? "es" : ""}`}
                </span>
                {stats.left.solved && (
                  <span className="text-emerald-600 font-semibold">✓ Solved</span>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* VS Divider */}
      <div className="flex items-center gap-2 my-2">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">VS</span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* Right Player Card */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.35 }}
        className={cn(
          "relative p-4 sm:p-5 md:p-6 rounded-xl border-2 transition-all",
          rightIsWinner
            ? "bg-gradient-to-br from-amber-50/50 to-yellow-50/50 dark:from-amber-900/20 dark:to-yellow-900/20 border-amber-400 shadow-lg shadow-amber-500/20"
            : "bg-muted/50 border-border opacity-75"
        )}
      >
        {rightIsWinner && (
          <div className="absolute -top-2 -right-2 sm:-top-3 sm:-right-3 bg-amber-500 text-white px-2 py-1 sm:px-3 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-1 shadow-lg">
            <Trophy className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            <span className="hidden sm:inline">Winner</span>
          </div>
        )}
        <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
          <Avatar name={rightName} isWinner={rightIsWinner} size="md" />
          <div className="flex-1 min-w-0 w-full sm:w-auto">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-2">
              <p className="font-bold text-base sm:text-lg">{rightName}</p>
              {rightPlayer?.wins !== undefined && (
                <span className="text-xs text-muted-foreground">
                  ({rightPlayer.wins} wins
                  {rightPlayer.streak > 0 && (
                    <span className="ml-1 inline-flex items-center gap-0.5">
                      <Zap className="w-3 h-3 text-amber-500" />
                      {rightPlayer.streak} streak
                    </span>
                  )}
                  )
                </span>
              )}
            </div>
            <div className="flex justify-center sm:justify-start">
              <Tiles word={rightSecret} size="md" animated={true} />
            </div>
            {stats && (
              <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-muted-foreground">
                <span>
                  {stats.right.solved
                    ? `Solved in ${stats.right.solveGuess} guess${stats.right.solveGuess !== 1 ? "es" : ""}`
                    : `${stats.right.guessCount} guess${stats.right.guessCount !== 1 ? "es" : ""}`}
                </span>
                {stats.right.solved && (
                  <span className="text-emerald-600 font-semibold">✓ Solved</span>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Memoize VictoryModal component to prevent unnecessary re-renders
export default memo(VictoryModal);
