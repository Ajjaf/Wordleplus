import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import Board from "../components/Board.jsx";
import Keyboard from "../components/Keyboard.jsx";
import PlayerProgressCard from "../components/PlayerProgressCard.jsx";
// import MobileBattleLayout from "../components/MobileBattleLayout.jsx";
import GameResults from "../components/GameResults.jsx";
import ParticleEffect from "../components/ParticleEffect.jsx";
import GradientBackground from "../components/ui/GradientBackground";
import { useIsMobile } from "../hooks/useIsMobile";
import MobilePlayerProgressCard from "../components/mobile/MobilePlayerProgressCard.jsx";
import MobileBoard from "../components/mobile/MobileBoard.jsx";
import GlowButton from "../components/ui/GlowButton";

function BattleGameScreen({
  room,
  players,
  allPlayers,
  otherPlayers,
  me,
  isHost,
  currentGuess,
  shakeKey,
  showActiveError,
  letterStates,
  canGuessBattle,
  onKeyPress,
  deadline,
  countdownEndsAt,
  onClaimHost,
  pendingStart = false,
  onStartAiRound,
}) {
  const [guessFlipKey, setGuessFlipKey] = useState(0);

  // Particle effects
  const [showCorrectParticles, setShowCorrectParticles] = useState(false);
  const [showStreakParticles, setShowStreakParticles] = useState(false);
  const [showVictoryParticles, setShowVictoryParticles] = useState(false);
  const [particlePosition, setParticlePosition] = useState({ x: 0, y: 0 });
  const [lastStreak, setLastStreak] = useState(0);
  const [claimingHost, setClaimingHost] = useState(false);
  const [startingRound, setStartingRound] = useState(false);
  const [startError, setStartError] = useState("");
  const [roundTimeRemaining, setRoundTimeRemaining] = useState(null);
  const [countdownRemaining, setCountdownRemaining] = useState(null);

  const isMobile = useIsMobile();
  const isAiMode = room?.mode === "battle_ai";
  const aiHostMode = room?.battle?.aiHost?.mode || "auto";
  const aiHostClaimedBy = room?.battle?.aiHost?.claimedBy || null;
  const hostPlayer = allPlayers.find((player) => player.id === room?.hostId);
  const formatDuration = (ms) => {
    if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
    const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Debug logging to verify server payload
  useEffect(() => {
    if (room?.battle) {
      // Battle state updated
    }
  }, [room?.battle]);

  const roundActive = !!room?.battle?.started;
  const lastWord = room?.battle?.lastRevealedWord ?? null;
  const roundFinished = !roundActive && !!lastWord;
  const playerGuesses = me?.guesses || [];
  const latestBattleGuess = playerGuesses.length
    ? (playerGuesses[playerGuesses.length - 1]?.guess || "").toUpperCase()
    : "";
  const normalizedBattleGuess = (currentGuess || "").toUpperCase();
  const activeGuessForBattle =
    normalizedBattleGuess && normalizedBattleGuess !== latestBattleGuess
      ? currentGuess
      : "";

  const correctWord = useMemo(
    () => (roundFinished ? lastWord : null),
    [roundFinished, lastWord]
  );

  useEffect(() => {
    if (!deadline || !isAiMode) {
      setRoundTimeRemaining(null);
      return;
    }
    const target = Number(deadline);
    if (!Number.isFinite(target)) {
      setRoundTimeRemaining(null);
      return;
    }
    const update = () => {
      setRoundTimeRemaining(Math.max(target - Date.now(), 0));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [deadline, isAiMode]);

  useEffect(() => {
    if (!countdownEndsAt || !isAiMode) {
      setCountdownRemaining(null);
      return;
    }
    const target = Number(countdownEndsAt);
    if (!Number.isFinite(target)) {
      setCountdownRemaining(null);
      return;
    }
    const update = () => {
      setCountdownRemaining(Math.max(target - Date.now(), 0));
    };
    update();
    const interval = setInterval(update, 250);
    return () => clearInterval(interval);
  }, [countdownEndsAt, isAiMode]);

  // Trigger guess flip animation when a new guess is added
  useEffect(() => {
    if (me?.guesses && me.guesses.length > 0) {
      // Small delay to let the guess state update
      const timer = setTimeout(() => {
        setGuessFlipKey((prev) => prev + 1);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [me?.guesses?.length]);

  useEffect(() => {
    if (!pendingStart) {
      setStartError("");
    }
  }, [pendingStart]);

  const handleClaimHost = async () => {
    if (!onClaimHost || claimingHost) return;
    try {
      setClaimingHost(true);
      await onClaimHost();
    } finally {
      setClaimingHost(false);
    }
  };

  const handleStartRound = async () => {
    if (!onStartAiRound || startingRound) return;
    try {
      setStartingRound(true);
      const result = await onStartAiRound();
      if (result?.error) {
        console.warn("[ai battle start]", result.error);
        setStartError(result.error || "Unable to start the game");
      } else {
        setStartError("");
      }
    } finally {
      setStartingRound(false);
    }
  };

  // Trigger particles for correct guesses
  useEffect(() => {
    if (me?.guesses && me.guesses.length > 0) {
      const lastGuess = me.guesses[me.guesses.length - 1];
      if (lastGuess && lastGuess.pattern) {
        const hasCorrect = lastGuess.pattern.some((state) => state === "green");
        if (hasCorrect) {
          // Position particles at the center of the board
          setParticlePosition({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2 - 100,
          });
          setShowCorrectParticles(true);
          const timer = setTimeout(() => setShowCorrectParticles(false), 1000);
          return () => clearTimeout(timer);
        }
      }
    }
  }, [me?.guesses?.length]);

  // Trigger streak celebration particles
  useEffect(() => {
    if (me?.streak && me.streak > lastStreak && me.streak > 0) {
      setLastStreak(me.streak);

      // Celebrate significant streak milestones
      const shouldCelebrate =
        me.streak === 3 || // First milestone
        me.streak === 5 || // Second milestone
        me.streak === 10 || // Major milestone
        me.streak === 15 || // Epic milestone
        me.streak === 20 || // Legendary milestone
        (me.streak > 20 && me.streak % 5 === 0); // Every 5 after 20

      if (shouldCelebrate) {
        setParticlePosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2 - 150,
        });
        setShowStreakParticles(true);

        // Longer celebration for higher streaks
        const duration = me.streak >= 10 ? 3000 : 2000;
        const timer = setTimeout(() => setShowStreakParticles(false), duration);
        return () => clearTimeout(timer);
      }
    }
  }, [me?.streak, lastStreak]);

  // Trigger victory particles when game ends
  useEffect(() => {
    if (roundFinished && room?.battle?.winner === me?.id) {
      setParticlePosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      setShowVictoryParticles(true);
      const timer = setTimeout(() => setShowVictoryParticles(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [roundFinished, room?.battle?.winner, me?.id]);

  const roundTimerLabel =
    isAiMode && roundTimeRemaining !== null
      ? formatDuration(roundTimeRemaining)
      : null;
  const countdownLabel =
    isAiMode && countdownRemaining !== null
      ? formatDuration(countdownRemaining)
      : null;
  const showStartButton =
    isAiMode &&
    aiHostMode === "auto" &&
    !roundActive &&
    typeof onStartAiRound === "function" &&
    (pendingStart || !countdownLabel);
  const startButtonLabel =
    pendingStart || !countdownLabel ? "Start Game" : "Start Now";
  const showClaimHostButton =
    isAiMode && aiHostMode === "auto" && !roundActive && Boolean(onClaimHost);
  const hostedByName =
    hostPlayer?.name ||
    (aiHostMode === "player" && aiHostClaimedBy && aiHostClaimedBy !== me?.id
      ? "Host"
      : null);
  const bannerTitle = isAiMode ? "AI Battle" : "Battle Royale";
  const standbyMessage = (() => {
    if (roundActive) return null;
    if (isAiMode) {
      if (pendingStart) return "Waiting for someone to start the game...";
      if (countdownLabel) {
        return `Next round in ${countdownLabel}`;
      }
      return roundFinished
        ? "Game ended — AI host is preparing the next round..."
        : "Waiting for AI host to start the game...";
    }
    return roundFinished
      ? "Game ended — waiting for host to start the next round..."
      : "Waiting for host to start the game...";
  })();
  const getWinnerName = () => {
    if (!room?.battle?.winner) return "Unknown";
    const playerArray = Array.isArray(players)
      ? players
      : Object.values(players || {});
    const winner = playerArray.find((p) => p.id === room.battle.winner);
    return winner?.name || "Unknown";
  };

  return (
    <GradientBackground fullHeight className="flex h-full">
      <div className="flex flex-1 flex-col w-full min-h-0 relative overflow-hidden">
        {/* Particle Effects */}
        <ParticleEffect
          trigger={showCorrectParticles}
          type="correctGuess"
          position={particlePosition}
          intensity={1.2}
        />
        <ParticleEffect
          trigger={showStreakParticles}
          type="streak"
          position={particlePosition}
          intensity={me?.streak >= 10 ? 2.5 : me?.streak >= 5 ? 2.0 : 1.5}
        />
        <ParticleEffect
          trigger={showVictoryParticles}
          type="victory"
          position={particlePosition}
          intensity={2.0}
        />

        {/* Game Status */}
        <div className="px-3 pt-4 pb-3">
          <div className="max-w-7xl mx-auto">
            {!isMobile && (
              <>
                <motion.h2
                  className="text-2xl md:text-3xl font-bold text-white text-center mb-2"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {bannerTitle}
                </motion.h2>

                {showStartButton && (
                  <div className="flex flex-col items-center mt-2 gap-1">
                    <GlowButton
                      onClick={handleStartRound}
                      size="sm"
                      disabled={startingRound}
                    >
                      {startingRound ? "Starting..." : startButtonLabel}
                    </GlowButton>
                    {startError && (
                      <span className="text-xs text-red-300 text-center">
                        {startError}
                      </span>
                    )}
                  </div>
                )}
                {!showStartButton && startError && (
                  <div className="mt-2 text-xs text-red-300 text-center">
                    {startError}
                  </div>
                )}

                {!isHost && (
                  <div className="text-center space-y-2">
                    {isAiMode && (
                      <>
                        <motion.div
                          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/20 border border-indigo-500/30 rounded-xl"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.2 }}
                        >
                          <span className="text-sm text-indigo-200 font-medium">
                            {aiHostMode === "auto"
                              ? "AI host is running this lobby"
                              : hostedByName
                              ? `Hosted by ${hostedByName}`
                              : "Hosted by player"}
                          </span>
                        </motion.div>
                        {roundActive && roundTimerLabel && (
                          <motion.div
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-900/60 border border-slate-700/60 rounded-lg"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.2 }}
                          >
                            <span className="text-xs uppercase tracking-wide text-slate-300">
                              Round ends in
                            </span>
                            <span className="text-sm font-semibold text-white">
                              {roundTimerLabel}
                            </span>
                          </motion.div>
                        )}
                        {!roundActive && pendingStart && (
                          <div className="text-xs text-white/60">
                            Waiting for someone to start the game...
                          </div>
                        )}
                        {!roundActive && !pendingStart && countdownLabel && (
                          <motion.div
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 border border-amber-500/40 rounded-lg"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.2 }}
                          >
                            <span className="text-xs uppercase tracking-wide text-amber-200">
                              Next round in
                            </span>
                            <span className="text-sm font-semibold text-amber-100">
                              {countdownLabel}
                            </span>
                          </motion.div>
                        )}
                        {showClaimHostButton && (
                          <GlowButton
                            onClick={handleClaimHost}
                            size="sm"
                            disabled={claimingHost}
                          >
                            {claimingHost ? "Claiming..." : "Claim Host"}
                          </GlowButton>
                        )}
                      </>
                    )}

                    {roundActive && !roundFinished && (
                      <motion.div
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-xl"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        <span className="text-sm text-emerald-300 font-medium">
                          Game in progress — good luck!
                        </span>
                      </motion.div>
                    )}
                    {room?.battle?.winner && (
                      <motion.div
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-xl"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        <span className="text-sm text-blue-300 font-medium">
                          Winner: {getWinnerName()}
                        </span>
                      </motion.div>
                    )}
                    {!roundActive && !roundFinished && !isAiMode && (
                      <motion.div
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-xl"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        <span className="text-sm text-white/70 font-medium">
                          Waiting for host to start the game...
                        </span>
                      </motion.div>
                    )}
                  </div>
                )}
              </>
            )}

            {isMobile && (
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="text-base font-semibold text-white">
                  {bannerTitle}
                </div>
                {showStartButton && (
                  <div className="flex flex-col items-center gap-1">
                    <GlowButton
                      onClick={handleStartRound}
                      size="sm"
                      disabled={startingRound}
                    >
                      {startingRound ? "Starting..." : startButtonLabel}
                    </GlowButton>
                    {startError && (
                      <span className="text-xs text-red-300">{startError}</span>
                    )}
                  </div>
                )}
                {!showStartButton && startError && (
                  <span className="text-xs text-red-300">{startError}</span>
                )}
                {isAiMode && (
                  <div className="space-y-1">
                    <div className="text-xs text-indigo-200">
                      {aiHostMode === "auto"
                        ? "AI host is running this lobby"
                        : hostedByName
                        ? `Hosted by ${hostedByName}`
                        : "Hosted by player"}
                    </div>
                    {roundActive && roundTimerLabel && (
                      <div className="text-xs text-white/70">
                        Round ends in {roundTimerLabel}
                      </div>
                    )}
                    {!roundActive && pendingStart && (
                      <div className="text-xs text-white/60">
                        Waiting for someone to start the game...
                      </div>
                    )}
                    {!roundActive && !pendingStart && countdownLabel && (
                      <div className="text-xs text-amber-200">
                        Next round in {countdownLabel}
                      </div>
                    )}
                  </div>
                )}
                {roundActive && !roundFinished && (
                  <div className="text-xs text-emerald-300">
                    Game in progress — good luck!
                  </div>
                )}
                {room?.battle?.winner && (
                  <div className="text-xs text-blue-200">
                    Winner: {getWinnerName()}
                  </div>
                )}
                {standbyMessage && (
                  <div className="text-xs text-white/60">{standbyMessage}</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Main */}
        <main className="flex-1 px-3 md:px-4 pt-2 pb-3 flex flex-col min-h-0">
          {isMobile ? (
            <div className="flex-1 flex flex-col items-center min-h-0">
              <MobileBoard
                guesses={me?.guesses || []}
                activeGuess={activeGuessForBattle}
                errorShakeKey={shakeKey}
                errorActiveRow={showActiveError}
                guessFlipKey={guessFlipKey}
                reservedBottom={360}
                maxWidth="min(440px, 96vw)"
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center min-h-0 relative gap-3">
              {/* Center board */}
              {roundActive ? (
                <div className="flex-1 w-full max-w-[min(1100px,95vw)] max-h-[calc(100dvh-260px)] flex items-center justify-center min-h-0">
                  <Board
                    guesses={me?.guesses || []}
                    activeGuess={activeGuessForBattle}
                    errorShakeKey={shakeKey}
                    errorActiveRow={showActiveError}
                    guessFlipKey={guessFlipKey}
                  />
                </div>
              ) : (
                <div className="flex-1 w-full flex items-center justify-center">
                  <GameResults
                    room={room}
                    players={allPlayers}
                    correctWord={correctWord}
                  />
                </div>
              )}

              {/* Right rail: other players with glassmorphism */}
              {roundActive && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 space-y-3 max-h-[80vh] overflow-y-auto pr-1">
                  {otherPlayers?.map((player, index) => (
                    <motion.div
                      key={player.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.2 }}
                    >
                      <PlayerProgressCard
                        player={player}
                        isCurrentPlayer={false}
                      />
                    </motion.div>
                  ))}
                  <div className="pointer-events-none sticky bottom-0 h-6 bg-gradient-to-t from-gray-900/0 to-transparent" />
                </div>
              )}
            </div>
          )}
        </main>

        {/* Footer (players only) */}
        <footer className="px-2 sm:px-4 pb-2 flex-shrink-0">
          <div className="max-w-5xl mx-auto">
            {
              canGuessBattle ? (
                <Keyboard onKeyPress={onKeyPress} letterStates={letterStates} />
              ) : (
                !isMobile &&
                standbyMessage && (
                  <div className="text-center text-sm text-white/60 py-3">
                    {standbyMessage}
                  </div>
                )
              ) /* Mobile informational banner hidden */
            }
          </div>
        </footer>
      </div>
    </GradientBackground>
  );
}

export default BattleGameScreen;
