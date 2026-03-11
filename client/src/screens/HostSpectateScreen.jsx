import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy } from "lucide-react";
import SpectateCard from "../components/SpectateCard.jsx";
import SecretWordInputRow from "../components/SecretWordInputRow.jsx";
import GradientBackground from "../components/ui/GradientBackground";
import GlowButton from "../components/ui/GlowButton";

function HostSpectateScreen({
  room,
  players = [],
  onWordSubmit,
  onStartAiRound,
  pendingStart = false,
  onReleaseHost,
}) {
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [startingRound, setStartingRound] = useState(false);
  const [startError, setStartError] = useState("");
  const [countdownRemaining, setCountdownRemaining] = useState(null);
  const isAiMode = room?.mode === "battle_ai";
  // true only when the AI is actually in control (auto mode), not when a player has claimed host
  const aiIsInControl = isAiMode && room?.battle?.aiHost?.mode !== "player";

  const [showReconnected, setShowReconnected] = useState(() => {
    const s = sessionStorage.getItem("wp.reconnected") === "1";
    const legacy = localStorage.getItem("wp.lastSocketId.wasHost") === "true";
    return s || legacy;
  });
  
  useEffect(() => {
    if (!showReconnected) return;
    sessionStorage.removeItem("wp.reconnected");
    localStorage.removeItem("wp.lastSocketId.wasHost");
    const t = setTimeout(() => setShowReconnected(false), 3500);
    return () => clearTimeout(t);
  }, [showReconnected]);

  const connectedCount = useMemo(
    () => players.filter((p) => !p.disconnected).length,
    [players]
  );

  const started = !!room?.battle?.started;
  const hasAnyGuesses = useMemo(
    () => players.some((p) => (p.guesses?.length || 0) > 0),
    [players]
  );
  const roundActive = started;
  const roundFinished =
    !started && (Boolean(room?.battle?.winner) || hasAnyGuesses);
  const canReleaseHost =
    isAiMode && typeof onReleaseHost === "function" && !roundActive;

  const formatDuration = (ms) => {
    if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
    const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const countdownLabel =
    countdownRemaining !== null ? formatDuration(countdownRemaining) : null;

  const canStartRound =
    isAiMode &&
    typeof onStartAiRound === "function" &&
    !roundActive &&
    (pendingStart || !countdownLabel);

  const winnerName = useMemo(() => {
    const id = room?.battle?.winner;
    if (!id) return null;
    return (
      room?.players?.[id]?.name ||
      players.find((p) => p.id === id)?.name ||
      "Unknown player"
    );
  }, [room?.battle?.winner, room?.players, players]);

  const standbyMessage = (() => {
    if (roundActive) return null;
    if (isAiMode) {
      if (pendingStart) return "Waiting for someone to start the game...";
      if (countdownLabel) return `Next round in ${countdownLabel}`;
      return roundFinished
        ? "Game ended — AI host is preparing the next round..."
        : "Waiting for AI host to start the game...";
    }
    return roundFinished
      ? "Game ended — waiting for host to start the next round..."
      : "Waiting for players...";
  })();

  const handleReleaseHost = async () => {
    if (!canReleaseHost || releasing) return;
    try {
      setReleasing(true);
      await onReleaseHost?.();
    } finally {
      setReleasing(false);
    }
  };

  const handleStartRound = async () => {
    if (!canStartRound || startingRound) return;
    try {
      setStartingRound(true);
      const result = await onStartAiRound?.();
      if (result?.error) {
        setStartError(result.error || "Unable to start the game");
      } else {
        setStartError("");
      }
    } finally {
      setStartingRound(false);
    }
  };

  useEffect(() => {
    if (!pendingStart) {
      setStartError("");
    }
  }, [pendingStart]);

  useEffect(() => {
    if (!isAiMode) {
      setCountdownRemaining(null);
      return;
    }
    const target = Number(room?.battle?.countdownEndsAt);
    if (!Number.isFinite(target)) {
      setCountdownRemaining(null);
      return;
    }
    const update = () => {
      setCountdownRemaining(Math.max(target - Date.now(), 0));
    };
    update();
    const interval = setInterval(update, 500);
    return () => clearInterval(interval);
  }, [isAiMode, room?.battle?.countdownEndsAt]);

  const leaderboard = useMemo(() => {
    return [...players]
      .filter((p) => p && p.id && p.id !== room?.hostId)
      .map((p) => ({
        id: p.id,
        name: p.name || "Player",
        wins: p.wins ?? 0,
        streak: p.streak ?? 0,
        disconnected: !!p.disconnected,
      }))
      .sort(
        (a, b) =>
          b.wins - a.wins || b.streak - a.streak || a.name.localeCompare(b.name)
      );
  }, [players, room?.hostId]);

  return (
    <GradientBackground fullHeight className="flex h-full">
      <div className="flex flex-1 flex-col w-full min-h-0 overflow-hidden relative">
        <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-1">
          <span className="text-xs font-medium text-white/50">
            Host
            {showReconnected && <span className="ml-1.5 text-emerald-400">· reconnected</span>}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLeaderboard(true)}
              className="text-[10px] text-white/40 hover:text-white/60 transition-colors"
            >
              Leaderboard
            </button>
            {canStartRound && (
              <GlowButton onClick={handleStartRound} size="sm" disabled={startingRound} className="!py-1 !text-xs !px-3">
                {startingRound ? "Starting..." : pendingStart ? "Start" : "Start Now"}
              </GlowButton>
            )}
            {canReleaseHost && (
              <button
                onClick={handleReleaseHost}
                disabled={releasing}
                className="text-[10px] text-white/30 hover:text-white/50 transition-colors"
              >
                {releasing ? "..." : "Release"}
              </button>
            )}
            <span className="text-[10px] text-white/30">
              {connectedCount}/{players.length}
            </span>
          </div>
        </div>
        {startError && <div className="px-3 text-[10px] text-red-300">{startError}</div>}

        <div className="text-center mt-1 mb-2 px-3">
          {roundActive ? (
            <p className="text-xs text-white/40">Live</p>
          ) : aiIsInControl ? (
            <div className="mx-auto max-w-md">
              <p className="text-xs text-white/50">
                {roundFinished
                  ? winnerName ? `${winnerName} won` : "No winner"
                  : standbyMessage || "Waiting..."}
              </p>
            </div>
          ) : (
            <div className="mx-auto max-w-md">
              {roundFinished && (
                <p className="text-xs text-emerald-400/70 mb-2">
                  {winnerName ? `${winnerName} won` : "No winner"}
                </p>
              )}
              {!room?.battle?.started && (
                <SecretWordInputRow
                  onSubmit={onWordSubmit}
                  submitHint="Press Enter to set word"
                  showGenerate={true}
                  size={56}
                />
              )}
            </div>
          )}
        </div>

        {/* Spectate grid: full-height, responsive columns, no overlap */}
        {roundActive && (
          <section className="flex-1 min-h-0 px-3 pb-3">
            <div
              className="h-[calc(100vh-180px)] overflow-auto"
              style={{
                display: "grid",
                gap: "16px",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                alignContent: "start",
              }}
            >
              {players.map((p, index) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05, duration: 0.2 }}
                >
                  <SpectateCard player={p} room={room} dense />
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Leaderboard modal */}
        <AnimatePresence>
          {showLeaderboard && (
            <motion.div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowLeaderboard(false)}
            >
              <motion.div
                className="w-full max-w-md bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl shadow-2xl p-6"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                    <h4 className="font-semibold text-lg text-white">
                      Leaderboard
                    </h4>
                  </div>
                  <GlowButton
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowLeaderboard(false)}
                  >
                    Close
                  </GlowButton>
                </div>
                <div className="space-y-2 max-h-[60vh] overflow-auto">
                  {leaderboard.map((p, i) => (
                    <motion.div
                      key={p.id}
                      className="flex items-center justify-between text-sm py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.2 }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 text-white/60 font-medium">
                          {i + 1}.
                        </span>
                        <span
                          className={`truncate font-medium ${
                            p.disconnected ? "opacity-60" : ""
                          } text-white`}
                          title={p.name}
                        >
                          {p.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          W:{p.wins}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          Stk:{p.streak}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                  {leaderboard.length === 0 && (
                    <div className="text-xs text-center py-8 text-white/50">
                      No players yet.
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </GradientBackground>
  );
}

export default HostSpectateScreen;

