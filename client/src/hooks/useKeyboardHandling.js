import { useEffect } from "react";

export function useKeyboardHandling({
  room,
  canGuessDuel,
  canGuessBattle,
  currentGuess,
  onDuelKey,
  onBattleKey,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key =
        e.key === "Enter"
          ? "ENTER"
          : e.key === "Backspace"
          ? "BACKSPACE"
          : /^[a-zA-Z]$/.test(e.key)
          ? e.key.toUpperCase()
          : null;

      if (!key) return;

      if (room?.mode === "duel") {
        onDuelKey(key);
      } else if (room?.mode === "battle" || room?.mode === "battle_ai") {
        onBattleKey(key);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    room?.mode,
    canGuessDuel,
    canGuessBattle,
    currentGuess,
    onDuelKey,
    onBattleKey,
  ]);

  // Keyboard handlers for different game modes
  const handleDuelKey = (
    key,
    currentGuess,
    canGuessDuel,
    onGuess,
    onBackspace
  ) => {
    if (!canGuessDuel) return;

    if (key === "ENTER") {
      onGuess();
    } else if (key === "BACKSPACE") {
      onBackspace();
    } else if (currentGuess.length < 5 && /^[A-Z]$/.test(key)) {
      // Add letter - this should be handled by the parent component
      // We return the key so parent can handle it
      return key;
    }
  };

  const handleBattleKey = (
    key,
    currentGuess,
    canGuessBattle,
    onGuess,
    onBackspace,
    onError
  ) => {
    if (!canGuessBattle) return;

    if (key === "ENTER") {
      if (currentGuess.length === 5) {
        onGuess();
      } else {
        onError();
      }
    } else if (key === "BACKSPACE") {
      onBackspace();
    } else if (currentGuess.length < 5 && /^[A-Z]$/.test(key)) {
      // Add letter - this should be handled by the parent component
      // We return the key so parent can handle it
      return key;
    }
  };

  return {
    handleDuelKey,
    handleBattleKey,
  };
}
