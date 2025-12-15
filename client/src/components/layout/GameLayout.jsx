import React from "react";
import GradientBackground from "../ui/GradientBackground";
import Keyboard from "../Keyboard";
import Board from "../Board";
import MobileBoard from "../mobile/MobileBoard";
import { UnifiedPlayerCard } from "../player/UnifiedPlayerCard";
import { GameEffects } from "../features/GameEffects";
import { GameTimer } from "../features/GameTimer";
import { GameStatusBar } from "../features/GameStatusBar";
import { getModeTheme, hasFeature } from "../../config/mode-themes";
import { useIsMobile } from "../../hooks/useIsMobile";
import { cn } from "../../lib/utils";

/**
 * GameLayout - Unified layout wrapper for all game modes
 * 
 * Provides consistent structure across all game screens:
 * - Header: Status, timer, mode badge
 * - Player Section: Unified player cards
 * - Board Section: Game board
 * - Footer: Keyboard
 */
export function GameLayout({
  mode = "duel",
  
  // Header props
  headerTitle,
  headerSubtitle,
  timerDeadline,
  timerCountdownEndsAt,
  timerLabel,
  showTimer = false,
  
  // Status bar props
  statusMessage,
  statusBadges = [],
  
  // Player section props
  players = [], // Array of player objects
  playerLayout = "grid-cols-2", // CSS grid class
  showPlayerSection = true,
  
  // Board props
  guesses = [],
  activeGuess = "",
  secretWord = null,
  secretWordState = "empty",
  onSecretWordSubmit,
  isOwnBoard = true,
  boardProps = {},
  
  // Keyboard props
  letterStates = {},
  onKeyPress,
  keyboardDisabled = false,
  showKeyboard = true,
  
  // Effects props
  effects = {}, // { showParticles, showConfetti, etc. }
  
  // Layout customization
  className = "",
  headerClassName = "",
  playerSectionClassName = "",
  boardSectionClassName = "",
  footerClassName = "",
  
  // Children for custom content
  children,
  
  // Custom render functions
  renderHeader,
  renderPlayerSection,
  renderBoard,
  renderFooter,
}) {
  const isMobile = useIsMobile();
  const theme = getModeTheme(mode);
  
  const enableParticles = hasFeature(mode, "particles");
  const enableConfetti = hasFeature(mode, "confetti");
  
  return (
    <GradientBackground fullHeight className="flex h-full">
      <div className={cn("flex flex-1 flex-col w-full min-h-0 relative overflow-hidden", className)}>
        {/* Game Effects */}
        <GameEffects
          {...effects}
          enableParticles={enableParticles}
          enableConfetti={enableConfetti}
        />
        
        {/* Header Section */}
        {renderHeader ? (
          renderHeader()
        ) : (
          <header className={cn("px-3", isMobile ? "pt-1.5 pb-1" : "pt-3 pb-3", headerClassName)}>
            <div className="max-w-7xl mx-auto">
              {headerTitle && (
                <h2
                  className={cn(
                    "font-semibold text-white text-center",
                    isMobile
                      ? "text-[10px] uppercase tracking-[0.35em] leading-4"
                      : "text-base md:text-lg"
                  )}
                >
                  {headerTitle}
                </h2>
              )}
              
              {headerSubtitle && (
                <div className="text-center mt-1">
                  <p className={cn("text-white/60", isMobile ? "text-[10px]" : "text-sm")}>
                    {headerSubtitle}
                  </p>
                </div>
              )}
              
              {showTimer && (timerDeadline || timerCountdownEndsAt) && (
                <div className="mt-2">
                  <GameTimer
                    deadline={timerDeadline}
                    countdownEndsAt={timerCountdownEndsAt}
                    label={timerLabel}
                    size={isMobile ? "sm" : "md"}
                  />
                </div>
              )}
              
              {(statusMessage || statusBadges.length > 0) && (
                <div className="mt-2">
                  <GameStatusBar
                    mode={mode}
                    status={statusMessage}
                    badges={statusBadges}
                    isMobile={isMobile}
                  />
                </div>
              )}
            </div>
          </header>
        )}
        
        {/* Main Content */}
        <main
          className={cn(
            "flex-1 px-3 md:px-4 min-h-0 flex flex-col",
            isMobile ? "pt-1.5 pb-2" : "pt-2 pb-3"
          )}
        >
          <div
            className={cn(
              "w-full max-w-4xl mx-auto flex flex-col flex-1 min-h-0",
              isMobile ? "gap-3" : "gap-4"
            )}
          >
            {/* Player Section */}
            {showPlayerSection && players.length > 0 && (
              renderPlayerSection ? (
                renderPlayerSection()
              ) : (
                <section className={cn("flex-shrink-0", playerSectionClassName)}>
                  {isMobile ? (
                    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1">
                      {players.map((player, index) => (
                        <UnifiedPlayerCard
                          key={player.id || index}
                          variant="compact"
                          size="sm"
                          isMobile={true}
                          onSelect={player.onSelect}
                          {...player}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className={cn("grid gap-3", playerLayout)}>
                      {players.map((player, index) => (
                        <UnifiedPlayerCard
                          key={player.id || index}
                          variant={player.variant || "detailed"}
                          size={player.size || "md"}
                          theme={theme}
                          {...player}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )
            )}
            
            {/* Board Section */}
            {renderBoard ? (
              renderBoard()
            ) : (
              <section className={cn("flex-1 flex items-center justify-center min-h-0", boardSectionClassName)}>
                {isMobile ? (
                  <MobileBoard
                    guesses={guesses}
                    activeGuess={activeGuess}
                    secretWord={secretWord}
                    secretWordState={secretWordState}
                    reservedBottom={360}
                    maxWidth="min(440px, 96vw)"
                    {...boardProps}
                  />
                ) : (
                  <div className="w-full max-w-[min(1100px,95vw)] max-h-[calc(100dvh-260px)] flex items-center justify-center min-h-0">
                    <Board
                      guesses={guesses}
                      activeGuess={activeGuess}
                      secretWord={secretWord}
                      secretWordState={secretWordState}
                      isOwnBoard={isOwnBoard}
                      {...boardProps}
                    />
                  </div>
                )}
              </section>
            )}
            
            {/* Custom Children */}
            {children}
          </div>
        </main>
        
        {/* Footer Section */}
        {(showKeyboard || renderFooter) && (
          <footer
            className={cn(
              "w-full px-2 sm:px-4 flex-shrink-0",
              isMobile ? "py-1.5" : "py-2",
              footerClassName
            )}
            style={{
              paddingBottom: isMobile
                ? renderFooter && !showKeyboard
                  ? "calc(env(safe-area-inset-bottom) + 1rem)"
                  : "calc(env(safe-area-inset-bottom) + 0.25rem)"
                : undefined,
            }}
          >
            <div className="mx-auto w-full max-w-5xl">
              {/* Custom footer content (e.g., rematch button) - shown above keyboard */}
              {renderFooter && (
                <div className="mb-2">
                  {renderFooter()}
                </div>
              )}
              
              {/* Keyboard - always show when showKeyboard is true */}
              {showKeyboard && (
                <Keyboard
                  onKeyPress={onKeyPress}
                  letterStates={letterStates}
                  disabled={keyboardDisabled}
                  sticky={isMobile}
                />
              )}
            </div>
          </footer>
        )}
      </div>
    </GradientBackground>
  );
}

export default GameLayout;

