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
  getUserDailyStats
} from "./daily-db.js";
import { setupAuth, getUserIdFromRequest } from "./auth.js";
import { getFullUserProfile } from "./mergeService.js";
import createAdminEventsRouter from "./admin/events.js";

// ---------- Word list loader (.txt) ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORDLIST_PATH =
  process.env.WORDLIST_PATH || path.join(__dirname, "words.txt");
const GUESSES_PATH =
  process.env.GUESSES_PATH || path.join(__dirname, "allowed_guesses.txt");

let WORDS = [];
let WORDSET = new Set();
let GUESSES = [];
let GUESSSET = new Set();
const DEFAULT_ROUND_MS = 6 * 60 * 1000; // 6 minutes
const envRoundMs = Number(process.env.DUEL_ROUND_MS);
const ROUND_MS =
  Number.isFinite(envRoundMs) && envRoundMs > 0
    ? Math.min(envRoundMs, DEFAULT_ROUND_MS)
    : DEFAULT_ROUND_MS;
const AI_BATTLE_COUNTDOWN_MS = 12 * 1000; // 12 seconds between AI-hosted rounds

function loadWordFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return raw
    .split(/\r?\n/)
    .map((w) => w.trim())
    .filter(Boolean)
    .map((w) => w.toUpperCase())
    .filter((w) => /^[A-Z]{5}$/.test(w));
}

function loadWords() {
  if (!fs.existsSync(WORDLIST_PATH)) {
    throw new Error(`Word list file not found at ${WORDLIST_PATH}`);
  }

  WORDS = Array.from(new Set(loadWordFile(WORDLIST_PATH)));
  WORDSET = new Set(WORDS);

  const hasGuessFile = fs.existsSync(GUESSES_PATH);
  const guessWords = hasGuessFile ? loadWordFile(GUESSES_PATH) : WORDS;

  GUESSES = Array.from(new Set([...guessWords, ...WORDS]));
  GUESSSET = new Set(GUESSES);

  console.log(`[words] Loaded ${WORDS.length} solutions from ${WORDLIST_PATH}`);
  if (hasGuessFile) {
    console.log(
      `[words] Loaded ${guessWords.length} allowed guesses from ${GUESSES_PATH}`
    );
  } else {
    console.warn(
      `[words] Guess list not found at ${GUESSES_PATH}; using solution list for validation`
    );
  }
}
loadWords();

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

// Helper to pick N random words from WORDS
function pickRandomWords(n) {
  const out = [];
  const pool = [...WORDS];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

function isValidWordLocal(word) {
  if (!word) return false;
  const w = word.toUpperCase();
  return /^[A-Z]{5}$/.test(w) && GUESSSET.has(w);
}

// ---------- Express app ----------
const app = express();
export { app };

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const normalizeOrigin = (value) => {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const getHostname = (value) => {
  if (!value) return null;
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
};

const allowedOrigins = (() => {
  const origins = new Set(
    DEFAULT_ALLOWED_ORIGINS.map(normalizeOrigin).filter(Boolean)
  );

  const baseOrigin = normalizeOrigin(process.env.BASE_URL);
  if (baseOrigin) {
    origins.add(baseOrigin);
  }

  const extraOrigins =
    process.env.CORS_ALLOWED_ORIGINS?.split(",") ?? [];
  for (const origin of extraOrigins) {
    const normalized = normalizeOrigin(origin.trim());
    if (normalized) {
      origins.add(normalized);
    }
  }

  return Array.from(origins);
})();

const allowedOriginSet = new Set(allowedOrigins);
const allowedOriginSuffixes =
  process.env.CORS_ALLOWED_ORIGIN_SUFFIXES?.split(",")
    .map((suffix) => suffix.trim())
    .filter(Boolean) ?? [];

const hostnameMatchesSuffix = (hostname, suffix) => {
  if (!hostname || !suffix) return false;
  const normalizedHostname = hostname.toLowerCase();
  const cleanedSuffix = suffix
    .toLowerCase()
    .replace(/^\*\./, "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .replace(/^\./, "");

  return (
    normalizedHostname === cleanedSuffix ||
    normalizedHostname.endsWith(`.${cleanedSuffix}`)
  );
};

const isOriginAllowed = (origin) => {
  if (!origin) return false;
  if (allowedOriginSet.has(origin)) {
    return true;
  }

  const hostname = getHostname(origin);
  return allowedOriginSuffixes.some((suffix) =>
    hostnameMatchesSuffix(hostname, suffix)
  );
};

const evaluateCorsOrigin = (origin, cb) => {
  if (!origin) {
    return cb(null, true);
  }

  const normalizedOrigin = normalizeOrigin(origin);
  if (normalizedOrigin && isOriginAllowed(normalizedOrigin)) {
    return cb(null, true);
  }

  return cb(new Error(`Origin ${origin} not allowed by CORS`));
};

const corsOptions = {
  origin: evaluateCorsOrigin,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

const shouldSetupAuth =
  process.env.NODE_ENV !== "test" &&
  process.env.SKIP_AUTH_SETUP !== "true";

if (shouldSetupAuth) {
  await setupAuth(app);
}

// Serve static files from client build in production
if (process.env.NODE_ENV === "production") {
  const clientDistPath = path.join(__dirname, "..", "client", "dist");
  app.use(express.static(clientDistPath));
} else {
  // In development, show helpful page with link to frontend
  app.get("/", (_req, res) => {
    const replitDomain = process.env.REPLIT_DEV_DOMAIN;
    const frontendUrl = replitDomain 
      ? `https://5000--${replitDomain}`
      : "http://localhost:5000";
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>WordlePlus Backend</title>
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
          <h1>🎮 WordlePlus Backend API</h1>
          <p>You've reached the backend API server. The WordlePlus game frontend is running on a different port.</p>
          <p><strong>Click the button below to access the game:</strong></p>
          <a href="${frontendUrl}" class="button">Open WordlePlus Game →</a>
          <p style="margin-top: 30px; font-size: 14px; color: #999;">Backend API running on port 8080 | Frontend on port 5000</p>
        </div>
      </body>
      </html>
    `);
  });
}

// Health + validate
app.get("/health", (_req, res) => res.json({ ok: true }));
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
    console.log("[GET /api/daily] Response:", { userId, gameOver, won, word: responseData.word, guessCount: guesses.length });
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
    
    if (!guess || typeof guess !== 'string') {
      return res.status(400).json({ error: "Invalid guess" });
    }
    
    const guessUpper = guess.toUpperCase();
    
    if (!isValidWordLocal(guessUpper)) {
      return res.status(400).json({ error: "Not a valid word" });
    }
    
    // Always create or get user record to ensure userId exists in database
    const user = await getOrCreateAnonymousUser(existingUserId);
    const userId = user.id;
    await ensureAnonymousSession(req, userId);
    
    const puzzle = await getTodaysPuzzle();
    const existingResult = await getUserDailyResult(userId, puzzle.id);
    
    const guesses = existingResult?.guesses || [];
    const patterns = existingResult?.patterns || [];
    const gameOver = existingResult?.completed || false;
    
    console.log("[Daily Guess - Load Existing]", {
      userId,
      puzzleId: puzzle.id,
      hasExistingResult: !!existingResult,
      existingGuessCount: guesses.length,
      existingGuesses: guesses
    });
    
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
    
    const won = pattern.every(state => state === 'green' || state === 'correct');
    const outOfGuesses = newGuesses.length >= MAX_DAILY_GUESSES;
    const completed = won || outOfGuesses;
    
    console.log("[Daily Guess Logic]", {
      guessCount: newGuesses.length,
      maxGuesses: MAX_DAILY_GUESSES,
      outOfGuesses,
      won,
      completed,
      puzzleWord: puzzle.word
    });
    
    const savedResult = await createOrUpdateDailyResult(userId, puzzle.id, {
      guesses: newGuesses,
      patterns: newPatterns,
      won,
      completed
    });
    
    console.log("[Daily Result Saved]", {
      userId,
      puzzleId: puzzle.id,
      savedGuessCount: savedResult.guesses.length,
      savedGuesses: savedResult.guesses
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
    console.log("[POST /api/daily/guess] Response:", { completed, won, word: guessResponse.word });
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
        recentResults: []
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

const AI_BATTLE_EVENT_BASE_KEY = "ai_battle_hour";
let aiBattleEventActive =
  String(process.env.AI_BATTLE_EVENT_ACTIVE || "").toLowerCase() === "true";
const AI_BATTLE_EVENT_SLOT =
  process.env.AI_BATTLE_EVENT_SLOT || "20:00-21:00";
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
    joinable = !(duelMode.canJoinDuel(room)?.error);
    capacity = 2;
  } else if (room.mode === "shared") {
    joinable = !(sharedMode.canJoinShared(room)?.error);
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
      (room.mode === "battle" || room.mode === "battle_ai")
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

app.get("/api/rooms/open", (_req, res) => {
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

app.get("/api/events/status", (_req, res) => {
  res.json(getAiBattleEventStatus());
});

function normalizeMode(mode) {
  const candidate = (mode || "").toString().toLowerCase();
  return VALID_MODES.has(candidate) ? candidate : "duel";
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
  if (room.battle.aiHost?.mode === "auto") {
    scheduleAiBattleCountdown(roomId);
  } else {
    room.battle.countdownEndsAt = null;
  }
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

// ---------- Socket handlers ----------

// ---------- Socket handlers ----------
io.on("connection", (socket) => {
  socket.on("syncRoom", ({ roomId }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ ok: false, error: "Room not found" });
    socket.join(roomId);
    cb?.({ ok: true, state: sanitizeRoom(room) });
  });

  socket.on("createRoom", ({ name, mode = "duel" }, cb) => {
    const id = Math.random().toString(36).slice(2, 8).toUpperCase();
    const normalizedMode = normalizeMode(mode);
    const initialHostId = normalizedMode === "battle_ai" ? null : socket.id;
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

    room.players[socket.id] = {
      name,
      ready: false,
      secret: null,
      guesses: [],
      done: false,
      wins: 0,
      streak: 0,
      disconnected: false,
      rematchRequested: false,
      disconnectedAt: null,
    };

    rooms.set(id, room);
    socket.join(id);
    if (normalizedMode === "battle_ai") {
      scheduleAiBattleCountdown(id);
    }
    cb?.({ roomId: id });
    io.to(id).emit("roomState", sanitizeRoom(room));
  });

  socket.on("joinRoom", ({ name, roomId }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ error: "Room not found" });

    const oldId = Object.keys(room.players).find((pid) =>
      (room.players[pid].name || "").trim().toLowerCase() === (name || "").trim().toLowerCase() && room.players[pid].disconnected
    );

    if (oldId) {
      if (room.players[socket.id] && socket.id !== oldId) {
        delete room.players[socket.id];
      }

      const oldPlayer = room.players[oldId];
      room.players[socket.id] = {
        ...oldPlayer,
        disconnected: false,
        disconnectedAt: null,
      };

      if (room.hostId === oldId) room.hostId = socket.id;
      if (room.winner === oldId) room.winner = socket.id;
      if (room.battle?.winner === oldId) room.battle.winner = socket.id;
      if (room.shared?.turn === oldId) room.shared.turn = socket.id;

      delete room.players[oldId];
      room.updatedAt = Date.now();

      socket.join(roomId);
      io.to(roomId).emit("roomState", sanitizeRoom(room));
      if (room.mode === "battle_ai") {
        maybeEnsureAiBattleRound(roomId);
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

    room.players[socket.id] = {
      name,
      ready: false,
      secret: null,
      guesses: [],
      done: false,
      wins: 0,
      streak: 0,
      disconnected: false,
      rematchRequested: false,
      disconnectedAt: null,
    };
    room.updatedAt = Date.now();

    socket.join(roomId);
    cb?.({ ok: true, resumed: false, mode: room.mode });
    io.to(roomId).emit("roomState", sanitizeRoom(room));
    if (room.mode === "battle_ai") {
      maybeEnsureAiBattleRound(roomId);
      if (room.meta?.isEvent && isAiBattleEventActive()) {
        ensureAiBattleEventRoom();
      }
    }
  });

  socket.on("setSecret", ({ roomId, secret }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ error: "Room not found" });
    if (room.mode !== "duel") return cb?.({ error: "Wrong mode" });

    const result = duelMode.handleSetSecret({
      room,
      socketId: socket.id,
      secret,
      isValidWord: isValidWordLocal,
    });
    if (result?.error) return cb?.(result);

    if (result?.started) {
      const startResult = duelMode.startDuelRound({
        room,
        roundMs: ROUND_MS,
        scheduleTimeout: () => setTimeout(() => handleDuelTimeout(roomId), ROUND_MS),
      });
      if (startResult?.error) return cb?.(startResult);
    }

    io.to(roomId).emit("roomState", sanitizeRoom(room));
    cb?.({ ok: true });
  });

  socket.on("makeGuess", ({ roomId, guess }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ error: "Room not found" });

    const raw = String(guess || "");
    const up = raw.toUpperCase();

    if (!isValidWordLocal(raw)) {
      console.log("[makeGuess] invalid word", { roomId, player: socket.id, raw, up });
      return cb?.({ error: "Invalid word" });
    }

    if (room.mode === "duel") {
      const result = duelMode.handleDuelGuess({
        room,
        socketId: socket.id,
        guess: up,
        scoreGuess,
        updateStatsOnWin,
        getOpponent,
      });
      if (result?.error) return cb?.(result);
      if (result?.roundEnded) duelMode.clearDuelTimer(room);
      io.to(roomId).emit("roomState", sanitizeRoom(room));
      return cb?.({ ok: true, pattern: result?.pattern });
    }

    if (room.mode === "shared") {
      const result = sharedMode.handleSharedGuess({
        room,
        socketId: socket.id,
        guess: up,
        scoreGuess,
        updateStatsOnWin,
        getOpponent,
      });
      if (result?.error) return cb?.(result);
      io.to(roomId).emit("roomState", sanitizeRoom(room));
      return cb?.({ ok: true, pattern: result?.pattern });
    }

    if (room.mode === "battle" || room.mode === "battle_ai") {
      const result = battleMode.handleBattleGuess({
        room,
        socketId: socket.id,
        guess: up,
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
        if (room.battle.aiHost?.mode === "auto") {
          scheduleAiBattleCountdown(roomId);
        } else {
          room.battle.countdownEndsAt = null;
        }
      }
      io.to(roomId).emit("roomState", sanitizeRoom(room));
      return cb?.({ ok: true, pattern: result?.pattern });
    }

    return cb?.({ error: "Unsupported mode" });
  });

  socket.on("duelPlayAgain", ({ roomId }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ error: "Room not found" });
    if (room.mode !== "duel" && room.mode !== "shared") return cb?.({ error: "Wrong mode" });

    if (room.players[socket.id]) {
      room.players[socket.id].rematchRequested = true;
    }

    const playerIds = Object.keys(room.players);
    const bothRequested = playerIds.length > 0 && playerIds.every((pid) => room.players[pid].rematchRequested);

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
    if (room.mode !== "shared") return cb?.({ error: "Room not found or wrong mode" });

    const result = sharedMode.startSharedRound({ room, socketId: socket.id, pickRandomWords });
    if (result?.error) return cb?.(result);

    io.to(roomId).emit("roomState", sanitizeRoom(room));
    cb?.({ ok: true });
  });

  socket.on("setHostWord", ({ roomId, secret }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ error: "Room not found" });
    if (room.mode !== "battle" && room.mode !== "battle_ai") {
      return cb?.({ error: "Wrong mode" });
    }
    if (room.mode === "battle_ai") {
      if (room.battle?.aiHost?.mode !== "player") {
        return cb?.({ error: "AI host is active" });
      }
    }
    if (socket.id !== room.hostId) return cb?.({ error: "Only host can set word" });

    const result = battleMode.setHostWord({ room, secret, validateWord: isValidWordLocal });
    if (result?.error) return cb?.(result);

    if (room.mode === "battle_ai") {
      clearAiBattleTimers(room);
      room.battle.countdownEndsAt = null;
    }

    io.to(roomId).emit("roomState", sanitizeRoom(room));
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
    if (socket.id !== room.hostId) return cb?.({ error: "Only host can start" });

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
    const player = room.players[socket.id];
    if (!player || player.disconnected) {
      return cb?.({ error: "Not in room" });
    }

    clearAiBattleTimers(room);
    battleMode.resetBattleRound(room);
    room.battle.secret = null;
    room.battle.lastRevealedWord = null;
    room.battle.aiHost = { mode: "player", claimedBy: socket.id, pendingStart: false };
    room.hostId = socket.id;
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
    if (room.battle.aiHost.claimedBy !== socket.id) {
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
    if (socket.id !== room.hostId) return cb?.({ error: "Only host can reset" });

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

  socket.on("resume", ({ roomId, oldId }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ error: "Room not found" });

    const oldPlayer = room.players[oldId];
    if (!oldPlayer) return cb?.({ error: "Old session not found" });

    const isSameSocket = oldId === socket.id;

    if (!isSameSocket && room.players[socket.id]) delete room.players[socket.id];

    const resumedPlayer = {
      ...oldPlayer,
      disconnected: false,
      disconnectedAt: null,
    };

    room.players[isSameSocket ? oldId : socket.id] = resumedPlayer;

    if (room.hostId === oldId) room.hostId = isSameSocket ? oldId : socket.id;
    if (room.winner === oldId) room.winner = isSameSocket ? oldId : socket.id;
    if (room.battle?.winner === oldId) {
      room.battle.winner = isSameSocket ? oldId : socket.id;
    }
    if (room.battle?.aiHost?.claimedBy === oldId) {
      room.battle.aiHost.claimedBy = isSameSocket ? oldId : socket.id;
    }
    if (room.shared?.turn === oldId) {
      room.shared.turn = isSameSocket ? oldId : socket.id;
    }

    if (!isSameSocket) {
      delete room.players[oldId];
    }
    room.updatedAt = Date.now();

    socket.join(roomId);
    io.to(roomId).emit("roomState", sanitizeRoom(room));
    if (room.mode === "battle_ai") {
      maybeEnsureAiBattleRound(roomId);
    }
    cb?.({ ok: true, mode: room.mode });
  });

  socket.on("leaveRoom", ({ roomId } = {}, cb) => {
    const now = Date.now();
    let handled = false;

    for (const [id, room] of rooms) {
      if (roomId && id !== roomId) continue;
      const player = room.players[socket.id];
      if (!player) continue;

      if (!player.disconnected) {
        player.disconnected = true;
        player.disconnectedAt = now;
        sharedMode.handleSharedDisconnect(room, socket.id);

        if (room.hostId === socket.id) {
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
              (pid) => pid !== socket.id && !room.players[pid].disconnected
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
    const now = Date.now();
    for (const [id, room] of rooms) {
      const player = room.players[socket.id];
      if (!player) continue;

      player.disconnected = true;
      player.disconnectedAt = now;
      sharedMode.handleSharedDisconnect(room, socket.id);

      if (room.hostId === socket.id) {
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
            (pid) => pid !== socket.id && !room.players[pid].disconnected
          );
          if (replacement) {
            room.hostId = replacement;
          }
        }
      }

      room.updatedAt = now;
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
        }
        const oldestDisconnect = Math.min(
          ...Object.values(room.players)
            .map((p) =>
              typeof p.disconnectedAt === "number" ? p.disconnectedAt : Infinity
            )
        );
        if (
          !hostPlayer ||
          !hostPlayer.disconnectedAt ||
          now - hostPlayer.disconnectedAt > HOST_DISCONNECT_GRACE_MS ||
          now - oldestDisconnect > HOST_DISCONNECT_GRACE_MS
        ) {
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
  process.env.NODE_ENV !== "test" ? startRoomCleanupInterval() : null;

const aiBattleEventInterval =
  isAiBattleEventActive() && process.env.NODE_ENV !== "test"
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

// ---------- Catch-all route for client-side routing (production only) ----------
if (process.env.NODE_ENV === "production") {
  app.get("*", (req, res) => {
    const clientDistPath = path.join(__dirname, "..", "client", "dist");
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

// ---------- Start server ----------
const PORT = process.env.PORT || 8080;

if (process.env.NODE_ENV !== "test") {
  httpServer.listen(PORT, "0.0.0.0", () =>
    console.log("Server listening on", PORT)
  );
}

export { httpServer };

