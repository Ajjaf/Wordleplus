// components/GameResults.jsx
import React, { useMemo } from "react";
import { Trophy } from "lucide-react";

export default function GameResults({ room, players = [], correctWord }) {
  const winnerId = room?.battle?.winner || null;
  const roundFinished = !!winnerId || !!correctWord;

  // Per-round stats from guesses vs. correctWord (exclude host)
  const results = useMemo(() => {
    const word = (correctWord || "").toUpperCase();
    return players
      .filter((p) => p && p.id && p.id !== room?.hostId) // Exclude host from leaderboard
      .map((p) => {
        const guesses = Array.isArray(p.guesses) ? p.guesses : [];
        const ix =
          word && guesses.length
            ? guesses.findIndex((g) => (g?.guess || "").toUpperCase() === word)
            : -1;
        const steps = ix >= 0 ? ix + 1 : null;
        return {
          id: p.id,
          name: p.name || "—",
          guesses: guesses.length,
          solved: steps !== null,
          steps,
          wins: p.wins ?? 0,
          streak: p.streak ?? 0,
          disconnected: !!p.disconnected,
        };
      });
  }, [players, correctWord, room?.hostId]);

  // Sort for podium / table
  const sorted = useMemo(() => {
    const copy = [...results];
    copy.sort((a, b) => {
      // winner always first if present
      if (winnerId) {
        if (a.id === winnerId && b.id !== winnerId) return -1;
        if (b.id === winnerId && a.id !== winnerId) return 1;
      }
      // then solved first, fewest steps first
      if (a.solved !== b.solved) return a.solved ? -1 : 1;
      if (a.solved && b.solved) return a.steps - b.steps;
      // both unsolved: fewer guesses used first
      if (!a.solved && !b.solved) return a.guesses - b.guesses;
      return a.name.localeCompare(b.name);
    });
    return copy;
  }, [results, winnerId]);

  const podium = sorted.slice(0, 3);

  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      {/* Compact Status Strip */}
      <div className="text-center mb-3">
        {roundFinished ? (
          <div className="inline-flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span
              className="text-sm font-semibold"
              style={{ color: "var(--card-text)" }}
            >
              Round Results
            </span>
          </div>
        ) : (
          <div className="text-sm" style={{ color: "var(--card-text-muted)" }}>
            {winnerId ? "Round in progress…" : "Waiting for host to start…"}
          </div>
        )}
      </div>

      {/* Revealed word tiles (only when we have it) */}
      {correctWord ? (
        <div className="flex items-center justify-center mb-4">
          <div className="grid grid-cols-5 gap-1.5">
            {correctWord
              .toUpperCase()
              .padEnd(5, " ")
              .slice(0, 5)
              .split("")
              .map((ch, i) => (
                <div
                  key={i}
                  className="w-10 h-12 grid place-items-center rounded border font-extrabold uppercase tracking-wider text-sm"
                  style={{
                    backgroundColor: "var(--tile-correct-bg)",
                    color: "var(--tile-correct-fg)",
                    borderColor: "var(--tile-correct-bg)",
                    animation: `tileFlip 0.6s ease-in-out ${i * 100}ms both`,
                  }}
                >
                  {ch.trim()}
                </div>
              ))}
          </div>
        </div>
      ) : null}

      {/* Podium - Physical podium structure */}
      {podium.length > 0 && (
        <div className="flex items-end justify-center gap-1.5 mb-4">
          {/* 2nd place - Left podium */}
          {podium[1] && (
            <div className="flex flex-col items-center">
              {/* Player card */}
              <div
                className="rounded border p-2 text-center mb-1.5 relative z-10"
                style={{
                  backgroundColor: "var(--card-bg)",
                  borderColor: "var(--card-border)",
                  color: "var(--card-text)",
                  minWidth: "100px",
                }}
              >
                <div className="text-lg mb-0.5">🥈</div>
                <div
                  className="font-semibold truncate text-xs"
                  style={{ color: "var(--card-text)" }}
                  title={podium[1].name}
                >
                  {podium[1].name}
                </div>
                <div
                  className="text-xs mt-0.5"
                  style={{ color: "var(--card-text-muted)" }}
                >
                  {podium[1].solved ? `${podium[1].steps}` : "—"}
                </div>
              </div>
              {/* Podium base */}
              <div
                className="w-24 h-8 rounded-t-lg border-t-2"
                style={{
                  backgroundColor: "var(--card-hover)",
                  borderColor: "var(--card-border)",
                }}
              />
            </div>
          )}

          {/* 1st place - Middle podium (highest) */}
          {podium[0] && (
            <div className="flex flex-col items-center">
              {/* Player card */}
              <div
                className="rounded border p-3 text-center mb-1.5 relative z-10"
                style={{
                  backgroundColor: "var(--card-bg)",
                  borderColor: "var(--card-border)",
                  color: "var(--card-text)",
                  minWidth: "120px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                }}
              >
                {/* Bouncing Crown */}
                <div
                  className="text-2xl mb-0.5 animate-bounce"
                  style={{ animationDuration: "2s" }}
                >
                  👑
                </div>
                <div className="text-lg mb-0.5">🥇</div>
                <div
                  className="font-bold truncate text-sm"
                  style={{ color: "var(--card-text)" }}
                  title={podium[0].name}
                >
                  {podium[0].name}
                </div>
                <div
                  className="text-xs mt-0.5"
                  style={{ color: "var(--card-text-muted)" }}
                >
                  {podium[0].solved ? `${podium[0].steps}` : "—"}
                </div>
              </div>
              {/* Podium base - tallest */}
              <div
                className="w-28 h-12 rounded-t-lg border-t-2"
                style={{
                  backgroundColor: "var(--card-hover)",
                  borderColor: "var(--card-border)",
                }}
              />
            </div>
          )}

          {/* 3rd place - Right podium */}
          {podium[2] && (
            <div className="flex flex-col items-center">
              {/* Player card */}
              <div
                className="rounded border p-2 text-center mb-1.5 relative z-10"
                style={{
                  backgroundColor: "var(--card-bg)",
                  borderColor: "var(--card-border)",
                  color: "var(--card-text)",
                  minWidth: "100px",
                }}
              >
                <div className="text-lg mb-0.5">🥉</div>
                <div
                  className="font-semibold truncate text-xs"
                  style={{ color: "var(--card-text)" }}
                  title={podium[2].name}
                >
                  {podium[2].name}
                </div>
                <div
                  className="text-xs mt-0.5"
                  style={{ color: "var(--card-text-muted)" }}
                >
                  {podium[2].solved ? `${podium[2].steps}` : "—"}
                </div>
              </div>
              {/* Podium base - shortest */}
              <div
                className="w-24 h-6 rounded-t-lg border-t-2"
                style={{
                  backgroundColor: "var(--card-hover)",
                  borderColor: "var(--card-border)",
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Full table */}
      <div
        className="overflow-hidden rounded-lg border max-w-full"
        style={{
          borderColor: "var(--card-border)",
          backgroundColor: "var(--card-bg)",
        }}
      >
        <div
          className="grid grid-cols-12 border-b text-xs font-semibold"
          style={{
            backgroundColor: "var(--card-hover)",
            borderColor: "var(--card-border)",
            color: "var(--card-text-muted)",
          }}
        >
          <div className="col-span-6 px-2 py-1.5">Player</div>
          <div className="col-span-2 px-2 py-1.5">Round</div>
          <div className="col-span-2 px-2 py-1.5 text-center">Wins</div>
          <div className="col-span-2 px-2 py-1.5 text-center">Streak</div>
        </div>

        <div className="max-h-[45vh] overflow-auto">
          {sorted.map((p) => (
            <div
              key={p.id}
              className={[
                "grid grid-cols-12 items-center border-b last:border-b-0",
                "px-2 py-1.5 text-xs",
                p.disconnected ? "opacity-60" : "",
              ].join(" ")}
              style={{
                backgroundColor:
                  p.id === winnerId
                    ? "rgba(251, 191, 36, 0.1)"
                    : "var(--card-bg)",
                borderColor: "var(--card-border)",
                color: "var(--card-text)",
              }}
            >
              <div className="col-span-6 flex items-center gap-2 min-w-0">
                <div
                  className={[
                    "w-1.5 h-1.5 rounded-full",
                    p.id === winnerId
                      ? "bg-amber-500"
                      : p.solved
                      ? "bg-emerald-500"
                      : "bg-slate-300",
                  ].join(" ")}
                />
                <span className="truncate" title={p.name}>
                  {p.name}
                </span>
              </div>

              <div className="col-span-2 text-xs">
                {p.solved ? `${p.steps}` : `${p.guesses}`}
              </div>

              <div className="col-span-2 text-center text-xs">{p.wins}</div>

              <div className="col-span-2 text-center text-xs">
                {p.streak || 0}
              </div>
            </div>
          ))}

          {sorted.length === 0 && (
            <div
              className="text-center text-xs py-4"
              style={{ color: "var(--card-text-muted)" }}
            >
              No players yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
