import React from "react";
import { getAvatarEmoji } from "../config/avatars";

const DEFAULT_BG = "rgba(255,255,255,0.08)";
const DEFAULT_COLOR = "rgba(255,255,255,0.5)";

/**
 * Renders a player avatar circle: preset emoji, or fallback to initial letter.
 * Uses profileColour as background when set.
 *
 * @param {string}  avatarKey     - preset avatar key (e.g. "cat")
 * @param {string}  colour        - hex accent colour (e.g. "#8b5cf6")
 * @param {string}  name          - player name (fallback to initial)
 * @param {number}  size          - circle diameter in px (default 40)
 * @param {string}  className     - extra CSS classes
 * @param {boolean} done          - show checkmark instead (for progress strip)
 */
export default function PlayerAvatar({
  avatarKey,
  colour,
  name = "",
  size = 40,
  className = "",
  done = false,
}) {
  const emoji = getAvatarEmoji(avatarKey);
  const bg = colour || DEFAULT_BG;
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  const fontSize = emoji ? size * 0.5 : size * 0.42;

  if (done) {
    return (
      <div
        className={`rounded-full grid place-items-center flex-shrink-0 font-bold ${className}`}
        style={{
          width: size,
          height: size,
          fontSize: size * 0.4,
          backgroundColor: "rgba(16, 185, 129, 0.2)",
          color: "#34d399",
          boxShadow: "0 0 0 2px rgba(16, 185, 129, 0.35)",
        }}
      >
        ✓
      </div>
    );
  }

  return (
    <div
      className={`rounded-full grid place-items-center flex-shrink-0 select-none ${className}`}
      style={{
        width: size,
        height: size,
        fontSize,
        backgroundColor: bg,
        color: colour ? "#fff" : DEFAULT_COLOR,
        fontWeight: emoji ? "normal" : "bold",
        lineHeight: 1,
      }}
    >
      {emoji || initial}
    </div>
  );
}
