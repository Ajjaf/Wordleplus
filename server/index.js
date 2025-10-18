// server/index.js
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { scoreGuess } from "./game.js";
import { duelMode, sharedMode, battleMode } from "./modes/index.js";

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
  credentials: false,
};
app.use(cors(corsOptions));
app.use(express.json());

// Serve static files from client build in production
if (process.env.NODE_ENV === "production") {
  const clientDistPath = path.join(__dirname, "..", "client", "dist");
  app.use(express.static(clientDistPath));
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
