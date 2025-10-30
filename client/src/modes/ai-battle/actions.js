import { validateWord } from "../../api";
import { emitAsync } from "../utils.js";

export function createActions(socket) {
  const setWordAndStart = async (roomId, word) => {
    if (!word || typeof word !== "string" || word.length !== 5) {
      return { error: "Invalid word format" };
    }

    const validation = await validateWord(word);
    if (!validation.valid) return { error: "Host word must be valid" };

    const setResult = await emitAsync(socket, "setHostWord", {
      roomId,
      secret: word,
    });
    if (setResult?.error) return setResult;

    const startResult = await emitAsync(socket, "startBattle", { roomId });
    if (startResult?.error) return startResult;

    return { success: true };
  };

  const submitGuess = async (roomId, currentGuess, canGuess) => {
    if (!canGuess) return { error: "Cannot guess right now" };
    if (currentGuess.length !== 5) return { error: "Guess must be 5 letters" };

    const validation = await validateWord(currentGuess);
    if (!validation.valid) return { error: "Invalid word" };

    const response = await emitAsync(socket, "makeGuess", {
      roomId,
      guess: currentGuess,
    });

    if (response?.error) {
      console.warn("[ai-battle makeGuess] error", response.error);
      return { error: response.error };
    }

    return response;
  };

  const startRound = (roomId) => emitAsync(socket, "aiBattleStart", { roomId });
  const playAgain = (roomId) => emitAsync(socket, "playAgain", { roomId });
  const claimHost = (roomId) =>
    emitAsync(socket, "aiBattleClaimHost", { roomId });
  const releaseHost = (roomId) =>
    emitAsync(socket, "aiBattleReleaseHost", { roomId });

  return {
    setWordAndStart,
    submitGuess,
    startRound,
    playAgain,
    claimHost,
    releaseHost,
  };
}

