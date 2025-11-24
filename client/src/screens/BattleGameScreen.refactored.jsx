import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useIsMobile } from "../hooks/useIsMobile";
import { GameLayout } from "../components/layout/GameLayout";
import { UnifiedPlayerCard } from "../components/player/UnifiedPlayerCard";
import { GameEffects } from "../components/features/GameEffects";
import { GameTimer } from "../components/features/GameTimer";
import { GameStatusBar } from "../components/features/GameStatusBar";
import GameResults from "../components/GameResults";
import GlowButton from "../components/ui/GlowButton";
import { getModeTheme } from "../config/mode-themes";
import { logger } from "../utils/logger";

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
  submittingGuess = false,
}) {
  const isMobile = useIsMobile();
  const isAiMode = room?.mode === "battle_ai";
  const mode = isAiMode ? "battle_ai" : "battle";
  const theme = getModeTheme(mode);
  
  const [guessFlipKey, setGuessFlipKey] = useState(0);
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

  useEffect(() => {
    if (me?.guesses && me.guesses.length > 0) {
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
        logger.warn("[ai battle start]", result.error);
        setStartError(result.error || "Unable to start the game");
      } else {
        setStartError("");
      }
    } finally {
      setStartingRound(false);
    }
  };

  useEffect(() => {
    if (me?.guesses && me.guesses.length > 0) {
      const lastGuess = me.guesses[me.guesses.length - 1];
      if (lastGuess && lastGuess.pattern) {
        const hasCorrect = lastGuess.pattern.some((state) => state === "green");
        if (hasCorrect) {
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

  useEffect(() => {
    if (me?.streak && me.streak > lastStreak && me.streak > 0) {
      setLastStreak(me.streak);
      const shouldCelebrate =
        me.streak === 3 ||
        me.streak === 5 ||
        me.streak === 10 ||
        me.streak === 15 ||
        me.streak === 20 ||
        (me.streak > 20 && me.streak % 5 === 0);

      if (shouldCelebrate) {
        setParticlePosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2 - 150,
        });
        setShowStreakParticles(true);
        const duration = me.streak >= 10 ? 3000 : 2000;
        const timer = setTimeout(() => setShowStreakParticles(false), duration);
        return () => clearTimeout(timer);
      }
    }
  }, [me?.streak, lastStreak]);

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
  
  const getWinnerName = () => {
    if (!room?.battle?.winner) return "Unknown";
    const playerArray = Array.isArray(players)
      ? players
      : Object.values(players || {});
    const winner = playerArray.find((p) => p.id === room.battle.winner);
    return winner?.name || "Unknown";
  };

  // Prepare status badges
  const statusBadges = [];
  if (isAiMode) {
    statusBadges.push({
      variant: "info",
      label: aiHostMode === "auto" ? "AI host is running this lobby" : hostedByName ? `Hosted by ${hostedByName}` : "Hosted by player",
    });
  }
  if (roundActive && roundTimerLabel) {
    statusBadges.push({
      variant: "info",
      label: "Round ends in",
      value: roundTimerLabel,
    });
  }
  if (!roundActive && !pendingStart && countdownLabel) {
    statusBadges.push({
      variant: "warning",
      label: "Next round in",
      value: countdownLabel,
    });
  }
  if (roundActive && !roundFinished) {
    statusBadges.push({
      variant: "success",
      label: "Game in progress — good luck!",
    });
  }
  if (room?.battle?.winner) {
    statusBadges.push({
      variant: "success",
      label: "Winner",
      value: getWinnerName(),
    });
  }

  // Custom header with start button
  const renderHeader = () => {
    return (
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
            </div>
          )}

          {!isHost && statusBadges.length > 0 && (
            <div className="mt-2">
              <GameStatusBar
                mode={mode}
                badges={statusBadges}
                isMobile={isMobile}
              />
            </div>
          )}

          {showClaimHostButton && (
            <div className="mt-2 flex justify-center">
              <GlowButton
                onClick={handleClaimHost}
                size="sm"
                disabled={claimingHost}
              >
                {claimingHost ? "Claiming..." : "Claim Host"}
              </GlowButton>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Custom board render with right rail for other players
  const renderBoard = () => {
    if (isMobile) {
      return null; // MobileBoard is handled by GameLayout
    }

    return (
      <div className="flex-1 flex flex-col items-center min-h-0 relative gap-3">
        {/* Center board */}
        {roundActive ? (
          <div className="flex-1 w-full max-w-[min(1100px,95vw)] max-h-[calc(100dvh-260px)] flex items-center justify-center min-h-0">
            {/* Board is handled by GameLayout */}
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

        {/* Right rail: other players */}
        {roundActive && otherPlayers && otherPlayers.length > 0 && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 space-y-3 max-h-[80vh] overflow-y-auto pr-1">
            {otherPlayers.map((player, index) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05, duration: 0.2 }}
              >
                <UnifiedPlayerCard
                  variant="progress"
                  size="sm"
                  name={player.name}
                  wins={player.wins}
                  streak={player.streak}
                  guesses={player.guesses || []}
                  maxGuesses={6}
                  done={player.done}
                  showProgressTiles={true}
                />
              </motion.div>
            ))}
            <div className="pointer-events-none sticky bottom-0 h-6 bg-gradient-to-t from-gray-900/0 to-transparent" />
          </div>
        )}
      </div>
    );
  };

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

  return (
    <GameLayout
      mode={mode}
      headerTitle={bannerTitle}
      timerDeadline={isAiMode && roundActive ? deadline : null}
      timerCountdownEndsAt={isAiMode && !roundActive ? countdownEndsAt : null}
      timerLabel={roundActive ? "Round ends in" : "Next round in"}
      showTimer={isAiMode && (roundActive || !pendingStart)}
      statusMessage={standbyMessage}
      players={[]} // No player cards in battle mode (shown in right rail)
      showPlayerSection={false}
      guesses={me?.guesses || []}
      activeGuess={activeGuessForBattle}
      boardProps={{
        errorShakeKey: shakeKey,
        errorActiveRow: showActiveError,
        guessFlipKey,
      }}
      letterStates={letterStates}
      onKeyPress={onKeyPress}
      keyboardDisabled={submittingGuess}
      showKeyboard={canGuessBattle}
      effects={{
        showCorrectParticles,
        showStreakParticles,
        showVictoryParticles,
        particlePosition,
        streak: me?.streak || 0,
      }}
      renderHeader={renderHeader}
      renderBoard={renderBoard}
    />
  );
}

export default BattleGameScreen;

