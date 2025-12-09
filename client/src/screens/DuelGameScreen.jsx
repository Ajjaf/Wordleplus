import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getRandomWord } from "../api";
import { useIsMobile } from "../hooks/useIsMobile";
import { useSwipeGestures } from "../hooks/useSwipeGestures";
import GradientBackground from "../components/ui/GradientBackground";
import { UnifiedPlayerCard } from "../components/player/UnifiedPlayerCard";
import { GameEffects } from "../components/features/GameEffects";
import { GameTimer } from "../components/features/GameTimer";
import Board from "../components/Board.jsx";
import Keyboard from "../components/Keyboard";
import GlowButton from "../components/ui/GlowButton";
import { SmartHint } from "../components/ui/SmartHint";
import { IconStatusBadge } from "../components/ui/IconStatusBadge";
import MicroProgressGrid from "../components/mobile/MicroProgressGrid";
import { getModeTheme } from "../config/mode-themes";
import { cn } from "../lib/utils";
import { GameLayout } from "../components/layout/GameLayout";

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

  // Mobile UX - which board to show
  const [mobileView, setMobileView] = useState("me");
  
  // Swipe gestures for mobile with right-edge detection
  const swipeHandlers = useSwipeGestures(
    () => setMobileView("opponent"), // Swipe left from right edge to see opponent
    () => setMobileView("me"), // Swipe right to see own board
    null,
    null,
    {
      requireRightEdge: true, // Only trigger left swipe from right edge
      edgeThreshold: 50, // 50px from right edge
      minSwipeDistance: 50,
    }
  );

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
      min: isMobile ? 44 : 56,
      max: isMobile ? 80 : 112,
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

  // Opponent's active guess (if any)
  const opponentActiveGuess = opponent?.currentGuess || "";
  const opponentGuesses = opponent?.guesses || [];
  
  // Prepare players array for UnifiedPlayerCard
  const myPlayerData = {
    id: me?.id,
    name: me?.name || "You",
    wins: me?.wins,
    streak: me?.streak,
    avatar: myAvatarInitial,
    host: room?.hostId === me?.id,
    isTyping: canSetSecret && !!secretWordInput,
    hasSecret: myReady,
    disconnected: !!me?.disconnected,
    highlight: isGameEnded && room?.winner === me?.id ? "winner" : mobileView === "me" ? "active" : "none",
    size: isMobile ? "sm" : "md",
    active: mobileView === "me",
    guesses: me?.guesses || [],
    maxGuesses: 6,
    variant: isMobile ? "compact" : "detailed",
    onSelect: isMobile ? () => setMobileView("me") : undefined,
  };
  
  const opponentPlayerData = {
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
      isGameEnded && room?.winner === opponent?.id ? "winner" : mobileView === "opponent" ? "active" : "none",
    size: isMobile ? "sm" : "md",
    active: mobileView === "opponent",
    guesses: opponentGuesses,
    maxGuesses: 6,
    variant: isMobile ? "compact" : "detailed",
    onSelect: isMobile ? () => setMobileView("opponent") : undefined,
    // Add micro progress grid for mobile
    showMicroGrid: isMobile,
  };

  // Header title
  const headerTitle = isGameEnded
    ? bothRequestedRematch
      ? "Rematch starting..."
      : "Game ended - ready for rematch?"
    : null;

  // Status message - using visual indicators instead of text
  const statusMessage = isGameEnded
    ? bothRequestedRematch
      ? null // Both ready - no status needed, rematch will start
      : null // Visual indicators in footer handle status
    : null;

  // Rematch status for footer (visual indicator)
  const rematchStatus = isGameEnded
    ? bothRequestedRematch
      ? null // Both ready - rematch starting
      : opponentRequestedRematch
      ? "Opponent ready" // Opponent has requested
      : hasRequestedRematch
      ? "Waiting for opponent" // You requested, waiting
      : null // No requests yet
    : null;

  // Footer content (rematch button) - returns content only, not footer wrapper
  const renderFooter = () => {
    if (isGameEnded) {
      return (
        <div className={cn(
          "text-center",
          isMobile ? "pb-4" : "mb-2"
        )}>
          <GlowButton
            onClick={handleRematch}
            disabled={hasRequestedRematch}
            size="lg"
            variant={hasRequestedRematch ? "secondary" : "primary"}
            className={cn(
              isMobile && "w-full max-w-sm mx-auto"
            )}
          >
            {hasRequestedRematch
              ? "✅ Rematch Requested"
              : "🚀 Request Rematch"}
          </GlowButton>
          {rematchStatus && (
            <div className="flex items-center justify-center gap-2 mt-2">
              {opponentRequestedRematch ? (
                <IconStatusBadge type="ready" size="sm" animated={true} />
              ) : hasRequestedRematch ? (
                <IconStatusBadge type="waitingForPlayer" size="sm" animated={true} />
              ) : null}
              <p className="text-xs text-white/60">{rematchStatus}</p>
            </div>
          )}
        </div>
      );
    }
    if (!canSetSecret && !canGuess) {
      return (
        <div className="text-center py-4 flex flex-col items-center gap-2">
          {!myReady ? (
            <div className="flex items-center gap-2">
              <IconStatusBadge type="ready" size="md" animated={true} />
              <span className="text-sm text-white/60">Set your secret word</span>
            </div>
          ) : !oppReady ? (
            <div className="flex items-center gap-2">
              <IconStatusBadge type="waitingForPlayer" size="md" animated={true} />
              <span className="text-sm text-white/60">Waiting for opponent</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <IconStatusBadge type="ready" size="md" animated={true} />
              <span className="text-sm text-white/60">Starting...</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  // Custom board section with secret word entry
  const renderBoard = () => {
    // Desktop: Show both boards side by side
    if (!isMobile && showBoardArea) {
      return (
        <div className="flex flex-col items-center flex-1 min-h-0 gap-4 w-full">
          {/* Secret Word Entry Section - only for player */}
          {showSecretEntry && (
            <div className="flex flex-col items-center gap-2 flex-shrink-0 w-full">
              <div className="text-[10px] uppercase tracking-[0.35em] text-white/50 text-center">
                Choose your secret word
              </div>

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
                <div className="flex relative" style={{ gap: secretGap }}>
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

                    const isReadyToSubmit = canSetSecret && secretWordInput.length === 5 && !isEmpty;
                    
                    if (mySecretState === "set" && !isEmpty) {
                      bg = "#e3f2fd";
                      color = "#1976d2";
                      border = "1px solid #1976d2";
                    } else if (isReadyToSubmit) {
                      bg = "var(--tile-typed-bg)";
                      border = "2px solid #10b981";
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
                            isReadyToSubmit
                              ? "0 0 12px rgba(16, 185, 129, 0.6), 0 4px 12px rgba(16, 185, 129, 0.3)"
                              : mySecretState === "set" && !isEmpty
                              ? "0 4px 12px rgba(25, 118, 210, 0.3)"
                              : mySecretState === "typing" && isEmpty
                              ? "0 2px 8px rgba(0, 0, 0, 0.2)"
                              : "0 1px 3px rgba(0, 0, 0, 0.1)",
                          animation:
                            isReadyToSubmit
                              ? "pulse 2s ease-in-out infinite"
                              : mySecretState === "typing" && isEmpty
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

                {canSetSecret && secretWordInput.length === 5 && (
                  <SmartHint
                    show={true}
                    message="Press Enter"
                    position="below"
                    autoHide={4000}
                    storageKey="duel_secret_word_hint_seen"
                  />
                )}

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

          {/* Desktop: Side-by-side boards */}
          <div className="flex flex-1 min-h-0 gap-4 w-full max-w-7xl">
            {/* Player Board */}
            <div className="flex-1 flex flex-col items-center min-h-0 gap-2">
              <div className="text-base font-semibold text-white text-center flex-shrink-0">
                {me?.name || "You"}
              </div>
              <div className="w-full flex-1 flex justify-center items-start min-h-0">
                <div className="w-full h-full">
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
                    gap={10}
                    minTile={boardTileBounds.min}
                    maxTile={boardTileBounds.max}
                    verticalAlign="start"
                    horizontalAlign="center"
                  />
                </div>
              </div>
            </div>

            {/* Opponent Board */}
            <div className="flex-1 flex flex-col items-center min-h-0 gap-2">
              <div className="text-base font-semibold text-white text-center flex-shrink-0">
                {opponent?.name || "Opponent"}
              </div>
              <div className="w-full flex-1 flex justify-center items-start min-h-0">
                <div className="w-full h-full">
                  <Board
                    guesses={opponentGuesses}
                    activeGuess={opponentActiveGuess}
                    errorShakeKey={0}
                    errorActiveRow={false}
                    secretWord={null}
                    isOwnBoard={false}
                    autoFit={true}
                    showGuessesLabel={false}
                    secretWordReveal={false}
                    guessFlipKey={0}
                    padding={boardPadding}
                    gap={10}
                    minTile={boardTileBounds.min}
                    maxTile={boardTileBounds.max}
                    verticalAlign="start"
                    horizontalAlign="center"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Mobile: Single board view with switching
    return (
      <div className="flex flex-col items-center flex-1 min-h-0 gap-4">
        {/* Secret Word Entry Section */}
        {showSecretEntry && (
          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            <div className="text-[10px] uppercase tracking-[0.35em] text-white/50 text-center">
              Choose your secret word
            </div>

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
              <div className="flex relative" style={{ gap: secretGap }}>
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

                  const isReadyToSubmit = canSetSecret && secretWordInput.length === 5 && !isEmpty;
                  
                  if (mySecretState === "set" && !isEmpty) {
                    bg = "#e3f2fd";
                    color = "#1976d2";
                    border = "1px solid #1976d2";
                  } else if (isReadyToSubmit) {
                    bg = "var(--tile-typed-bg)";
                    border = "2px solid #10b981";
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
                          isReadyToSubmit
                            ? "0 0 12px rgba(16, 185, 129, 0.6), 0 4px 12px rgba(16, 185, 129, 0.3)"
                            : mySecretState === "set" && !isEmpty
                            ? "0 4px 12px rgba(25, 118, 210, 0.3)"
                            : mySecretState === "typing" && isEmpty
                            ? "0 2px 8px rgba(0, 0, 0, 0.2)"
                            : "0 1px 3px rgba(0, 0, 0, 0.1)",
                        animation:
                          isReadyToSubmit
                            ? "pulse 2s ease-in-out infinite"
                            : mySecretState === "typing" && isEmpty
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

              {canSetSecret && secretWordInput.length === 5 && (
                <SmartHint
                  show={true}
                  message="Press Enter"
                  position="below"
                  autoHide={4000}
                  storageKey="duel_secret_word_hint_seen"
                />
              )}

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

        {/* Mobile: Single board view with switching */}
        {showBoardArea ? (
          <div className="flex flex-col items-center flex-1 min-h-0 gap-2 w-full">
            <div className="text-[10px] uppercase tracking-[0.35em] text-white/50 text-center flex-shrink-0">
              Guesses
            </div>

            <div 
              className="w-full flex-1 flex justify-center items-start min-h-0 relative"
              {...(isMobile ? swipeHandlers : {})}
            >
              <AnimatePresence mode="wait">
                {mobileView === "me" ? (
                  <motion.div
                    key="player-board"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                    className={`w-full h-full mx-auto max-w-[20rem] absolute inset-0`}
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
                      gap={6}
                      minTile={boardTileBounds.min}
                      maxTile={boardTileBounds.max}
                      verticalAlign="start"
                      horizontalAlign="center"
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="opponent-board"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className={`w-full h-full mx-auto max-w-[20rem] absolute inset-0`}
                  >
                    <Board
                      guesses={opponentGuesses}
                      activeGuess={opponentActiveGuess}
                      errorShakeKey={0}
                      errorActiveRow={false}
                      secretWord={null}
                      isOwnBoard={false}
                      autoFit={true}
                      showGuessesLabel={false}
                      secretWordReveal={false}
                      guessFlipKey={0}
                      padding={boardPadding}
                      gap={6}
                      minTile={boardTileBounds.min}
                      maxTile={boardTileBounds.max}
                      verticalAlign="start"
                      horizontalAlign="center"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
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

  // Custom player section rendering for duel mode
  const renderPlayerSection = () => {
    if (isMobile) {
      // Mobile: Minimalized cards with micro grid in opponent card
      return (
        <section className="flex-shrink-0 px-2 py-2">
          <div className="flex gap-2 justify-center items-stretch">
            <UnifiedPlayerCard
              {...myPlayerData}
              variant="compact"
              size="sm"
              isMobile={true}
              onSelect={() => setMobileView("me")}
              guesses={me?.guesses || []}
            />
            <UnifiedPlayerCard
              {...opponentPlayerData}
              variant="compact"
              size="sm"
              isMobile={true}
              onSelect={() => setMobileView("opponent")}
              showMicroGrid={true}
              guesses={opponentGuesses}
            />
          </div>
        </section>
      );
    } else {
      // Desktop: Side-by-side cards
      return (
        <section className="flex-shrink-0">
          <div className="grid grid-cols-2 gap-3">
            <UnifiedPlayerCard
              {...myPlayerData}
              variant="detailed"
              size="md"
            />
            <UnifiedPlayerCard
              {...opponentPlayerData}
              variant="detailed"
              size="md"
            />
          </div>
        </section>
      );
    }
  };

  return (
    <GameLayout
      mode={mode}
      headerTitle={headerTitle}
      timerDeadline={deadline}
      timerLabel="Time Remaining:"
      showTimer={!!deadline && !isGameEnded}
      statusMessage={statusMessage}
      players={[]}
      playerLayout="grid-cols-2"
      showPlayerSection={true}
      guesses={me?.guesses || []}
      activeGuess={activeGuessForMe}
      letterStates={letterStates}
      onKeyPress={handleKeyPress}
      keyboardDisabled={submittingGuess || isGameEnded}
      showKeyboard={!isGameEnded && (isMobile ? mobileView === "me" : true)}
      effects={{
        showParticles,
        showConfetti,
        showCorrectParticles,
        showStreakParticles,
        particlePosition,
        streak: me?.streak || 0,
      }}
      renderPlayerSection={renderPlayerSection}
      renderBoard={renderBoard}
      renderFooter={renderFooter}
    />
  );
}

export default DuelGameScreen;

