import React, { useEffect, useRef, memo, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Trophy, Crown, X, RefreshCw, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Enhanced Tiles component with animations
const Tiles = memo(function Tiles({ word = "", size = "md", animated = false }) {
  const letters = (word || "").toUpperCase().padEnd(5).slice(0, 5).split("");
  const sizeClasses = {
    sm: "h-8 w-8 text-sm",
    md: "h-11 w-11 text-base",
    lg: "h-14 w-14 text-lg",
  };

  return (
    <div className="flex items-center justify-center">
      <div className="flex gap-1.5">
        {letters.map((ch, i) => (
          <motion.div
            key={i}
            initial={animated ? { opacity: 0, scale: 0.6, y: 6 } : false}
            animate={animated ? { opacity: 1, scale: 1, y: 0 } : {}}
            transition={{ delay: i * 0.07, type: "spring", stiffness: 400, damping: 20 }}
            className={cn(
              "grid place-items-center rounded-md font-bold text-white",
              sizeClasses[size],
              "bg-[#6aaa64] border border-[#5a9a54]"
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
    return { guessCount: 0, solveGuess: null, solved: false };
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
  leftPlayer = null,
  rightPlayer = null,
  battleSecret,
  onPlayAgain,
  showPlayAgain = true,
  dailyStats = null, // { guesses: number, streak: number }
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
    }, 50);

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

  // Screen reader announcement
  useEffect(() => {
    if (!open) return;
    const announcement =
      mode === "daily"
        ? "Puzzle solved! Congratulations!"
        : winnerName
        ? `${winnerName} wins the round!`
        : "Round complete.";

    const liveRegion = document.createElement("div");
    liveRegion.setAttribute("role", "status");
    liveRegion.setAttribute("aria-live", "polite");
    liveRegion.className = "sr-only";
    liveRegion.textContent = announcement;
    document.body.appendChild(liveRegion);
    return () => liveRegion.remove();
  }, [open, mode, winnerName]);

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

    let actualWinner = winnerId;
    if (!actualWinner) {
      if (leftStats.solved && !rightStats.solved) actualWinner = leftPlayerId;
      else if (rightStats.solved && !leftStats.solved) actualWinner = rightPlayerId;
      else if (leftStats.solved && rightStats.solved) {
        actualWinner =
          leftStats.solveGuess < rightStats.solveGuess
            ? leftPlayerId
            : rightStats.solveGuess < leftStats.solveGuess
            ? rightPlayerId
            : "draw";
      }
    }

    return { left: leftStats, right: rightStats, winner: actualWinner };
  }, [mode, leftPlayer, rightPlayer, leftSecret, rightSecret, winnerId, leftPlayerId, rightPlayerId]);

  const isDraw = duelStats?.winner === "draw";

  const title =
    mode === "daily"
      ? "Puzzle Solved!"
      : isDraw
      ? "It's a Draw!"
      : winnerName
      ? `${winnerName} wins`
      : "Round complete";

  const titleEmoji =
    mode === "daily" ? "🎉" : isDraw ? "🤝" : winnerName ? "🏆" : "✅";

  return (
    <div
      ref={overlayRef}
      role="presentation"
      onMouseDown={onOverlayClick}
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm"
      style={{ animation: "fadeIn 160ms ease-out" }}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="victory-title"
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="w-full max-w-2xl mx-4 rounded-2xl bg-slate-900/95 border border-white/10 shadow-2xl outline-none max-h-[90vh] overflow-y-auto"
      >
        {/* Gradient overlay */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/8 via-blue-500/5 to-amber-500/8 pointer-events-none" />

        <div className="relative p-5 sm:p-7">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="flex items-center justify-center gap-3 mb-6"
          >
            <motion.span
              animate={{ scale: [1, 1.15, 1], rotate: [0, 8, -8, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 4 }}
              className="text-3xl sm:text-4xl select-none"
            >
              {titleEmoji}
            </motion.span>
            <h3
              id="victory-title"
              className="text-2xl sm:text-3xl font-bold tracking-tight text-center text-white"
            >
              {title}
            </h3>
          </motion.div>

          {/* Mode-specific content */}
          {mode === "daily" ? (
            <DailyContent winnerName={winnerName} dailyStats={dailyStats} />
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
              isDraw={isDraw}
            />
          ) : (
            <WordReveal
              secret={battleSecret}
              winnerName={winnerName}
              mode={mode}
            />
          )}

          {/* Action buttons */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.5 }}
            className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3"
          >
            <Button
              variant="ghost"
              onClick={() => onOpenChange?.(false)}
              className="flex items-center justify-center gap-2 w-full sm:w-auto text-white/60 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
            >
              <X className="w-4 h-4" />
              Close
            </Button>
            {showPlayAgain && onPlayAgain && (
              <Button
                data-autofocus
                onClick={onPlayAgain}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg hover:shadow-purple-500/25 hover:scale-105 active:scale-95 transition-all duration-200 w-full sm:w-auto"
              >
                <RefreshCw className="w-4 h-4" />
                Play Again
              </Button>
            )}
          </motion.div>
        </div>
      </motion.div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </div>
  );
}

// Daily challenge result content
function DailyContent({ winnerName, dailyStats }) {
  const guesses = dailyStats?.guesses ?? null;
  const streak = dailyStats?.streak ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="space-y-4"
    >
      <div className="p-5 bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-xl text-center">
        <p className="text-lg font-semibold text-white">
          Well done, {winnerName || "Player"}!
        </p>
        <p className="text-sm text-white/60 mt-1">
          You solved today's Daily Challenge
        </p>
        {guesses !== null && (
          <p className="text-sm text-white/80 mt-3 font-medium">
            Solved in{" "}
            <span className="text-emerald-400 font-bold">{guesses}</span>
            {" / 6 "}
            {guesses === 1 ? "guess" : "guesses"}
          </p>
        )}
      </div>

      {streak !== null && streak > 0 && (
        <div className="flex items-center justify-between px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <div className="flex items-center gap-2 text-amber-400">
            <Zap className="w-4 h-4" />
            <span className="text-sm font-semibold">Current streak</span>
          </div>
          <span className="text-xl font-bold text-amber-400">{streak}</span>
        </div>
      )}

      <p className="text-center text-xs text-white/40">
        Come back tomorrow for a new puzzle 🌟
      </p>
    </motion.div>
  );
}

// Battle / shared word reveal
function WordReveal({ secret, winnerName, mode }) {
  const isShared = mode === "shared";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="space-y-4 text-center"
    >
      {winnerName && (
        <p className="text-sm text-white/70">
          <span className="font-semibold text-white">{winnerName}</span>
          {isShared ? " solved the shared puzzle!" : " won this round!"}
        </p>
      )}
      <div className="py-3">
        <p className="text-xs text-white/40 uppercase tracking-widest mb-3">
          The word was
        </p>
        <Tiles word={secret} size="lg" animated />
      </div>
    </motion.div>
  );
}

// Enhanced Avatar component
function Avatar({ name, isWinner = false, isDraw = false, size = "md" }) {
  const initials = (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");

  const sizeClasses = {
    sm: "h-10 w-10 text-sm",
    md: "h-14 w-14 text-lg",
    lg: "h-18 w-18 text-xl",
  };

  return (
    <div
      className={cn(
        "rounded-full grid place-items-center font-bold text-white relative shrink-0",
        sizeClasses[size],
        isWinner
          ? "bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 shadow-lg shadow-amber-500/40 ring-2 ring-amber-400"
          : isDraw
          ? "bg-gradient-to-br from-slate-500 to-slate-600 ring-1 ring-white/20"
          : "bg-gradient-to-br from-slate-500 to-slate-700 opacity-60"
      )}
    >
      {initials || "?"}
      {isWinner && (
        <div className="absolute -top-1 -right-1 bg-amber-500 rounded-full p-0.5">
          <Crown className="w-3.5 h-3.5 text-white" />
        </div>
      )}
    </div>
  );
}

// Player card inside DuelResults
function DuelPlayerCard({ name, secret, player, isWinner, isDraw, playerId, winnerId, stats, side }) {
  const statData = side === "left" ? stats?.left : stats?.right;

  return (
    <motion.div
      initial={{ opacity: 0, x: side === "left" ? -16 : 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: side === "left" ? 0.25 : 0.35, type: "spring", stiffness: 260, damping: 22 }}
      className={cn(
        "relative p-4 sm:p-5 rounded-xl border-2 transition-all h-full",
        isWinner
          ? "bg-gradient-to-br from-amber-500/10 to-yellow-500/10 border-amber-400/70 shadow-lg shadow-amber-500/15"
          : isDraw
          ? "bg-white/5 border-white/20"
          : "bg-white/[0.03] border-white/10 opacity-70"
      )}
    >
      {isWinner && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-3 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-lg whitespace-nowrap">
          <Trophy className="w-2.5 h-2.5" />
          Winner
        </div>
      )}
      {isDraw && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-slate-600 text-white px-3 py-0.5 rounded-full text-[10px] font-bold shadow-lg whitespace-nowrap">
          Draw
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <Avatar name={name} isWinner={isWinner} isDraw={isDraw} size="md" />
        <div className="min-w-0">
          <p className="font-bold text-white truncate">{name}</p>
          {player?.wins !== undefined && (
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-white/40">{player.wins} wins</span>
              {player.streak > 0 && (
                <span className="inline-flex items-center gap-0.5 text-xs text-amber-400">
                  <Zap className="w-3 h-3" />
                  {player.streak}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <Tiles word={secret} size="md" animated />

      {statData && (
        <div className="mt-3 flex items-center justify-center gap-3 text-xs">
          {statData.solved ? (
            <>
              <span className="text-emerald-400 font-semibold">
                ✓ Solved in {statData.solveGuess} {statData.solveGuess === 1 ? "guess" : "guesses"}
              </span>
            </>
          ) : (
            <span className="text-white/40">
              {statData.guessCount} {statData.guessCount === 1 ? "guess" : "guesses"}, not solved
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

// Duel Results — side-by-side on desktop
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
  isDraw,
}) {
  const leftIsWinner = !isDraw && winnerId === leftPlayerId;
  const rightIsWinner = !isDraw && winnerId === rightPlayerId;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
      <DuelPlayerCard
        name={leftName}
        secret={leftSecret}
        player={leftPlayer}
        isWinner={leftIsWinner}
        isDraw={isDraw}
        playerId={leftPlayerId}
        winnerId={winnerId}
        stats={stats}
        side="left"
      />
      <DuelPlayerCard
        name={rightName}
        secret={rightSecret}
        player={rightPlayer}
        isWinner={rightIsWinner}
        isDraw={isDraw}
        playerId={rightPlayerId}
        winnerId={winnerId}
        stats={stats}
        side="right"
      />
    </div>
  );
}

export default memo(VictoryModal);
