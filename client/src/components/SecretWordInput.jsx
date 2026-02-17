// components/SecretWordInput.jsx
import React, { useEffect, useRef, useState } from "react";
import { getRandomWord } from "../api";

export default function SecretWordInput({
  disabled = false,
  onSubmit,
  submitHint = "Press Enter to start",
  tile = 64, // tile size px
  className = "",
  showGenerate = true,
}) {
  const [word, setWord] = useState("");
  const inputRef = useRef(null);

  // Focus once when enabled
  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  const onKeyDown = (e) => {
    // CRITICAL: never bubble to App's global key handler
    e.stopPropagation();

    if (disabled) return;

    const k = e.key;
    if (k === "Enter") {
      e.preventDefault();
      if (word.length === 5) onSubmit?.(word);
      return;
    }
    if (k === "Backspace") {
      e.preventDefault();
      setWord((w) => w.slice(0, -1));
      return;
    }
    if (k === "Tab") {
      e.preventDefault();
      handleGenerate();
      return;
    }
    if (/^[a-zA-Z]$/.test(k)) {
      e.preventDefault();
      setWord((w) => (w.length < 5 ? w + k.toUpperCase() : w));
    }
  };

  async function handleGenerate() {
    try {
      const w = await getRandomWord();
      if (w && w.length === 5) {
        setWord(w);
        inputRef.current?.focus();
      }
    } catch (error) {
      console.error("Failed to generate word:", error);
    }
  }

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => {
          const ch = word[i] || "";
          const isActive = i === word.length && word.length < 5;
          return (
            <div
              key={i}
              className="grid place-items-center rounded-md font-bold uppercase"
              style={{
                width: tile,
                height: tile,
                background: isActive ? "#e3f2fd" : ch ? "#fff" : "#f8fafc",
                color: "#0f172a",
                border: `2px solid ${
                  isActive ? "#1976d2" : ch ? "#9ca3af" : "#cbd5e1"
                }`,
                transition: "all .15s ease",
              }}
            >
              {ch}
            </div>
          );
        })}
      </div>

      {/* Hidden input that owns all keystrokes */}
      <input
        ref={inputRef}
        onKeyDown={onKeyDown}
        className="sr-only"
        aria-label="Enter 5-letter secret word"
      />

      <div className="flex items-center gap-2">
        {showGenerate && (
          <button
            type="button"
            className="text-xs px-2 py-1 rounded bg-slate-100 border border-slate-200 hover:bg-slate-200"
            onMouseDown={(e) => e.preventDefault()} // keep focus on input
            onClick={handleGenerate}
            disabled={disabled}
            aria-label="Generate random word"
            title="Generate random word (or press R)"
          >
            🎲 Generate
          </button>
        )}
        <div className="text-xs text-slate-500">
          {word.length < 5 ? "Type a 5-letter word…" : submitHint}
        </div>
      </div>
    </div>
  );
}
