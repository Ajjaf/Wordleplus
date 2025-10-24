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
}) {
  const [guessFlipKey, setGuessFlipKey] = useState(0);

  // Particle effects
  const [showCorrectParticles, setShowCorrectParticles] = useState(false);
  const [showStreakParticles, setShowStreakParticles] = useState(false);
  const [showVictoryParticles, setShowVictoryParticles] = useState(false);
  const [particlePosition, setParticlePosition] = useState({ x: 0, y: 0 });
  const [lastStreak, setLastStreak] = useState(0);

  const isMobile = useIsMobile();

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

  // Trigger guess flip animation when a new guess is added
  useEffect(() => {
    if (me?.guesses && me.guesses.length > 0) {
      // Small delay to let the guess state update
      const timer = setTimeout(() => {
        setGuessFlipKey((prev) => prev + 1);
      }, 100);
      if (isMobile) {
    const mobileRoster = [
      ...(me ? [{ ...me, id: me.id || "self", isSelf: true }] : []),
      ...((Array.isArray(otherPlayers) ? otherPlayers : []) || []),
    ];

    return (
      <GradientBackground fullHeight className="flex h-full">
        <div className="flex flex-1 flex-col w-full min-h-0 px-3 pt-5 pb-3 gap-4">
          <div className="flex-1 flex items-start justify-center min-h-0">
            <div className="w-full max-w-[min(420px,92vw)]">
              <Board
                guesses={me?.guesses || []}
                activeGuess={activeGuessForBattle}
                errorShakeKey={shakeKey}
                errorActiveRow={showActiveError}
                guessFlipKey={guessFlipKey}
              />
            </div>
          </div>

          {mobileRoster.length > 0 && (
            <div className="-mx-1 px-1 flex gap-3 overflow-x-auto">
              {mobileRoster.map((player) => (
                <MobilePlayerProgressCard
                  key={player.id || player.name}
                  name={player.name || "Player"}
                  wins={player.wins || 0}
                  streak={player.streak || 0}
                  guesses={player.guesses || []}
                  maxGuesses={6}
                  isActive={player.id === me?.id}
                />
              ))}
            </div>
          )}

          <div className="px-1 pb-[env(safe-area-inset-bottom,0px)]">
            <Keyboard
              onKeyPress={onKeyPress}
              letterStates={letterStates}
              disabled={!canGuessBattle}
            />
          </div>
        </div>
      </GradientBackground>
    );
  }

  return () => clearTimeout(timer);
    }
  }, [me?.guesses?.length]);

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

  const getWinnerName = () => {
    if (!room?.battle?.winner) return "Unknown";
    const playerArray = Array.isArray(players) ? players : Object.values(players || {});
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
                  Battle Royale
                </motion.h2>

                {!isHost && (
                  <div className="text-center space-y-2">
                    {roundActive && !roundFinished && (
                      <motion.div
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-xl"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        <span className="text-sm text-emerald-300 font-medium">
                          Game in progress… good luck!
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
                    {!roundActive && !roundFinished && (
                      <motion.div
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-xl"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        <span className="text-sm text-white/70 font-medium">
                          Waiting for host to start the game…
                        </span>
                      </motion.div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Main */}
        <main className="flex-1 px-3 md:px-4 pt-2 pb-3 flex flex-col min-h-0">
          {isMobile ? (
            <div className="flex-1 flex items-center justify-center min-h-0">
              {/* Mobile-specific layout removed for a cleaner experience:
              {roundActive ? (
                <MobileBattleLayout
                  me={me}
                  otherPlayers={otherPlayers}
                  currentGuess={currentGuess}
                  shakeKey={shakeKey}
                  showActiveError={showActiveError}
                  letterStates={letterStates}
                  canGuessBattle={canGuessBattle}
                  onKeyPress={onKeyPress}
                  className="h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <GameResults
                    room={room}
                    players={allPlayers}
                    correctWord={correctWord}
                  />
                </div>
              )}
              */}
              <div className="w-full max-w-[min(1100px,95vw)] flex items-center justify-center min-h-0">
                <Board
                  guesses={me?.guesses || []}
                  activeGuess={activeGuessForBattle}
                  errorShakeKey={shakeKey}
                  errorActiveRow={showActiveError}
                  guessFlipKey={guessFlipKey}
                />
              </div>
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
            {canGuessBattle ? (
              <Keyboard onKeyPress={onKeyPress} letterStates={letterStates} />
            ) : (!isMobile && (
              <div className="text-center text-sm text-white/60 py-3">
                {roundFinished
                  ? "Game ended — waiting for host to start the next round…"
                  : "Waiting for host to start the game…"}
              </div>
            ) /* Mobile informational banner hidden */)}
          </div>
        </footer>
      </div>
    </GradientBackground>
  );
}

export default BattleGameScreen;
