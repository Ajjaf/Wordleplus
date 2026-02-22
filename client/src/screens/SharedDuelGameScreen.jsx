import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useIsMobile } from "../hooks/useIsMobile";
import { GameLayout } from "../components/layout/GameLayout";
import { UnifiedPlayerCard } from "../components/player/UnifiedPlayerCard";
import { GameStatusBar } from "../components/features/GameStatusBar";
import { IconStatusBadge } from "../components/ui/IconStatusBadge";
import Board from "../components/Board";
import MobileBoard from "../components/mobile/MobileBoard";
import GlowButton from "../components/ui/GlowButton";
import { logger } from "../utils/logger";
import { getModeTheme } from "../config/mode-themes";

export default function SharedDuelGameScreen({
  room,
  me,
  currentGuess,
  onKeyPress,
  letterStates,
  onStartShared,
  onRematch,
  submittingGuess = false,
}) {
  const mode = "shared";
  const theme = getModeTheme(mode);
  const isMobile = useIsMobile();
  
  const opponentEntry = Object.entries(room.players || {}).find(
    ([id]) => id !== me?.id
  );
  const opponent = opponentEntry
    ? { id: opponentEntry[0], ...opponentEntry[1] }
    : null;

  const canGuess = room.shared?.started && !room.shared?.winner;
  const myTurn = room.shared?.turn === me?.id;
  const isHost = room?.hostId === me?.id;
  const [starting, setStarting] = useState(false);
  const [guessFlipKey, setGuessFlipKey] = useState(0);
  const prevGuessCountRef = useRef(0);

  // bump flip key when a new shared guess is added so Board can animate
  useEffect(() => {
    const count = room.shared?.guesses?.length ?? 0;
    if (count > prevGuessCountRef.current) {
      setGuessFlipKey((k) => k + 1);
    }
    prevGuessCountRef.current = count;
  }, [room.shared?.guesses?.length]);

  // Check if we have enough players to start
  const playerCount = Object.keys(room?.players || {}).length;
  const canStart = isHost && playerCount >= 2 && !room.shared?.started;

  const handleKey = (k) => {
    if (!canGuess) return;
    if (!myTurn) return;
    onKeyPress(k);
  };

  // Get game status text
  const sharedGuesses = room.shared?.guesses || [];
  const latestGuessWord = sharedGuesses.length
    ? (sharedGuesses[sharedGuesses.length - 1].guess || "").toUpperCase()
    : "";
  const normalizedCurrentGuess = (currentGuess || "").toUpperCase();
  const activeGuessForBoard =
    canGuess &&
    myTurn &&
    normalizedCurrentGuess &&
    normalizedCurrentGuess !== latestGuessWord
      ? currentGuess
      : "";

  const getGameStatus = () => {
    if (room.shared?.winner) {
      if (room.shared.winner === "draw") return "It's a draw!";
      const winner = room.players?.[room.shared.winner];
      return winner?.id === me?.id ? "You won!" : `${winner?.name} won!`;
    }
    if (!room.shared?.started) {
      if (playerCount < 2) {
        return isHost
          ? "Waiting for player"
          : "Waiting for host";
      }
      return isHost
        ? null // Host sees button, no status needed
        : "Waiting for host";
    }
    // Turn indicators removed - handled visually via player card highlighting
    return null;
  };

  // Prepare players array
  const players = [
    {
      id: me?.id,
      name: me?.name || "You",
      wins: me?.wins,
      streak: me?.streak,
      highlight: myTurn ? "active" : "none",
      variant: isMobile ? "compact" : "detailed",
      size: isMobile ? "sm" : "md",
      theme,
    },
    {
      id: opponent?.id,
      name: opponent?.name || "Opponent",
      wins: opponent?.wins,
      streak: opponent?.streak,
      highlight: !myTurn && canGuess ? "active" : "none",
      variant: isMobile ? "compact" : "detailed",
      size: isMobile ? "sm" : "md",
      theme,
    },
  ];

  // Custom render for player section with animations
  const renderPlayerSection = () => {
    if (isMobile) {
      return (
        <div className="rounded-3xl border border-white/15 bg-white/10 backdrop-blur-sm p-4 text-white space-y-3 flex-shrink-0">
          <div className="flex items-center justify-between text-sm text-white/80">
            <span className="font-semibold truncate">{me?.name || "You"}</span>
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/50">
              Shared Duel
            </span>
            <span className="font-semibold truncate text-right">
              {opponent?.name || "Opponent"}
            </span>
          </div>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col md:flex-row gap-3 md:gap-4 flex-shrink-0">
        <motion.div
          className="flex-1"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <UnifiedPlayerCard {...players[0]} />
        </motion.div>
        <motion.div
          className="flex-1"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <UnifiedPlayerCard {...players[1]} />
        </motion.div>
      </div>
    );
  };

  // Custom board render with game controls
  const renderBoard = () => {
    return (
      <div className="flex flex-col items-center flex-1 min-h-0">
        {/* Shared board */}
        <div className="flex-1 flex items-center justify-center min-h-0 w-full">
          <div className="w-full max-w-[min(99.8vw,1200px)] max-h-[calc(100dvh-260px)] flex items-center justify-center">
            {isMobile ? (
              <MobileBoard
                guesses={room.shared?.guesses || []}
                activeGuess={activeGuessForBoard}
                isOwnBoard={true}
                secretWord={
                  !room.shared?.started && room.shared?.lastRevealedWord
                    ? room.shared.lastRevealedWord
                    : null
                }
                secretWordState={
                  !room.shared?.started && room.shared?.lastRevealedWord
                    ? "set"
                    : "empty"
                }
                maxTile={80}
                minTile={44}
                gap={6}
                padding={10}
                players={room?.players || {}}
                currentPlayerId={me?.id}
                guessFlipKey={guessFlipKey}
                reservedBottom={360}
              />
            ) : (
              <Board
                guesses={room.shared?.guesses || []}
                activeGuess={activeGuessForBoard}
                isOwnBoard={true}
                secretWord={
                  !room.shared?.started && room.shared?.lastRevealedWord
                    ? room.shared.lastRevealedWord
                    : null
                }
                secretWordState={
                  !room.shared?.started && room.shared?.lastRevealedWord
                    ? "set"
                    : "empty"
                }
                maxTile={112}
                minTile={56}
                gap={10}
                padding={12}
                players={room?.players || {}}
                currentPlayerId={me?.id}
                guessFlipKey={guessFlipKey}
              />
            )}
          </div>
        </div>

        {/* Game controls */}
        <div className="mt-2 flex justify-center flex-shrink-0">
          {!room.shared?.started ? (
            isHost ? (
              <div className="text-center">
                <GlowButton
                  onClick={async () => {
                    if (starting || !canStart) return;
                    try {
                      setStarting(true);
                      const result = await onStartShared();
                      if (result?.error) {
                        logger.error("Start shared error:", result.error);
                      }
                    } finally {
                      setStarting(false);
                    }
                  }}
                  disabled={starting || !canStart}
                  size="lg"
                >
                  {starting ? "Starting..." : "Start Shared Round"}
                </GlowButton>
                {playerCount < 2 && (
                  <motion.div
                    className="flex items-center gap-2 mt-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <IconStatusBadge type="waitingForPlayer" size="sm" animated={true} />
                    <span className="text-xs text-white/60">Waiting for opponent</span>
                  </motion.div>
                )}
              </div>
            ) : (
              <div className="text-center flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  <IconStatusBadge type="waiting" size="md" animated={true} />
                  <span className="text-sm text-white/60">Waiting for host</span>
                </div>
              </div>
            )
          ) : room.shared?.winner ? (
            <div className="text-center">
              <GlowButton onClick={onRematch} size="lg">
                Play Again
              </GlowButton>
            </div>
          ) : (
            // Turn state shown visually via player card highlighting - no text needed
            null
          )}
        </div>
      </div>
    );
  };

  // Status badges
  const statusBadges = [];
  if (room.shared?.winner) {
    if (room.shared.winner === "draw") {
      statusBadges.push({
        variant: "info",
        label: "Draw",
        value: null,
      });
    } else {
      const winner = room.players?.[room.shared.winner];
      statusBadges.push({
        variant: "success",
        label: "Winner",
        value: winner?.id === me?.id ? "You" : winner?.name || "Opponent",
      });
    }
  }

  return (
    <GameLayout
      mode={mode}
      headerTitle={isMobile ? "Shared Duel" : null}
      statusMessage={getGameStatus()}
      statusBadges={statusBadges}
      players={players}
      playerLayout="flex-col md:flex-row"
      showPlayerSection={!isMobile}
      guesses={room.shared?.guesses || []}
      activeGuess={activeGuessForBoard}
      secretWord={
        !room.shared?.started && room.shared?.lastRevealedWord
          ? room.shared.lastRevealedWord
          : null
      }
      secretWordState={
        !room.shared?.started && room.shared?.lastRevealedWord
          ? "set"
          : "empty"
      }
      boardProps={{
        isOwnBoard: true,
        maxTile: isMobile ? 80 : 112,
        minTile: isMobile ? 44 : 56,
        gap: isMobile ? 6 : 10,
        padding: isMobile ? 10 : 12,
        players: room?.players || {},
        currentPlayerId: me?.id,
        guessFlipKey,
      }}
      letterStates={letterStates}
      onKeyPress={handleKey}
      keyboardDisabled={!room.shared?.started || !myTurn || !canGuess || submittingGuess}
      showKeyboard={true}
      renderPlayerSection={renderPlayerSection}
      renderBoard={renderBoard}
    />
  );
}
