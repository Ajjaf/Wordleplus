// server/config/env.js
// Centralized environment configuration with validation.
// Import `config` for typed access; call `validateConfig()` at startup.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isTruthy = (value) =>
  typeof value === "string"
    ? ["true", "1", "yes", "on"].includes(value.toLowerCase())
    : Boolean(value);

const toInt = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const trimSlash = (url) => (url ? url.replace(/\/$/, "") : url);

const splitList = (value) =>
  value
    ? value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

// ---------------------------------------------------------------------------
// Config object – single source of truth for every env var the server reads
// ---------------------------------------------------------------------------

export const config = Object.freeze({
  // ---- Core ----------------------------------------------------------------
  port: toInt(process.env.PORT, 8080),
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  isTest: process.env.NODE_ENV === "test",

  // ---- Database ------------------------------------------------------------
  databaseUrl: process.env.DATABASE_URL,

  // ---- Sessions ------------------------------------------------------------
  sessionSecret: process.env.SESSION_SECRET,

  // ---- Auth / OAuth --------------------------------------------------------
  issuerUrl: process.env.ISSUER_URL ?? "https://replit.com/oidc",
  baseUrl: trimSlash(process.env.BASE_URL) || "http://localhost:5000",
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  replId: process.env.REPL_ID,
  replitDomains: process.env.REPLIT_DOMAINS,
  replitDevDomain: process.env.REPLIT_DEV_DOMAIN,
  skipAuthSetup: isTruthy(process.env.SKIP_AUTH_SETUP),

  // ---- Session cookie overrides --------------------------------------------
  sessionCookieSameSite: process.env.SESSION_COOKIE_SAME_SITE,
  sessionCookieDomain: process.env.SESSION_COOKIE_DOMAIN || undefined,

  // ---- CORS ----------------------------------------------------------------
  corsAllowedOrigins: splitList(process.env.CORS_ALLOWED_ORIGINS),
  corsAllowedOriginSuffixes: splitList(
    process.env.CORS_ALLOWED_ORIGIN_SUFFIXES,
  ),

  // ---- Word lists ----------------------------------------------------------
  wordlistPath: process.env.WORDLIST_PATH, // resolved relative to caller
  guessesPath: process.env.GUESSES_PATH,

  // ---- Game tuning ---------------------------------------------------------
  duelRoundMs: (() => {
    const val = Number(process.env.DUEL_ROUND_MS);
    const MAX = 6 * 60 * 1000;
    return Number.isFinite(val) && val > 0 ? Math.min(val, MAX) : MAX;
  })(),

  // ---- Daily challenge -----------------------------------------------------
  dailyTz: process.env.DAILY_TZ || "America/New_York",
  dailyRollHour: toInt(process.env.DAILY_ROLL_HOUR, 0),

  // ---- AI Battle event -----------------------------------------------------
  aiBattleEventActive: isTruthy(process.env.AI_BATTLE_EVENT_ACTIVE),
  aiBattleEventSlot: process.env.AI_BATTLE_EVENT_SLOT || "20:00-21:00",

  // ---- Admin ---------------------------------------------------------------
  eventAdminToken: process.env.EVENT_ADMIN_TOKEN || "",

  // ---- Error tracking (Sentry) ---------------------------------------------
  sentryDsn: process.env.SENTRY_DSN || "",
  sentryEnvironment: process.env.SENTRY_ENVIRONMENT || "development",
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates that all required environment variables are set.
 * Call once at server startup before any connections are opened.
 *
 * @param {object} [options]
 * @param {boolean} [options.requireDatabase=true] - Require DATABASE_URL
 * @returns {{ warnings: string[] }} Collected non-fatal warnings
 * @throws {Error} If any required variable is missing
 */
export function validateConfig({ requireDatabase = true } = {}) {
  const missing = [];
  const warnings = [];

  // Required in every environment
  if (requireDatabase && !config.databaseUrl) {
    missing.push("DATABASE_URL");
  }

  // Required in production, warned in development
  if (!config.sessionSecret) {
    if (config.isProduction) {
      missing.push("SESSION_SECRET");
    } else {
      warnings.push(
        "SESSION_SECRET not set – using insecure default (OK for local dev)",
      );
    }
  }

  // Warn about auth-related vars
  if (!config.replitDomains) {
    warnings.push(
      "REPLIT_DOMAINS not set – auth callbacks may not work in deployment",
    );
  }

  if (!config.replId && !config.skipAuthSetup) {
    warnings.push("REPL_ID not set – OAuth login will fail");
  }

  if (!config.googleClientSecret && !config.skipAuthSetup) {
    warnings.push("GOOGLE_CLIENT_SECRET not set – OAuth login will fail");
  }

  // Print warnings
  for (const w of warnings) {
    console.warn(`⚠️  ${w}`);
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        "Check your .env file or environment configuration.",
    );
  }

  return { warnings };
}
