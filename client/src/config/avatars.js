export const PRESET_AVATARS = [
  { key: "cat", emoji: "🐱" },
  { key: "dog", emoji: "🐶" },
  { key: "fox", emoji: "🦊" },
  { key: "panda", emoji: "🐼" },
  { key: "robot", emoji: "🤖" },
  { key: "alien", emoji: "👾" },
  { key: "ghost", emoji: "👻" },
  { key: "skull", emoji: "💀" },
  { key: "flame", emoji: "🔥" },
  { key: "bolt", emoji: "⚡" },
  { key: "star", emoji: "⭐" },
  { key: "gem", emoji: "💎" },
  { key: "rocket", emoji: "🚀" },
  { key: "crown", emoji: "👑" },
  { key: "heart", emoji: "❤️" },
  { key: "moon", emoji: "🌙" },
];

export const AVATAR_KEYS = new Set(PRESET_AVATARS.map((a) => a.key));

export function getAvatarEmoji(key) {
  const avatar = PRESET_AVATARS.find((a) => a.key === key);
  return avatar?.emoji || null;
}

export const PRESET_COLOURS = [
  "#8b5cf6", // violet
  "#3b82f6", // blue
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#eab308", // yellow
  "#f97316", // orange
  "#ef4444", // red
  "#ec4899", // pink
  "#f1f5f9", // slate-100
  "#64748b", // slate-500
];
