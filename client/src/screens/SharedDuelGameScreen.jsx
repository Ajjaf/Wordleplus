import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Board from "../components/Board.jsx";
import Keyboard from "../components/Keyboard.jsx";
import PlayerCard from "../components/PlayerCard.jsx";
import GradientBackground from "../components/ui/GradientBackground";
import GlowButton from "../components/ui/GlowButton";
import { useIsMobile } from "../hooks/useIsMobile";
import MobileBoard from "../components/mobile/MobileBoard.jsx";

export default function SharedDuelGameScreen({ room, me, currentGuess, onKeyPress, letterStates, onStartShared, onRematch }) {
  const opponentEntry = Object.entries(room.players || {}).find(([id]) => id !== me?.id);
  const opponent = opponentEntry ? { id: opponentEntry[0], ...opponentEntry[1] } : null;
  
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
  const isMobile = useIsMobile();

  // Get game status text
  const sharedGuesses = room.shared?.guesses || [];
  const latestGuessWord = sharedGuesses.length
    ? (sharedGuesses[sharedGuesses.length - 1].guess || "").toUpperCase()
    : "";
  const normalizedCurrentGuess = (currentGuess || "").toUpperCase();
  const activeGuessForBoard =
    canGuess && myTurn && normalizedCurrentGuess && normalizedCurrentGuess !== latestGuessWord
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
        return isHost ? "Waiting for opponent to join..." : "Waiting for host to start...";
      }
      return isHost ? "Click 'Start Round' to begin" : "Waiting for host to start...";
    }
    if (myTurn) return "Your turn - make a guess!";
    return `${opponent?.name}'s turn`;
  };

  if (isMobile) {
    return (
      <GradientBackground fullHeight className="flex h-full">
        <div className="flex flex-1 flex-col w-full min-h-0 px-3 pt-5 pb-3 gap-4">
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
              !room.shared?.started && room.shared?.lastRevealedWord ? "set" : "empty"
            }
            maxTile={88}
            minTile={48}
            players={room?.players || {}}
            currentPlayerId={me?.id}
            guessFlipKey={guessFlipKey}
            reservedBottom={360}
          />

          <div className="px-1 pb-[env(safe-area-inset-bottom,0px)]">
            <Keyboard
              onKeyPress={handleKey}
              letterStates={letterStates}
              disabled={!myTurn || !canGuess}
            />
          </div>
        </div>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground fullHeight className="flex h-full">
      <div className="flex flex-1 flex-col w-full min-h-0 relative overflow-hidden">
        <main className="flex-1 px-3 md:px-4 pt-4 pb-3 min-h-0">
          <div className="max-w-4xl mx-auto h-full flex flex-col gap-4">
            {/* Player cards */}
            <div className="flex flex-col md:flex-row gap-3 md:gap-4">
              <motion.div
                className="flex-1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <PlayerCard
                  name={me?.name || "You"}
                  wins={me?.wins}
                  streak={me?.streak}
                  highlight={myTurn ? "active" : "none"}
                />
              </motion.div>
              <motion.div
                className="flex-1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <PlayerCard
                  name={opponent?.name || "Opponent"}
                  wins={opponent?.wins}
                  streak={opponent?.streak}
                  highlight={!myTurn && canGuess ? "active" : "none"}
                />
              </motion.div>
            </div>

            {/* Shared board */}
            <div className="flex-1 flex items-center justify-center min-h-0">
              <div className="w-full max-w-[min(99.8vw,1200px)] max-h-[calc(100dvh-260px)] flex items-center justify-center">
                <Board
                  guesses={room.shared?.guesses || []}
                  activeGuess={activeGuessForBoard}
                  isOwnBoard={true}
                  // only reveal secret when round has ended
                  secretWord={!room.shared?.started && room.shared?.lastRevealedWord ? room.shared.lastRevealedWord : null}
                  secretWordState={!room.shared?.started && room.shared?.lastRevealedWord ? 'set' : 'empty'}
                  maxTile={140}
                  minTile={50}
                  players={room?.players || {}}
                  currentPlayerId={me?.id}
                  guessFlipKey={guessFlipKey}
                />
              </div>
            </div>

            {/* Game controls */}
            <div className="mt-2 flex justify-center">
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
                            console.error("Start shared error:", result.error);
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
                        className="text-sm text-amber-300 mt-3"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        ⚠️ Waiting for opponent to join...
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="text-lg font-medium text-white mb-2">
                      Waiting for host to start...
                    </div>
                    <div className="text-sm text-white/60">
                      Both players will compete to solve the same puzzle!
                    </div>
                  </div>
                )
              ) : room.shared?.winner ? (
                <div className="text-center">
                  <GlowButton
                    onClick={onRematch}
                    size="lg"
                  >
                    Play Again
                  </GlowButton>
                </div>
              ) : (
                <div className="text-center">
                  <motion.div
                    className={`text-sm font-medium mb-2 ${myTurn ? "text-emerald-300" : "text-white/70"}`}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    {myTurn ? "It's your turn!" : "Waiting for opponent..."}
                  </motion.div>
                  <div className="text-xs text-white/50">
                    Take turns guessing the same word
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Keyboard */}
        <footer className="w-full px-2 sm:px-4 pb-2 flex-shrink-0">
          <div className="max-w-[min(99.8vw,1200px)] mx-auto">
            <Keyboard
              onKeyPress={handleKey}
              letterStates={letterStates}
              disabled={!myTurn || !canGuess}
            />
          </div>
        </footer>
      </div>
    </GradientBackground>
  );
}
