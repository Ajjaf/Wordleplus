import { validateWord } from "../../api";
import { emitAsync } from "../utils.js";
import { logger } from "../../utils/logger";

export function createActions(socket) {
  const startRound = (roomId) => emitAsync(socket, "startShared", { roomId });

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
      logger.warn("[shared makeGuess] error", response.error);
      return { error: response.error };
    }

    return response;
  };

  const playAgain = (roomId) => emitAsync(socket, "duelPlayAgain", { roomId });

  return {
    startRound,
    submitGuess,
    playAgain,
  };
}
