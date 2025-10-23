import React, { useMemo } from "react";

const STATE_COLORS = {
  correct: "#22c55e",
  present: "#fbbf24",
  absent: "#64748b",
  filled: "rgba(129, 140, 248, 0.85)",
  idle: "rgba(148, 163, 184, 0.2)",
};

const BORDER_COLOR = "rgba(148, 163, 184, 0.3)";

function normalizeState(value) {
  if (!value) return "idle";
  const normalized = value.toString().toLowerCase();
  if (normalized === "correct" || normalized === "green") return "correct";
  if (normalized === "present" || normalized === "yellow") return "present";
  if (normalized === "absent" || normalized === "gray" || normalized === "grey")
    return "absent";
  if (normalized === "filled") return "filled";
  return "idle";
}

export default function MicroProgressGrid({
  rows = 3,
  cols = 5,
  size = 10,
  gap = 2,
  radius = 3,
  patterns = null,
  fallbackFilled = 0,
}) {
  const cells = useMemo(() => {
    const total = rows * cols;

    if (Array.isArray(patterns) && patterns.length > 0) {
      const trimmed = patterns.slice(-rows);
      const paddedRows = [
        ...trimmed,
        ...Array.from({ length: Math.max(0, rows - trimmed.length) }, () =>
          Array.from({ length: cols }, () => "idle")
        ),
      ];

      return paddedRows
        .map((row) =>
          Array.from({ length: cols }, (_, idx) =>
            normalizeState(row?.[idx])
          )
        )
        .flat()
        .slice(0, total);
    }

    const clampedFilled = Math.max(
      0,
      Math.min(total, Number.parseInt(fallbackFilled, 10) || 0)
    );

    return Array.from({ length: total }, (_, idx) =>
      idx < clampedFilled ? "filled" : "idle"
    );
  }, [cols, rows, patterns, fallbackFilled]);

  return (
    <div
      className="rounded-xl border border-white/10 bg-white/5 p-2"
      style={{ borderColor: BORDER_COLOR }}
    >
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, ${size}px)`,
          gap,
        }}
      >
        {cells.map((state, index) => (
          <div
            key={index}
            style={{
              width: size,
              height: size,
              borderRadius: radius,
              backgroundColor: STATE_COLORS[state] || STATE_COLORS.idle,
              border: `0.5px solid ${BORDER_COLOR}`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
