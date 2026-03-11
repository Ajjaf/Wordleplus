import React, { useRef, useState, useEffect } from "react";
import { validateWord, getRandomWord } from "../api";
import { useIsMobile } from "../hooks/useIsMobile";
import Keyboard from "./Keyboard";

export default function SecretWordInputRow({
  onSubmit, // (word) => Promise|void
  validate = true, // call /api/validate
  disabled = false,
  size = 56, // tile px (use clamp in parent if you want)
  gap = 8,
  placeholder = "Enter 5-letter word",
  submitHint = "Press Enter to start",
  className = "",
  showGenerate = true, // NEW: show the 🎲 button
}) {
  const [value, setValue] = useState(""); // typed word (0..5)
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Global keydown fallback so physical keyboard works even if hidden input loses focus
  useEffect(() => {
    if (disabled) return;
    const handler = (e) => {
      if (document.activeElement === inputRef.current) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const k = e.key;
      if (k === "Enter") { e.preventDefault(); submit(); return; }
      if (k === "Backspace") { e.preventDefault(); setError(""); setValue((s) => s.slice(0, -1)); return; }
      if (k === "Tab") { e.preventDefault(); handleGenerate(); return; }
      if (/^[a-zA-Z]$/.test(k)) {
        e.preventDefault();
        setError("");
        setValue((s) => (s.length < 5 ? s + k.toUpperCase() : s));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const onKeyDown = async (e) => {
    if (disabled) return;
    e.stopPropagation();
    const k = e.key;

    if (k === "Enter") {
      e.preventDefault();
      submit();
      return;
    }
    if (k === "Backspace") {
      e.preventDefault();
      setError("");
      setValue((s) => s.slice(0, -1));
      return;
    }
    if (k === "Tab") {
      e.preventDefault();
      handleGenerate();
      return;
    }
    if (/^[a-zA-Z]$/.test(k)) {
      e.preventDefault();
      setError("");
      setValue((s) => (s.length < 5 ? s + k.toUpperCase() : s));
    }
  };

  // Handle keyboard input from virtual keyboard
  const handleKeyPress = (key) => {
    if (disabled || busy) return;

    if (key === "ENTER") {
      submit();
      return;
    }
    if (key === "BACKSPACE") {
      setError("");
      setValue((s) => s.slice(0, -1));
      return;
    }
    if (/^[A-Z]$/.test(key)) {
      setError("");
      setValue((s) => (s.length < 5 ? s + key : s));
    }
  };

  async function submit() {
    const word = value.trim().toUpperCase();
    if (word.length !== 5) {
      setError("Word must be 5 letters");
      return;
    }
    if (validate) {
      setBusy(true);
      try {
        const v = await validateWord(word);
        if (!v?.valid) {
          setError("Not a valid word");
          setValue("");
          return;
        }
      } catch (err) {
        // Error occurred
        setError("Validation failed");
        return;
      } finally {
        setBusy(false);
      }
    }
    await onSubmit?.(word);
    // keep the word visible; host screen will flip to spectate when the round starts
    inputRef.current?.focus();
  }

  async function handleGenerate() {
    try {
      setError("");
      const w = await getRandomWord();
      if (!w || w.length !== 5) {
        setError("Could not generate a word");
        return;
      }
      setValue(w); // fill tiles…
      inputRef.current?.focus();
      // …but DO NOT auto-submit. User presses Enter to accept.
    } catch (error) {
      console.error("Failed to generate word:", error);
      setError("Failed to generate word");
    }
  }

  // CSS calc: simple inline-grid; NO height:100%; no ResizeObserver
  const gridStyle = {
    display: "inline-grid",
    gridTemplateColumns: `repeat(5, ${size}px)`,
    gridTemplateRows: `${size}px`,
    gap,
  };

  return (
    <div className={["flex flex-col items-center", className].join(" ")}>
      {/* hidden input catches keys locally */}
      <input
        ref={inputRef}
        value=""
        onChange={() => {}}
        onKeyDown={onKeyDown}
        disabled={disabled}
        aria-label={placeholder}
        autoFocus
        tabIndex={-1}
        style={{
          position: "absolute",
          opacity: 0,
          pointerEvents: "none",
          width: 1,
          height: 1,
        }}
      />

      <div
        style={gridStyle}
        onClick={() => !disabled && inputRef.current?.focus()}
      >
        {Array.from({ length: 5 }).map((_, i) => {
          const ch = value[i] || "";
          const isActive = !disabled && i === value.length;

          let bg = "var(--tile-empty-bg)",
            color = "var(--tile-text)",
            border = "1px solid var(--tile-empty-border)";
          if (ch) {
            bg = "var(--tile-typed-bg)";
            color = "var(--tile-text)";
            border = "1px solid var(--tile-empty-border)";
          }
          if (isActive) {
            bg = "#e3f2fd";
            color = "#1976d2";
            border = "2px solid #1976d2";
          }

          return (
            <div
              key={i}
              style={{
                width: size,
                height: size,
                display: "grid",
                placeItems: "center",
                background: bg,
                color,
                fontWeight: "bold",
                textTransform: "uppercase",
                border,
                borderRadius: 6,
                transition: "all 0.15s ease",
              }}
            >
              {ch}
            </div>
          );
        })}
      </div>

      {/* Controls / hint row */}
      <div className="mt-2 flex items-center gap-2 h-5">
        {showGenerate && (
          <button
            type="button"
            className="text-xs px-2 py-1 rounded border"
            style={{
              backgroundColor: "var(--card-bg)",
              borderColor: "var(--card-border)",
              color: "var(--card-text)",
            }}
            onMouseDown={(e) => e.preventDefault()} // keep focus on tile row
            onClick={handleGenerate}
            disabled={disabled || busy}
            aria-label="Generate random word"
            title="Generate random word (or press Tab)"
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = "var(--card-hover)";
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = "var(--card-bg)";
            }}
          >
            🎲 Generate
          </button>
        )}

        {busy ? (
          <span className="text-xs" style={{ color: "#1976d2" }}>
            Validating…
          </span>
        ) : (
          <span
            className="text-xs"
            style={{
              color: error ? "#dc2626" : "var(--card-text-muted)",
            }}
          >
            {error
              ? error
              : value.length === 0
              ? placeholder
              : value.length < 5
              ? "Type a 5-letter word…"
              : submitHint}
          </span>
        )}
      </div>

      {/* Mobile keyboard */}
      {isMobile && !disabled && (
        <div className="mt-4 w-full max-w-5xl mx-auto">
          <Keyboard
            onKeyPress={handleKeyPress}
            letterStates={{}}
            disabled={busy}
          />
        </div>
      )}
    </div>
  );
}
