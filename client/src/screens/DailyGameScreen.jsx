import React from "react";
import { motion } from "framer-motion";
import { useIsMobile } from "../hooks/useIsMobile";
import { GameLayout } from "../components/layout/GameLayout";
import Board from "../components/Board";
import MobileBoard from "../components/mobile/MobileBoard";
// GameNotification removed - using visual feedback only (shake animations)
import LoadingSpinner, { LoadingOverlay } from "../components/ui/LoadingSpinner";
import { getModeTheme } from "../config/mode-themes";
import { cn } from "../lib/utils";

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
  const mode = "daily";
  const theme = getModeTheme(mode);
  const isMobile = useIsMobile();
  
  const title = challenge?.title || "Daily Challenge";
  const subtitle = challenge?.subtitle || challenge?.date || "";
  const maxGuesses = challenge?.maxGuesses || 6;

  // Custom header with notification
  const renderHeader = () => {
    return (
      <>
        {loading && !challenge && (
          <LoadingOverlay text="Loading daily challenge..." />
        )}
        <div className={cn("px-3", isMobile ? "pt-1.5 pb-1" : "pt-3 pb-2")}>
          <div className="max-w-7xl mx-auto">
            <motion.h2
              className={cn(
                "font-semibold text-white text-center",
                isMobile
                  ? "text-base mb-1"
                  : "text-xl md:text-2xl mb-1.5"
              )}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {title}
            </motion.h2>
            <div className="text-center space-y-0.5">
              {subtitle && (
                <motion.p
                  className={cn("text-white/60", isMobile ? "text-[10px]" : "text-xs")}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                >
                  {subtitle}
                </motion.p>
              )}
              <motion.p
                className={cn(
                  "text-white/70 font-medium tracking-[0.35em] uppercase",
                  isMobile ? "text-[10px]" : "text-xs"
                )}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.3 }}
              >
                Guess the word in {maxGuesses} tries
              </motion.p>
            </div>
          </div>
        </div>
      </>
    );
  };

  // Custom board section - visual feedback only (no text notifications)
  const renderBoard = () => {
    return (
      <div className="flex-1 flex flex-col items-center min-h-0 relative">
        {/* Visual feedback handled via board shake animations - no text notifications */}

        {isMobile ? (
          <MobileBoard
            guesses={guesses}
            activeGuess={gameOver ? "" : currentGuess}
            maxTile={80}
            minTile={44}
            gap={6}
            padding={10}
            secretWord={null}
            secretWordState="empty"
            errorShakeKey={shakeKey}
            errorActiveRow={showActiveError}
            guessFlipKey={guessFlipKey}
            reservedBottom={340}
          />
        ) : (
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
        )}
      </div>
    );
  };

  return (
    <GameLayout
      mode={mode}
      players={[]}
      showPlayerSection={false}
      guesses={guesses}
      activeGuess={gameOver ? "" : currentGuess}
      boardProps={{
        secretWord: null,
        secretWordState: "empty",
        errorShakeKey: shakeKey,
        errorActiveRow: showActiveError,
        guessFlipKey,
        maxTile: isMobile ? 86 : 112,
        minTile: isMobile ? 44 : 56,
        gap: isMobile ? 6 : 10,
        padding: isMobile ? 8 : 12,
      }}
      letterStates={letterStates}
      onKeyPress={onKeyPress}
      keyboardDisabled={gameOver || loading}
      showKeyboard={true}
      renderHeader={renderHeader}
      renderBoard={renderBoard}
    />
  );
}
