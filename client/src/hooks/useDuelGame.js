import { useCallback, useRef, useEffect, useState } from "react";
import { useGameContext } from "../contexts/GameContext";

export function useDuelGame(room, canGuessDuel, canGuessShared, duelActions, sharedActions) {
  const { screen, roomId, currentGuess, setCurrentGuess, setShowActiveError, setShakeKey, setMsg } = useGameContext();
  
  const gameErrorTimeoutRef = useRef(null);
  const [submittingGuess, setSubmittingGuess] = useState(false);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (gameErrorTimeoutRef.current) {
        clearTimeout(gameErrorTimeoutRef.current);
        gameErrorTimeoutRef.current = null;
      }
    };
  }, []);

  const bumpActiveRowError = useCallback(() => {
    setShowActiveError(true);
    setShakeKey((k) => k + 1);
    if (gameErrorTimeoutRef.current) {
      clearTimeout(gameErrorTimeoutRef.current);
    }
    gameErrorTimeoutRef.current = setTimeout(() => setShowActiveError(false), 300);
  }, [setShowActiveError, setShakeKey]);

  const handleSubmitDuelGuess = useCallback(async () => {
    if (!(canGuessDuel || canGuessShared)) return;
    if (currentGuess.length !== 5) {
      bumpActiveRowError();
      return;
    }
    if (submittingGuess) return; // Prevent double submission

    setSubmittingGuess(true);
    try {
      // Use appropriate function based on mode
      const v =
        room?.mode === "shared"
          ? await sharedActions.submitGuess(roomId, currentGuess, canGuessShared)
          : await duelActions.submitGuess(roomId, currentGuess, canGuessDuel);

      if (v?.error) {
        bumpActiveRowError();
        return;
      }
      setCurrentGuess("");
      setShowActiveError(false);
    } finally {
      setSubmittingGuess(false);
    }
  }, [canGuessDuel, canGuessShared, currentGuess, room?.mode, roomId, duelActions, sharedActions, bumpActiveRowError, setCurrentGuess, setShowActiveError, submittingGuess]);

  const handleDuelKey = useCallback(
    (key) => {
      if (!(canGuessDuel || canGuessShared)) return;
      if (key === "ENTER") {
        handleSubmitDuelGuess();
      } else if (key === "BACKSPACE") {
        setCurrentGuess((p) => p.slice(0, -1));
      } else if (currentGuess.length < 5 && /^[A-Z]$/.test(key)) {
        setCurrentGuess((p) => p + key);
      }
    },
    [canGuessDuel, canGuessShared, currentGuess, handleSubmitDuelGuess, setCurrentGuess]
  );

  // Keyboard event handler for game screen
  useEffect(() => {
    if (screen !== "game") return;
    if (room?.mode !== "duel" && room?.mode !== "shared") return;

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
      handleDuelKey(key);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [screen, room?.mode, handleDuelKey]);

  return {
    handleDuelKey,
    handleSubmitDuelGuess,
    submittingGuess,
  };
}

