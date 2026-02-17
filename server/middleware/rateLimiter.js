import rateLimit from "express-rate-limit";

// ---------- HTTP rate limiters (express-rate-limit, in-memory store) ----------

/** General API rate limiter — 100 requests per 15 minutes per IP. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Stricter limiter for auth endpoints — 10 attempts per 15 minutes per IP. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ---------- Socket.IO rate limiting (in-memory sliding window) ----------

const socketRateLimits = new Map();

/**
 * Check whether a socket event is within the allowed rate.
 * @param {string} socketId
 * @param {string} event
 * @param {number} maxPerMinute - Maximum events allowed per 60-second window.
 * @returns {boolean} `true` if within limit, `false` if rate-limited.
 */
export function checkSocketRateLimit(socketId, event, maxPerMinute = 60) {
  const key = `${socketId}:${event}`;
  const now = Date.now();

  const entry = socketRateLimits.get(key);
  if (!entry || now > entry.resetAt) {
    socketRateLimits.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (entry.count >= maxPerMinute) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Remove a socket's entries when it disconnects.
 * @param {string} socketId
 */
export function clearSocketRateLimits(socketId) {
  const prefix = `${socketId}:`;
  for (const key of socketRateLimits.keys()) {
    if (key.startsWith(prefix)) {
      socketRateLimits.delete(key);
    }
  }
}

// Periodic cleanup of expired entries (every 5 minutes)
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, value] of socketRateLimits.entries()) {
    if (now > value.resetAt + 60_000) {
      socketRateLimits.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Allow Node to exit cleanly if this is the only pending timer
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}
