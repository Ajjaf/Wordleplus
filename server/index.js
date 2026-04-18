// server/index.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { Server } from "socket.io";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { scoreGuess } from "./game.js";
import { duelMode, sharedMode, battleMode } from "./modes/index.js";
import {
  getOrCreateAnonymousUser,
  getTodaysPuzzle,
  getUserDailyResult,
  createOrUpdateDailyResult,
  getUserDailyStats,
} from "./daily-db.js";
import { setupAuth, getUserIdFromRequest, authenticateSocket } from "./auth.js";
import { getFullUserProfile } from "./mergeService.js";
import createAdminEventsRouter from "./admin/events.js";
import {
  sanitizePlayerName,
  sanitizeRoomId,
  sanitizeWord,
  isSafeInput,
} from "./utils/sanitize.js";
import helmet from "helmet";
import * as Sentry from "@sentry/node";
import { PrismaClient } from "@prisma/client";
import { config, validateConfig } from "./config/env.js";
import { startSessionCleanup } from "./jobs/cleanupSessions.js";
import {
  apiLimiter,
  authLimiter,
  pollingLimiter,
  checkSocketRateLimit,
  clearSocketRateLimits,
} from "./middleware/rateLimiter.js";

const prisma = new PrismaClient();

// ---------- Sentry error tracking (optional) ----------
if (config.sentryDsn) {
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.sentryEnvironment,
    tracesSampleRate: 1.0,
  });
}

// ---------- Validate environment before proceeding ----------
if (!config.isTest) {
  try {
    validateConfig();
  } catch (error) {
    console.error("❌ Configuration Error:", error.message);
    process.exit(1);
  }
}

// ---------- Word list loader (.txt) ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORDLIST_PATH =
  config.wordlistPath || path.join(__dirname, "words.txt");
const GUESSES_PATH =
  config.guessesPath || path.join(__dirname, "allowed_guesses.txt");

let WORDS = [];
let WORDSET = new Set();
let GUESSES = [];
let GUESSSET = new Set();
const ROUND_MS = config.duelRoundMs;
const AI_BATTLE_COUNTDOWN_MS = 12 * 1000; // 12 seconds between AI-hosted rounds

async function loadWordFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Word list file not found: ${filePath}`);
  }
  const raw = await fs.promises.readFile(filePath, "utf8");
  return raw
    .split(/\r?\n/)
    .map((w) => w.trim())
    .filter(Boolean)
    .map((w) => w.toUpperCase())
    .filter((w) => /^[A-Z]{5}$/.test(w));
}

async function loadWords() {
  const words = await loadWordFile(WORDLIST_PATH);
  if (words.length === 0) {
    throw new Error(
      `Word list is empty or contains no valid 5-letter words: ${WORDLIST_PATH}`,
    );
  }

  WORDS = Array.from(new Set(words));
  WORDSET = new Set(WORDS);
  console.log(`[words] Loaded ${WORDS.length} solutions from ${WORDLIST_PATH}`);

  let guessWords = WORDS;
  if (fs.existsSync(GUESSES_PATH)) {
    guessWords = await loadWordFile(GUESSES_PATH);
    if (guessWords.length === 0) {
      console.warn(
        `[words] Guess list at ${GUESSES_PATH} is empty; using solution list for validation`,
      );
      guessWords = WORDS;
    } else {
      console.log(
        `[words] Loaded ${guessWords.length} allowed guesses from ${GUESSES_PATH}`,
      );
    }
  } else {
    console.warn(
      `[words] Guess list not found at ${GUESSES_PATH}; using solution list for validation`,
    );
  }

  GUESSES = Array.from(new Set([...guessWords, ...WORDS]));
  GUESSSET = new Set(GUESSES);
}
try {
  await loadWords();
} catch (error) {
  console.error("Failed to load word lists:", error.message);
  if (!config.isTest) process.exit(1);
  else throw error;
}

async function ensureAnonymousSession(req, userId) {
  if (!req || !req.session || !userId) return;
  if (req.session.anonymousUserId === userId) return;
  req.session.anonymousUserId = userId;
  if (typeof req.session.save !== "function") return;
  await new Promise((resolve) => {
    req.session.save((err) => {
      if (err) {
        console.warn("[session] Failed to persist anonymous user id", err);
      }
      resolve();
    });
  });
}

// Helper to pick N unique random words from WORDS.
// Uses a Fisher-Yates partial shuffle so each swap is O(1) rather than
// the O(remaining) element-shift caused by splice().
function pickRandomWords(n) {
  const pool = [...WORDS];
  const limit = Math.min(n, pool.length);
  for (let i = 0; i < limit; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, limit);
}

function isValidWordLocal(word) {
  if (!word) return false;
  const w = word.toUpperCase();
  return /^[A-Z]{5}$/.test(w) && GUESSSET.has(w);
}

// ---------- Express app ----------
const app = express();
export { app };

// ---------- CORS ----------
// Build a set of allowed origins from config + dev defaults.
const allowedOrigins = new Set(
  [
    ...(config.isProduction
      ? []
      : [
          "http://localhost:5000",
          "http://127.0.0.1:5000",
          "http://localhost:5173",
          "http://127.0.0.1:5173",
        ]),
    config.baseUrl,
    ...config.corsAllowedOrigins,
  ]
    .map((v) => {
      try {
        return v ? new URL(v).origin : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean),
);

const allowedSuffixes = config.corsAllowedOriginSuffixes.map((s) =>
  s.toLowerCase().replace(/^\*\./, "").replace(/^\./, ""),
);

function evaluateCorsOrigin(origin, cb) {
  if (!origin) return cb(null, true);

  if (allowedOrigins.has(origin)) return cb(null, true);

  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    if (
      allowedSuffixes.some(
        (sfx) => hostname === sfx || hostname.endsWith(`.${sfx}`),
      )
    ) {
      return cb(null, true);
    }
  } catch {
    /* malformed origin — fall through to reject */
  }

  cb(new Error(`CORS: Origin ${origin} not allowed`));
}

const corsOptions = {
  origin: evaluateCorsOrigin,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// ---------- Security headers ----------
app.use(
  helmet({
    contentSecurityPolicy: config.isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            connectSrc: ["'self'", ...allowedOrigins],
            scriptSrc: ["'self'"],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(express.json());
app.use(cookieParser());

// ---------- Rate limiting ----------
app.use("/api/", apiLimiter);
app.use("/api/login", authLimiter);
app.use("/api/callback", authLimiter);

const shouldSetupAuth = !config.isTest && !config.skipAuthSetup;

if (shouldSetupAuth) {
  await setupAuth(app);
}

// Serve static files from client build in production
if (config.isProduction) {
  const clientDistPath = path.join(__dirname, "..", "client", "dist");
  app.use(express.static(clientDistPath));
} else {
  // In development, show helpful page with link to frontend
  app.get("/", (_req, res) => {
    const frontendUrl = config.replitDevDomain
      ? `https://5000--${config.replitDevDomain}`
      : config.baseUrl;

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>EvoWordo Backend</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
          .container { background: white; padding: 40px; border-radius: 10px; max-width: 600px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #5b21b6; }
          .button { display: inline-block; margin-top: 20px; padding: 15px 30px; background: #5b21b6; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
          .button:hover { background: #7c3aed; }
          p { color: #666; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🎮 EvoWordo Backend API</h1>
          <p>You've reached the backend API server. The EvoWordo game frontend is running on a different port.</p>
          <p><strong>Click the button below to access the game:</strong></p>
          <a href="${frontendUrl}" class="button">Open EvoWordo →</a>
          <p style="margin-top: 30px; font-size: 14px; color: #999;">Backend API running on port 8080 | Frontend on port 5000</p>
        </div>
      </body>
      </html>
    `);
  });
}

// ---------- Health / readiness / liveness ----------
app.get("/health", async (_req, res) => {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    health.database = "connected";
  } catch {
    health.database = "disconnected";
    health.status = "degraded";
  }

  health.wordLists = {
    words: WORDSET.size,
    guesses: GUESSSET.size,
  };

  health.activeRooms = rooms.size;

  const statusCode = health.status === "ok" ? 200 : 503;
  res.status(statusCode).json(health);
});

app.get("/ready", (_req, res) => {
  const isReady = WORDSET.size > 0 && GUESSSET.size > 0;
  if (isReady) {
    res.status(200).json({ ready: true });
  } else {
    res.status(503).json({ ready: false, reason: "Word lists not loaded" });
  }
});

app.get("/alive", (_req, res) => {
  res.status(200).json({ alive: true });
});
app.get("/api/validate", (req, res) => {
  const word = (req.query.word || "").toString();
  res.json({ valid: isValidWordLocal(word) });
});

// ---------- Auth API endpoints ----------

// Get current user (works for both anonymous and authenticated)
app.get("/api/auth/user", async (req, res) => {
  try {
    let userId = getUserIdFromRequest(req);

    // If no user session exists, create an anonymous one
    if (!userId) {
      const user = await getOrCreateAnonymousUser(null);
      userId = user.id;
      // Store in session for future requests
      req.session.anonymousUserId = userId;
      await req.session.save();
    }

    // Get full user profile
    const profile = await getFullUserProfile(userId);

    if (!profile) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(profile);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

// Update profile (works for anonymous and authenticated)
const ALLOWED_AVATAR_KEYS = new Set([
  "cat","dog","fox","panda","robot","alien","ghost","skull",
  "flame","bolt","star","gem","rocket","crown","heart","moon",
]);
const HEX_COLOUR_RE = /^#[0-9a-fA-F]{6}$/;

app.patch("/api/auth/profile", async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "No user session" });
    }

    const { displayName, profileAvatar, profileColour } = req.body || {};
    const data = {};

    if (displayName !== undefined) {
      const trimmed = String(displayName).trim().slice(0, 20);
      if (!isSafeInput(trimmed)) {
        return res.status(400).json({ message: "Invalid display name" });
      }
      data.displayName = trimmed || null;
    }

    if (profileAvatar !== undefined) {
      if (profileAvatar !== null && !ALLOWED_AVATAR_KEYS.has(profileAvatar)) {
        return res.status(400).json({ message: "Invalid avatar" });
      }
      data.profileAvatar = profileAvatar;
    }

    if (profileColour !== undefined) {
      if (profileColour !== null && !HEX_COLOUR_RE.test(profileColour)) {
        return res.status(400).json({ message: "Invalid colour" });
      }
      data.profileColour = profileColour;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    await prisma.user.update({ where: { id: userId }, data });
    const profile = await getFullUserProfile(userId);
    res.json(profile);
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Failed to update profile" });
  }
});

// Get user stats
app.get("/api/auth/stats", async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);

    if (!userId) {
      return res.status(401).json({ message: "No user session" });
    }

    const profile = await getFullUserProfile(userId);

    if (!profile) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(profile.stats);
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
});

// GET /api/random?letters=5 -> { word: "FLARE" }
app.get("/api/random", (_req, res) => {
  // we only have 5-letter words in WORDS, but keep the param for future use
  const pool = WORDS; // or filter by length if you add other lists later
  const word = pool[Math.floor(Math.random() * pool.length)] || null;
  res.json({ word });
});

// GET /api/random-word -> { word: "FLARE" }
app.get("/api/random-word", (_req, res) => {
  const w = WORDS[Math.floor(Math.random() * WORDS.length)];
  res.json({ word: w });
});

// Optional: hot-reload words (disable/protect in prod)
app.post("/api/reload-words", (_req, res) => {
  try {
    loadWords();
    res.json({ ok: true, count: WORDS.length });
  } catch (e) {
    console.error("reload-words failed:", e);
    res.status(500).json({ ok: false });
  }
});

// ---------- Daily Challenge ----------
const MAX_DAILY_GUESSES = 6;
const DAILY_WORD_LENGTH = 5;

// GET /api/daily - Load daily challenge
app.get("/api/daily", async (req, res) => {
  try {
    let userId = getUserIdFromRequest(req);

    // If no userId from client, create one
    if (!userId) {
      const user = await getOrCreateAnonymousUser(null);
      userId = user.id;
    }
    await ensureAnonymousSession(req, userId);

    const puzzle = await getTodaysPuzzle();
    const existingResult = await getUserDailyResult(userId, puzzle.id);

    const guesses = existingResult?.guesses || [];
    const patterns = existingResult?.patterns || [];
    const gameOver = existingResult?.completed || false;
    const won = existingResult?.won || false;

    const responseData = {
      title: "Daily Challenge",
      subtitle: `Challenge for ${puzzle.date}`,
      date: puzzle.date,
      wordLength: DAILY_WORD_LENGTH,
      maxGuesses: MAX_DAILY_GUESSES,
      guesses,
      patterns,
      gameOver,
      won,
      word: gameOver ? puzzle.word : undefined,
      userId, // Send back the userId for client to store
    };
    console.log("[GET /api/daily] Response:", {
      userId,
      gameOver,
      won,
      word: responseData.word,
      guessCount: guesses.length,
    });
    res.json(responseData);
  } catch (error) {
    console.error("Error in GET /api/daily:", error);
    res.status(500).json({ error: "Failed to load daily challenge" });
  }
});

// POST /api/daily/guess - Submit a guess
app.post("/api/daily/guess", async (req, res) => {
  try {
    const existingUserId = getUserIdFromRequest(req);
    const { guess } = req.body;

    if (!guess || typeof guess !== "string") {
      return res.status(400).json({ error: "Invalid guess" });
    }

    const guessUpper = guess.toUpperCase();

    if (!isValidWordLocal(guessUpper)) {
      return res.status(400).json({ error: "Not a valid word" });
    }

    // Fetch user and today's puzzle in parallel — they are independent
    const [user, puzzle] = await Promise.all([
      getOrCreateAnonymousUser(existingUserId),
      getTodaysPuzzle(),
    ]);
    const userId = user.id;

    const existingResult = await getUserDailyResult(userId, puzzle.id);

    const guesses = existingResult?.guesses || [];
    const patterns = existingResult?.patterns || [];
    const gameOver = existingResult?.completed || false;

    if (gameOver) {
      return res.json({
        error: "Challenge already completed",
        gameOver: true,
        won: existingResult.won,
      });
    }

    if (guesses.includes(guessUpper)) {
      return res.status(400).json({ error: "Already guessed that word" });
    }

    if (guesses.length >= MAX_DAILY_GUESSES) {
      return res.status(400).json({ error: "No more guesses left" });
    }

    const pattern = scoreGuess(puzzle.word, guessUpper);

    const newGuesses = [...guesses, guessUpper];
    const newPatterns = [...patterns, pattern];

    const won = pattern.every(
      (state) => state === "green" || state === "correct"
    );
    const outOfGuesses = newGuesses.length >= MAX_DAILY_GUESSES;
    const completed = won || outOfGuesses;

    await createOrUpdateDailyResult(userId, puzzle.id, {
      guesses: newGuesses,
      patterns: newPatterns,
      won,
      completed,
    });

    const guessResponse = {
      pattern,
      correct: won,
      gameOver: completed,
      won,
      word: completed ? puzzle.word : undefined,
      message: won
        ? "🎉 Congratulations! You solved today's puzzle!"
        : outOfGuesses
        ? `Game over! The word was ${puzzle.word}`
        : "",
    };
    res.json(guessResponse);
  } catch (error) {
    console.error("Error in POST /api/daily/guess:", error);
    res.status(500).json({ error: "Failed to process guess" });
  }
});

// GET /api/daily/stats - Get user's daily challenge statistics
app.get("/api/daily/stats", async (req, res) => {
  try {
    const cookieUserId = getUserIdFromRequest(req);

    if (!cookieUserId) {
      return res.json({
        totalPlayed: 0,
        totalWins: 0,
        winRate: 0,
        currentStreak: 0,
        maxStreak: 0,
        recentResults: [],
      });
    }
    await ensureAnonymousSession(req, cookieUserId);

    const stats = await getUserDailyStats(cookieUserId);
    res.json(stats);
  } catch (error) {
    console.error("Error in GET /api/daily/stats:", error);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

// ---------- Rooms ----------
/**
 * Room schema:
 * {
 *   id, mode: 'duel' | 'battle' | 'battle_ai', hostId,
 *   players: { [socketId]: { name, guesses: [], done: false, ready: false, secret: string|null } },
 *   started, winner,
 *   duelReveal?: { [socketId]: secret }, // populated at end of duel
 *   battle: {
 *     secret,
 *     started,
 *     winner,
 *     lastRevealedWord,
 *     deadline,
 *     countdownEndsAt,
 *     aiHost?: { mode: 'auto' | 'player', claimedBy: string|null }
 *   }
 * }
 */
const rooms = new Map();
const VALID_MODES = new Set(["duel", "shared", "battle", "battle_ai"]);

const HOST_DISCONNECT_GRACE_MS = 2 * 60 * 1000; // 2 minutes
const SOCKET_DISCONNECT_GRACE_MS = 5 * 1000; // 5 seconds
const pendingDisconnectTimers = new Map();

const AI_BATTLE_EVENT_BASE_KEY = "ai_battle_hour";
let aiBattleEventActive = config.aiBattleEventActive;
const AI_BATTLE_EVENT_SLOT = config.aiBattleEventSlot;
const AI_BATTLE_EVENT_INTERVAL_MS = 30 * 1000;
let ioRef = null;

const isTruthy = (value) =>
  typeof value === "string"
    ? ["true", "1", "yes", "on"].includes(value.toLowerCase())
    : Boolean(value);

function computeAiBattleEventId(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${AI_BATTLE_EVENT_BASE_KEY}_${year}${month}${day}`;
}

function isAiBattleEventActive() {
  return aiBattleEventActive;
}

function setAiBattleEventActive(nextActive) {
  const normalized = isTruthy(nextActive);
  const previous = aiBattleEventActive;
  if (previous === normalized) {
    if (normalized) {
      ensureAiBattleEventRoom();
    } else {
      retireAiBattleEventRooms();
    }
    return getAiBattleEventStatus();
  }
  aiBattleEventActive = normalized;
  if (normalized) {
    ensureAiBattleEventRoom();
  } else {
    retireAiBattleEventRooms();
  }
  return getAiBattleEventStatus();
}

function getAiBattleEventContext() {
  if (!isAiBattleEventActive()) return null;
  return {
    key: AI_BATTLE_EVENT_BASE_KEY,
    eventId: computeAiBattleEventId(),
    slot: AI_BATTLE_EVENT_SLOT,
  };
}

function tagRoomAsEvent(room, ctx) {
  room.meta = {
    ...(room.meta || {}),
    isEvent: true,
    eventKey: ctx.key,
    eventId: ctx.eventId,
    slot: ctx.slot,
    featured: true,
  };
  room.hostId = "server";
  room.hostConnected = true;
}

function ensureEventRoomDefaults(room, ctx) {
  tagRoomAsEvent(room, ctx);
  if (!room.battle) {
    battleMode.initBattleRoom(room);
  }
  room.mode = "battle_ai";
  room.battle.aiHost = {
    mode: "auto",
    claimedBy: null,
    pendingStart: false,
  };
  room.battle.pendingStart = false;
  room.battle.countdownEndsAt = room.battle.countdownEndsAt ?? null;
  room.battle.deadline = room.battle.deadline ?? null;
  room.updatedAt = Date.now();
}

function createAiBattleEventRoom(ctx) {
  const id = Math.random().toString(36).slice(2, 8).toUpperCase();
  const now = Date.now();
  const room = {
    id,
    mode: "battle_ai",
    hostId: "server",
    hostConnected: true,
    players: {},
    started: false,
    winner: null,
    duelReveal: undefined,
    duelDeadline: null,
    roundClosed: false,
    createdAt: now,
    updatedAt: now,
    meta: {
      isEvent: true,
      eventKey: ctx.key,
      eventId: ctx.eventId,
      slot: ctx.slot,
      featured: true,
    },
  };

  duelMode.initDuelRoom(room);
  sharedMode.initSharedRoom(room, { pickRandomWords });
  battleMode.initBattleRoom(room);
  room.battle.aiHost = {
    mode: "auto",
    claimedBy: null,
    pendingStart: false,
  };
  rooms.set(id, room);
  scheduleAiBattleCountdown(id);
  return room;
}

function ensureAiBattleEventRoom() {
  const ctx = getAiBattleEventContext();
  if (!ctx) return null;
  let activeRoom = null;
  const staleRooms = [];
  for (const [roomId, room] of rooms.entries()) {
    if (room.meta?.isEvent && room.meta.eventKey === ctx.key) {
      if (room.meta.eventId === ctx.eventId) {
        activeRoom = room;
      } else {
        staleRooms.push({ roomId, room });
      }
    }
  }

  for (const { roomId, room } of staleRooms) {
    room.meta.isEvent = false;
    room.meta.featured = false;
    room.meta.eventEndedAt = Date.now();
    if (room.hostId === "server") {
      room.hostId = null;
      room.hostConnected = false;
    }
    if (ioRef) {
      ioRef.to(roomId).emit("roomState", sanitizeRoom(room));
    }
  }

  if (!activeRoom) {
    activeRoom = createAiBattleEventRoom(ctx);
  } else {
    ensureEventRoomDefaults(activeRoom, ctx);
    if (getActivePlayerIds(activeRoom).length === 0) {
      scheduleAiBattleCountdown(activeRoom.id);
    }
  }

  if (ioRef) {
    ioRef.to(activeRoom.id).emit("roomState", sanitizeRoom(activeRoom));
  }
  return activeRoom;
}

function findActiveAiBattleEventRoom(ctx = getAiBattleEventContext()) {
  if (!ctx) return null;
  for (const room of rooms.values()) {
    if (
      room.meta?.isEvent &&
      room.meta.eventKey === ctx.key &&
      room.meta.eventId === ctx.eventId
    ) {
      return room;
    }
  }
  return null;
}

function retireAiBattleEventRooms() {
  for (const [roomId, room] of rooms.entries()) {
    if (room.meta?.isEvent && room.meta.eventKey === AI_BATTLE_EVENT_BASE_KEY) {
      room.meta.isEvent = false;
      room.meta.eventEndedAt = Date.now();
      room.meta.featured = false;
      if (room.hostId === "server") {
        room.hostId = null;
        room.hostConnected = false;
      }
      if (ioRef) {
        ioRef.to(roomId).emit("roomState", sanitizeRoom(room));
      }
    }
  }
}

function getAiBattleEventStatus() {
  const ctx = getAiBattleEventContext();
  const room = ctx ? findActiveAiBattleEventRoom(ctx) : null;
  return {
    active: Boolean(ctx && room),
    eventKey: ctx?.key ?? AI_BATTLE_EVENT_BASE_KEY,
    eventId: ctx?.eventId ?? null,
    slot: ctx?.slot ?? AI_BATTLE_EVENT_SLOT,
    roomId: room?.id ?? null,
    featured: Boolean(room?.meta?.featured),
    hostId: room?.hostId ?? null,
  };
}

const adminEventsRouter = createAdminEventsRouter({
  setAiBattleEventActive,
  getAiBattleEventStatus,
});
app.use("/admin/events", adminEventsRouter);

function summarizeJoinableRoom(room) {
  if (!room) return null;

  const players = Object.values(room.players || {});
  const activePlayers = players.filter((player) => !player?.disconnected);
  const isEventRoom = Boolean(room.meta?.isEvent);
  if (activePlayers.length === 0 && !isEventRoom) return null;

  let joinable = true;
  let capacity = null;

  if (room.mode === "duel") {
    joinable = !duelMode.canJoinDuel(room)?.error;
    capacity = 2;
  } else if (room.mode === "shared") {
    joinable = !sharedMode.canJoinShared(room)?.error;
    capacity = 2;
  } else if (room.mode === "battle" || room.mode === "battle_ai") {
    joinable = room.mode === "battle_ai" ? true : !room.battle?.started;
  } else {
    joinable = false;
  }

  if (!joinable) return null;

  const host = room.players ? room.players[room.hostId] : null;
  if (room.mode !== "battle_ai") {
    if (!host || host.disconnected) return null;
  }

  const updatedAt = Number(room.updatedAt || room.createdAt || Date.now());
  const createdAt = Number(room.createdAt || updatedAt);

  const isInProgress =
    room.mode === "battle" || room.mode === "battle_ai"
      ? Boolean(room.battle?.started)
      : room.mode === "shared"
      ? Boolean(room.shared?.started)
      : Boolean(room.started);

  const displayHostName =
    room.mode === "battle_ai"
      ? room.battle?.aiHost?.mode === "player"
        ? host?.name || "Player Host"
        : room.meta?.isEvent
        ? "AI Battle Hour"
        : "AI Host"
      : host?.name || "Host";

  return {
    id: room.id,
    mode: room.mode,
    hostName: displayHostName,
    playerCount: activePlayers.length,
    totalPlayers: players.length,
    capacity,
    isInProgress,
    createdAt,
    updatedAt,
  };
}

app.get("/api/rooms/open", pollingLimiter, (_req, res) => {
  const summaries = [];

  for (const room of rooms.values()) {
    const summary = summarizeJoinableRoom(room);
    if (summary) summaries.push(summary);
  }

  summaries.sort((a, b) => {
    if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
    return b.createdAt - a.createdAt;
  });

  res.json({ rooms: summaries.slice(0, 20) });
});

app.get("/api/events/status", pollingLimiter, (_req, res) => {
  res.json(getAiBattleEventStatus());
});

// ---------- Leaderboard API ----------
app.get("/api/leaderboard/top-players", async (_req, res) => {
  try {
    const topPlayers = await prisma.user.findMany({
      where: { isAnonymous: false, totalWins: { gt: 0 } },
      orderBy: { totalWins: "desc" },
      take: 10,
      select: {
        displayName: true,
        username: true,
        totalWins: true,
        totalGames: true,
      },
    });
    res.json(topPlayers);
  } catch (error) {
    console.error("Leaderboard error:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

app.get("/api/leaderboard/streaks", async (_req, res) => {
  try {
    const topStreaks = await prisma.user.findMany({
      where: { isAnonymous: false, longestStreak: { gt: 0 } },
      orderBy: { longestStreak: "desc" },
      take: 10,
      select: {
        displayName: true,
        username: true,
        streak: true,
        longestStreak: true,
      },
    });
    res.json(topStreaks);
  } catch (error) {
    console.error("Streaks error:", error);
    res.status(500).json({ error: "Failed to fetch streaks" });
  }
});

app.get("/api/leaderboard/categories", async (_req, res) => {
  try {
    const [wins, streaks, winRateRows, avgGuessRows] = await Promise.all([
      prisma.user.findMany({
        where: { isAnonymous: false, totalWins: { gt: 0 } },
        orderBy: { totalWins: "desc" },
        take: 20,
        select: { id: true, displayName: true, username: true, profileAvatar: true, totalWins: true, totalGames: true },
      }),
      prisma.user.findMany({
        where: { isAnonymous: false, longestStreak: { gt: 0 } },
        orderBy: { longestStreak: "desc" },
        take: 20,
        select: { id: true, displayName: true, username: true, profileAvatar: true, streak: true, longestStreak: true },
      }),
      prisma.$queryRaw`
        SELECT id, "displayName", username, "profileAvatar", "totalWins", "totalGames",
               ROUND("totalWins"::numeric / GREATEST("totalGames", 1) * 100, 1) as "winRate"
        FROM "User"
        WHERE "isAnonymous" = false AND "totalGames" >= 10
        ORDER BY "totalWins"::numeric / GREATEST("totalGames", 1) DESC
        LIMIT 20
      `,
      prisma.$queryRaw`
        SELECT u.id, u."displayName", u.username, u."profileAvatar",
               ROUND(AVG(dr.attempts)::numeric, 2) as "avgGuesses",
               COUNT(*)::int as "gamesWon"
        FROM "DailyResult" dr
        JOIN "User" u ON u.id = dr."userId"
        WHERE dr.won = true AND u."isAnonymous" = false
        GROUP BY u.id, u."displayName", u.username, u."profileAvatar"
        HAVING COUNT(*) >= 5
        ORDER BY AVG(dr.attempts) ASC
        LIMIT 20
      `,
    ]);

    res.json({
      wins,
      streaks,
      winRate: winRateRows.map((r) => ({ ...r, winRate: Number(r.winRate) })),
      avgGuesses: avgGuessRows.map((r) => ({ ...r, avgGuesses: Number(r.avgGuesses) })),
    });
  } catch (error) {
    console.error("Leaderboard categories error:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard categories" });
  }
});

function getWeekStartUTC() {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
  return monday;
}

app.get("/api/leaderboard/weekly", async (_req, res) => {
  try {
    const weekStart = getWeekStartUTC();
    const rows = await prisma.$queryRaw`
      SELECT u.id, u."displayName", u.username, u."profileAvatar",
             COUNT(*)::int as "weeklyWins"
      FROM "DailyResult" dr
      JOIN "User" u ON u.id = dr."userId"
      WHERE dr.won = true AND dr."createdAt" >= ${weekStart}
        AND u."isAnonymous" = false
      GROUP BY u.id, u."displayName", u.username, u."profileAvatar"
      ORDER BY "weeklyWins" DESC
      LIMIT 20
    `;
    res.json(rows);
  } catch (error) {
    console.error("Weekly leaderboard error:", error);
    res.status(500).json({ error: "Failed to fetch weekly leaderboard" });
  }
});

app.get("/api/leaderboard/near-me", async (req, res) => {
  const userId = getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const category = (req.query.category || "wins").toString();
  const NEIGHBORS = 3;

  try {
    let rankedQuery;
    switch (category) {
      case "winRate":
        rankedQuery = `
          SELECT id, "displayName", username, "profileAvatar", "totalWins", "totalGames",
                 ROUND("totalWins"::numeric / GREATEST("totalGames", 1) * 100, 1) as "statValue",
                 ROW_NUMBER() OVER (ORDER BY "totalWins"::numeric / GREATEST("totalGames", 1) DESC, "totalWins" DESC) as rank
          FROM "User"
          WHERE "isAnonymous" = false AND "totalGames" >= 10
        `;
        break;
      case "streaks":
        rankedQuery = `
          SELECT id, "displayName", username, "profileAvatar", streak, "longestStreak",
                 "longestStreak" as "statValue",
                 ROW_NUMBER() OVER (ORDER BY "longestStreak" DESC, streak DESC) as rank
          FROM "User"
          WHERE "isAnonymous" = false AND "longestStreak" > 0
        `;
        break;
      case "avgGuesses":
        rankedQuery = `
          SELECT u.id, u."displayName", u.username, u."profileAvatar",
                 ROUND(AVG(dr.attempts)::numeric, 2) as "statValue",
                 COUNT(*)::int as "gamesWon",
                 ROW_NUMBER() OVER (ORDER BY AVG(dr.attempts) ASC) as rank
          FROM "DailyResult" dr
          JOIN "User" u ON u.id = dr."userId"
          WHERE dr.won = true AND u."isAnonymous" = false
          GROUP BY u.id, u."displayName", u.username, u."profileAvatar"
          HAVING COUNT(*) >= 5
        `;
        break;
      case "weekly": {
        const weekStart = getWeekStartUTC();
        const rows = await prisma.$queryRaw`
          WITH ranked AS (
            SELECT u.id, u."displayName", u.username, u."profileAvatar",
                   COUNT(*)::int as "weeklyWins",
                   ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) as rank
            FROM "DailyResult" dr
            JOIN "User" u ON u.id = dr."userId"
            WHERE dr.won = true AND dr."createdAt" >= ${weekStart}
              AND u."isAnonymous" = false
            GROUP BY u.id, u."displayName", u.username, u."profileAvatar"
          )
          SELECT * FROM ranked
          WHERE rank BETWEEN
            (SELECT GREATEST(rank - ${NEIGHBORS}, 1) FROM ranked WHERE id = ${userId})
            AND
            (SELECT rank + ${NEIGHBORS} FROM ranked WHERE id = ${userId})
        `;
        const myRow = rows.find((r) => r.id === userId);
        return res.json({
          myRank: myRow ? Number(myRow.rank) : null,
          total: rows.length,
          players: rows.map((r) => ({ ...r, rank: Number(r.rank), weeklyWins: Number(r.weeklyWins) })),
        });
      }
      default:
        rankedQuery = `
          SELECT id, "displayName", username, "profileAvatar", "totalWins", "totalGames",
                 "totalWins" as "statValue",
                 ROW_NUMBER() OVER (ORDER BY "totalWins" DESC, "totalGames" DESC) as rank
          FROM "User"
          WHERE "isAnonymous" = false AND "totalWins" > 0
        `;
        break;
    }

    const rows = await prisma.$queryRawUnsafe(`
      WITH ranked AS (${rankedQuery})
      SELECT * FROM ranked
      WHERE rank BETWEEN
        (SELECT GREATEST(rank - ${NEIGHBORS}, 1) FROM ranked WHERE id = '${userId}')
        AND
        (SELECT rank + ${NEIGHBORS} FROM ranked WHERE id = '${userId}')
    `);

    const myRow = rows.find((r) => r.id === userId);
    res.json({
      myRank: myRow ? Number(myRow.rank) : null,
      total: rows.length,
      players: rows.map((r) => ({ ...r, rank: Number(r.rank), statValue: Number(r.statValue) })),
    });
  } catch (error) {
    console.error("Near-me leaderboard error:", error);
    res.status(500).json({ error: "Failed to fetch near-me leaderboard" });
  }
});

function normalizeMode(mode) {
  const candidate = (mode || "").toString().toLowerCase();
  return VALID_MODES.has(candidate) ? candidate : "duel";
}

function normalizePlayerId(playerId) {
  const value = (playerId || "").toString().trim();
  return value || null;
}

/** Within 5–10 min policy window for resume after disconnect. */
const RESUME_MAX_DISCONNECT_MS = 8 * 60 * 1000;

function isValidUuidPlayerId(value) {
  if (typeof value !== "string") return false;
  const v = value.trim();
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
    v,
  );
}

function resumeError(cb, error, code) {
  cb?.({ ok: false, error, code });
}

function getPlayerIdBySocket(room, socketId) {
  if (!room?.players || !socketId) return null;
  return (
    Object.keys(room.players).find((pid) => room.players[pid]?.socketId === socketId) ||
    null
  );
}

function replacePlayerReferences(room, fromId, toId) {
  if (!fromId || !toId || fromId === toId) return;
  if (room.hostId === fromId) room.hostId = toId;
  if (room.winner === fromId) room.winner = toId;
  if (room.battle?.winner === fromId) room.battle.winner = toId;
  if (room.battle?.aiHost?.claimedBy === fromId) room.battle.aiHost.claimedBy = toId;
  if (room.shared?.turn === fromId) room.shared.turn = toId;
}

function disconnectTimerKey(roomId, playerId) {
  return `${roomId}:${playerId}`;
}

function clearPendingDisconnect(roomId, playerId) {
  if (!roomId || !playerId) return;
  const key = disconnectTimerKey(roomId, playerId);
  const timer = pendingDisconnectTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    pendingDisconnectTimers.delete(key);
  }
}

function scheduleDisconnectMark(roomId, playerId) {
  if (!roomId || !playerId) return;
  const key = disconnectTimerKey(roomId, playerId);
  clearPendingDisconnect(roomId, playerId);
  const timer = setTimeout(() => {
    pendingDisconnectTimers.delete(key);
    const room = rooms.get(roomId);
    if (!room) return;
    const player = room.players[playerId];
    if (!player) return;
    // Player already reconnected before the grace timer fired.
    if (!player.socketId || player.disconnected) return;

    const now = Date.now();
    player.disconnected = true;
    player.disconnectedAt = now;
    sharedMode.handleSharedDisconnect(room, playerId);

    if (room.hostId === playerId) {
      if (room.mode === "battle_ai") {
        if (room.meta?.isEvent) {
          room.hostId = "server";
          room.hostConnected = true;
        } else {
          room.hostId = null;
          room.hostConnected = false;
        }
        if (room.battle?.aiHost) {
          room.battle.aiHost.mode = "auto";
          room.battle.aiHost.claimedBy = null;
        }
      } else {
        const replacement = Object.keys(room.players).find(
          (pid) => pid !== playerId && !room.players[pid].disconnected
        );
        if (replacement) {
          room.hostId = replacement;
        }
      }
    }

    room.updatedAt = now;
    io.to(roomId).emit("roomState", sanitizeRoom(room));
    if (room.mode === "battle_ai") {
      const active = getActivePlayerIds(room);
      if (active.length === 0) {
        clearAiBattleTimers(room);
        room.battle.deadline = null;
        room.battle.countdownEndsAt = null;
        battleMode.resetBattleRound(room);
        room.battle.secret = null;
        room.battle.lastRevealedWord = null;
        if (room.meta?.isEvent && isAiBattleEventActive()) {
          ensureAiBattleEventRoom();
        }
      } else if (
        room.battle.aiHost?.mode === "auto" &&
        !room.battle.started &&
        !room.battle.countdownEndsAt
      ) {
        maybeEnsureAiBattleRound(roomId);
      }
    }
  }, SOCKET_DISCONNECT_GRACE_MS);
  if (typeof timer.unref === "function") {
    timer.unref();
  }
  pendingDisconnectTimers.set(key, timer);
}

function updateStatsOnWin(room, winnerId) {
  if (!winnerId || winnerId === "draw") return;
  const player = room.players[winnerId];
  if (!player) return;
  player.wins = (player.wins || 0) + 1;
  player.streak = (player.streak || 0) + 1;

  Object.keys(room.players).forEach((id) => {
    if (id !== winnerId) room.players[id].streak = 0;
  });
}

function handleDuelTimeout(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.mode !== "duel") return;
  duelMode.resolveDuelTimeout({ room });
  if (room.winner && room.winner !== "draw") {
    updateStatsOnWin(room, room.winner);
  } else if (room.winner === "draw") {
    Object.keys(room.players).forEach((id) => {
      room.players[id].streak = 0;
    });
  }
  duelMode.clearDuelTimer(room);
  io.to(roomId).emit("roomState", sanitizeRoom(room));
}

function isAiBattleRoom(room) {
  return room?.mode === "battle_ai";
}

function getActivePlayerIds(room) {
  return Object.keys(room.players || {}).filter(
    (id) => !room.players[id].disconnected
  );
}

function pickAiBattleWord() {
  const [word] = pickRandomWords(1);
  if (word) return word;
  if (WORDS.length === 0) return null;
  const idx = Math.floor(Math.random() * WORDS.length);
  return WORDS[idx] || null;
}

function clearAiBattleTimers(room) {
  if (room._aiBattleRoundTimer) {
    clearTimeout(room._aiBattleRoundTimer);
    room._aiBattleRoundTimer = null;
  }
  if (room._aiBattleCountdownTimer) {
    clearTimeout(room._aiBattleCountdownTimer);
    room._aiBattleCountdownTimer = null;
  }
}

function scheduleAiBattleCountdown(roomId) {
  const room = rooms.get(roomId);
  if (!room || !isAiBattleRoom(room)) return;
  if (room.battle.aiHost?.mode !== "auto") return;
  if (room.battle.pendingStart) return;
  const active = getActivePlayerIds(room);
  if (active.length === 0) {
    clearAiBattleTimers(room);
    room.battle.countdownEndsAt = null;
    room.battle.deadline = null;
    return;
  }
  if (room._aiBattleCountdownTimer) {
    clearTimeout(room._aiBattleCountdownTimer);
  }
  const countdownEndsAt = Date.now() + AI_BATTLE_COUNTDOWN_MS;
  room.battle.countdownEndsAt = countdownEndsAt;
  room.updatedAt = Date.now();
  room._aiBattleCountdownTimer = setTimeout(() => {
    room._aiBattleCountdownTimer = null;
    const result = autoStartAiBattleRound(roomId);
    if (!result.ok) {
      room.battle.pendingStart = true;
      if (room.battle.aiHost) room.battle.aiHost.pendingStart = true;
      io.to(roomId).emit("roomState", sanitizeRoom(room));
    }
  }, AI_BATTLE_COUNTDOWN_MS);
}

function autoStartAiBattleRound(roomId) {
  const room = rooms.get(roomId);
  if (!room || !isAiBattleRoom(room))
    return { ok: false, error: "Room not available" };
  if (room.battle.aiHost?.mode !== "auto")
    return { ok: false, error: "AI host disabled" };
  if (room.battle.started) return { ok: false, error: "Round already running" };
  if (room.battle.pendingStart)
    return { ok: false, error: "Start pending confirmation" };
  if (room._aiBattleCountdownTimer) {
    clearTimeout(room._aiBattleCountdownTimer);
    room._aiBattleCountdownTimer = null;
  }

  const active = getActivePlayerIds(room);
  if (active.length === 0) {
    clearAiBattleTimers(room);
    room.battle.deadline = null;
    room.battle.countdownEndsAt = null;
    return { ok: false, error: "No active players" };
  }

  const secret = pickAiBattleWord();
  if (!secret) {
    console.warn("[aiBattle] Unable to pick secret word");
    return { ok: false, error: "No words available" };
  }

  battleMode.resetBattleRound(room);
  room.battle.secret = secret;
  room.battle.lastRevealedWord = null;
  room.battle.countdownEndsAt = null;

  const result = battleMode.startBattleRound({ room });
  if (result?.error) {
    console.warn("[aiBattle] startBattleRound failed", result.error);
    return { ok: false, error: result.error };
  }

  room.battle.pendingStart = false;
  if (room.battle.aiHost) room.battle.aiHost.pendingStart = false;
  room.battle.deadline = Date.now() + ROUND_MS;
  room.updatedAt = Date.now();
  if (room._aiBattleRoundTimer) {
    clearTimeout(room._aiBattleRoundTimer);
  }
  room._aiBattleRoundTimer = setTimeout(() => {
    handleAiBattleTimeout(roomId);
  }, ROUND_MS);

  io.to(roomId).emit("roomState", sanitizeRoom(room));
  return { ok: true };
}

function handleAiBattleTimeout(roomId) {
  const room = rooms.get(roomId);
  if (!room || !isAiBattleRoom(room)) return;
  room._aiBattleRoundTimer = null;
  if (!room.battle.started) return;

  battleMode.endBattleRound(room, null, { updateStatsOnWin });
  room.battle.deadline = null;
  if (room.battle.aiHost?.mode === "player") {
    room.battle.aiHost = { mode: "auto", claimedBy: null, pendingStart: false };
    room.hostId = room.meta?.isEvent ? "server" : null;
    room.hostConnected = room.meta?.isEvent ? true : false;
  }
  scheduleAiBattleCountdown(roomId);
  io.to(roomId).emit("roomState", sanitizeRoom(room));
}

function maybeEnsureAiBattleRound(roomId) {
  const room = rooms.get(roomId);
  if (!room || !isAiBattleRoom(room)) return;
  if (room.battle.aiHost?.mode !== "auto") return;
  if (room.battle.started) return;

  const active = getActivePlayerIds(room);
  let touched = false;

  if (active.length === 0) {
    if (room.battle.countdownEndsAt || room.battle.deadline) {
      clearAiBattleTimers(room);
      room.battle.deadline = null;
      room.battle.countdownEndsAt = null;
      touched = true;
    }
    if (touched) {
      io.to(roomId).emit("roomState", sanitizeRoom(room));
    }
    return;
  }

  if (room.battle.pendingStart) {
    room.battle.pendingStart = false;
    if (room.battle.aiHost) room.battle.aiHost.pendingStart = false;
    touched = true;
  }

  if (!room.battle.countdownEndsAt && !room._aiBattleCountdownTimer) {
    scheduleAiBattleCountdown(roomId);
    touched = true;
  }

  if (touched) {
    io.to(roomId).emit("roomState", sanitizeRoom(room));
  }
}

// ---------- HTTP + Socket.IO (same server) ----------
const httpServer = createServer(app);
// const io = new Server(httpServer, { cors: corsOptions });
const io = new Server(httpServer, {
  cors: {
    origin: evaluateCorsOrigin,
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingInterval: 10000, // send pings every 10s
  pingTimeout: 30000, // allow 30s before declaring dead
  allowEIO3: true, // helps older clients/proxies
  perMessageDeflate: false, // avoid proxy compression issues
});
ioRef = io;

// ---------- Socket authentication middleware ----------
io.use(authenticateSocket);

// ---------- Socket helpers ----------

async function getSocketProfileData(socket) {
  if (!socket.userId) return {};
  try {
    const u = await prisma.user.findUnique({
      where: { id: socket.userId },
      select: { profileAvatar: true, profileColour: true },
    });
    return { profileAvatar: u?.profileAvatar || null, profileColour: u?.profileColour || null };
  } catch {
    return {};
  }
}

// ---------- Socket handlers ----------
io.on("connection", (socket) => {
  socket.on("syncRoom", ({ roomId }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ ok: false, error: "Room not found" });
    socket.join(roomId);
    cb?.({ ok: true, state: sanitizeRoom(room) });
  });

  socket.on("createRoom", async ({ name, mode = "duel", playerId }, cb) => {
    if (!checkSocketRateLimit(socket.id, "createRoom", 5)) {
      return cb?.({ error: "Too many rooms created. Slow down!" });
    }
    const sanitizedName = sanitizePlayerName(name);
    if (!sanitizedName || !isSafeInput(sanitizedName)) {
      return cb?.({ error: "Invalid name" });
    }

    const id = Math.random().toString(36).slice(2, 8).toUpperCase();
    const normalizedMode = normalizeMode(mode);
    const stablePlayerId = normalizePlayerId(playerId) || socket.id;
    const initialHostId = normalizedMode === "battle_ai" ? null : stablePlayerId;
    const now = Date.now();
    const room = {
      id,
      mode: normalizedMode,
      hostId: initialHostId,
      players: {},
      started: false,
      winner: null,
      duelReveal: undefined,
      duelDeadline: null,
      roundClosed: false,
      createdAt: now,
      updatedAt: now,
    };

    duelMode.initDuelRoom(room);
    sharedMode.initSharedRoom(room, { pickRandomWords });
    battleMode.initBattleRoom(room);
    if (normalizedMode === "battle_ai") {
      room.hostId = null;
      room.battle.pendingStart = false;
      room.battle.aiHost = {
        mode: "auto",
        claimedBy: null,
        pendingStart: false,
      };
    }

    const profile = await getSocketProfileData(socket);
    room.players[stablePlayerId] = {
      playerId: stablePlayerId,
      socketId: socket.id,
      name: sanitizedName,
      ready: false,
      secret: null,
      guesses: [],
      done: false,
      wins: 0,
      streak: 0,
      disconnected: false,
      rematchRequested: false,
      disconnectedAt: null,
      ...profile,
    };

    rooms.set(id, room);
    socket.join(id);
    if (normalizedMode === "battle_ai") {
      scheduleAiBattleCountdown(id);
    }
    cb?.({ roomId: id });
    io.to(id).emit("roomState", sanitizeRoom(room));
  });

  socket.on("joinRoom", async ({ name, roomId, playerId }, cb) => {
    if (!checkSocketRateLimit(socket.id, "joinRoom", 10)) {
      return cb?.({ error: "Too many join attempts. Slow down!" });
    }
    const sanitizedRoomId = sanitizeRoomId(roomId);
    const sanitizedName = sanitizePlayerName(name);

    if (!sanitizedRoomId) {
      return cb?.({ error: "Invalid room ID" });
    }
    if (!sanitizedName || !isSafeInput(sanitizedName)) {
      return cb?.({ error: "Invalid name" });
    }

    const room = rooms.get(sanitizedRoomId);
    if (!room) return cb?.({ error: "Room not found" });

    const stablePlayerId = normalizePlayerId(playerId);
    const knownPlayerId =
      stablePlayerId && room.players[stablePlayerId] ? stablePlayerId : null;
    const oldId = Object.keys(room.players).find(
      (pid) =>
        (room.players[pid].name || "").trim().toLowerCase() ===
          sanitizedName.trim().toLowerCase() && room.players[pid].disconnected
    );

    if (knownPlayerId || oldId) {
      const sourceId = knownPlayerId || oldId;
      const targetId = stablePlayerId || sourceId;
      const oldPlayer = room.players[sourceId];
      clearPendingDisconnect(sanitizedRoomId, sourceId);
      clearPendingDisconnect(sanitizedRoomId, targetId);
      room.players[targetId] = {
        ...oldPlayer,
        playerId: targetId,
        socketId: socket.id,
        disconnected: false,
        disconnectedAt: null,
      };
      if (sourceId !== targetId) {
        replacePlayerReferences(room, sourceId, targetId);
        delete room.players[sourceId];
      }
      room.updatedAt = Date.now();

      socket.join(sanitizedRoomId);
      io.to(sanitizedRoomId).emit("roomState", sanitizeRoom(room));
      if (room.mode === "battle_ai") {
        maybeEnsureAiBattleRound(sanitizedRoomId);
        if (room.meta?.isEvent && isAiBattleEventActive()) {
          ensureAiBattleEventRoom();
        }
      }
      return cb?.({ ok: true, resumed: true, mode: room.mode });
    }

    if (room.mode === "duel") {
      const allowDuel = duelMode.canJoinDuel(room);
      if (allowDuel?.error) return cb?.(allowDuel);
    }
    if (room.mode === "shared") {
      const allowShared = sharedMode.canJoinShared(room);
      if (allowShared?.error) return cb?.(allowShared);
    }

    const joinProfile = await getSocketProfileData(socket);
    const newPlayerId = stablePlayerId || socket.id;
    clearPendingDisconnect(sanitizedRoomId, newPlayerId);
    room.players[newPlayerId] = {
      playerId: newPlayerId,
      socketId: socket.id,
      name: sanitizedName,
      ready: false,
      secret: null,
      guesses: [],
      done: false,
      wins: 0,
      streak: 0,
      disconnected: false,
      rematchRequested: false,
      disconnectedAt: null,
      ...joinProfile,
    };
    room.updatedAt = Date.now();

    socket.join(sanitizedRoomId);
    cb?.({ ok: true, resumed: false, mode: room.mode });
    io.to(sanitizedRoomId).emit("roomState", sanitizeRoom(room));
    if (room.mode === "battle_ai") {
      maybeEnsureAiBattleRound(sanitizedRoomId);
      if (room.meta?.isEvent && isAiBattleEventActive()) {
        ensureAiBattleEventRoom();
      }
    }
  });

  socket.on("setSecret", ({ roomId, secret }, cb) => {
    // Sanitize inputs
    const sanitizedRoomId = sanitizeRoomId(roomId);
    const sanitizedSecret = sanitizeWord(secret);

    if (!sanitizedRoomId) {
      return cb?.({ error: "Invalid room ID" });
    }
    if (!sanitizedSecret || sanitizedSecret.length !== 5) {
      return cb?.({ error: "Invalid secret word" });
    }

    const room = rooms.get(sanitizedRoomId);
    if (!room) return cb?.({ error: "Room not found" });
    if (room.mode !== "duel") return cb?.({ error: "Wrong mode" });
    const actorId = getPlayerIdBySocket(room, socket.id);
    if (!actorId) return cb?.({ error: "Player not in room" });

    const result = duelMode.handleSetSecret({
      room,
      socketId: actorId,
      secret: sanitizedSecret, // Use sanitized secret
      isValidWord: isValidWordLocal,
    });
    if (result?.error) return cb?.(result);

    if (result?.started) {
      const startResult = duelMode.startDuelRound({
        room,
        roundMs: ROUND_MS,
        scheduleTimeout: () =>
          setTimeout(() => handleDuelTimeout(sanitizedRoomId), ROUND_MS),
      });
      if (startResult?.error) return cb?.(startResult);
    }

    io.to(sanitizedRoomId).emit("roomState", sanitizeRoom(room));
    cb?.({ ok: true });
  });

  socket.on("makeGuess", ({ roomId, guess }, cb) => {
    if (!checkSocketRateLimit(socket.id, "makeGuess", 10)) {
      return cb?.({ error: "Too many guesses. Slow down!" });
    }
    // Sanitize inputs
    const sanitizedRoomId = sanitizeRoomId(roomId);
    const sanitizedGuess = sanitizeWord(guess);

    if (!sanitizedRoomId) {
      return cb?.({ error: "Invalid room ID" });
    }
    if (!sanitizedGuess || sanitizedGuess.length !== 5) {
      return cb?.({ error: "Invalid guess" });
    }

    const room = rooms.get(sanitizedRoomId);
    if (!room) return cb?.({ error: "Room not found" });
    const actorId = getPlayerIdBySocket(room, socket.id);
    if (!actorId) return cb?.({ error: "Player not in room" });

    if (!isValidWordLocal(sanitizedGuess)) {
      return cb?.({ error: "Invalid word" });
    }

    if (room.mode === "duel") {
      const result = duelMode.handleDuelGuess({
        room,
        socketId: actorId,
        guess: sanitizedGuess, // Use sanitized guess
        scoreGuess,
        updateStatsOnWin,
        getOpponent,
      });
      if (result?.error) return cb?.(result);
      if (result?.roundEnded) duelMode.clearDuelTimer(room);
      io.to(sanitizedRoomId).emit("roomState", sanitizeRoom(room));
      return cb?.({ ok: true, pattern: result?.pattern });
    }

    if (room.mode === "shared") {
      const result = sharedMode.handleSharedGuess({
        room,
        socketId: actorId,
        guess: sanitizedGuess, // Use sanitized guess
        scoreGuess,
        updateStatsOnWin,
        getOpponent,
      });
      if (result?.error) return cb?.(result);
      io.to(sanitizedRoomId).emit("roomState", sanitizeRoom(room));
      return cb?.({ ok: true, pattern: result?.pattern });
    }

    if (room.mode === "battle" || room.mode === "battle_ai") {
      const result = battleMode.handleBattleGuess({
        room,
        socketId: actorId,
        guess: sanitizedGuess, // Use sanitized guess
        scoreGuess,
        updateStatsOnWin,
      });
      if (result?.error) return cb?.(result);
      if (room.mode === "battle_ai" && result?.ended) {
        if (room._aiBattleRoundTimer) {
          clearTimeout(room._aiBattleRoundTimer);
          room._aiBattleRoundTimer = null;
        }
        room.battle.deadline = null;
        if (room.battle.aiHost?.mode === "player") {
          room.battle.aiHost = { mode: "auto", claimedBy: null, pendingStart: false };
          room.hostId = room.meta?.isEvent ? "server" : null;
          room.hostConnected = room.meta?.isEvent ? true : false;
        }
        scheduleAiBattleCountdown(sanitizedRoomId);
      }
      io.to(sanitizedRoomId).emit("roomState", sanitizeRoom(room));
      return cb?.({ ok: true, pattern: result?.pattern });
    }

    return cb?.({ error: "Unsupported mode" });
  });

  socket.on("duelPlayAgain", ({ roomId }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ error: "Room not found" });
    if (room.mode !== "duel" && room.mode !== "shared")
      return cb?.({ error: "Wrong mode" });

    const actorId = getPlayerIdBySocket(room, socket.id);
    if (actorId && room.players[actorId]) {
      room.players[actorId].rematchRequested = true;
    }

    const playerIds = Object.keys(room.players);
    const bothRequested =
      playerIds.length > 0 &&
      playerIds.every((pid) => room.players[pid].rematchRequested);

    if (bothRequested) {
      Object.values(room.players).forEach((p) => {
        p.guesses = [];
        p.done = false;
        p.ready = false;
        p.secret = null;
        p.rematchRequested = false;
      });
      room.started = false;
      room.winner = null;
      room.duelReveal = undefined;
      room.duelDeadline = null;
      room.roundClosed = false;

      if (room._duelTimer) {
        clearTimeout(room._duelTimer);
        room._duelTimer = null;
      }

      if (room.mode === "duel") {
        duelMode.resetDuelRound(room);
      } else {
        sharedMode.resetSharedRound(room);
      }
    }

    io.to(roomId).emit("roomState", sanitizeRoom(room));
    cb?.({ ok: true, bothRequested });
  });

  socket.on("startShared", ({ roomId }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ error: "Room not found" });
    if (room.mode !== "shared")
      return cb?.({ error: "Room not found or wrong mode" });

    const result = sharedMode.startSharedRound({
      room,
      socketId: getPlayerIdBySocket(room, socket.id),
      pickRandomWords,
    });
    if (result?.error) return cb?.(result);

    io.to(roomId).emit("roomState", sanitizeRoom(room));
    cb?.({ ok: true });
  });

  socket.on("setHostWord", ({ roomId, secret }, cb) => {
    // Sanitize inputs
    const sanitizedRoomId = sanitizeRoomId(roomId);
    const sanitizedSecret = sanitizeWord(secret);

    if (!sanitizedRoomId) {
      return cb?.({ error: "Invalid room ID" });
    }
    if (!sanitizedSecret || sanitizedSecret.length !== 5) {
      return cb?.({ error: "Invalid word" });
    }

    const room = rooms.get(sanitizedRoomId);
    if (!room) return cb?.({ error: "Room not found" });
    if (room.mode !== "battle" && room.mode !== "battle_ai") {
      return cb?.({ error: "Wrong mode" });
    }
    if (room.mode === "battle_ai") {
      if (room.battle?.aiHost?.mode !== "player") {
        return cb?.({ error: "AI host is active" });
      }
    }
    const actorId = getPlayerIdBySocket(room, socket.id);
    if (actorId !== room.hostId)
      return cb?.({ error: "Only host can set word" });

    const result = battleMode.setHostWord({
      room,
      secret: sanitizedSecret,
      validateWord: isValidWordLocal,
    });
    if (result?.error) return cb?.(result);

    if (room.mode === "battle_ai") {
      clearAiBattleTimers(room);
      room.battle.countdownEndsAt = null;
    }

    io.to(sanitizedRoomId).emit("roomState", sanitizeRoom(room));
    cb?.({ ok: true });
  });

  socket.on("startBattle", ({ roomId }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ error: "Room not found" });
    if (room.mode !== "battle" && room.mode !== "battle_ai") {
      return cb?.({ error: "Wrong mode" });
    }
    if (room.mode === "battle_ai" && room.battle?.aiHost?.mode !== "player") {
      return cb?.({ error: "AI host is active" });
    }
    const actorId = getPlayerIdBySocket(room, socket.id);
    if (actorId !== room.hostId)
      return cb?.({ error: "Only host can start" });

    const result = battleMode.startBattleRound({ room });
    if (result?.error) return cb?.(result);

    if (room.mode === "battle_ai") {
      room.battle.lastRevealedWord = null;
      room.battle.countdownEndsAt = null;
      room.battle.deadline = Date.now() + ROUND_MS;
      if (room._aiBattleRoundTimer) {
        clearTimeout(room._aiBattleRoundTimer);
      }
      room._aiBattleRoundTimer = setTimeout(() => {
        handleAiBattleTimeout(roomId);
      }, ROUND_MS);
    }

    io.to(roomId).emit("roomState", sanitizeRoom(room));
    cb?.({ ok: true });
  });

  socket.on("aiBattleClaimHost", ({ roomId }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ error: "Room not found" });
    if (room.mode !== "battle_ai") return cb?.({ error: "Wrong mode" });
    if (room.battle?.aiHost?.mode === "player") {
      return cb?.({ error: "Host already claimed" });
    }
    if (room.battle?.started) {
      return cb?.({ error: "Wait for the round to finish first" });
    }
    const actorId = getPlayerIdBySocket(room, socket.id);
    const player = actorId ? room.players[actorId] : null;
    if (!player || player.disconnected) {
      return cb?.({ error: "Not in room" });
    }

    clearAiBattleTimers(room);
    battleMode.resetBattleRound(room);
    room.battle.secret = null;
    room.battle.lastRevealedWord = null;
    room.battle.aiHost = {
      mode: "player",
      claimedBy: actorId,
      pendingStart: false,
    };
    room.hostId = actorId;
    room.battle.countdownEndsAt = null;
    room.battle.deadline = null;
    room.battle.pendingStart = false;
    room.updatedAt = Date.now();
    io.to(roomId).emit("roomState", sanitizeRoom(room));
    cb?.({ ok: true });
  });

  socket.on("aiBattleReleaseHost", ({ roomId }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ error: "Room not found" });
    if (room.mode !== "battle_ai") return cb?.({ error: "Wrong mode" });
    if (room.battle?.aiHost?.mode !== "player") {
      return cb?.({ error: "No player host to release" });
    }
    const actorId = getPlayerIdBySocket(room, socket.id);
    if (room.battle.aiHost.claimedBy !== actorId) {
      return cb?.({ error: "Only the claimed host can release" });
    }
    if (room.battle?.started) {
      return cb?.({ error: "Wait for the round to finish first" });
    }

    clearAiBattleTimers(room);
    battleMode.resetBattleRound(room);
    room.battle.secret = null;
    room.battle.lastRevealedWord = null;
    room.battle.aiHost = { mode: "auto", claimedBy: null, pendingStart: false };
    if (room.meta?.isEvent) {
      room.hostId = "server";
      room.hostConnected = true;
    } else {
      room.hostId = null;
      room.hostConnected = false;
    }
    room.battle.countdownEndsAt = null;
    room.battle.deadline = null;
    room.battle.pendingStart = false;
    room.updatedAt = Date.now();
    io.to(roomId).emit("roomState", sanitizeRoom(room));
    maybeEnsureAiBattleRound(roomId);
    cb?.({ ok: true });
  });

  socket.on("playAgain", ({ roomId }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ error: "Room not found" });
    if (room.mode !== "battle" && room.mode !== "battle_ai") {
      return cb?.({ error: "Wrong mode" });
    }
    if (room.mode === "battle_ai" && room.battle?.aiHost?.mode !== "player") {
      return cb?.({ error: "AI host is active" });
    }
    const actorId = getPlayerIdBySocket(room, socket.id);
    if (actorId !== room.hostId)
      return cb?.({ error: "Only host can reset" });

    battleMode.resetBattleRound(room);
    if (room.mode === "battle_ai") {
      room.battle.secret = null;
      room.battle.lastRevealedWord = null;
      room.battle.deadline = null;
      room.battle.countdownEndsAt = null;
      clearAiBattleTimers(room);
    }
    io.to(roomId).emit("roomState", sanitizeRoom(room));
    cb?.({ ok: true });
  });

  socket.on("aiBattleStart", ({ roomId }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ error: "Room not found" });
    if (room.mode !== "battle_ai") return cb?.({ error: "Wrong mode" });
    if (room.battle.started) return cb?.({ error: "Round already running" });
    if (room.battle.aiHost?.mode !== "auto") {
      return cb?.({ error: "AI host not active" });
    }

    const active = getActivePlayerIds(room);
    if (active.length === 0) return cb?.({ error: "No active players" });

    const started = autoStartAiBattleRound(roomId);
    if (!started?.ok) {
      room.battle.pendingStart = true;
      if (room.battle.aiHost) room.battle.aiHost.pendingStart = true;
      io.to(roomId).emit("roomState", sanitizeRoom(room));
      return cb?.({
        error: started?.error || "Unable to start round",
      });
    }
    cb?.(started);
  });

  socket.on("resume", ({ roomId, oldId, playerId }, cb) => {
    const sanitizedRoomId = sanitizeRoomId(
      typeof roomId === "string" ? roomId : roomId != null ? String(roomId) : "",
    );
    if (!sanitizedRoomId) {
      return resumeError(cb, "Invalid room ID", "INVALID_ROOM_ID");
    }

    const room = rooms.get(sanitizedRoomId);
    if (!room) {
      return resumeError(cb, "Room not found", "ROOM_NOT_FOUND");
    }

    let stablePlayerId = null;
    const rawPlayerId = playerId;
    if (
      rawPlayerId !== undefined &&
      rawPlayerId !== null &&
      String(rawPlayerId).trim() !== ""
    ) {
      const trimmed = String(rawPlayerId).trim();
      if (!isValidUuidPlayerId(trimmed)) {
        return resumeError(cb, "Invalid player id", "INVALID_PLAYER_ID");
      }
      stablePlayerId = trimmed;
    }

    if (!config.isTest && stablePlayerId && !socket.userId) {
      return resumeError(
        cb,
        "Authentication required to resume",
        "AUTH_REQUIRED",
      );
    }

    let sourceId = null;
    if (stablePlayerId && room.players[stablePlayerId]) {
      sourceId = stablePlayerId;
    } else if (oldId && room.players[oldId]) {
      sourceId = oldId;
    } else if (oldId) {
      sourceId = Object.keys(room.players).find(
        (pid) => room.players[pid]?.socketId === oldId,
      );
    }
    if (!sourceId) {
      return resumeError(cb, "Old session not found", "SESSION_NOT_FOUND");
    }

    const candidate = room.players[sourceId];
    if (!candidate) {
      return resumeError(cb, "Old session not found", "SESSION_NOT_FOUND");
    }

    if (!candidate.disconnected) {
      return resumeError(
        cb,
        "Player session is still active",
        "NOT_DISCONNECTED",
      );
    }

    if (
      candidate.disconnected &&
      typeof candidate.disconnectedAt === "number" &&
      Date.now() - candidate.disconnectedAt > RESUME_MAX_DISCONNECT_MS
    ) {
      return resumeError(
        cb,
        "Reconnect window expired; join the room again",
        "RESUME_EXPIRED",
      );
    }

    if (stablePlayerId && candidate.playerId && candidate.playerId !== stablePlayerId) {
      return resumeError(
        cb,
        "Player id does not match this seat",
        "PLAYER_MISMATCH",
      );
    }

    const targetId = stablePlayerId || sourceId;
    clearPendingDisconnect(sanitizedRoomId, sourceId);
    clearPendingDisconnect(sanitizedRoomId, targetId);
    room.players[targetId] = {
      ...room.players[sourceId],
      playerId: targetId,
      socketId: socket.id,
      disconnected: false,
      disconnectedAt: null,
    };
    if (sourceId !== targetId) {
      replacePlayerReferences(room, sourceId, targetId);
      delete room.players[sourceId];
    }
    room.updatedAt = Date.now();

    socket.join(sanitizedRoomId);
    io.to(sanitizedRoomId).emit("roomState", sanitizeRoom(room));
    if (room.mode === "battle_ai") {
      maybeEnsureAiBattleRound(sanitizedRoomId);
    }
    cb?.({ ok: true, mode: room.mode });
  });

  socket.on("leaveRoom", ({ roomId } = {}, cb) => {
    const now = Date.now();
    let handled = false;

    for (const [id, room] of rooms) {
      if (roomId && id !== roomId) continue;
      const playerId = getPlayerIdBySocket(room, socket.id);
      const player = playerId ? room.players[playerId] : null;
      if (!player) continue;
      clearPendingDisconnect(id, playerId);

      if (!player.disconnected) {
        player.disconnected = true;
        player.disconnectedAt = now;
        sharedMode.handleSharedDisconnect(room, playerId);

        if (room.hostId === playerId) {
          if (room.mode === "battle_ai") {
            if (room.meta?.isEvent) {
              room.hostId = "server";
              room.hostConnected = true;
            } else {
              room.hostId = null;
              room.hostConnected = false;
            }
            if (room.battle?.aiHost) {
              room.battle.aiHost.mode = "auto";
              room.battle.aiHost.claimedBy = null;
            }
          } else {
            const replacement = Object.keys(room.players).find(
              (pid) => pid !== playerId && !room.players[pid].disconnected
            );
            if (replacement) {
              room.hostId = replacement;
            }
          }
        }
      }

      room.updatedAt = now;
      socket.leave(id);
      io.to(id).emit("roomState", sanitizeRoom(room));

      if (room.mode === "battle_ai") {
        const active = getActivePlayerIds(room);
        if (active.length === 0) {
          clearAiBattleTimers(room);
          room.battle.deadline = null;
          room.battle.countdownEndsAt = null;
          battleMode.resetBattleRound(room);
          room.battle.secret = null;
          room.battle.lastRevealedWord = null;
          if (room.meta?.isEvent && isAiBattleEventActive()) {
            ensureAiBattleEventRoom();
          }
        } else if (
          room.battle.aiHost?.mode === "auto" &&
          !room.battle.started &&
          !room.battle.countdownEndsAt
        ) {
          maybeEnsureAiBattleRound(id);
        }
      }

      handled = true;
    }

    cb?.({ ok: handled });
  });

  socket.on("disconnect", () => {
    clearSocketRateLimits(socket.id);
    for (const [id, room] of rooms) {
      const playerId = getPlayerIdBySocket(room, socket.id);
      const player = playerId ? room.players[playerId] : null;
      if (!player) continue;
      // Hold a short grace window before marking disconnected to avoid
      // brief network blips causing immediate failover.
      scheduleDisconnectMark(id, playerId);
    }
  });
});

const DISCONNECT_TTL_MS = 30 * 60 * 1000;

const startRoomCleanupInterval = () =>
  setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of rooms.entries()) {
      if (room.meta?.isEvent && isAiBattleEventActive()) {
        continue;
      }
      let updated = false;
      for (const pid of Object.keys(room.players)) {
        const player = room.players[pid];
        if (
          player.disconnected &&
          player.disconnectedAt &&
          now - player.disconnectedAt > DISCONNECT_TTL_MS
        ) {
          if (room.hostId === pid) {
            if (room.mode === "battle_ai") {
              room.hostId = null;
              room.hostConnected = false;
              if (room.battle?.aiHost) {
                room.battle.aiHost.mode = "auto";
                room.battle.aiHost.claimedBy = null;
              }
            } else {
              const next = Object.keys(room.players).find(
                (id) => !room.players[id].disconnected && id !== pid
              );
              if (next) room.hostId = next;
            }
          }
          if (room.battle?.aiHost?.claimedBy === pid) {
            room.battle.aiHost.claimedBy = null;
            if (room.mode === "battle_ai") {
              room.battle.aiHost.mode = "auto";
            }
          }
          clearPendingDisconnect(roomId, pid);
          delete room.players[pid];
          updated = true;
        }
      }

      if (updated) {
        room.updatedAt = now;
      }

      const activeIds = Object.keys(room.players).filter(
        (pid) => !room.players[pid].disconnected
      );
      const hostPlayer = room.players[room.hostId];

      if (activeIds.length === 0) {
        if (room.mode === "battle_ai") {
          clearAiBattleTimers(room);
          battleMode.resetBattleRound(room);
          room.battle.secret = null;
          room.battle.lastRevealedWord = null;
          room.battle.deadline = null;
          room.battle.countdownEndsAt = null;
        } else if (room.mode === "duel" || room.mode === "shared") {
          // Clean up duel timers before deleting room
          duelMode.clearDuelTimer(room);
        }
        const oldestDisconnect = Math.min(
          ...Object.values(room.players).map((p) =>
            typeof p.disconnectedAt === "number" ? p.disconnectedAt : Infinity
          )
        );
        if (
          !hostPlayer ||
          !hostPlayer.disconnectedAt ||
          now - hostPlayer.disconnectedAt > HOST_DISCONNECT_GRACE_MS ||
          now - oldestDisconnect > HOST_DISCONNECT_GRACE_MS
        ) {
          for (const pid of Object.keys(room.players)) {
            clearPendingDisconnect(roomId, pid);
          }
          rooms.delete(roomId);
        }
        continue;
      }

      if (
        (!hostPlayer || hostPlayer.disconnected) &&
        room.mode !== "battle_ai"
      ) {
        const nextHost = activeIds[0];
        if (nextHost) {
          room.hostId = nextHost;
          room.updatedAt = now;
        }
      }
      if (
        room.mode === "battle_ai" &&
        room.battle.aiHost?.mode === "auto" &&
        !room.battle.started &&
        !room.battle.countdownEndsAt
      ) {
        maybeEnsureAiBattleRound(roomId);
      }
    }
  }, 5 * 60 * 1000);

const roomCleanupInterval =
  !config.isTest ? startRoomCleanupInterval() : null;

const aiBattleEventInterval =
  isAiBattleEventActive() && !config.isTest
    ? setInterval(() => ensureAiBattleEventRoom(), AI_BATTLE_EVENT_INTERVAL_MS)
    : null;

if (isAiBattleEventActive()) {
  ensureAiBattleEventRoom();
}
// ---------- Helpers ----------
function getOpponent(room, socketId) {
  return Object.keys(room.players).find((id) => id !== socketId);
}

function sanitizeRoom(room) {
  const players = Object.fromEntries(
    Object.entries(room.players).map(([id, p]) => {
      const {
        name,
        ready,
        guesses,
        done,
        wins = 0,
        streak = 0,
        disconnected = false,
        rematchRequested = false,
        profileAvatar = null,
        profileColour = null,
      } = p;
      return [
        id,
        {
          id,
          name,
          ready,
          guesses,
          done,
          wins,
          streak,
          disconnected,
          rematchRequested,
          profileAvatar,
          profileColour,
        },
      ];
    })
  );

  const battleSnapshot = battleMode.sanitizeBattle(room);
  if (
    battleSnapshot &&
    !battleSnapshot.lastRevealedWord &&
    !room.battle.started &&
    room.roundClosed &&
    room.battle.secret
  ) {
    battleSnapshot.lastRevealedWord = room.battle.secret;
  }

  const sharedSnapshot = sharedMode.sanitizeShared(room);

  return {
    id: room.id,
    mode: room.mode,
    hostId: room.hostId,
    players,
    started: room.started,
    winner: room.winner,
    duelReveal: room.duelReveal || undefined,
    duelDeadline: room.duelDeadline ?? null,
    battle: battleSnapshot,
    shared: sharedSnapshot,
  };
}

// ---------- CORS rejection handler ----------
app.use((err, req, res, next) => {
  if (err.message && err.message.startsWith("CORS:")) {
    console.warn(`CORS rejected: ${req.headers.origin}`);
    if (Sentry.isInitialized()) {
      Sentry.captureMessage(err.message, {
        level: "warning",
        extra: { origin: req.headers.origin, url: req.url },
      });
    }
    res.status(403).json({ error: "Origin not allowed" });
    return;
  }
  next(err);
});

// ---------- Sentry error handler (must be before other error handlers) ----------
if (config.sentryDsn) {
  Sentry.setupExpressErrorHandler(app);
}

// ---------- Catch-all route for client-side routing (production only) ----------
if (config.isProduction) {
  app.get("*", (req, res) => {
    const clientDistPath = path.join(__dirname, "..", "client", "dist");
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

// ---------- Start server ----------
const PORT = config.port;

if (!config.isTest) {
  try {
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`Server listening on ${PORT}`);
      console.log(`Word lists loaded: ${WORDSET.size} solutions, ${GUESSSET.size} total guesses`);
      startSessionCleanup();
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

export { httpServer };
