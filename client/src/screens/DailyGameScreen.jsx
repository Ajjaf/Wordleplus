import React from "react";
import { motion } from "framer-motion";
import Board from "../components/Board.jsx";
import Keyboard from "../components/Keyboard.jsx";
import GameNotification from "../components/GameNotification.jsx";
import GradientBackground from "../components/ui/GradientBackground";

export default function DailyGameScreen({
  challenge,
  guesses,
  currentGuess,
  letterStates,
  onKeyPress,
  statusMessage,
  loading = false,
  gameOver = false,
  correctWord = null,
  won = false,
  shakeKey = 0,
  showActiveError = false,
  notificationMessage = "",
  onNotificationDismiss = () => {},
  guessFlipKey = 0,
}) {
  const title = challenge?.title || "Daily Challenge";
  const subtitle = challenge?.subtitle || challenge?.date || "";
  const maxGuesses = challenge?.maxGuesses || 6;

  return (
    <GradientBackground fullHeight className="flex h-full">
      <div className="flex flex-1 flex-col w-full min-h-0 relative overflow-hidden">
        {/* Header */}
        <div className="px-3 pt-4 pb-3">
          <div className="max-w-7xl mx-auto">
            <motion.h2
              className="text-2xl md:text-3xl font-bold text-white text-center mb-2"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {title}
            </motion.h2>
            <div className="text-center space-y-1">
              {subtitle && (
                <motion.p
                  className="text-xs text-white/60"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                >
                  {subtitle}
                </motion.p>
              )}
              <motion.p
                className="text-xs text-white/70 font-medium tracking-[0.35em] uppercase"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.3 }}
              >
                Guess the word in {maxGuesses} tries
              </motion.p>
            </div>
          </div>
        </div>

        {/* Main Board Area */}
        <main className="flex-1 px-3 md:px-4 pt-2 pb-3 flex flex-col min-h-0 relative">
          {/* Transient Notification */}
          {notificationMessage && (
            <GameNotification
              message={notificationMessage}
              duration={1500}
              onDismiss={onNotificationDismiss}
            />
          )}

          <div className="flex-1 flex flex-col items-center min-h-0">
            {/* Center board */}
            <div className="flex-1 w-full max-w-[min(1100px,95vw)] max-h-[calc(100dvh-260px)] flex items-center justify-center min-h-0">
              <Board
                guesses={guesses}
                activeGuess={gameOver ? "" : currentGuess}
                maxTile={112}
                minTile={56}
                gap={10}
                padding={12}
                secretWord={null}
                secretWordState="empty"
                errorShakeKey={shakeKey}
                errorActiveRow={showActiveError}
                guessFlipKey={guessFlipKey}
              />
            </div>
          </div>
        </main>

        {/* Keyboard Footer */}
        <footer className="px-2 sm:px-4 pb-2 flex-shrink-0">
          <div className="max-w-5xl mx-auto">
            <Keyboard
              onKeyPress={onKeyPress}
              letterStates={letterStates}
              disabled={gameOver || loading}
            />
          </div>
        </footer>
      </div>
    </GradientBackground>
  );
}
