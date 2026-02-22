import {
  bootServer,
  shutdownServer,
  createClient,
  emitWithAck,
  emitAndWait,
  waitForEvent,
  disconnectAll,
} from "../helpers/socketTestHelper.js";

let p1, p2;

beforeAll(async () => {
  await bootServer();
}, 15000);

afterAll(async () => {
  disconnectAll(p1, p2);
  await shutdownServer();
});

afterEach(() => {
  disconnectAll(p1, p2);
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

describe("Duel Game Flow Integration", () => {
  it("completes a full create → join → set secrets → guess → win flow", async () => {
    p1 = await createClient();
    p2 = await createClient();

    // Player 1 creates a duel room
    const { ack: createAck, event: state1 } = await emitAndWait(
      p1, "createRoom", { name: "Alice", mode: "duel" },
    );
    expect(createAck.roomId).toBeDefined();
    const roomId = createAck.roomId;
    expect(state1.mode).toBe("duel");
    expect(Object.keys(state1.players)).toHaveLength(1);
    expect(state1.started).toBe(false);

    // Player 2 joins — both get roomState
    const p1Join = waitForEvent(p1, "roomState");
    const { ack: joinAck, event: p2JoinState } = await emitAndWait(
      p2, "joinRoom", { name: "Bob", roomId },
    );
    expect(joinAck.ok).toBe(true);
    await p1Join;
    expect(Object.keys(p2JoinState.players)).toHaveLength(2);

    // P1 sets secret — broadcasts to both, drain both
    await collectRoomState(p1, "setSecret", { roomId, secret: "HOUSE" }, [p2]);

    // P2 sets secret — triggers game start, drain both
    const { ack: secretAck2, others: [p1StartState] } = await collectRoomState(
      p2, "setSecret", { roomId, secret: "CRANE" }, [p1],
    );
    expect(secretAck2.ok).toBe(true);
    expect(p1StartState.started).toBe(true);

    // Player 1 guesses wrong — drain p2 too
    const { ack: guess1Ack, event: afterGuess } = await collectRoomState(
      p1, "makeGuess", { roomId, guess: "MEOWS" }, [p2],
    );
    expect(guess1Ack.ok).toBe(true);
    const p1Data = Object.values(afterGuess.players).find((p) => p.name === "Alice");
    expect(p1Data.guesses).toHaveLength(1);
    expect(p1Data.done).toBe(false);

    // Player 2 guesses correct (P1's secret was HOUSE) — drain p1 too
    const { ack: guess2Ack, event: winState } = await collectRoomState(
      p2, "makeGuess", { roomId, guess: "HOUSE" }, [p1],
    );
    expect(guess2Ack.ok).toBe(true);
    expect(guess2Ack.pattern).toEqual(["green", "green", "green", "green", "green"]);
    const p2Data = Object.values(winState.players).find((p) => p.name === "Bob");
    expect(p2Data.done).toBe(true);
  });

  it("rejects a guess before secrets are set", async () => {
    p1 = await createClient();
    p2 = await createClient();

    const { ack: createAck } = await emitAndWait(
      p1, "createRoom", { name: "Alice", mode: "duel" },
    );
    const roomId = createAck.roomId;

    const p1Promise = waitForEvent(p1, "roomState");
    await emitAndWait(p2, "joinRoom", { name: "Bob", roomId });
    await p1Promise;

    const ack = await emitWithAck(p1, "makeGuess", { roomId, guess: "HOUSE" });
    expect(ack.error).toBeDefined();
  });

  it("rejects invalid words", async () => {
    p1 = await createClient();

    const { ack: createAck } = await emitAndWait(
      p1, "createRoom", { name: "Alice", mode: "duel" },
    );
    const roomId = createAck.roomId;

    const ack = await emitWithAck(p1, "setSecret", { roomId, secret: "ZZZZZ" });
    expect(ack.error).toBeDefined();
  });

  it("handles rematch (duelPlayAgain) flow", async () => {
    p1 = await createClient();
    p2 = await createClient();

    const { ack: createAck } = await emitAndWait(
      p1, "createRoom", { name: "Alice", mode: "duel" },
    );
    const roomId = createAck.roomId;

    const joinBroadcast = waitForEvent(p1, "roomState");
    await emitAndWait(p2, "joinRoom", { name: "Bob", roomId });
    await joinBroadcast;

    await collectRoomState(p1, "setSecret", { roomId, secret: "HOUSE" }, [p2]);
    await collectRoomState(p2, "setSecret", { roomId, secret: "CRANE" }, [p1]);

    // P1 solves P2's word → round ends immediately (winner determined)
    const { event: endState } = await collectRoomState(
      p1, "makeGuess", { roomId, guess: "CRANE" }, [p2],
    );
    expect(endState.started).toBe(false);
    expect(endState.winner).toBeDefined();

    // Both request rematch
    const r1Broadcast = waitForEvent(p2, "roomState");
    const r1 = await emitWithAck(p1, "duelPlayAgain", { roomId });
    expect(r1.ok).toBe(true);
    await r1Broadcast;

    const resetPromise = waitForEvent(p1, "roomState");
    const r2 = await emitWithAck(p2, "duelPlayAgain", { roomId });
    expect(r2.ok).toBe(true);
    expect(r2.bothRequested).toBe(true);

    const resetState = await resetPromise;
    expect(resetState.started).toBe(false);
    for (const pl of Object.values(resetState.players)) {
      expect(pl.guesses).toHaveLength(0);
      expect(pl.done).toBe(false);
      expect(pl.ready).toBe(false);
    }
  });
});
