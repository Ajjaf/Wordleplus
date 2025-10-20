import React, { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

function Tiles({ word = "" }) {
  const letters = (word || "").toUpperCase().padEnd(5).slice(0, 5).split("");
  return (
    <div className="flex items-center justify-center">
      <div className="flex gap-[4px]">
        {letters.map((ch, i) => (
          <div
            key={i}
            className="h-10 w-10 grid place-items-center rounded-md font-bold text-white"
            style={{ background: "#6aaa64", border: "1px solid #6aaa64" }}
          >
            {ch.trim()}
          </div>
        ))}
      </div>
    </div>
  );
}

// Accessible, animated modal
export default function VictoryModal({
  open,
  onOpenChange,
  mode,
  winnerName = "",
  leftName,
  rightName,
  leftSecret,
  rightSecret,
  battleSecret,
  onPlayAgain,
  showPlayAgain = true, // duel=true, battle=false
}) {
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement;
    setTimeout(() => {
      const btn = dialogRef.current?.querySelector("[data-autofocus]");
      (btn || dialogRef.current)?.focus();
    }, 0);

    const onKey = (e) => {
      if (e.key === "Escape") onOpenChange?.(false);
      if (e.key === "Tab") {
        const f = dialogRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!f || !f.length) return;
        const list = Array.from(f).filter(
          (el) => !el.hasAttribute("disabled") && el.getAttribute("tabindex") !== "-1"
        );
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          last.focus(); e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus(); e.preventDefault();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused.current?.focus?.();
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  const onOverlayClick = (e) => {
    if (e.target === overlayRef.current) onOpenChange?.(false);
  };

  const title =
    mode === "daily"
      ? "🎉 Puzzle Solved!"
      : winnerName
      ? `${winnerName} wins`
      : "Round complete";

  return (
    <div
      ref={overlayRef}
      onMouseDown={onOverlayClick}
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm animate-[fadeIn_160ms_ease-out]"
      aria-hidden="true"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="victory-title"
        tabIndex={-1}
        className="w-full max-w-lg mx-4 rounded-xl bg-white dark:bg-neutral-900 shadow-2xl outline-none ring-1 ring-black/10 animate-[popIn_200ms_cubic-bezier(0.2,0.8,0.2,1)]"
      >
        <div className="p-6">
          <h3 id="victory-title" className="text-2xl font-bold tracking-tight">
            {title}
          </h3>

          {mode === "daily" ? (
            <div className="mt-4">
              <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg">
                <p className="text-center text-lg font-semibold">
                  Congratulations, {winnerName || "Player"}!
                </p>
                <p className="text-center text-sm text-muted-foreground mt-2">
                  You solved today's Daily Challenge!
                </p>
                <p className="text-center text-xs text-muted-foreground mt-3">
                  Come back tomorrow for a new puzzle! 🌟
                </p>
              </div>
            </div>
          ) : mode === "duel" ? (
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-4">
                <Avatar name={leftName} />
                <div className="flex-1">
                  <p className="font-semibold">{leftName}</p>
                  <Tiles word={leftSecret} />
                </div>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center gap-4">
                <Avatar name={rightName} />
                <div className="flex-1">
                  <p className="font-semibold">{rightName}</p>
                  <Tiles word={rightSecret} />
                </div>
              </div>
            </div>
          ) : mode === "shared" ? (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">Secret word:</p>
              <Tiles word={battleSecret} />
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Congrats <span className="font-semibold">{winnerName}</span> solved the shared puzzle!
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">Secret word:</p>
              <Tiles word={battleSecret} />
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange?.(false)}>Close</Button>
            {showPlayAgain && onPlayAgain && (
              <Button data-autofocus onClick={onPlayAgain}>Play again</Button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes popIn {
          0% { opacity: 0; transform: translateY(6px) scale(.96) }
          100% { opacity: 1; transform: translateY(0) scale(1) }
        }
      `}</style>
    </div>
  );
}

function Avatar({ name }) {
  const initials = (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
  return (
    <div className="h-10 w-10 rounded-full bg-muted grid place-items-center text-sm font-semibold">
      {initials || "?"}
    </div>
  );
}
