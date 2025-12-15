// client/src/utils/sanitize.js
// Input sanitization utilities to prevent XSS and data corruption

/**
 * Sanitizes a general text input
 * @param {string} input - The input string to sanitize
 * @param {number} maxLength - Maximum allowed length (default: 50)
 * @returns {string} - Sanitized string
 */
export const sanitizeInput = (input, maxLength = 50) => {
  if (typeof input !== "string") return "";
  // Remove leading/trailing whitespace
  let sanitized = input.trim();
  // Remove any HTML tags (basic XSS prevention)
  sanitized = sanitized.replace(/<[^>]*>/g, "");
  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");
  // Limit length
  return sanitized.slice(0, maxLength);
};

/**
 * Sanitizes a room ID
 * @param {string} id - The room ID to sanitize
 * @returns {string} - Sanitized room ID (uppercase, alphanumeric only, max 8 chars)
 */
export const sanitizeRoomId = (id) => {
  if (typeof id !== "string") return "";
  // Convert to uppercase, remove non-alphanumeric characters, limit to 8 chars
  return id
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
};

/**
 * Sanitizes a player name
 * @param {string} name - The player name to sanitize
 * @returns {string} - Sanitized name
 */
export const sanitizePlayerName = (name) => {
  if (typeof name !== "string") return "";
  // Remove HTML tags
  let sanitized = name.replace(/<[^>]*>/g, "");
  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, "");
  // Trim and limit length (player names can be a bit longer)
  sanitized = sanitized.trim();
  return sanitized.slice(0, 30);
};

/**
 * Sanitizes a word guess (5-letter word)
 * @param {string} word - The word to sanitize
 * @returns {string} - Sanitized word (uppercase, letters only, exactly 5 chars)
 */
export const sanitizeWord = (word) => {
  if (typeof word !== "string") return "";
  // Convert to uppercase, remove non-letters, limit to 5 chars
  const sanitized = word.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
  return sanitized;
};

/**
 * Validates that a string is safe for display (no XSS)
 * @param {string} str - String to validate
 * @returns {boolean} - True if safe
 */
export const isSafeString = (str) => {
  if (typeof str !== "string") return false;
  // Check for potential XSS patterns
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // onclick, onerror, etc.
    /<iframe/i,
    /<object/i,
    /<embed/i,
  ];
  return !dangerousPatterns.some((pattern) => pattern.test(str));
};


