import React from "react";
import ParticleEffect from "../ParticleEffect";
import ConfettiEffect from "../ConfettiEffect";

/**
 * GameEffects - Unified wrapper for particle and confetti effects
 * 
 * Consolidates particle and confetti effects that were scattered across different game screens
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
  
  // Feature flags (can be controlled by mode theme)
  enableParticles = true,
  enableConfetti = true,
}) {
  if (!enableParticles && !enableConfetti) return null;
  
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
    </>
  );
}

export default GameEffects;

