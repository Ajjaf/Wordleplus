import {
  bootServer,
  shutdownServer,
  createClient,
  emitWithAck,
  emitAndWait,
  waitForEvent,
  disconnectAll,
} from "../helpers/socketTestHelper.js";

let c1, c2, c3;

beforeAll(async () => {
  await bootServer();
}, 15000);

afterAll(async () => {
  disconnectAll(c1, c2, c3);
  await shutdownServer();
});

afterEach(() => {
  disconnectAll(c1, c2, c3);
  c1 = null;
  c2 = null;
  c3 = null;
});

describe("Room Management Integration", () => {
  // ---- Room creation ----

  it("creates a room and receives roomState", async () => {
    c1 = await createClient();

    const { ack, event: state } = await emitAndWait(c1, "createRoom", {
      name: "Alice",
      mode: "duel",
    });
    expect(ack.roomId).toBeDefined();
    expect(typeof ack.roomId).toBe("string");
    expect(state.id).toBe(ack.roomId);
    expect(state.mode).toBe("duel");
    expect(state.hostId).toBe(c1.id);
    expect(Object.keys(state.players)).toHaveLength(1);
    expect(state.players[c1.id].name).toBe("Alice");
  });

  it("rejects empty player name", async () => {
    c1 = await createClient();

    const ack = await emitWithAck(c1, "createRoom", { name: "", mode: "duel" });
    expect(ack.error).toBeDefined();
  });

  // ---- Joining ----

  it("allows a second player to join", async () => {
    c1 = await createClient();
    c2 = await createClient();

    const { ack: createAck } = await emitAndWait(c1, "createRoom", {
      name: "Alice",
      mode: "duel",
    });
    const roomId = createAck.roomId;

    const c1Promise = waitForEvent(c1, "roomState");
    const joinAck = await emitWithAck(c2, "joinRoom", { name: "Bob", roomId });
    expect(joinAck.ok).toBe(true);

    const state = await c1Promise;
    expect(Object.keys(state.players)).toHaveLength(2);
    expect(Object.values(state.players).some((p) => p.name === "Bob")).toBe(true);
  });

  it("rejects joining a non-existent room", async () => {
    c1 = await createClient();

    const ack = await emitWithAck(c1, "joinRoom", { name: "Alice", roomId: "ZZZZZZ" });
    expect(ack.error).toBeDefined();
  });

  it("rejects a third player in duel mode", async () => {
    c1 = await createClient();
    c2 = await createClient();
    c3 = await createClient();

    const { ack: createAck } = await emitAndWait(c1, "createRoom", {
      name: "Alice",
      mode: "duel",
    });
    const roomId = createAck.roomId;

    const c1Promise = waitForEvent(c1, "roomState");
    await emitWithAck(c2, "joinRoom", { name: "Bob", roomId });
    await c1Promise;

    const ack = await emitWithAck(c3, "joinRoom", { name: "Charlie", roomId });
    expect(ack.error).toBeDefined();
  });

  // ---- Leaving ----

  it("marks a player as disconnected on leaveRoom", async () => {
    c1 = await createClient();
    c2 = await createClient();

    const { ack: createAck } = await emitAndWait(c1, "createRoom", {
      name: "Alice",
      mode: "duel",
    });
    const roomId = createAck.roomId;

    const joinBroadcast = waitForEvent(c1, "roomState");
    await emitWithAck(c2, "joinRoom", { name: "Bob", roomId });
    await joinBroadcast;

    const leavePromise = waitForEvent(c1, "roomState");
    await emitWithAck(c2, "leaveRoom", { roomId });
    const state = await leavePromise;

    const bob = Object.values(state.players).find((p) => p.name === "Bob");
    expect(bob.disconnected).toBe(true);
  });

  // ---- Disconnection ----

  it("marks player disconnected on socket disconnect", async () => {
    c1 = await createClient();
    c2 = await createClient();

    const { ack: createAck } = await emitAndWait(c1, "createRoom", {
      name: "Alice",
      mode: "duel",
    });
    const roomId = createAck.roomId;

    const joinBroadcast = waitForEvent(c1, "roomState");
    await emitWithAck(c2, "joinRoom", { name: "Bob", roomId });
    await joinBroadcast;

    const dcPromise = waitForEvent(c1, "roomState", 9000);
    c2.disconnect();
    const state = await dcPromise;

    const bob = Object.values(state.players).find((p) => p.name === "Bob");
    expect(bob.disconnected).toBe(true);
  }, 15000);

  it("transfers host on disconnect in battle mode", async () => {
    c1 = await createClient();
    c2 = await createClient();

    const { ack: createAck } = await emitAndWait(c1, "createRoom", {
      name: "Host",
      mode: "battle",
    });
    const roomId = createAck.roomId;

    const joinBroadcast = waitForEvent(c1, "roomState");
    await emitWithAck(c2, "joinRoom", { name: "Player", roomId });
    await joinBroadcast;

    const dcPromise = waitForEvent(c2, "roomState", 9000);
    c1.disconnect();
    const state = await dcPromise;

    expect(state.hostId).toBe(c2.id);
  }, 15000);

  // ---- Reconnection / Resume ----

  it("allows a disconnected player to rejoin with the same name", async () => {
    c1 = await createClient();
    c2 = await createClient();

    const { ack: createAck } = await emitAndWait(c1, "createRoom", {
      name: "Alice",
      mode: "duel",
    });
    const roomId = createAck.roomId;

    const joinBroadcast = waitForEvent(c1, "roomState");
    await emitWithAck(c2, "joinRoom", { name: "Bob", roomId });
    await joinBroadcast;

    const dcPromise = waitForEvent(c1, "roomState", 9000);
    c2.disconnect();
    await dcPromise;

    // Rejoin with same name via a new socket
    c3 = await createClient();
    const rejoinBroadcast = waitForEvent(c1, "roomState");
    const rejoinAck = await emitWithAck(c3, "joinRoom", { name: "Bob", roomId });
    expect(rejoinAck.ok).toBe(true);
    expect(rejoinAck.resumed).toBe(true);

    const state = await rejoinBroadcast;
    const bob = Object.values(state.players).find((p) => p.name === "Bob");
    expect(bob.disconnected).toBe(false);
  }, 15000);

  // ---- Mode variants ----

  it("creates a battle mode room", async () => {
    c1 = await createClient();

    const { event: state } = await emitAndWait(c1, "createRoom", {
      name: "Host",
      mode: "battle",
    });
    expect(state.mode).toBe("battle");
    expect(state.battle).toBeDefined();
    expect(state.battle.started).toBe(false);
  });

  // ---- SyncRoom ----

  it("syncRoom returns current state for an existing room", async () => {
    c1 = await createClient();
    c2 = await createClient();

    const { ack: createAck } = await emitAndWait(c1, "createRoom", {
      name: "Alice",
      mode: "duel",
    });
    const roomId = createAck.roomId;

    const syncAck = await emitWithAck(c2, "syncRoom", { roomId });
    expect(syncAck.ok).toBe(true);
    expect(syncAck.state).toBeDefined();
    expect(syncAck.state.id).toBe(roomId);
  });

  it("syncRoom returns error for non-existent room", async () => {
    c1 = await createClient();

    const syncAck = await emitWithAck(c1, "syncRoom", { roomId: "NOPE99" });
    expect(syncAck.ok).toBe(false);
    expect(syncAck.error).toBeDefined();
  });
});
