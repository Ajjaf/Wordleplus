import React, { useEffect, useState } from "react";

export default function ParticleEffect({
  trigger,
  type = "wordComplete",
  position = { x: 0, y: 0 },
  className = "",
  intensity = 1, // Multiplier for particle count
}) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (!trigger) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const createParticles = () => {
      let particleCount, colors, velocity, size, life, decay;

      switch (type) {
        case "wordComplete":
          particleCount = Math.floor(20 * intensity);
          colors = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b"];
          velocity = 2 + Math.random() * 3;
          size = 3 + Math.random() * 4;
          life = 1.0;
          decay = 0.02 + Math.random() * 0.01;
          break;

        case "correctGuess":
          particleCount = Math.floor(15 * intensity);
          colors = ["#10b981", "#22c55e", "#16a34a"];
          velocity = 1.5 + Math.random() * 2;
          size = 2 + Math.random() * 3;
          life = 0.8;
          decay = 0.03 + Math.random() * 0.02;
          break;

        case "streak":
          particleCount = Math.floor(30 * intensity);
          colors = ["#f59e0b", "#f97316", "#ef4444", "#dc2626"];
          velocity = 3 + Math.random() * 4;
          size = 4 + Math.random() * 6;
          life = 1.2;
          decay = 0.015 + Math.random() * 0.01;
          break;

        case "victory":
          particleCount = Math.floor(50 * intensity);
          colors = [
            "#ef4444",
            "#f97316",
            "#eab308",
            "#22c55e",
            "#06b6d4",
            "#8b5cf6",
            "#ec4899",
            "#f59e0b",
          ];
          velocity = 2 + Math.random() * 4;
          size = 3 + Math.random() * 5;
          life = 1.0;
          decay = 0.02 + Math.random() * 0.01;
          break;

        case "confetti":
          particleCount = Math.floor(40 * intensity);
          colors = [
            "#ef4444",
            "#f97316",
            "#eab308",
            "#22c55e",
            "#06b6d4",
            "#8b5cf6",
            "#ec4899",
            "#f59e0b",
          ];
          velocity = 1 + Math.random() * 3;
          size = 2 + Math.random() * 4;
          life = 1.5;
          decay = 0.01 + Math.random() * 0.01;
          break;

        default:
          particleCount = Math.floor(20 * intensity);
          colors = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b"];
          velocity = 2 + Math.random() * 3;
          size = 3 + Math.random() * 4;
          life = 1.0;
          decay = 0.02 + Math.random() * 0.01;
      }

      const newParticles = [];

      for (let i = 0; i < particleCount; i++) {
        const angle =
          (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
        const finalVelocity = velocity * (0.8 + Math.random() * 0.4);
        const finalSize = size * (0.8 + Math.random() * 0.4);
        const color = colors[Math.floor(Math.random() * colors.length)];

        newParticles.push({
          id: i,
          x: position.x + (Math.random() - 0.5) * 20,
          y: position.y + (Math.random() - 0.5) * 20,
          vx: Math.cos(angle) * finalVelocity,
          vy: Math.sin(angle) * finalVelocity,
          size: finalSize,
          color,
          life,
          decay: decay * (0.8 + Math.random() * 0.4),
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 10,
        });
      }

      setParticles(newParticles);
    };

    createParticles();
  }, [trigger, type, position, intensity]);

  useEffect(() => {
    if (particles.length === 0) return;

    const animate = () => {
      setParticles((prevParticles) => {
        const updated = prevParticles
          .map((particle) => ({
            ...particle,
            x: particle.x + particle.vx,
            y: particle.y + particle.vy,
            vx: particle.vx * 0.98, // Friction
            vy: particle.vy * 0.98 + 0.1, // Gravity
            life: particle.life - particle.decay,
            rotation: particle.rotation + particle.rotationSpeed,
          }))
          .filter((particle) => particle.life > 0);

        return updated;
      });
    };

    const interval = setInterval(animate, 16); // 60fps
    return () => clearInterval(interval);
  }, [particles.length]);

  if (particles.length === 0) return null;

  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`}>
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            left: particle.x,
            top: particle.y,
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            opacity: particle.life,
            transform: `translate(-50%, -50%) scale(${particle.life}) rotate(${particle.rotation}deg)`,
            transition: "opacity 0.1s ease-out",
            boxShadow:
              type === "streak"
                ? `0 0 ${particle.size * 2}px ${particle.color}`
                : "none",
          }}
        />
      ))}
    </div>
  );
}
