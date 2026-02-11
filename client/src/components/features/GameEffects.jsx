import React from "react";
import ParticleEffect from "../ParticleEffect";
import ConfettiEffect from "../ConfettiEffect";
import AudioFeedback from "./AudioFeedback";

/**
 * GameEffects - Unified wrapper for particle, confetti, and audio effects
 * 
 * Consolidates all game effects that were scattered across different game screens
 */
export function GameEffects({
  // Particle effects
  showParticles = false,
  showCorrectParticles = false,
  showStreakParticles = false,
  showVictoryParticles = false,
  particlePosition = { x: 0, y: 0 },
  particleIntensity = 1.0,
  streak = 0,
  
  // Confetti effects
  showConfetti = false,
  
  // Audio effects
  lastGuess = null,
  lastPattern = null,
  hasError = false,
  isVictory = false,
  isDefeat = false,
  isTyping = false,
  onGuessSubmit = false,
  
  // Feature flags (can be controlled by mode theme)
  enableParticles = true,
  enableConfetti = true,
  enableAudio = true,
}) {
  return (
    <>
      {enableParticles && (
        <>
          <ParticleEffect
            trigger={showParticles}
            type="wordComplete"
            position={particlePosition}
            intensity={particleIntensity}
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
            intensity={
              streak >= 10 ? 2.5 : streak >= 5 ? 2.0 : 1.5
            }
          />
          <ParticleEffect
            trigger={showVictoryParticles}
            type="victory"
            position={particlePosition}
            intensity={2.0}
          />
        </>
      )}
      {enableConfetti && (
        <ConfettiEffect trigger={showConfetti} />
      )}
      {enableAudio && (
        <AudioFeedback
          lastGuess={lastGuess}
          lastPattern={lastPattern}
          hasError={hasError}
          isVictory={isVictory}
          isDefeat={isDefeat}
          isTyping={isTyping}
          onGuessSubmit={onGuessSubmit}
          enabled={enableAudio}
        />
      )}
    </>
  );
}

export default GameEffects;
