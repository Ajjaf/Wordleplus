import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRef } from "react";
import { motion } from "framer-motion";
import { getRandomWord } from "../api";
import { useIsMobile } from "../hooks/useIsMobile";
import { GameLayout } from "../components/layout/GameLayout";
import { UnifiedPlayerCard } from "../components/player/UnifiedPlayerCard";
import { GameEffects } from "../components/features/GameEffects";
import { GameTimer } from "../components/features/GameTimer";
import { GameStatusBar } from "../components/features/GameStatusBar";
import Board from "../components/Board.jsx";
import GlowButton from "../components/ui/GlowButton";
import { getModeTheme } from "../config/mode-themes";

function DuelGameScreen({
  room,
  me,
  opponent,
  currentGuess,
  shakeKey,
  showActiveError,
  letterStates,
  onKeyPress,
  onSubmitSecret,
  onRematch,
  submittingGuess = false,
}) {
  const mode = "duel";
  const theme = getModeTheme(mode);
  const isMobile = useIsMobile();
  
  // Local input for MY secret only
  const [secretWordInput, setSecretWordInput] = useState("");
  const [secretLocked, setSecretLocked] = useState(false);
  const [mySubmittedSecret, setMySubmittedSecret] = useState("");

  // Effects state
  const [showParticles, setShowParticles] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showCorrectParticles, setShowCorrectParticles] = useState(false);
  const [showStreakParticles, setShowStreakParticles] = useState(false);
  const [particlePosition, setParticlePosition] = useState({ x: 0, y: 0 });
  const [showSecretReveal, setShowSecretReveal] = useState(false);
  const [guessFlipKey, setGuessFlipKey] = useState(0);
  const [lastStreak, setLastStreak] = useState(0);

  // Mobile UX
  const [mobileView, setMobileView] = useState("me");

  // Generate random word
  const [genBusy, setGenBusy] = useState(false);
  const [boardMetrics, setBoardMetrics] = useState(null);
  const [viewportHeight, setViewportHeight] = useState(() => {
    if (typeof window === "undefined") return 0;
    return window.visualViewport?.height ?? window.innerHeight;
  });

  // Derived flags
  const isGameStarted = !!room?.started;
  const isGameEnded = !!(room?.winner || room?.duelReveal);
  const hasRequestedRematch = !!me?.rematchRequested;
  const opponentRequestedRematch = !!opponent?.rematchRequested;
  const bothRequestedRematch = hasRequestedRematch && opponentRequestedRematch;
  const canGuess = isGameStarted && !isGameEnded;
  const showSecretEntry = !isGameStarted && !isGameEnded;
  const showBoardArea = isGameStarted || isGameEnded;
  const myGuesses = me?.guesses || [];
  const latestGuessWord = myGuesses.length
    ? (myGuesses[myGuesses.length - 1]?.guess || "").toUpperCase()
    : "";
  const normalizedCurrentGuess = (currentGuess || "").toUpperCase();
  const activeGuessForMe =
    normalizedCurrentGuess && normalizedCurrentGuess !== latestGuessWord
      ? currentGuess
      : "";

  const revealNow = isGameEnded || !!room?.duelReveal;
  const myReady = !!me?.ready;
  const oppReady = !!opponent?.ready;
  const bothReady = myReady && oppReady;
  const canSetSecret = !myReady && !isGameEnded;
  const freshRound = !isGameStarted && !isGameEnded && !myReady && !oppReady;
  const deadline = room?.duelDeadline ?? null;

  // Board metrics
  const secretTileSize = boardMetrics?.tile ?? 48;
  const secretGap = boardMetrics?.gap ?? 8;
  const secretRowWidth = secretTileSize * 5 + secretGap * 4;
  const diceSize = Math.max(36, Math.min(48, secretTileSize));
  const secretFontSize = Math.max(18, secretTileSize * 0.55);
  
  const getInitial = (value, fallback) => {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : fallback;
  };
  const myAvatarInitial = getInitial(me?.name, "Y");
  const opponentAvatarInitial = getInitial(opponent?.name, "?");

  const handleBoardMeasure = useCallback((metrics) => {
    setBoardMetrics((prev) => {
      if (
        !prev ||
        prev.tile !== metrics.tile ||
        prev.gap !== metrics.gap ||
        prev.padding !== metrics.padding
      ) {
        return metrics;
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    const handleViewportChange = () => {
      const next = vv?.height ?? window.innerHeight;
      setViewportHeight(next);
    };
    handleViewportChange();
    if (vv) {
      vv.addEventListener("resize", handleViewportChange);
      vv.addEventListener("scroll", handleViewportChange);
      return () => {
        vv.removeEventListener("resize", handleViewportChange);
        vv.removeEventListener("scroll", handleViewportChange);
      };
    }
    window.addEventListener("resize", handleViewportChange);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
    };
  }, []);

  const boardTileBounds = useMemo(() => {
    const defaults = {
      min: isMobile ? 34 : 36,
      max: isMobile ? 56 : 72,
    };
    if (!viewportHeight) return defaults;
    if (viewportHeight < 480) return { min: 26, max: 34 };
    if (viewportHeight < 560) return { min: 28, max: 38 };
    if (viewportHeight < 650) return { min: 30, max: 44 };
    if (viewportHeight < 740) return { min: 32, max: isMobile ? 50 : 58 };
    return defaults;
  }, [viewportHeight, isMobile]);

  const boardPadding = !isMobile
    ? 12
    : !viewportHeight
    ? 8
    : viewportHeight < 480
    ? 4
    : viewportHeight < 560
    ? 6
    : 8;

  const [secretErrorActive, setSecretErrorActive] = useState(false);
  const [secretErrorKey, setSecretErrorKey] = useState(0);

  // Clear all local secret-related state at the start of a fresh round
  useEffect(() => {
    if (freshRound) {
      setSecretWordInput("");
      setSecretLocked(false);
      setMySubmittedSecret("");
    }
  }, [freshRound]);

  const clamp5 = (w) =>
    (w || "").toString().toUpperCase().slice(0, 5).padEnd(5, " ");

  const myId = me?.id;
  const oppId = opponent?.id;
  const revealMine = clamp5(
    (myId && room?.duelReveal?.[myId]) || mySubmittedSecret
  );
  const revealOpp = clamp5((oppId && room?.duelReveal?.[oppId]) || "");

  // Effects
  useEffect(() => {
    if (bothRequestedRematch) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(t);
    }
  }, [bothRequestedRematch]);

  useEffect(() => {
    if (isGameEnded && revealNow) {
      const timer = setTimeout(() => {
        setShowSecretReveal(true);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setShowSecretReveal(false);
    }
  }, [isGameEnded, revealNow]);

  useEffect(() => {
    if (me?.guesses && me.guesses.length > 0) {
      const timer = setTimeout(() => {
        setGuessFlipKey((prev) => prev + 1);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [me?.guesses?.length]);

  useEffect(() => {
    if (me?.guesses && me.guesses.length > 0) {
      const lastGuess = me.guesses[me.guesses.length - 1];
      if (lastGuess && lastGuess.pattern) {
        const hasCorrect = lastGuess.pattern.some((state) => state === "green");
        if (hasCorrect) {
          setParticlePosition({
            x: window.innerWidth / 4,
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
          x: window.innerWidth / 4,
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
    if (bothReady && !isGameStarted) {
      setParticlePosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      setShowParticles(true);
      const t = setTimeout(() => setShowParticles(false), 2000);
      return () => clearTimeout(t);
    }
  }, [bothReady, isGameStarted]);

  const handleSecretSubmit = async (word) => {
    if (word.length !== 5) return;
    const res = await onSubmitSecret(word);
    if (res?.ok) {
      setSecretLocked(true);
      setMySubmittedSecret(word.toUpperCase());
    } else {
      bumpSecretError();
    }
  };

  async function handleGenerateSecret() {
    if (!canSetSecret || genBusy) return;
    try {
      setGenBusy(true);
      const w = await getRandomWord();
      if (w && w.length === 5) {
        setSecretWordInput(w);
      }
    } catch (e) {
      // Error occurred
    } finally {
      setGenBusy(false);
    }
  }

  const handleSecretKeyPress = (key) => {
    if (!canSetSecret) return;
    if (key === "ENTER") {
      if (secretWordInput.length === 5) handleSecretSubmit(secretWordInput);
    } else if (key === "BACKSPACE") {
      setSecretWordInput((prev) => prev.slice(0, -1));
    } else if (/^[A-Z]$/.test(key)) {
      setSecretWordInput((prev) => (prev.length < 5 ? prev + key : prev));
    }
  };

  const handleRematch = () => {
    onRematch();
    setMySubmittedSecret("");
  };

  useEffect(() => {
    const handler = (event) => {
      event.stopPropagation();
      if (canSetSecret) {
        const up = event.key.toUpperCase();
        if (up === "ENTER") {
          if (secretWordInput.length === 5) handleSecretSubmit(secretWordInput);
          event.preventDefault();
          return;
        }
        if (up === "BACKSPACE") {
          setSecretWordInput((p) => p.slice(0, -1));
          event.preventDefault();
          return;
        }
        if (/^[A-Z]$/.test(up)) {
          setSecretWordInput((p) => (p.length < 5 ? p + up : p));
          event.preventDefault();
          return;
        }
        event.preventDefault();
        return;
      }
      const mySecretReady = secretLocked || !!me?.secret;
      const oppSecretReady = !!opponent?.secret;
      if (canGuess) {
        const up = event.key.toUpperCase();
        if (up === "ENTER") onKeyPress("ENTER");
        else if (up === "BACKSPACE") onKeyPress("BACKSPACE");
        else if (/^[A-Z]$/.test(up)) onKeyPress(up);
        event.preventDefault();
        return;
      }
      event.preventDefault();
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [canSetSecret, secretWordInput, isGameEnded, onKeyPress, canGuess]);

  const handleKeyPress = (key) => {
    if (canSetSecret) {
      handleSecretKeyPress(key);
      return;
    }
    if (canGuess) {
      onKeyPress(key);
    }
  };

  function bumpSecretError() {
    setSecretErrorActive(true);
    setSecretErrorKey((k) => k + 1);
    setTimeout(() => setSecretErrorActive(false), 300);
  }

  const mySecretWord = canSetSecret
    ? secretWordInput.padEnd(5, " ")
    : revealNow
    ? revealMine
    : "?????";
  const mySecretState = canSetSecret
    ? secretWordInput.length
      ? "typing"
      : "empty"
    : "set";

  // Prepare players array for UnifiedPlayerCard
  const players = [
    {
      id: me?.id,
      name: me?.name || "You",
      wins: me?.wins,
      streak: me?.streak,
      avatar: myAvatarInitial,
      host: room?.hostId === me?.id,
      isTyping: canSetSecret && !!secretWordInput,
      hasSecret: myReady,
      disconnected: !!me?.disconnected,
      highlight: isGameEnded && room?.winner === me?.id ? "winner" : "none",
      size: "sm",
      active: true,
      guesses: me?.guesses || [],
      maxGuesses: 6,
      variant: isMobile ? "compact" : "detailed",
      onSelect: isMobile ? () => setMobileView("me") : undefined,
    },
    {
      id: opponent?.id,
      name: opponent?.name || "?",
      wins: opponent?.wins,
      streak: opponent?.streak,
      avatar: opponentAvatarInitial,
      host: room?.hostId === opponent?.id,
      isTyping: false,
      hasSecret: oppReady || isGameStarted,
      disconnected: !!opponent?.disconnected,
      highlight:
        isGameEnded && room?.winner === opponent?.id ? "winner" : "none",
      size: "sm",
      guesses: opponent?.guesses || [],
      maxGuesses: 6,
      variant: isMobile ? "compact" : "detailed",
      onSelect: isMobile ? () => setMobileView("opponent") : undefined,
    },
  ];

  // Header title
  const headerTitle = isGameEnded
    ? bothRequestedRematch
      ? "Rematch starting..."
      : "Game ended - ready for rematch?"
    : null;

  // Status message
  const statusMessage = isGameEnded
    ? bothRequestedRematch
      ? "🚀 Both players ready! Starting rematch..."
      : hasRequestedRematch
      ? "🔥 Opponent requested rematch"
      : "⏳ Waiting for opponent"
    : null;

  // Footer content (rematch button)
  const renderFooter = () => {
    if (isGameEnded) {
      return (
        <div className="w-full px-2 sm:px-4 flex-shrink-0">
          <div className="mx-auto w-full max-w-5xl">
            <div className="text-center">
              <GlowButton
                onClick={handleRematch}
                disabled={hasRequestedRematch}
                size="lg"
                variant={hasRequestedRematch ? "secondary" : "primary"}
              >
                {hasRequestedRematch
                  ? "✅ Rematch Requested"
                  : "🚀 Request Rematch"}
              </GlowButton>
            </div>
          </div>
        </div>
      );
    }
    if (!canSetSecret && !canGuess) {
      return (
        <div className="w-full px-2 sm:px-4 flex-shrink-0">
          <div className="mx-auto w-full max-w-5xl">
            <div className="text-center py-4">
              <p className="text-lg font-medium text-white/80">
                {!myReady
                  ? "Set your secret word to continue..."
                  : !oppReady
                  ? "Waiting for opponent to set their secret word..."
                  : "Both players ready! Starting..."}
              </p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom board section with secret word entry
  const renderBoard = () => {
    return (
      <div className="flex flex-col items-center flex-1 min-h-0 gap-4">
        {/* Secret Word Entry Section */}
        {showSecretEntry && (
          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            <div className="text-[10px] uppercase tracking-[0.35em] text-white/50 text-center">
              Choose your secret word
            </div>

            {canSetSecret && secretWordInput.length === 5 && (
              <div className="text-center text-xs text-white/70">
                Press <span className="font-semibold text-white">Enter</span> to
                lock your word
              </div>
            )}

            <div
              className="relative flex justify-center"
              style={{
                width:
                  secretRowWidth +
                  (canSetSecret ? diceSize + secretGap : 0),
                minHeight: secretTileSize,
                paddingRight: canSetSecret ? diceSize + secretGap : 0,
              }}
            >
              {/* Secret Word Tiles */}
              <div className="flex" style={{ gap: secretGap }}>
                {Array.from({ length: 5 }).map((_, i) => {
                  const typingLen = secretWordInput.length;
                  const show =
                    mySecretState === "typing"
                      ? secretWordInput.padEnd(5, " ")
                      : mySecretWord || "";
                  const letter = show[i] || "";
                  const isEmpty = letter === "" || letter === " ";
                  const isActive =
                    mySecretState === "typing" &&
                    isEmpty &&
                    i === typingLen;

                  let bg = "var(--tile-empty-bg)",
                    color = "var(--tile-text)",
                    border = "1px solid var(--tile-empty-border)";

                  if (mySecretState === "set" && !isEmpty) {
                    bg = "#e3f2fd";
                    color = "#1976d2";
                    border = "1px solid #1976d2";
                  } else if (isActive) {
                    bg = "var(--tile-typed-bg)";
                    border = "1px solid #999";
                  }

                  if (secretErrorActive) {
                    bg = "#fee2e2";
                    color = "#991b1b";
                    border = "1px solid #ef4444";
                  }

                  return (
                    <div
                      key={`secret-${i}`}
                      className={secretErrorActive ? "tile-error" : ""}
                      style={{
                        width: secretTileSize,
                        height: secretTileSize,
                        display: "grid",
                        placeItems: "center",
                        background: bg,
                        color,
                        fontWeight: "bold",
                        fontSize: secretFontSize,
                        lineHeight: 1,
                        textTransform: "uppercase",
                        border,
                        borderRadius: 6,
                        overflow: "hidden",
                        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        transform:
                          mySecretState === "typing" && isEmpty
                            ? "scale(1.05)"
                            : "scale(1)",
                        boxShadow:
                          mySecretState === "set" && !isEmpty
                            ? "0 4px 12px rgba(25, 118, 210, 0.3)"
                            : mySecretState === "typing" && isEmpty
                            ? "0 2px 8px rgba(0, 0, 0, 0.2)"
                            : "0 1px 3px rgba(0, 0, 0, 0.1)",
                        animation:
                          mySecretState === "typing" && isEmpty
                            ? "pulse 1.5s ease-in-out infinite"
                            : "none",
                      }}
                    >
                      {mySecretState === "typing"
                        ? letter.trim()
                        : letter || ""}
                    </div>
                  );
                })}
              </div>

              {/* Generate Button */}
              {canSetSecret && (
                <motion.button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleGenerateSecret}
                  disabled={genBusy}
                  title="Generate a random word"
                  aria-label="Generate a random word"
                  className="w-12 h-12 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm shadow-lg grid place-items-center text-xl"
                  whileHover={{
                    scale: 1.1,
                    backgroundColor: "rgba(255, 255, 255, 0.15)",
                  }}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "50%",
                    marginTop: -(diceSize / 2),
                    width: diceSize,
                    height: diceSize,
                    fontSize: Math.round(diceSize * 0.45),
                    transformOrigin: "center",
                  }}
                >
                  🎲
                </motion.button>
              )}
            </div>
          </div>
        )}

        {/* Guesses Board Section */}
        {showBoardArea ? (
          <div className="flex flex-col items-center flex-1 min-h-0 gap-2">
            <div className="text-[10px] uppercase tracking-[0.35em] text-white/50 text-center flex-shrink-0">
              Guesses
            </div>

            <div className="w-full flex-1 flex justify-center items-start min-h-0">
              <div
                className={`w-full h-full mx-auto ${
                  isMobile ? "max-w-[20rem]" : "max-w-md"
                }`}
              >
                <Board
                  guesses={me?.guesses || []}
                  activeGuess={activeGuessForMe}
                  errorShakeKey={shakeKey}
                  errorActiveRow={showActiveError}
                  secretWord={null}
                  isOwnBoard={true}
                  autoFit={true}
                  showGuessesLabel={false}
                  secretWordReveal={showSecretReveal}
                  guessFlipKey={guessFlipKey}
                  onMeasure={handleBoardMeasure}
                  padding={boardPadding}
                  minTile={boardTileBounds.min}
                  maxTile={boardTileBounds.max}
                  verticalAlign="start"
                  horizontalAlign="center"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 flex-1 min-h-0 justify-center text-center px-6">
            <div className="text-[10px] uppercase tracking-[0.35em] text-white/50">
              Guesses
            </div>
            <p className="text-sm text-white/60">
              The board appears once both players lock in their secret words
              and the round begins.
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <GameLayout
      mode={mode}
      headerTitle={headerTitle}
      timerDeadline={deadline}
      timerLabel="Time Remaining:"
      showTimer={!!deadline && !isGameEnded}
      statusMessage={statusMessage}
      players={players}
      playerLayout="grid-cols-2"
      showPlayerSection={true}
      guesses={me?.guesses || []}
      activeGuess={activeGuessForMe}
      letterStates={letterStates}
      onKeyPress={handleKeyPress}
      keyboardDisabled={submittingGuess}
      showKeyboard={canSetSecret || canGuess}
      effects={{
        showParticles,
        showConfetti,
        showCorrectParticles,
        showStreakParticles,
        particlePosition,
        streak: me?.streak || 0,
      }}
      renderBoard={renderBoard}
      renderFooter={renderFooter}
    />
  );
}

export default DuelGameScreen;

