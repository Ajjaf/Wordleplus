import React, { useEffect, useState } from "react";

const STYLE_PRESETS = {
  confetti: {
    count: 100,
    colors: ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#8b5cf6", "#ec4899"],
    shapes: ["square", "circle", "triangle"],
    sizeRange: [8, 16],
    rotate: true,
  },
  stars: {
    count: 40,
    colors: ["#fbbf24", "#fcd34d", "#fef3c7", "#ffffff", "#f59e0b"],
    shapes: ["star"],
    sizeRange: [6, 14],
    rotate: true,
  },
  neon: {
    count: 60,
    colors: ["#06b6d4", "#ec4899", "#a3e635", "#818cf8", "#f472b6"],
    shapes: ["circle"],
    sizeRange: [4, 10],
    rotate: false,
    glow: true,
  },
  pixel: {
    count: 50,
    colors: ["#ef4444", "#22c55e", "#3b82f6", "#eab308", "#f97316", "#8b5cf6"],
    shapes: ["square"],
    sizeRange: [6, 6],
    rotate: false,
  },
};

function getClipPath(shape) {
  if (shape === "triangle") return "polygon(50% 0%, 0% 100%, 100% 100%)";
  if (shape === "star") return "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)";
  return "none";
}

function getBorderRadius(shape) {
  if (shape === "circle") return "50%";
  return shape === "square" || shape === "pixel" ? "1px" : "0";
}

export default function ConfettiEffect({ trigger, celebrationStyle = "confetti", className = "" }) {
  const [confetti, setConfetti] = useState([]);

  useEffect(() => {
    if (!trigger) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const preset = STYLE_PRESETS[celebrationStyle] || STYLE_PRESETS.confetti;

    const newConfetti = [];
    for (let i = 0; i < preset.count; i++) {
      const color = preset.colors[Math.floor(Math.random() * preset.colors.length)];
      const shape = preset.shapes[Math.floor(Math.random() * preset.shapes.length)];
      const size = preset.sizeRange[0] + Math.random() * (preset.sizeRange[1] - preset.sizeRange[0]);

      newConfetti.push({
        id: i,
        x: Math.random() * window.innerWidth,
        y: -10,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        rotation: Math.random() * 360,
        rotationSpeed: preset.rotate ? (Math.random() - 0.5) * 10 : 0,
        color,
        shape,
        size,
        glow: preset.glow || false,
        life: 1.0,
        decay: 0.005,
      });
    }
    setConfetti(newConfetti);
  }, [trigger, celebrationStyle]);

  useEffect(() => {
    if (confetti.length === 0) return;

    const interval = setInterval(() => {
      setConfetti((prev) => {
        const updated = prev
          .map((item) => ({
            ...item,
            x: item.x + item.vx,
            y: item.y + item.vy,
            rotation: item.rotation + item.rotationSpeed,
            vy: item.vy + 0.1,
            life: item.life - item.decay,
          }))
          .filter((item) => item.life > 0 && item.y < window.innerHeight + 50);
        return updated;
      });
    }, 16);
    return () => clearInterval(interval);
  }, [confetti.length]);

  if (confetti.length === 0) return null;

  return (
    <div className={`fixed inset-0 pointer-events-none z-50 ${className}`}>
      {confetti.map((item) => (
        <div
          key={item.id}
          className="absolute"
          style={{
            left: item.x,
            top: item.y,
            width: item.size,
            height: item.size,
            backgroundColor: item.color,
            opacity: item.life,
            transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
            borderRadius: getBorderRadius(item.shape),
            clipPath: getClipPath(item.shape),
            boxShadow: item.glow ? `0 0 6px 2px ${item.color}` : "none",
          }}
        />
      ))}
    </div>
  );
}
