import React, { useEffect, useState, memo } from "react";

const TINTS = {
  neutral: "rgba(124, 58, 237, 0.15)",
  yellow: "rgba(234, 179, 8, 0.18)",
  green: "rgba(34, 197, 94, 0.2)",
  win: "rgba(34, 197, 94, 0.35)",
};

function glowColor(pattern) {
  if (!pattern || pattern.length === 0) return TINTS.neutral;
  if (pattern.every((s) => s === "green")) return TINTS.win;
  if (pattern.some((s) => s === "green")) return TINTS.green;
  if (pattern.some((s) => s === "yellow")) return TINTS.yellow;
  return TINTS.neutral;
}

function BoardGlow({ guessFlipKey = 0, lastPattern = null }) {
  const [pulse, setPulse] = useState(false);
  const tint = glowColor(lastPattern);

  useEffect(() => {
    if (guessFlipKey <= 0) return;
    setPulse(true);
    const id = setTimeout(() => setPulse(false), 700);
    return () => clearTimeout(id);
  }, [guessFlipKey]);

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: "-20%",
        zIndex: -1,
        pointerEvents: "none",
        borderRadius: "50%",
        background: `radial-gradient(circle, ${tint} 0%, transparent 70%)`,
        opacity: pulse ? 1 : 0.6,
        transform: pulse ? "scale(1.15)" : "scale(1)",
        transition: "opacity 0.6s ease, transform 0.6s ease, background 0.4s ease",
        willChange: "transform, opacity",
      }}
    />
  );
}

export default memo(BoardGlow);
