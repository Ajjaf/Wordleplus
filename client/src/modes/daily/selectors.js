import { buildLetterStates } from "../utils.js";

export function createSelectors({ dailyGuesses = [], dailyPatternResponses = [], dailyGameOver = false }) {
  // Transform daily guesses into the format expected by buildLetterStates
  const transformedGuesses = dailyGuesses.map((guess, index) => ({
    guess,
    pattern: dailyPatternResponses[index] || [],
  }));
  
  const letterStates = buildLetterStates(transformedGuesses);
  
  return {
    canGuessDaily: !dailyGameOver,
    letterStates,
    shouldShowVictory: dailyGameOver,
  };
}
