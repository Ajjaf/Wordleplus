import {
  initBattleRoom,
  setHostWord,
  startBattleRound,
  handleBattleGuess,
  endBattleRound,
  resetBattleRound,
} from "../modes/battle.js";
import { scoreGuess } from "../game.js";

// Mock scoreGuess for testing
const mockScoreGuess = (secret, guess) => {
  return scoreGuess(secret, guess);
};

// Mock updateStatsOnWin
const mockUpdateStatsOnWin = () => {};

describe("Battle Mode", () => {
  let room;

  beforeEach(() => {
    room = {
      id: "BATTLE123",
      mode: "battle",
      hostId: "host1",
      players: {
        host1: { guesses: [], done: false },
        player1: { guesses: [], done: false },
        player2: { guesses: [], done: false },
      },
      battle: null,
    };
    initBattleRoom(room);
  });

  describe("initBattleRoom", () => {
    it("initializes battle state with correct defaults", () => {
      expect(room.battle).toEqual({
        secret: null,
        started: false,
        winner: null,
        lastRevealedWord: null,
        deadline: null,
        countdownEndsAt: null,
        aiHost: null,
        pendingStart: false,
      });
    });
  });

  describe("setHostWord", () => {
    const mockValidateWord = (word) => word && word.length === 5 && /^[A-Z]{5}$/.test(word.toUpperCase());

    it("sets the host word and resets player guesses", () => {
      room.players.player1.guesses = [{ guess: "TEST", pattern: [] }];
      room.players.player2.guesses = [{ guess: "TEST", pattern: [] }];

      const result = setHostWord({
        room,
        secret: "APPLE",
        validateWord: mockValidateWord,
      });

      expect(result).toEqual({ ok: true });
      expect(room.battle.secret).toBe("APPLE");
      expect(room.players.player1.guesses).toEqual([]);
      expect(room.players.player2.guesses).toEqual([]);
      expect(room.players.player1.done).toBe(false);
      expect(room.players.player2.done).toBe(false);
    });

    it("converts word to uppercase", () => {
      setHostWord({
        room,
        secret: "apple",
        validateWord: mockValidateWord,
      });

      expect(room.battle.secret).toBe("APPLE");
    });

    it("rejects invalid word", () => {
      const result = setHostWord({
        room,
        secret: "INVALID",
        validateWord: mockValidateWord,
      });

      expect(result).toEqual({ error: "Invalid word" });
      expect(room.battle.secret).toBe(null);
    });
  });

  describe("startBattleRound", () => {
    it("starts round when secret is set and players exist", () => {
      room.battle.secret = "APPLE";
      const result = startBattleRound({ room });

      expect(result).toEqual({ ok: true });
      expect(room.battle.started).toBe(true);
      expect(room.battle.winner).toBe(null);
      expect(room.roundClosed).toBe(false);
    });

    it("rejects when secret is not set", () => {
      const result = startBattleRound({ room });

      expect(result).toEqual({ error: "Set a word first" });
      expect(room.battle.started).toBe(false);
    });

    it("rejects when only host exists", () => {
      room.players = { host1: { guesses: [], done: false } };
      room.battle.secret = "APPLE";
      const result = startBattleRound({ room });

      expect(result).toEqual({ error: "Need at least 2 players" });
    });
  });

  describe("handleBattleGuess", () => {
    beforeEach(() => {
      room.battle.secret = "APPLE";
      room.battle.started = true;
    });

    it("processes a correct guess and ends round", () => {
      const result = handleBattleGuess({
        room,
        socketId: "player1",
        guess: "APPLE",
        scoreGuess: mockScoreGuess,
        updateStatsOnWin: mockUpdateStatsOnWin,
      });

      expect(result.ok).toBe(true);
      expect(result.ended).toBe(true);
      expect(room.battle.winner).toBe("player1");
      expect(room.battle.started).toBe(false);
      expect(room.battle.lastRevealedWord).toBe("APPLE");
    });

    it("processes an incorrect guess", () => {
      const result = handleBattleGuess({
        room,
        socketId: "player1",
        guess: "WORDS",
        scoreGuess: mockScoreGuess,
        updateStatsOnWin: mockUpdateStatsOnWin,
      });

      expect(result.ok).toBe(true);
      expect(result.ended).toBe(false);
      expect(room.players.player1.guesses.length).toBe(1);
      expect(room.players.player1.done).toBe(false);
    });

    it("marks player as done after 6 guesses", () => {
      room.players.player1.guesses = Array(5).fill({ guess: "WORDS", pattern: [] });

      const result = handleBattleGuess({
        room,
        socketId: "player1",
        guess: "WORDS",
        scoreGuess: mockScoreGuess,
        updateStatsOnWin: mockUpdateStatsOnWin,
      });

      expect(room.players.player1.done).toBe(true);
      expect(room.players.player1.guesses.length).toBe(6);
    });

    it("ends round when all players are done with no winner", () => {
      room.players.player1.guesses = Array(5).fill({ guess: "WORDS", pattern: [] });
      room.players.player2.guesses = Array(5).fill({ guess: "WORDS", pattern: [] });

      const result = handleBattleGuess({
        room,
        socketId: "player1",
        guess: "WORDS",
        scoreGuess: mockScoreGuess,
        updateStatsOnWin: mockUpdateStatsOnWin,
      });

      // After player1's 6th guess, they're done, but round only ends if ALL players are done
      expect(room.players.player1.done).toBe(true);
      
      // Now player2 makes their 6th guess - this should end the round
      const result2 = handleBattleGuess({
        room,
        socketId: "player2",
        guess: "WORDS",
        scoreGuess: mockScoreGuess,
        updateStatsOnWin: mockUpdateStatsOnWin,
      });

      expect(result2.ended).toBe(true);
      expect(room.battle.started).toBe(false);
      expect(room.battle.winner).toBe(null);
    });

    it("rejects guess from host", () => {
      const result = handleBattleGuess({
        room,
        socketId: "host1",
        guess: "APPLE",
        scoreGuess: mockScoreGuess,
        updateStatsOnWin: mockUpdateStatsOnWin,
      });

      expect(result).toEqual({ error: "Host is spectating this round" });
    });

    it("rejects guess when battle not started", () => {
      room.battle.started = false;
      const result = handleBattleGuess({
        room,
        socketId: "player1",
        guess: "APPLE",
        scoreGuess: mockScoreGuess,
        updateStatsOnWin: mockUpdateStatsOnWin,
      });

      expect(result).toEqual({ error: "Battle not started" });
    });

    it("rejects guess when player not in room", () => {
      const result = handleBattleGuess({
        room,
        socketId: "nonexistent",
        guess: "APPLE",
        scoreGuess: mockScoreGuess,
        updateStatsOnWin: mockUpdateStatsOnWin,
      });

      expect(result).toEqual({ error: "Not in room" });
    });

    it("rejects guess when player already done", () => {
      room.players.player1.done = true;
      const result = handleBattleGuess({
        room,
        socketId: "player1",
        guess: "APPLE",
        scoreGuess: mockScoreGuess,
        updateStatsOnWin: mockUpdateStatsOnWin,
      });

      expect(result).toEqual({ error: "No guesses left" });
    });
  });

  describe("endBattleRound", () => {
    it("ends round with winner", () => {
      room.battle.started = true;
      room.battle.secret = "APPLE";
      room.players.player1.done = false;
      room.players.player2.done = false;

      endBattleRound(room, "player1", { updateStatsOnWin: mockUpdateStatsOnWin });

      expect(room.battle.started).toBe(false);
      expect(room.battle.winner).toBe("player1");
      expect(room.battle.lastRevealedWord).toBe("APPLE");
      expect(room.battle.deadline).toBe(null);
      expect(room.battle.countdownEndsAt).toBe(null);
      expect(room.players.player1.done).toBe(true);
      expect(room.players.player2.done).toBe(true);
      expect(room.roundClosed).toBe(true);
      // Note: mockUpdateStatsOnWin is called but we don't verify it in this test
    });

    it("ends round without winner", () => {
      room.battle.started = true;
      room.battle.secret = "APPLE";

      endBattleRound(room, null, { updateStatsOnWin: mockUpdateStatsOnWin });

      expect(room.battle.winner).toBe(null);
      expect(room.roundClosed).toBe(true);
      // Note: mockUpdateStatsOnWin should not be called when there's no winner
    });
  });

  describe("resetBattleRound", () => {
    it("resets all player state and battle state", () => {
      room.players.player1.guesses = [{ guess: "TEST", pattern: [] }];
      room.players.player1.done = true;
      room.players.player2.guesses = [{ guess: "TEST", pattern: [] }];
      room.players.player2.done = true;
      room.battle.started = true;
      room.battle.winner = "player1";
      room.battle.deadline = Date.now() + 60000;
      room.battle.countdownEndsAt = Date.now() + 5000;
      room.roundClosed = true;

      resetBattleRound(room);

      expect(room.players.player1.guesses).toEqual([]);
      expect(room.players.player1.done).toBe(false);
      expect(room.players.player2.guesses).toEqual([]);
      expect(room.players.player2.done).toBe(false);
      expect(room.battle.started).toBe(false);
      expect(room.battle.winner).toBe(null);
      expect(room.battle.deadline).toBe(null);
      expect(room.battle.countdownEndsAt).toBe(null);
      expect(room.roundClosed).toBe(false);
    });
  });
});

