import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import Board from "../components/Board.jsx";
import Keyboard from "../components/Keyboard.jsx";
import { DuelPlayerCard } from "../components/DuelPlayerCard.jsx";
import ParticleEffect from "../components/ParticleEffect.jsx";
import ConfettiEffect from "../components/ConfettiEffect.jsx";
import { getRandomWord } from "../api";
import { useRef } from "react";
import { motion } from "framer-motion";
import GradientBackground from "../components/ui/GradientBackground";
import GlowButton from "../components/ui/GlowButton";
import MobilePlayerProgressCard from "../components/mobile/MobilePlayerProgressCard.jsx";
import { COLORS, GRADIENTS, SHADOWS } from "../design-system";
import { useIsMobile } from "../hooks/useIsMobile";

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
}) {
  // Local input for MY secret only (we never edit opponent secret locally)
  const [secretWordInput, setSecretWordInput] = useState("");
  const [secretLocked, setSecretLocked] = useState(false); // lock immediately on submit
  const [mySubmittedSecret, setMySubmittedSecret] = useState(""); // for reveal

  // Small delights
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
  const isMobile = useIsMobile();

  // Generate random word
  const [genBusy, setGenBusy] = useState(false);
  const [boardMetrics, setBoardMetrics] = useState(null);

  // Derived flags
  const isGameStarted = !!room?.started;
  const isGameEnded = !!(room?.winner || room?.duelReveal);
  const hasRequestedRematch = !!me?.rematchRequested;
  const opponentRequestedRematch = !!opponent?.rematchRequested;
  const bothRequestedRematch = hasRequestedRematch && opponentRequestedRematch;
  const canGuess = isGameStarted && !isGameEnded;
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
  // Ready should be server-driven
  const myReady = !!me?.ready;
  const oppReady = !!opponent?.ready;
  const bothReady = myReady && oppReady;
  const canSetSecret = !myReady && !isGameEnded;
  const freshRound = !isGameStarted && !isGameEnded && !myReady && !oppReady;
  const rematchStatus = bothRequestedRematch
    ? "\u{1F680} Both players ready! Starting rematch..."
    : "\u{23F3} Waiting for opponent...";
  const secretTileSize = boardMetrics?.tile ?? 48;
  const secretGap = boardMetrics?.gap ?? 8;
  const secretRowWidth = secretTileSize * 5 + secretGap * 4;
  const diceSize = Math.max(36, Math.min(48, secretTileSize));
  const secretFontSize = Math.max(18, secretTileSize * 0.55);
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

  const [secretErrorActive, setSecretErrorActive] = useState(false);
  const [secretErrorKey, setSecretErrorKey] = useState(0);
  //timer
  const deadline = room?.duelDeadline ?? null;
  const { remaining, label: timerLabel, pct } = useCountdown(deadline);
  const low = remaining <= 10_000; // <= 10s
  const warn = remaining <= 20_000; // <= 20s

  // Clear all local secret-related state at the start of a fresh round
  useEffect(() => {
    if (freshRound) {
      setSecretWordInput("");
      setSecretLocked(false);
      setMySubmittedSecret("");
    }
  }, [freshRound]);
  // normalize to exactly 5 uppercase letters (pad if needed)
  const clamp5 = (w) =>
    (w || "").toString().toUpperCase().slice(0, 5).padEnd(5, " ");

  // What to show for ME
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

  // Trigger secret word reveal animation when game ends
  useEffect(() => {
    if (isGameEnded && revealNow) {
      // Small delay to let the game end state settle
      const timer = setTimeout(() => {
        setShowSecretReveal(true);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setShowSecretReveal(false);
    }
  }, [isGameEnded, revealNow]);

  // Trigger guess flip animation when a new guess is added
  useEffect(() => {
    if (me?.guesses && me.guesses.length > 0) {
      // Small delay to let the guess state update
      const timer = setTimeout(() => {
        setGuessFlipKey((prev) => prev + 1);
      }, 100);
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
          // Position particles at the center of my board
          setParticlePosition({
            x: window.innerWidth / 4, // Left side for my board
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
          x: window.innerWidth / 4, // Left side for my board
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

  // Fun particle when both secrets are set and game not yet started
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
    const res = await onSubmitSecret(word); // { ok } or { error }
    if (res?.ok) {
      setSecretLocked(true); // prevent local edits
      setMySubmittedSecret(word.toUpperCase()); // local copy for reveal
    } else {
      bumpSecretError();
      // optional: show a small inline error or shake your "Secret Word" label
      // e.g. set a local error message or bump a "shake" state
    }
  };

  async function handleGenerateSecret() {
    if (!canSetSecret || genBusy) return;
    try {
      setGenBusy(true);
      const w = await getRandomWord();
      if (w && w.length === 5) {
        setSecretWordInput(w); // fill the tiles
        // NOTE: still requires Enter to lock in (per your flow)
      }
    } catch (e) {
      // Error occurred
    } finally {
      setGenBusy(false);
    }
  }

  // On-screen keyboard while setting MY secret
  const handleSecretKeyPress = (key) => {
    if (!canSetSecret) return;
    if (key === "ENTER") {
      if (secretWordInput.length === 5) handleSecretSubmit(secretWordInput);
    } else if (key === "BACKSPACE") {
      setSecretWordInput((prev) => prev.slice(0, -1));
    } else if (/^[A-Z]$/.test(key)) {
      // cap at 5; do NOT auto-submit
      setSecretWordInput((prev) => (prev.length < 5 ? prev + key : prev));
    }
  };

  const handleRematch = () => {
    onRematch();
    setMySubmittedSecret("");
  };

  // Physical keyboard routing
  useEffect(() => {
    const handler = (event) => {
      // Always stop so App-level listeners don't double-handle
      event.stopPropagation();

      // If I'm setting my secret, edit local input only
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
        // Ignore other keys while setting secret
        event.preventDefault();
        return;
      }

      // If BOTH secrets are set (mine locally locked or server-provided, AND opponent's server-provided),
      // route physical keys to game input
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

      // Otherwise block typing
      event.preventDefault();
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [canSetSecret, secretWordInput, isGameEnded, onKeyPress, canGuess]);

  // On-screen keyboard router
  const handleKeyPress = (key) => {
    if (canSetSecret) {
      handleSecretKeyPress(key);
      return;
    }
    if (canGuess) {
      onKeyPress(key);
    }
  };

  //functions
  function bumpSecretError() {
    setSecretErrorActive(true);
    setSecretErrorKey((k) => k + 1);
    setTimeout(() => setSecretErrorActive(false), 300);
  }

  // Simple countdown from a deadline (ms since epoch).
  function useCountdown(deadline) {
    const [remaining, setRemaining] = useState(() =>
      deadline ? Math.max(0, deadline - Date.now()) : 0
    );

    // Capture the initial total so we can draw a progress bar %
    const [initialTotal, setInitialTotal] = useState(null);
    useEffect(() => {
      if (!deadline) {
        setRemaining(0);
        setInitialTotal(null);
        return;
      }
      const first = Math.max(0, deadline - Date.now());
      setRemaining(first);
      // keep the first seen total for this round
      setInitialTotal((t) => (t == null ? first : t));

      const id = setInterval(() => {
        setRemaining(Math.max(0, deadline - Date.now()));
      }, 250);
      return () => clearInterval(id);
    }, [deadline]);

    const secs = Math.ceil(remaining / 1000);
    const mm = String(Math.floor(secs / 60)).padStart(2, "0");
    const ss = String(secs % 60).padStart(2, "0");
    const label = `${mm}:${ss}`;

    const pct =
      initialTotal && initialTotal > 0
        ? Math.max(0, Math.min(100, (remaining / initialTotal) * 100))
        : null;

    return { remaining, label, pct };
  }

  // What to show in the secret row for ME
  // While setting, show what you're typing; after submit, mask it.
  const mySecretWord = canSetSecret
    ? secretWordInput.padEnd(5, " ")
    : revealNow
    ? revealMine // <- reveal after game ends
    : "?????";
  const mySecretState = canSetSecret
    ? secretWordInput.length
      ? "typing"
      : "empty"
    : "set";
  // Opponent secret row (always masked once present)
  const oppSecretWord = revealNow
    ? revealOpp.trim()
      ? revealOpp
      : "?????"
    : oppReady || isGameStarted
    ? "?????"
    : "";
  const oppSecretState = revealNow
    ? "set"
    : oppReady || isGameStarted
    ? "set"
    : "empty";
  return (
    <GradientBackground fullHeight className="flex h-full">
      <div className="flex flex-1 flex-col w-full min-h-0 relative overflow-hidden">
        <ParticleEffect
          trigger={showParticles}
          type="wordComplete"
          position={particlePosition}
        />
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
        <ConfettiEffect trigger={showConfetti} />

        {/* Game Status */}
        <div className="px-3 pt-3 pb-2">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex-1 text-center">
              <h2 className="text-base md:text-lg font-semibold text-white">
                {isGameEnded ? (
                  bothRequestedRematch ? (
                    "Rematch starting..."
                  ) : (
                    "Game ended - ready for rematch?"
                  )
                ) : deadline ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="text-white/70">Time Remaining:</span>
                    <span
                      className={`font-mono px-3 py-1 rounded-xl ${
                        low
                          ? "bg-red-500/20 text-red-300 border border-red-500/30"
                          : warn
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      }`}
                    >
                      {timerLabel}
                    </span>
                  </span>
                ) : null}
              </h2>
            </div>
          </div>

          {/* Modern gradient progress bar when round is live */}
          {!isGameEnded && deadline && (
            <div className="mx-auto mt-2 w-full max-w-xl h-2 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${
                  low
                    ? "bg-gradient-to-r from-red-500 to-red-600"
                    : warn
                    ? "bg-gradient-to-r from-amber-500 to-amber-600"
                    : "bg-gradient-to-r from-emerald-500 to-cyan-500"
                }`}
                style={{ width: `${pct ?? 100}%` }}
                initial={{ width: "100%" }}
                animate={{ width: `${pct ?? 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          )}

          {isGameEnded && (
            <div className="text-center mt-3">
              <div className="text-sm text-white/80">
                {bothRequestedRematch
                  ? "\u{1F680} Both players ready! Starting rematch..."
                  : hasRequestedRematch
                  ? "\u{1F525} Opponent requested rematch"
                  : "\u{23F3} Waiting for opponent"}
              </div>
            </div>
          )}
        </div>

        {/* Main */}
        <main className="flex-1 px-3 md:px-4 pt-2 pb-3 min-h-0 flex flex-col">
          <div className="w-full max-w-4xl mx-auto flex flex-col gap-4 flex-1 min-h-0">
            {/* Player Cards Row */}
            {isMobile ? (
              <div className="-mx-1 flex gap-3 overflow-x-auto px-1">
                <MobilePlayerProgressCard
                  name={me?.name || "You"}
                  wins={me?.wins || 0}
                  streak={me?.streak || 0}
                  guesses={me?.guesses || []}
                  maxGuesses={6}
                  isActive={mobileView === "me"}
                  onSelect={() => setMobileView("me")}
                />
                <MobilePlayerProgressCard
                  name={opponent?.name || "Opponent"}
                  wins={opponent?.wins || 0}
                  streak={opponent?.streak || 0}
                  guesses={opponent?.guesses || []}
                  maxGuesses={6}
                  isActive={mobileView === "opponent"}
                  onSelect={() => setMobileView("opponent")}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <DuelPlayerCard
                  name={me?.name || "You"}
                  wins={me?.wins}
                  streak={me?.streak}
                  avatar="\u{1F642}"
                  host={room?.hostId === me?.id}
                  isTyping={canSetSecret && !!secretWordInput}
                  hasSecret={myReady}
                  disconnected={!!me?.disconnected}
                  highlight={
                    isGameEnded && room?.winner === me?.id ? "winner" : "none"
                  }
                  size="sm"
                  active={true}
                />

                <DuelPlayerCard
                  name={opponent?.name || "?"}
                  wins={opponent?.wins}
                  streak={opponent?.streak}
                  avatar="\u{1F916}"
                  host={room?.hostId === opponent?.id}
                  isTyping={false}
                  hasSecret={oppReady || isGameStarted}
                  disconnected={!!opponent?.disconnected}
                  highlight={
                    isGameEnded && room?.winner === opponent?.id
                      ? "winner"
                      : "none"
                  }
                  size="sm"
                />
              </div>
            )}

            {/* Secret Word Entry Section */}
            <div className="flex flex-col items-center gap-2">
              <div className="text-[10px] uppercase tracking-[0.35em] text-white/50 text-center">
                Choose your secret word
              </div>

              {canSetSecret && secretWordInput.length === 5 && (
                <div className="text-center text-xs text-white/70">
                  Press <span className="font-semibold text-white">Enter</span>{" "}
                  to lock your word
                </div>
              )}

              <div
                className="relative flex justify-center"
                style={{
                  width: secretRowWidth + (canSetSecret ? diceSize + secretGap : 0),
                  minHeight: secretTileSize,
                  paddingRight: canSetSecret ? diceSize + secretGap : 0,
                }}
              >
                {/* Secret Word Tiles */}
                <div
                  className="flex"
                  style={{
                    gap: secretGap,
                  }}
                >
                  {Array.from({ length: 5 }).map((_, i) => {
                    const typingLen = secretWordInput.length;
                    const show =
                      mySecretState === "typing"
                        ? secretWordInput.padEnd(5, " ")
                        : mySecretWord || "";
                    const letter = show[i] || "";
                    const isEmpty = letter === "" || letter === " ";
                    const isActive =
                      mySecretState === "typing" && isEmpty && i === typingLen;

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
                      transform: "translateY(-50%)",
                      width: diceSize,
                      height: diceSize,
                      fontSize: Math.round(diceSize * 0.45),
                    }}
                  >
                    {genBusy ? "\u2026" : "\u{1F3B2}"}
                  </motion.button>
                )}
              </div>
            </div>
            {/* Guesses Board Section */}
            <div className="flex flex-col items-center gap-2 flex-1 min-h-0">
              <div className="text-[10px] uppercase tracking-[0.35em] text-white/50 text-center flex-shrink-0">
                Guesses
              </div>

              <div className="w-full flex-1 flex justify-center min-h-0">
                <div className="w-full max-w-md h-full">
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
                  />
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="w-full px-2 sm:px-4 py-2 flex-shrink-0">
          <div className="mx-auto w-full max-w-5xl">
            {isGameEnded ? (
              <div className="text-center">
                <GlowButton
                  onClick={handleRematch}
                  disabled={hasRequestedRematch}
                  size="lg"
                  variant={hasRequestedRematch ? "secondary" : "primary"}
                >
                  {hasRequestedRematch
                    ? "\u2705 Rematch Requested"
                    : "\u{1F680} Request Rematch"}
                </GlowButton>
                <p className="text-sm text-white/60 mt-2">{rematchStatus}</p>
              </div>
            ) : !canSetSecret && !canGuess ? (
              <div className="text-center py-4">
                <p className="text-lg font-medium text-white/80">
                  {!myReady
                    ? "Set your secret word to continue..."
                    : !oppReady
                    ? "Waiting for opponent to set their secret word..."
                    : "Both players ready! Starting..."}
                </p>
              </div>
            ) : null}
          </div>
        </footer>

        {/* Keyboard - Now in its own grid row */}
        {(canSetSecret || canGuess) && (
          <div className="w-full px-2 sm:px-4 pb-2 flex-shrink-0">
            <div className="mx-auto w-full max-w-5xl">
              <Keyboard
                onKeyPress={handleKeyPress}
                letterStates={letterStates}
              />
            </div>
          </div>
        )}
      </div>
    </GradientBackground>
  );
}

export default DuelGameScreen;
