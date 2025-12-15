import { useCallback, useRef, useEffect, useState } from "react";
import { useGameContext } from "../contexts/GameContext";

export function useBattleGame(room, canGuessBattle, isHost, wasHost, battleActions, aiBattleActions) {
  const { screen, roomId, currentGuess, setCurrentGuess, setShowActiveError, setShakeKey } = useGameContext();
  
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

  const handleBattleKey = useCallback(
    async (key) => {
      if (!canGuessBattle) return;
      if (key === "ENTER") {
        if (currentGuess.length === 5) {
          if (submittingGuess) return; // Prevent double submission
          setSubmittingGuess(true);
          try {
            const actions =
              room?.mode === "battle_ai" ? aiBattleActions : battleActions;
            const result = await actions?.submitGuess?.(
              roomId,
              currentGuess,
              canGuessBattle
            );
            if (result?.error) {
              bumpActiveRowError();
              return;
            }
            setCurrentGuess("");
            setShowActiveError(false);
          } finally {
            setSubmittingGuess(false);
          }
        } else {
          setShowActiveError(true);
          setShakeKey((k) => k + 1);
        }
      } else if (key === "BACKSPACE") {
        setCurrentGuess((p) => p.slice(0, -1));
      } else if (currentGuess.length < 5 && /^[A-Z]$/.test(key)) {
        setCurrentGuess((p) => p + key);
      }
    },
    [canGuessBattle, currentGuess, room?.mode, roomId, battleActions, aiBattleActions, bumpActiveRowError, setCurrentGuess, setShowActiveError, setShakeKey, submittingGuess]
  );

  // Keyboard event handler for game screen
  useEffect(() => {
    if (screen !== "game") return;
    if (room?.mode !== "battle" && room?.mode !== "battle_ai") return;

    const onKeyDown = (e) => {
      // If I'm the host in Battle and the round hasn't started yet,
      // we're on the "type secret" screen — don't handle keys globally.
      const hostTyping =
        room?.mode === "battle" ||
        (room?.mode === "battle_ai" &&
          (isHost || wasHost) &&
          !room?.battle?.started);
      if (hostTyping) return;

      const key =
        e.key === "Enter"
          ? "ENTER"
          : e.key === "Backspace"
          ? "BACKSPACE"
          : /^[a-zA-Z]$/.test(e.key)
          ? e.key.toUpperCase()
          : null;
      if (!key) return;
      handleBattleKey(key);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [screen, room?.mode, room?.battle?.started, isHost, wasHost, handleBattleKey]);

  return {
    handleBattleKey,
    submittingGuess,
  };
}

