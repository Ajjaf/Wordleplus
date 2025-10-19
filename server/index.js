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

// ---------- Word list loader (.txt) ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORDLIST_PATH =
  process.env.WORDLIST_PATH || path.join(__dirname, "words.txt");

let WORDS = [];
let WORDSET = new Set();
const ROUND_MS = Number(process.env.DUEL_ROUND_MS || 360000); // 2 minutes

function loadWords() {
  const raw = fs.readFileSync(WORDLIST_PATH, "utf8");
  const arr = raw
    .split(/\r?\n/)
    .map((w) => w.trim())
    .filter(Boolean)
    .map((w) => w.toUpperCase())
    .filter((w) => /^[A-Z]{5}$/.test(w)); // only A–Z 5-letter words

  WORDS = Array.from(new Set(arr)); // dedupe
  WORDSET = new Set(WORDS);
  console.log(`[words] Loaded ${WORDS.length} entries from ${WORDLIST_PATH}`);
}
loadWords();

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
  return /^[A-Z]{5}$/.test(w) && WORDSET.has(w);
}

// ---------- Express app ----------
const app = express();

const corsOptions = {
  origin: (origin, cb) => {
    cb(null, true);
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

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

function getUserIdFromCookie(req) {
  return req.cookies?.dailyUserId || null;
}

// GET /api/daily - Load daily challenge
app.get("/api/daily", async (req, res) => {
  try {
    const cookieUserId = getUserIdFromCookie(req);
    const user = await getOrCreateAnonymousUser(cookieUserId);
    const puzzle = await getTodaysPuzzle();
    
    const existingResult = await getUserDailyResult(user.id, puzzle.id);
    
    const guesses = existingResult?.guesses || [];
    const patterns = existingResult?.patterns || [];
    const gameOver = existingResult?.completed || false;
    const won = existingResult?.won || false;
    
    res.cookie('dailyUserId', user.id, {
      httpOnly: true,
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      sameSite: 'lax'
    });
    
    res.json({
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
    });
  } catch (error) {
    console.error("Error in GET /api/daily:", error);
    res.status(500).json({ error: "Failed to load daily challenge" });
  }
});

// POST /api/daily/guess - Submit a guess
app.post("/api/daily/guess", async (req, res) => {
  try {
    const cookieUserId = getUserIdFromCookie(req);
    const { guess } = req.body;
    
    if (!guess || typeof guess !== 'string') {
      return res.status(400).json({ error: "Invalid guess" });
    }
    
    const guessUpper = guess.toUpperCase();
    
    if (!isValidWordLocal(guessUpper)) {
      return res.status(400).json({ error: "Not a valid word" });
    }
    
    const user = await getOrCreateAnonymousUser(cookieUserId);
    const puzzle = await getTodaysPuzzle();
    const existingResult = await getUserDailyResult(user.id, puzzle.id);
    
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
    
    const won = pattern.every(state => state === 'green' || state === 'correct');
    const outOfGuesses = newGuesses.length >= MAX_DAILY_GUESSES;
    const completed = won || outOfGuesses;
    
    await createOrUpdateDailyResult(user.id, puzzle.id, {
      guesses: newGuesses,
      patterns: newPatterns,
      won,
      completed
    });
    
    res.json({
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
    });
  } catch (error) {
    console.error("Error in POST /api/daily/guess:", error);
    res.status(500).json({ error: "Failed to process guess" });
  }
});

// GET /api/daily/stats - Get user's daily challenge statistics
app.get("/api/daily/stats", async (req, res) => {
  try {
    const cookieUserId = getUserIdFromCookie(req);
    
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
 *   id, mode: 'duel' | 'battle', hostId,
 *   players: { [socketId]: { name, guesses: [], done: false, ready: false, secret: string|null } },
 *   started, winner,
 *   duelReveal?: { [socketId]: secret }, // populated at end of duel
 *   battle: { secret, started, winner, reveal }
 * }
 */
const rooms = new Map();
const VALID_MODES = new Set(["duel", "shared", "battle"]);

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
  duelMode.clearDuelTimer(room);
  io.to(roomId).emit("roomState", sanitizeRoom(room));
}

// ---------- HTTP + Socket.IO (same server) ----------
const httpServer = createServer(app);
// const io = new Server(httpServer, { cors: corsOptions });
const io = new Server(httpServer, {
  cors: {
    origin: true, // or ['https://964d668fba0f.ngrok-free.app ']
    methods: ["GET", "POST"],
  },
  pingInterval: 10000, // send pings every 10s
  pingTimeout: 30000, // allow 30s before declaring dead
  allowEIO3: true, // helps older clients/proxies
  perMessageDeflate: false, // avoid some proxies’ compression issues
});

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
    const room = {
      id,
      mode: normalizedMode,
      hostId: socket.id,
      players: {},
      started: false,
      winner: null,
      duelReveal: undefined,
      duelDeadline: null,
      roundClosed: false,
    };

    duelMode.initDuelRoom(room);
    sharedMode.initSharedRoom(room, { pickRandomWords });
    battleMode.initBattleRoom(room);

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
    };

    rooms.set(id, room);
    socket.join(id);
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
      if (room.players[socket.id] && socket.id !== oldId) delete room.players[socket.id];

      const oldPlayer = room.players[oldId];
      room.players[socket.id] = { ...oldPlayer, disconnected: false };

      if (room.hostId === oldId) room.hostId = socket.id;
      if (room.winner === oldId) room.winner = socket.id;
      if (room.battle?.winner === oldId) room.battle.winner = socket.id;

      delete room.players[oldId];

      socket.join(roomId);
      io.to(roomId).emit("roomState", sanitizeRoom(room));
      return cb?.({ ok: true, resumed: true });
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
    };

    socket.join(roomId);
    cb?.({ ok: true, resumed: false });
    io.to(roomId).emit("roomState", sanitizeRoom(room));
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

    if (room.mode === "battle") {
      const result = battleMode.handleBattleGuess({
        room,
        socketId: socket.id,
        guess: up,
        scoreGuess,
        updateStatsOnWin,
      });
      if (result?.error) return cb?.(result);
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
    if (room.mode !== "battle") return cb?.({ error: "Wrong mode" });
    if (socket.id !== room.hostId) return cb?.({ error: "Only host can set word" });

    const result = battleMode.setHostWord({ room, secret, validateWord: isValidWordLocal });
    if (result?.error) return cb?.(result);

    io.to(roomId).emit("roomState", sanitizeRoom(room));
    cb?.({ ok: true });
  });

  socket.on("startBattle", ({ roomId }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ error: "Room not found" });
    if (room.mode !== "battle") return cb?.({ error: "Wrong mode" });
    if (socket.id !== room.hostId) return cb?.({ error: "Only host can start" });

    const result = battleMode.startBattleRound({ room });
    if (result?.error) return cb?.(result);

    io.to(roomId).emit("roomState", sanitizeRoom(room));
    cb?.({ ok: true });
  });

  socket.on("playAgain", ({ roomId }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ error: "Room not found" });
    if (room.mode !== "battle") return cb?.({ error: "Wrong mode" });
    if (socket.id !== room.hostId) return cb?.({ error: "Only host can reset" });

    battleMode.resetBattleRound(room);
    io.to(roomId).emit("roomState", sanitizeRoom(room));
    cb?.({ ok: true });
  });

  socket.on("resume", ({ roomId, oldId }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ error: "Room not found" });

    const oldPlayer = room.players[oldId];
    if (!oldPlayer) return cb?.({ error: "Old session not found" });

    if (room.players[socket.id] && socket.id !== oldId) delete room.players[socket.id];

    room.players[socket.id] = { ...oldPlayer, disconnected: false };

    if (room.hostId === oldId) room.hostId = socket.id;
    if (room.winner === oldId) room.winner = socket.id;
    if (room.battle?.winner === oldId) room.battle.winner = socket.id;
    if (room.shared?.turn === oldId) room.shared.turn = socket.id;

    delete room.players[oldId];

    socket.join(roomId);
    io.to(roomId).emit("roomState", sanitizeRoom(room));
    cb?.({ ok: true });
  });

  socket.on("disconnect", () => {
    for (const [id, room] of rooms) {
      if (room.players[socket.id]) {
        room.players[socket.id].disconnected = true;
        room.players[socket.id].disconnectedAt = Date.now();
        sharedMode.handleSharedDisconnect(room, socket.id);
        io.to(id).emit("roomState", sanitizeRoom(room));
      }
    }
  });
});

const DISCONNECT_TTL_MS = 30 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    for (const pid of Object.keys(room.players)) {
      const player = room.players[pid];
      if (
        player.disconnected &&
        player.disconnectedAt &&
        now - player.disconnectedAt > DISCONNECT_TTL_MS
      ) {
        if (room.hostId === pid) {
          const next = Object.keys(room.players).find(
            (id) => !room.players[id].disconnected && id !== pid
          );
          if (next) room.hostId = next;
        }
        delete room.players[pid];
      }
    }
  }
}, 5 * 60 * 1000);
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
httpServer.listen(PORT, "0.0.0.0", () => console.log("Server listening on", PORT));
