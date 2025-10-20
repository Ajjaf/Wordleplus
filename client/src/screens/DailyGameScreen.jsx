import React from "react";
import Board from "../components/Board.jsx";
import Keyboard from "../components/Keyboard.jsx";
import GameNotification from "../components/GameNotification.jsx";

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
}) {
  const title = challenge?.title || "Daily Challenge";
  const subtitle = challenge?.subtitle || challenge?.date || "";
  const maxGuesses = challenge?.maxGuesses || 6;

  return (
    <div
      className="w-full flex flex-col bg-background relative overflow-hidden"
      style={{ minHeight: "calc(100dvh - 64px)" }}
    >
      {/* Header */}
      <div className="px-3 pt-3 pb-2">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-800 text-center mb-1">
            {title}
          </h2>
          <div className="text-center space-y-1">
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            <p className="text-xs text-slate-600 font-medium tracking-[0.35em] uppercase">
              Guess the word in {maxGuesses} tries
            </p>
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
  );
}
