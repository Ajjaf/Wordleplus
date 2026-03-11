import React, { useState, useEffect, useMemo } from "react";
import { useIsMobile } from "../hooks/useIsMobile";
import { GameLayout } from "../components/layout/GameLayout";
import GameResults from "../components/GameResults";
import Board from "../components/Board";
import MobileBoard from "../components/mobile/MobileBoard";
import BattleProgressStrip from "../components/BattleProgressStrip";
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

  // Compact status header — single row, no redundant title (nav already shows mode)
  const renderHeader = () => {
    // Pick one status indicator to show, in priority order
    const showLive = roundActive && !roundFinished;
    const showCountdown = !roundActive && !pendingStart && !!countdownLabel;
    const showWinner = Boolean(room?.battle?.winner);
    const showWaiting = !showLive && !showCountdown && !showWinner;

    // Timer color based on remaining ms
    const timerColor =
      roundTimeRemaining !== null && roundTimeRemaining <= 10000
        ? "text-red-300 bg-red-500/10"
        : roundTimeRemaining !== null && roundTimeRemaining <= 20000
        ? "text-amber-300 bg-amber-500/10"
        : "text-emerald-300 bg-emerald-500/10";

    return (
      <div className={isMobile ? "px-4 pt-1.5 pb-1" : "px-4 pt-2 pb-2"}>
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-3 flex-wrap min-h-[28px]">
          {/* Live indicator + timer */}
          {showLive && (
            <span className="inline-flex items-center gap-2 select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
              <span className="text-[10px] uppercase tracking-[0.25em] text-white/40 font-medium">
                Live
              </span>
              {roundTimerLabel && (
                <span
                  className={`font-mono text-xs font-bold tabular-nums px-1.5 py-0.5 rounded-md ${timerColor}`}
                >
                  {roundTimerLabel}
                </span>
              )}
            </span>
          )}

          {/* Countdown to next round */}
          {showCountdown && (
            <span className="inline-flex items-center gap-2 select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
              <span className="text-[10px] uppercase tracking-[0.25em] text-amber-400/60 font-medium">
                Next
              </span>
              <span className="font-mono text-xs font-bold tabular-nums text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded-md">
                {countdownLabel}
              </span>
            </span>
          )}

          {/* Winner */}
          {showWinner && (
            <span className="text-[10px] uppercase tracking-[0.25em] text-emerald-400/80 font-semibold select-none">
              ✓ {getWinnerName()}
            </span>
          )}

          {/* Idle / waiting */}
          {showWaiting && standbyMessage && (
            <span className="text-[10px] uppercase tracking-[0.25em] text-white/20 font-medium select-none">
              Waiting
            </span>
          )}

          {/* Action buttons */}
          {showStartButton && (
            <GlowButton
              onClick={handleStartRound}
              size="sm"
              disabled={startingRound}
              className="!py-1 !min-h-[30px] !text-xs !px-3"
            >
              {startingRound ? "Starting…" : startButtonLabel}
            </GlowButton>
          )}
          {startError && (
            <span className="text-[10px] text-red-300">{startError}</span>
          )}
          {showClaimHostButton && (
            <GlowButton
              onClick={handleClaimHost}
              size="sm"
              disabled={claimingHost}
              className="!py-1 !min-h-[30px] !text-xs !px-3"
            >
              {claimingHost ? "Claiming…" : "Claim Host"}
            </GlowButton>
          )}
        </div>
      </div>
    );
  };

  // Strip of opponent progress cards shown above the board
  const hasOtherPlayers = roundActive && otherPlayers && otherPlayers.length > 0;

  const renderBoard = () => {
    if (isMobile) {
      return (
        <div className="flex-1 flex flex-col min-h-0 w-full">
          {hasOtherPlayers && (
            <BattleProgressStrip
              players={otherPlayers}
              isMobile={true}
            />
          )}
          {roundActive ? (
            <MobileBoard
              guesses={me?.guesses || []}
              activeGuess={activeGuessForBattle}
              errorShakeKey={shakeKey}
              errorActiveRow={showActiveError}
              guessFlipKey={guessFlipKey}
              reservedBottom={hasOtherPlayers ? 420 : 360}
              maxWidth="min(440px, 96vw)"
              maxTile={80}
              minTile={44}
              gap={6}
              padding={10}
            />
          ) : (
            <div className="flex-1 w-full flex items-center justify-center">
              <GameResults
                room={room}
                players={allPlayers}
                correctWord={correctWord}
              />
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col min-h-0 gap-2">
        {/* Opponent progress strip — above the board */}
        {hasOtherPlayers && (
          <BattleProgressStrip
            players={otherPlayers}
            isMobile={false}
          />
        )}

        {/* Board — flex-1 + min-h-0 constrains height so Board.autoFit measures correctly */}
        {roundActive ? (
          <div className="flex-1 w-full max-w-[min(1100px,95vw)] mx-auto flex items-center justify-center min-h-0">
            <Board
              guesses={me?.guesses || []}
              activeGuess={activeGuessForBattle}
              errorShakeKey={shakeKey}
              errorActiveRow={showActiveError}
              guessFlipKey={guessFlipKey}
              maxTile={112}
              minTile={44}
              gap={8}
              padding={8}
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
      </div>
    );
  };

  const standbyMessage = (() => {
    if (roundActive) return null;
    if (isAiMode) {
      if (pendingStart) return "Waiting for host";
      if (countdownLabel) {
        return `Next round in ${countdownLabel}`;
      }
      return roundFinished
        ? "Game ended — AI host is preparing the next round..."
        : "Waiting for AI host";
    }
    return roundFinished
      ? "Game ended — waiting for host to start the next round..."
      : "Waiting for host";
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
        maxTile: isMobile ? 80 : 112,
        minTile: isMobile ? 44 : 56,
        gap: isMobile ? 6 : 10,
        padding: isMobile ? 10 : 12,
      }}
      letterStates={letterStates}
      onKeyPress={onKeyPress}
      keyboardDisabled={!canGuessBattle || submittingGuess}
      showKeyboard={true}
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

