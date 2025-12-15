// server/utils/sanitize.js
// Server-side input sanitization utilities

/**
 * Sanitizes a player name
 * @param {string} name - The player name to sanitize
 * @returns {string} - Sanitized name
 */
export function sanitizePlayerName(name) {
  if (typeof name !== "string") return "";
  // Remove HTML tags
  let sanitized = name.replace(/<[^>]*>/g, "");
  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, "");
  // Trim and limit length
  sanitized = sanitized.trim();
  return sanitized.slice(0, 30);
}

/**
 * Sanitizes a room ID
 * @param {string} id - The room ID to sanitize
 * @returns {string} - Sanitized room ID (uppercase, alphanumeric only, max 8 chars)
 */
export function sanitizeRoomId(id) {
  if (typeof id !== "string") return "";
  return id
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

/**
 * Sanitizes a word guess
 * @param {string} word - The word to sanitize
 * @returns {string} - Sanitized word (uppercase, letters only, max 5 chars)
 */
export function sanitizeWord(word) {
  if (typeof word !== "string") return "";
  return word.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
}

/**
 * Validates that input is safe (no XSS patterns)
 * @param {string} input - Input to validate
 * @returns {boolean} - True if safe
 */
export function isSafeInput(input) {
  if (typeof input !== "string") return false;
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
  ];
  return !dangerousPatterns.some((pattern) => pattern.test(input));
}


