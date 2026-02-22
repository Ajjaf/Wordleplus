import {
  bootServer,
  shutdownServer,
  createClient,
  emitWithAck,
  emitAndWait,
  waitForEvent,
  disconnectAll,
} from "../helpers/socketTestHelper.js";

let host, p1, p2;

beforeAll(async () => {
  await bootServer();
}, 15000);

afterAll(async () => {
  disconnectAll(host, p1, p2);
  await shutdownServer();
});

afterEach(() => {
  disconnectAll(host, p1, p2);
  host = null;
  p1 = null;
  p2 = null;
});

async function collectRoomState(emitter, emitEvent, data, others = []) {
  const promises = [emitAndWait(emitter, emitEvent, data)];
  for (const s of others) {
    promises.push(waitForEvent(s, "roomState"));
  }
  const [result, ...rest] = await Promise.all(promises);
  return { ...result, others: rest };
}

describe("Battle Game Flow Integration", () => {
  async function setupBattleWithPlayer() {
    host = await createClient();
    const { ack } = await emitAndWait(host, "createRoom", {
      name: "Host",
      mode: "battle",
    });
    const roomId = ack.roomId;

    p1 = await createClient();
    const hostJoinBroadcast = waitForEvent(host, "roomState");
    await emitAndWait(p1, "joinRoom", { name: "Player1", roomId });
    await hostJoinBroadcast;

    // Set word — drain broadcast on both host and p1
    await collectRoomState(host, "setHostWord", { roomId, secret: "CRANE" }, [p1]);

    // Start round — drain broadcast on both
    const p1StartPromise = waitForEvent(p1, "roomState");
    const { ack: startAck, event: hostStart } = await emitAndWait(
      host, "startBattle", { roomId },
    );
    const p1Start = await p1StartPromise;

    return { roomId, hostStart, p1Start };
  }

  it("completes a full battle: create → join → setHostWord → start → guess → win", async () => {
    const { roomId, p1Start } = await setupBattleWithPlayer();
    expect(p1Start.battle.started).toBe(true);

    const { ack: guessAck, event: endState } = await collectRoomState(
      p1, "makeGuess", { roomId, guess: "CRANE" }, [host],
    );
    expect(guessAck.ok).toBe(true);
    expect(guessAck.pattern).toEqual(["green", "green", "green", "green", "green"]);
    expect(endState.battle.started).toBe(false);
    expect(endState.battle.winner).toBe(p1.id);
  });

  it("prevents host from guessing", async () => {
    const { roomId } = await setupBattleWithPlayer();

    const ack = await emitWithAck(host, "makeGuess", { roomId, guess: "CRANE" });
    expect(ack.error).toBeDefined();
  });

  it("ends round when all players exhaust guesses without solving", async () => {
    const { roomId } = await setupBattleWithPlayer();

    const wrongGuesses = ["ADORE", "BLUNT", "DROWN", "FLUTE", "GRIPE", "JOLTS"];
    let lastState;
    for (const w of wrongGuesses) {
      const result = await collectRoomState(
        p1, "makeGuess", { roomId, guess: w }, [host],
      );
      lastState = result.event;
    }

    expect(lastState.battle.started).toBe(false);
    expect(lastState.battle.winner).toBeNull();
  });

  it("supports multiple players racing", async () => {
    host = await createClient();
    const { ack: createAck } = await emitAndWait(host, "createRoom", {
      name: "Host",
      mode: "battle",
    });
    const roomId = createAck.roomId;

    p1 = await createClient();
    p2 = await createClient();

    let hostBroadcast = waitForEvent(host, "roomState");
    await emitAndWait(p1, "joinRoom", { name: "Player1", roomId });
    await hostBroadcast;

    hostBroadcast = waitForEvent(host, "roomState");
    const p1JoinBroadcast = waitForEvent(p1, "roomState");
    await emitAndWait(p2, "joinRoom", { name: "Player2", roomId });
    await hostBroadcast;
    await p1JoinBroadcast;

    // Set word — drain from all sockets
    await collectRoomState(host, "setHostWord", { roomId, secret: "HOUSE" }, [p1, p2]);

    // Start — drain from all
    const p1Start = waitForEvent(p1, "roomState");
    const p2Start = waitForEvent(p2, "roomState");
    await emitAndWait(host, "startBattle", { roomId });
    await p1Start;
    await p2Start;

    // P1 guesses wrong — drain from host, p1, and p2
    await collectRoomState(p1, "makeGuess", { roomId, guess: "CRANE" }, [host, p2]);

    // P2 guesses correct — drain from host and p1
    const { ack, event: endState } = await collectRoomState(
      p2, "makeGuess", { roomId, guess: "HOUSE" }, [host, p1],
    );
    expect(ack.ok).toBe(true);
    expect(endState.battle.started).toBe(false);
    expect(endState.battle.winner).toBe(p2.id);
  });

  it("host can reset and start a new round (playAgain)", async () => {
    const { roomId } = await setupBattleWithPlayer();

    // P1 wins — drain from host
    await collectRoomState(p1, "makeGuess", { roomId, guess: "CRANE" }, [host]);

    // Host resets — drain from p1
    const p1Reset = waitForEvent(p1, "roomState");
    const resetAck = await emitWithAck(host, "playAgain", { roomId });
    expect(resetAck.ok).toBe(true);

    const resetState = await p1Reset;
    expect(resetState.battle.started).toBe(false);
    expect(resetState.battle.winner).toBeNull();
  });
});
