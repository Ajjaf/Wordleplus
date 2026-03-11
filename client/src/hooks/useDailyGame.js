import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { buildLetterStates } from "../modes/utils.js";
import { useGameContext } from "../contexts/GameContext";
import { playErrorSound } from "../utils/sounds";

const maxDailyGuessesDefault = 6;
const dailyWordLengthDefault = 5;

export function useDailyGame(screen, dailyActions, persistSession, goHome) {
  const {
    name,
    room,
    setRoom,
    setScreen,
    setMode,
    setMsg,
    setRoomId,
    setCurrentGuess,
    setShowVictory,
  } = useGameContext();
  // Daily game state
  const [dailyChallenge, setDailyChallenge] = useState(null);
  const [dailyGuesses, setDailyGuesses] = useState([]);
  const [dailyPatternResponses, setDailyPatternResponses] = useState([]);
  const [dailyCurrentGuess, setDailyCurrentGuess] = useState("");
  const [dailyStatus, setDailyStatus] = useState("");
  const [dailyGameOver, setDailyGameOver] = useState(false);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyCorrectWord, setDailyCorrectWord] = useState(null);
  const [dailyShakeKey, setDailyShakeKey] = useState(0);
  const [dailyGuessFlipKey, setDailyGuessFlipKey] = useState(0);
  const [dailyShowActiveError, setDailyShowActiveError] = useState(false);
  const [dailyNotificationMessage, setDailyNotificationMessage] = useState("");

  // Refs for timeout cleanup
  const dailyErrorTimeoutRef = useRef(null);

  const dailyWordLength = dailyChallenge?.wordLength || dailyWordLengthDefault;
  const maxDailyGuesses = dailyChallenge?.maxGuesses || maxDailyGuessesDefault;

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (dailyErrorTimeoutRef.current) {
        clearTimeout(dailyErrorTimeoutRef.current);
        dailyErrorTimeoutRef.current = null;
      }
    };
  }, []);

  const resetDailyProgress = useCallback(() => {
    setDailyChallenge(null);
    setDailyGuesses([]);
    setDailyPatternResponses([]);
    setDailyCurrentGuess("");
    setDailyStatus("");
    setDailyGameOver(false);
    setDailyLoading(false);
    setDailyCorrectWord(null);
    setDailyShakeKey(0);
    setDailyGuessFlipKey(0);
    setDailyShowActiveError(false);
    setDailyNotificationMessage("");
  }, []);

  const startDailyMode = useCallback(async () => {
    persistSession({ name, mode: "daily" });
    setMode("daily");
    setMsg("");
    goHome(null, { clearRoom: true });
    setRoom(null);
    setRoomId("");
    setCurrentGuess("");
    setShowVictory(false);
    resetDailyProgress();
    setScreen("daily");
    setDailyLoading(true);
    try {
      const response = await dailyActions.loadChallenge();
      if (response?.error) {
        setDailyStatus(response.error);
        setDailyChallenge(null);
        return;
      }
      setDailyChallenge(response);
      const responseWordLength = response?.wordLength || dailyWordLengthDefault;
      if (Array.isArray(response?.guesses)) {
        setDailyGuesses(
          response.guesses.map((g) => String(g || "").toUpperCase())
        );
      }
      if (Array.isArray(response?.patterns)) {
        setDailyPatternResponses(
          response.patterns.map((pattern = []) =>
            Array.from({ length: responseWordLength }, (_, i) => {
              const value = pattern[i];
              if (value === "green" || value === "correct") return "green";
              if (value === "yellow" || value === "present") return "yellow";
              if (value === "gray" || value === "absent") return "gray";
              return "empty";
            })
          )
        );
      }
      setDailyGuessFlipKey(0);
      if (typeof response?.currentGuess === "string") {
        setDailyCurrentGuess(response.currentGuess.toUpperCase());
      }
      if (typeof response?.status === "string") {
        setDailyStatus(response.status);
      } else {
        setDailyStatus("");
      }
      if (response?.gameOver) {
        setDailyGameOver(true);
      }
      if (response?.word) {
        setDailyCorrectWord(response.word.toUpperCase());
      }
    } catch (err) {
      setDailyStatus(err?.message || "Unable to load daily challenge");
      setDailyChallenge(null);
    } finally {
      setDailyLoading(false);
    }
  }, [dailyActions, name, persistSession, resetDailyProgress, goHome, setMode, setMsg, setRoom, setRoomId, setCurrentGuess, setShowVictory, setScreen, room]);

  const handleDailySubmit = useCallback(async () => {
    if (screen !== "daily") return;
    if (!dailyChallenge) return;
    if (dailyGameOver) return;
    if (dailyLoading) return;
    if (dailyGuesses.length >= maxDailyGuesses) {
      // Visual feedback only - no text notification
      setDailyGameOver(true);
      return;
    }
    if (dailyCurrentGuess.length !== dailyWordLength) {
      setDailyShakeKey((prev) => prev + 1);
      setDailyShowActiveError(true);
      playErrorSound();
      if (dailyErrorTimeoutRef.current) clearTimeout(dailyErrorTimeoutRef.current);
      dailyErrorTimeoutRef.current = setTimeout(() => setDailyShowActiveError(false), 250);
      return;
    }
    if (dailyGuesses.includes(dailyCurrentGuess)) {
      setDailyShakeKey((prev) => prev + 1);
      setDailyShowActiveError(true);
      playErrorSound();
      if (dailyErrorTimeoutRef.current) clearTimeout(dailyErrorTimeoutRef.current);
      dailyErrorTimeoutRef.current = setTimeout(() => setDailyShowActiveError(false), 250);
      return;
    }

    setDailyLoading(true);
    try {
      const result = await dailyActions.submitGuess(
        dailyCurrentGuess.toLowerCase()
      );
      if (result?.error) {
        setDailyShakeKey((prev) => prev + 1);
        setDailyShowActiveError(true);
        playErrorSound();
        if (dailyErrorTimeoutRef.current) clearTimeout(dailyErrorTimeoutRef.current);
        dailyErrorTimeoutRef.current = setTimeout(() => setDailyShowActiveError(false), 250);
        return;
      }

      const patternRaw = Array.isArray(result?.pattern) ? result.pattern : [];
      const normalized = Array.from({ length: dailyWordLength }, (_, idx) => {
        const value = patternRaw[idx];
        if (value === "green" || value === "correct") return "green";
        if (value === "yellow" || value === "present") return "yellow";
        if (value === "gray" || value === "absent") return "gray";
        return "empty";
      });

      const nextGuessCount = dailyGuesses.length + 1;
      const solved =
        normalized.every((state) => state === "green") ||
        Boolean(result?.correct);
      const exhausted = nextGuessCount >= maxDailyGuesses;

      setDailyGuesses((prev) => [...prev, dailyCurrentGuess]);
      setDailyPatternResponses((prev) => [...prev, normalized]);
      setDailyGuessFlipKey((prev) => prev + 1);
      setDailyCurrentGuess("");
      setDailyGameOver(
        solved || exhausted || Boolean(result?.complete || result?.gameOver)
      );

      // Store correct word if game is over
      if (result?.word) {
        setDailyCorrectWord(result.word.toUpperCase());
        // Correct word shown in results modal - no text notification needed
      }

      if (solved) {
        setShowVictory(true);
      }
    } catch (err) {
      setDailyShakeKey((prev) => prev + 1);
      setDailyShowActiveError(true);
      playErrorSound();
      if (dailyErrorTimeoutRef.current) clearTimeout(dailyErrorTimeoutRef.current);
      dailyErrorTimeoutRef.current = setTimeout(() => setDailyShowActiveError(false), 250);
    } finally {
      setDailyLoading(false);
    }
  }, [
    screen,
    dailyActions,
    dailyChallenge,
    dailyCurrentGuess,
    dailyGameOver,
    dailyGuesses,
    dailyLoading,
    dailyWordLength,
    maxDailyGuesses,
    setShowVictory,
  ]);

  const handleDailyKey = useCallback(
    (key) => {
      if (screen !== "daily") return;
      if (!dailyChallenge) return;
      if (dailyGameOver || dailyLoading) return;

      if (key === "ENTER") {
        handleDailySubmit();
      } else if (key === "BACKSPACE") {
        setDailyCurrentGuess((prev) => prev.slice(0, -1));
        setDailyNotificationMessage("");
      } else if (
        /^[A-Z]$/.test(key) &&
        dailyCurrentGuess.length < dailyWordLength
      ) {
        setDailyCurrentGuess((prev) => prev + key);
        setDailyNotificationMessage("");
      }
    },
    [
      screen,
      dailyChallenge,
      dailyGameOver,
      dailyLoading,
      dailyCurrentGuess,
      dailyWordLength,
      handleDailySubmit,
    ]
  );

  // Keyboard event handler
  useEffect(() => {
    if (screen !== "daily") return;

    const onKeyDown = (e) => {
      const key =
        e.key === "Enter"
          ? "ENTER"
          : e.key === "Backspace"
          ? "BACKSPACE"
          : /^[a-zA-Z]$/.test(e.key)
          ? e.key.toUpperCase()
          : null;
      if (!key) return;
      handleDailyKey(key);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [screen, handleDailyKey]);

  // Compute daily guess entries and letter states
  const dailyGuessEntries = useMemo(
    () =>
      dailyGuesses.map((guess, idx) => {
        const pattern = dailyPatternResponses[idx] || [];
        const padded = Array.from({ length: dailyWordLength }, (_, i) => {
          const value = pattern[i];
          if (value === "green" || value === "correct") return "green";
          if (value === "yellow" || value === "present") return "yellow";
          if (value === "gray" || value === "absent") return "gray";
          return "empty";
        });
        return { guess, pattern: padded };
      }),
    [dailyGuesses, dailyPatternResponses, dailyWordLength]
  );

  const dailyLetterStates = useMemo(
    () => buildLetterStates(dailyGuessEntries),
    [dailyGuessEntries]
  );

  const won = useMemo(
    () => dailyGuessEntries.some((g) => g.pattern?.every((s) => s === "green")),
    [dailyGuessEntries]
  );

  return {
    // State
    dailyChallenge,
    dailyGuesses: dailyGuessEntries,
    dailyCurrentGuess,
    dailyLetterStates,
    dailyStatus,
    dailyLoading,
    dailyGameOver,
    dailyCorrectWord,
    dailyShakeKey,
    dailyShowActiveError,
    dailyNotificationMessage,
    dailyGuessFlipKey,
    won,
    // Actions
    startDailyMode,
    handleDailyKey,
    handleDailySubmit,
    resetDailyProgress,
    setDailyNotificationMessage,
  };
}

