import React, { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Crown } from "lucide-react";
import SpectateCard from "../components/SpectateCard.jsx";
import SecretWordInputRow from "../components/SecretWordInputRow.jsx";
import GradientBackground from "../components/ui/GradientBackground";
import GlowButton from "../components/ui/GlowButton";

function HostSpectateScreen({ room, players = [], onWordSubmit }) {
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // one-shot "reconnected" badge
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

  const winnerName = useMemo(() => {
    const id = room?.battle?.winner;
    if (!id) return null;
    return (
      room?.players?.[id]?.name ||
      players.find((p) => p.id === id)?.name ||
      "Unknown player"
    );
  }, [room?.battle?.winner, room?.players, players]);

  // simple leaderboard data (exclude host)
  const leaderboard = useMemo(() => {
    return [...players]
      .filter((p) => p && p.id && p.id !== room?.hostId) // Exclude host from leaderboard
      .map((p) => ({
        id: p.id,
        name: p.name || "—",
        wins: p.wins ?? 0,
        streak: p.streak ?? 0,
        disconnected: !!p.disconnected,
      }))
      .sort(
        (a, b) =>
          b.wins - a.wins || b.streak - a.streak || a.name.localeCompare(b.name)
      );
  }, [players, room?.hostId]);

  // ---- UI ----
  return (
    <GradientBackground fullHeight className="flex h-full">
      <div className="flex flex-1 flex-col w-full min-h-0 overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-3 pt-3 pb-2">
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-xl backdrop-blur-sm"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Crown className="w-4 h-4 text-blue-300" />
            <span className="text-sm font-medium text-blue-300">
              You are the Host
            </span>
            {showReconnected && (
              <span className="ml-2 text-xs text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 rounded px-2 py-1 animate-pulse">
                Reconnected
              </span>
            )}
          </motion.div>

          <div className="flex items-center gap-2">
            {/* Leaderboard button */}
            <GlowButton
              onClick={() => setShowLeaderboard(true)}
              variant="secondary"
              size="sm"
            >
              <Trophy className="w-4 h-4 mr-1" />
              Leaderboard
            </GlowButton>

            <span className="text-xs text-white/60">
              {connectedCount}/{players.length} online
            </span>
          </div>
        </div>

        {/* Title / status */}
        <div className="text-center mt-2 mb-3 px-3">
          {roundActive ? (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h3 className="text-lg font-semibold text-white">
                Player Progress
              </h3>
              <p className="text-sm text-white/60">
                Watch players compete in real time.
              </p>
            </motion.div>
          ) : (
            <>
              {roundFinished ? (
                <motion.div
                  className="mx-auto max-w-xl mb-3 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl p-4 backdrop-blur-sm"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <p className="text-sm text-emerald-300 font-medium">
                    {winnerName
                      ? `Round finished — ${winnerName} won!`
                      : "Round finished — no winner."}
                  </p>
                  <p className="text-xs text-emerald-400 mt-1">
                    Enter a new word below to start the next round.
                  </p>
                </motion.div>
              ) : (
                <p className="text-sm text-white/70 mb-2">
                  Enter a word to start the game.
                </p>
              )}
              {!room?.battle?.started && (
                <SecretWordInputRow
                  onSubmit={onWordSubmit}
                  submitHint="Press Enter to set word"
                  showGenerate={true}
                  size={64}
                />
              )}
            </>
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

        {/* Leaderboard modal (on demand) */}
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
