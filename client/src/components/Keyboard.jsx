import React from "react";

const keys = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"],
];

export default function Keyboard({ onKeyPress, letterStates = {} }) {
  const getBg = (key) => {
    if (key === "ENTER" || key === "BACKSPACE") return "#d3d6da"; // Light gray for specials
    const state = letterStates[key];
    if (state === "correct") return "#6aaa64"; // Green
    if (state === "present") return "#c9b458"; // Yellow
    if (state === "absent") return "#787c7e"; // Gray
    return "#d3d6da"; // Default unused
  };

  const getColor = (key) => {
    const state = letterStates[key];
    return state === "correct" || state === "present" || state === "absent"
      ? "#fff"
      : "#000";
  };

  return (
    //change to push
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        marginTop: 16,
      }}
    >
      {keys.map((row, rowIdx) => (
        <div key={rowIdx} style={{ display: "flex", gap: 6 }}>
          {row.map((key) => (
            <button
              key={key}
              onClick={() => onKeyPress(key)}
              style={{
                width: key === "ENTER" || key === "BACKSPACE" ? 60 : 40, // Wider for specials
                height: 50,
                borderRadius: 4,
                border: "none",
                background: getBg(key),
                color: getColor(key),
                fontWeight: "bold",
                fontSize: 16,
                textTransform: "uppercase",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {key === "ENTER" ? "↵" : key === "BACKSPACE" ? "⌫" : key}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
