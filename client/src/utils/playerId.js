const LS_PLAYER_ID = "wp.playerId";

function fallbackUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rnd = Math.floor(Math.random() * 16);
    const value = char === "x" ? rnd : (rnd & 0x3) | 0x8;
    return value.toString(16);
  });
}

function generatePlayerId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return fallbackUuid();
}

export function getOrCreatePlayerId() {
  if (typeof window === "undefined") return "";
  const existing = localStorage.getItem(LS_PLAYER_ID);
  if (existing) return existing;
  const created = generatePlayerId();
  localStorage.setItem(LS_PLAYER_ID, created);
  return created;
}
