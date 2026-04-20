// server/room-store.js
// Redis-backed room persistence (JSON) with in-memory fallback when REDIS_URL is unset.

import Redis from "ioredis";
import { config } from "./config/env.js";

/** Timer handles and other non-JSON fields stay process-local only. */
const EPHEMERAL_KEYS = new Set([
  "_duelTimer",
  "_aiBattleRoundTimer",
  "_aiBattleCountdownTimer",
]);

/** @type {Redis | null} */
let redisClient = null;
let useMemory = false;
let redisFailureFallbackLogged = false;

/** @type {Map<string, object>} */
const memoryRooms = new Map();

/** Canonical object cache per room id when using Redis (single-writer phase1). */
/** @type {Map<string, object>} */
const redisRoomCache = new Map();

function roomDocKey(roomId) {
  return `${config.redisKeyPrefix}:doc:${roomId}`;
}

function roomIndexKey() {
  return `${config.redisKeyPrefix}:index`;
}

function stripEphemeralForJson(room) {
  return JSON.parse(
    JSON.stringify(room, (key, value) => {
      if (EPHEMERAL_KEYS.has(key)) return undefined;
      return value;
    }),
  );
}

function activateMemoryFallback(reason) {
  if (!useMemory) {
    // Preserve any hydrated rooms so ongoing requests can continue in-process.
    for (const [roomId, room] of redisRoomCache.entries()) {
      memoryRooms.set(roomId, room);
    }
    useMemory = true;
  }
  if (!redisFailureFallbackLogged) {
    console.error(
      `[room-store] Redis unavailable, falling back to in-memory store: ${reason}`,
    );
    redisFailureFallbackLogged = true;
  }
}

/**
 * Connect to Redis or enable in-memory store (tests / local without Redis).
 */
export async function initRoomStore() {
  if (config.redisUrl) {
    try {
      redisClient = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
      });
      redisClient.on("error", (err) => {
        console.error("[room-store] Redis error:", err.message);
      });
      await redisClient.ping();
      useMemory = false;
      redisFailureFallbackLogged = false;
      console.log("[room-store] Connected to Redis");
      return;
    } catch (error) {
      activateMemoryFallback(error?.message || "initialization failed");
      return;
    }
  }

  useMemory = true;
  redisClient = null;
  redisRoomCache.clear();
  redisFailureFallbackLogged = false;
  if (config.isTest) {
    console.log("[room-store] No REDIS_URL — in-memory store (test)");
  } else {
    console.warn(
      "[room-store] No REDIS_URL — in-memory store (dev only; not for multi-instance)",
    );
  }
}

export function isRoomStoreMemoryMode() {
  return useMemory;
}

/**
 * @param {string} roomId
 * @returns {Promise<object | null>}
 */
export async function getRoom(roomId) {
  if (!roomId) return null;
  if (useMemory) {
    return memoryRooms.get(roomId) ?? null;
  }
  if (redisRoomCache.has(roomId)) {
    return redisRoomCache.get(roomId);
  }
  try {
    const raw = await redisClient.get(roomDocKey(roomId));
    if (!raw) return null;
    const room = JSON.parse(raw);
    redisRoomCache.set(roomId, room);
    return room;
  } catch (error) {
    activateMemoryFallback(error?.message || "getRoom failed");
    return memoryRooms.get(roomId) ?? redisRoomCache.get(roomId) ?? null;
  }
}

/**
 * Persist room JSON (ephemeral timer fields excluded).
 * @param {object} room
 */
export async function saveRoom(room) {
  const roomId = room?.id;
  if (!roomId) throw new Error("saveRoom: room.id is required");

  const payload = JSON.stringify(stripEphemeralForJson(room));

  if (useMemory) {
    memoryRooms.set(roomId, room);
    return;
  }

  try {
    await redisClient.set(roomDocKey(roomId), payload);
    await redisClient.sadd(roomIndexKey(), roomId);
    redisRoomCache.set(roomId, room);
  } catch (error) {
    activateMemoryFallback(error?.message || "saveRoom failed");
    memoryRooms.set(roomId, room);
  }
}

/**
 * @param {string} roomId
 */
export async function deleteRoom(roomId) {
  if (!roomId) return;
  if (useMemory) {
    memoryRooms.delete(roomId);
    return;
  }
  try {
    await redisClient.del(roomDocKey(roomId));
    await redisClient.srem(roomIndexKey(), roomId);
    redisRoomCache.delete(roomId);
  } catch (error) {
    activateMemoryFallback(error?.message || "deleteRoom failed");
    memoryRooms.delete(roomId);
    redisRoomCache.delete(roomId);
  }
}

/**
 * @returns {Promise<string[]>}
 */
export async function listRoomIds() {
  if (useMemory) {
    return [...memoryRooms.keys()];
  }
  try {
    const ids = await redisClient.smembers(roomIndexKey());
    return ids || [];
  } catch (error) {
    activateMemoryFallback(error?.message || "listRoomIds failed");
    return [...new Set([...memoryRooms.keys(), ...redisRoomCache.keys()])];
  }
}

/**
 * @returns {Promise<number>}
 */
export async function getActiveRoomCount() {
  if (useMemory) {
    return memoryRooms.size;
  }
  try {
    return await redisClient.scard(roomIndexKey());
  } catch (error) {
    activateMemoryFallback(error?.message || "getActiveRoomCount failed");
    return memoryRooms.size;
  }
}

export async function closeRoomStore() {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      redisClient.disconnect();
    }
    redisClient = null;
  }
  redisRoomCache.clear();
  memoryRooms.clear();
}
