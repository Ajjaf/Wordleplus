const cache = new Map();

function getEnabled() {
  if (typeof window === "undefined") return true;
  return localStorage.getItem("wordleplus_audio_enabled") !== "false";
}

function getVolume() {
  if (typeof window === "undefined") return 0.7;
  const v = parseFloat(localStorage.getItem("wordleplus_audio_volume"));
  return Number.isFinite(v) ? v : 0.7;
}

function play(name, vol) {
  if (!getEnabled()) return;
  try {
    let src = cache.get(name);
    if (!src) {
      src = new Audio(`/sounds/${name}.mp3`);
      src.preload = "auto";
      cache.set(name, src);
    }
    const clone = src.cloneNode();
    clone.volume = Math.min(vol ?? getVolume(), 1);
    clone.play().catch(() => {});
  } catch { /* ignore */ }
}

export function playErrorSound() { play("error", 0.6); }
export function playSubmitSound() { play("submit", 0.5); }
