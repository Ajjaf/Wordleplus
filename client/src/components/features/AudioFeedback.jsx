import { useEffect, useRef } from "react";
import { useAudio } from "../../hooks/useAudio";

/**
 * AudioFeedback - Component that plays sounds for game events
 * 
 * Listens to game state changes and plays appropriate sound effects:
 * - Correct letter placement
 * - Present letter (wrong position)
 * - Absent letter
 * - Error (invalid word)
 * - Victory
 * - Defeat
 * - Typing
 * - Submit guess
 */
export function AudioFeedback({
  // Game state
  lastGuess,
  lastPattern,
  hasError = false,
  isVictory = false,
  isDefeat = false,
  isTyping = false,
  onGuessSubmit = false,
  
  // Configuration
  enabled = true,
}) {
  const { playSound, enabled: audioEnabled } = useAudio();
  const prevGuessRef = useRef(null);
  const prevPatternRef = useRef(null);

  // Only play sounds if audio is enabled
  const shouldPlay = enabled && audioEnabled;

  // Play sound for guess pattern (correct, present, absent)
  useEffect(() => {
    if (!shouldPlay || !lastPattern || !lastGuess) return;
    
    // Only play if this is a new guess
    if (lastGuess === prevGuessRef.current && lastPattern === prevPatternRef.current) {
      return;
    }

    prevGuessRef.current = lastGuess;
    prevPatternRef.current = lastPattern;

    // Play sounds for each letter in the pattern
    // Use a slight delay between each sound for better UX
    lastPattern.forEach((state, index) => {
      setTimeout(() => {
        if (state === "correct" || state === "green") {
          playSound("correct", { volume: 0.6 });
        } else if (state === "present" || state === "yellow") {
          playSound("present", { volume: 0.5 });
        } else if (state === "absent" || state === "gray" || state === "grey") {
          playSound("absent", { volume: 0.4 });
        }
      }, index * 50); // 50ms delay between each letter sound
    });
  }, [lastGuess, lastPattern, shouldPlay, playSound]);

  // Play error sound
  useEffect(() => {
    if (!shouldPlay || !hasError) return;
    playSound("error", { volume: 0.6 });
  }, [hasError, shouldPlay, playSound]);

  // Play victory sound
  useEffect(() => {
    if (!shouldPlay || !isVictory) return;
    playSound("victory", { volume: 0.8 });
  }, [isVictory, shouldPlay, playSound]);

  // Play defeat sound
  useEffect(() => {
    if (!shouldPlay || !isDefeat) return;
    playSound("defeat", { volume: 0.6 });
  }, [isDefeat, shouldPlay, playSound]);

  // Play typing sound (optional - can be annoying, so lower volume)
  useEffect(() => {
    if (!shouldPlay || !isTyping) return;
    // Only play typing sound occasionally to avoid annoyance
    const shouldPlayTyping = Math.random() < 0.1; // 10% chance
    if (shouldPlayTyping) {
      playSound("typing", { volume: 0.2 });
    }
  }, [isTyping, shouldPlay, playSound]);

  // Play submit sound
  useEffect(() => {
    if (!shouldPlay || !onGuessSubmit) return;
    playSound("submit", { volume: 0.5 });
  }, [onGuessSubmit, shouldPlay, playSound]);

  return null; // This component doesn't render anything
}

export default AudioFeedback;

