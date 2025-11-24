import {
  initDuelRoom,
  canJoinDuel,
  handleSetSecret,
  startDuelRound,
  handleDuelGuess,
  resetDuelRound,
  resolveDuelTimeout,
  clearDuelTimer,
} from "../modes/duel.js";
import { scoreGuess } from "../game.js";

// Mock scoreGuess for testing
const mockScoreGuess = (secret, guess) => {
  return scoreGuess(secret, guess);
};

// Mock updateStatsOnWin
const mockUpdateStatsOnWin = () => {};

// Mock getOpponent
const mockGetOpponent = (room, socketId) => {
  const ids = Object.keys(room.players || {});
  if (ids.length !== 2) return null;
  return ids.find((id) => id !== socketId) || null;
};

describe("Duel Mode", () => {
  let room;

  beforeEach(() => {
    room = {
      id: "TEST123",
      mode: "duel",
      players: {},
      started: false,
      winner: null,
      duelReveal: undefined,
      duelDeadline: null,
      roundClosed: false,
    };
    initDuelRoom(room);
  });

  describe("initDuelRoom", () => {
    it("initializes room with correct default values", () => {
      expect(room.winner).toBe(null);
      expect(room.duelReveal).toBeUndefined();
      expect(room.roundClosed).toBe(false);
    });
  });

  describe("canJoinDuel", () => {
    it("allows joining when room is empty", () => {
      const result = canJoinDuel(room);
      expect(result).toEqual({ ok: true });
    });

    it("allows joining when one player exists", () => {
      room.players["player1"] = { disconnected: false };
      const result = canJoinDuel(room);
      expect(result).toEqual({ ok: true });
    });

    it("rejects joining when two active players exist", () => {
      room.players["player1"] = { disconnected: false };
      room.players["player2"] = { disconnected: false };
      const result = canJoinDuel(room);
      expect(result).toEqual({ error: "Duel rooms support exactly two players" });
    });

    it("allows joining when one player is disconnected", () => {
      room.players["player1"] = { disconnected: true };
      room.players["player2"] = { disconnected: false };
      const result = canJoinDuel(room);
      expect(result).toEqual({ ok: true });
    });
  });

  describe("handleSetSecret", () => {
    const mockIsValidWord = (word) => word && word.length === 5 && /^[A-Z]{5}$/.test(word.toUpperCase());

    it("sets secret and marks player as ready", () => {
      room.players["player1"] = { ready: false, secret: null };
      const result = handleSetSecret({
        room,
        socketId: "player1",
        secret: "APPLE",
        isValidWord: mockIsValidWord,
      });

      expect(result).toEqual({ ok: true, started: false });
      expect(room.players["player1"].secret).toBe("APPLE");
      expect(room.players["player1"].ready).toBe(true);
    });

    it("starts game when both players are ready", () => {
      room.players["player1"] = { ready: false, secret: null };
      room.players["player2"] = { ready: false, secret: null };

      handleSetSecret({
        room,
        socketId: "player1",
        secret: "APPLE",
        isValidWord: mockIsValidWord,
      });

      const result = handleSetSecret({
        room,
        socketId: "player2",
        secret: "BANAN",
        isValidWord: mockIsValidWord,
      });

      expect(result).toEqual({ ok: true, started: true });
    });

    it("rejects invalid word", () => {
      room.players["player1"] = { ready: false, secret: null };
      const result = handleSetSecret({
        room,
        socketId: "player1",
        secret: "INVALID",
        isValidWord: mockIsValidWord,
      });

      expect(result).toEqual({ error: "Invalid word" });
    });

    it("rejects when player not in room", () => {
      const result = handleSetSecret({
        room,
        socketId: "nonexistent",
        secret: "APPLE",
        isValidWord: mockIsValidWord,
      });

      expect(result).toEqual({ error: "Player not in room" });
    });
  });

  describe("startDuelRound", () => {
    it("starts round with two players", () => {
      room.players["player1"] = { guesses: [], done: false };
      room.players["player2"] = { guesses: [], done: false };

      const mockScheduleTimeout = () => setTimeout(() => {}, 1000);
      const result = startDuelRound({
        room,
        roundMs: 60000,
        scheduleTimeout: mockScheduleTimeout,
      });

      expect(result).toEqual({ ok: true });
      expect(room.started).toBe(true);
      expect(room.duelDeadline).toBeGreaterThan(Date.now());
      expect(room.players["player1"].guesses).toEqual([]);
      expect(room.players["player2"].guesses).toEqual([]);
    });

    it("rejects when not two players", () => {
      room.players["player1"] = {};
      const result = startDuelRound({
        room,
        roundMs: 60000,
        scheduleTimeout: () => {},
      });

      expect(result).toEqual({ error: "Need two players" });
    });
  });

  describe("handleDuelGuess", () => {
    beforeEach(() => {
      room.started = true;
      room.players["player1"] = {
        guesses: [],
        done: false,
        secret: "APPLE",
      };
      room.players["player2"] = {
        guesses: [],
        done: false,
        secret: "BANAN",
      };
    });

    it("processes a correct guess", () => {
      const result = handleDuelGuess({
        room,
        socketId: "player1",
        guess: "BANAN",
        scoreGuess: mockScoreGuess,
        updateStatsOnWin: mockUpdateStatsOnWin,
        getOpponent: mockGetOpponent,
      });

      expect(result.ok).toBe(true);
      expect(result.pattern).toEqual(["green", "green", "green", "green", "green"]);
      expect(room.players["player1"].done).toBe(true);
    });

    it("processes an incorrect guess", () => {
      const result = handleDuelGuess({
        room,
        socketId: "player1",
        guess: "WORDS",
        scoreGuess: mockScoreGuess,
        updateStatsOnWin: mockUpdateStatsOnWin,
        getOpponent: mockGetOpponent,
      });

      expect(result.ok).toBe(true);
      expect(result.pattern).toBeDefined();
      expect(room.players["player1"].guesses.length).toBe(1);
      expect(room.players["player1"].done).toBe(false);
    });

    it("marks player as done after 6 guesses", () => {
      room.players["player1"].guesses = Array(5).fill({ guess: "WORDS", pattern: [] });

      const result = handleDuelGuess({
        room,
        socketId: "player1",
        guess: "WORDS",
        scoreGuess: mockScoreGuess,
        updateStatsOnWin: mockUpdateStatsOnWin,
        getOpponent: mockGetOpponent,
      });

      expect(room.players["player1"].done).toBe(true);
      expect(room.players["player1"].guesses.length).toBe(6);
    });

    it("rejects guess when game not started", () => {
      room.started = false;
      const result = handleDuelGuess({
        room,
        socketId: "player1",
        guess: "WORDS",
        scoreGuess: mockScoreGuess,
        updateStatsOnWin: mockUpdateStatsOnWin,
        getOpponent: mockGetOpponent,
      });

      expect(result).toEqual({ error: "Game not started" });
    });

    it("rejects guess when player already done", () => {
      room.players["player1"].done = true;
      const result = handleDuelGuess({
        room,
        socketId: "player1",
        guess: "WORDS",
        scoreGuess: mockScoreGuess,
        updateStatsOnWin: mockUpdateStatsOnWin,
        getOpponent: mockGetOpponent,
      });

      expect(result).toEqual({ error: "You already finished" });
    });

    it("computes winner when one player solves", () => {
      handleDuelGuess({
        room,
        socketId: "player1",
        guess: "BANAN",
        scoreGuess: mockScoreGuess,
        updateStatsOnWin: mockUpdateStatsOnWin,
        getOpponent: mockGetOpponent,
      });

      expect(room.winner).toBe("player1");
      expect(room.duelReveal).toBeDefined();
    });
  });

  describe("resetDuelRound", () => {
    it("resets all player state", () => {
      room.players["player1"] = {
        guesses: [{ guess: "TEST", pattern: [] }],
        done: true,
        ready: true,
        secret: "APPLE",
        rematchRequested: true,
      };
      room.players["player2"] = {
        guesses: [{ guess: "TEST", pattern: [] }],
        done: true,
        ready: true,
        secret: "BANAN",
        rematchRequested: true,
      };
      room.started = true;
      room.duelDeadline = Date.now() + 60000;

      resetDuelRound(room);

      expect(room.players["player1"].guesses).toEqual([]);
      expect(room.players["player1"].done).toBe(false);
      expect(room.players["player1"].ready).toBe(false);
      expect(room.players["player1"].secret).toBe(null);
      expect(room.players["player1"].rematchRequested).toBe(false);
      expect(room.started).toBe(false);
      expect(room.duelDeadline).toBe(null);
    });
  });

  describe("clearDuelTimer", () => {
    it("clears timer if it exists", () => {
      const timer = setTimeout(() => {}, 1000);
      room._duelTimer = timer;
      clearDuelTimer(room);
      expect(room._duelTimer).toBe(null);
    });

    it("handles missing timer gracefully", () => {
      room._duelTimer = null;
      expect(() => clearDuelTimer(room)).not.toThrow();
    });
  });

  describe("resolveDuelTimeout", () => {
    it("marks all players as done and computes winner", () => {
      room.players["player1"] = {
        guesses: [{ guess: "TEST", pattern: [] }],
        done: false,
        secret: "APPLE",
      };
      room.players["player2"] = {
        guesses: [{ guess: "TEST", pattern: [] }],
        done: false,
        secret: "BANAN",
      };
      room.started = true;

      resolveDuelTimeout({ room });

      expect(room.players["player1"].done).toBe(true);
      expect(room.players["player2"].done).toBe(true);
      expect(room.started).toBe(false);
      expect(room.roundClosed).toBe(true);
      expect(room.duelReveal).toBeDefined();
    });
  });
});

