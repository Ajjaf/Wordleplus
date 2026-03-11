import React from "react";
import { useIsMobile } from "../hooks/useIsMobile";
import { GameLayout } from "../components/layout/GameLayout";
import Board from "../components/Board";
import MobileBoard from "../components/mobile/MobileBoard";
// GameNotification removed - using visual feedback only (shake animations)
import { LoadingOverlay } from "../components/ui/LoadingSpinner";
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
        <div className={cn("px-3", isMobile ? "pt-2 pb-1" : "pt-3 pb-2")}>
          <h2
            className={cn(
              "font-semibold text-white text-center",
              isMobile ? "text-sm" : "text-lg"
            )}
          >
            {title}
          </h2>
          {subtitle && (
            <p className={cn("text-white/40 text-center", isMobile ? "text-[10px]" : "text-xs")}>
              {subtitle}
            </p>
          )}
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
