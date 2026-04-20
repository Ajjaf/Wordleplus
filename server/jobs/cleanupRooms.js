const DISCONNECT_TTL_MS = 30 * 60 * 1000;
const ROOM_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Start periodic room cleanup against Redis-backed room ids.
 * Keeps gameplay behavior the same as the in-file cleanup flow.
 */
export function startRoomCleanupInterval({
  listRoomIds,
  getRoom,
  saveRoom,
  deleteRoom,
  clearPendingDisconnect,
  clearAiBattleTimers,
  duelMode,
  battleMode,
  maybeEnsureAiBattleRound,
  isAiBattleEventActive,
  hostDisconnectGraceMs,
}) {
  return setInterval(() => {
    void (async () => {
      const now = Date.now();
      for (const roomId of await listRoomIds()) {
        const room = await getRoom(roomId);
        if (!room) {
          // Remove stale ids left in the index.
          await deleteRoom(roomId);
          continue;
        }

        // Preserve event room while the AI battle event is active.
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
                  (id) => !room.players[id].disconnected && id !== pid,
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
          (pid) => !room.players[pid].disconnected,
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
            duelMode.clearDuelTimer(room);
          }

          const oldestDisconnect = Math.min(
            ...Object.values(room.players).map((p) =>
              typeof p.disconnectedAt === "number" ? p.disconnectedAt : Infinity,
            ),
          );
          if (
            !hostPlayer ||
            !hostPlayer.disconnectedAt ||
            now - hostPlayer.disconnectedAt > hostDisconnectGraceMs ||
            now - oldestDisconnect > hostDisconnectGraceMs
          ) {
            for (const pid of Object.keys(room.players)) {
              clearPendingDisconnect(roomId, pid);
            }
            await deleteRoom(roomId);
          } else {
            await saveRoom(room);
          }
          continue;
        }

        if ((!hostPlayer || hostPlayer.disconnected) && room.mode !== "battle_ai") {
          const nextHost = activeIds[0];
          if (nextHost) {
            room.hostId = nextHost;
            room.updatedAt = now;
            updated = true;
          }
        }

        if (updated) {
          await saveRoom(room);
        }

        if (
          room.mode === "battle_ai" &&
          room.battle.aiHost?.mode === "auto" &&
          !room.battle.started &&
          !room.battle.countdownEndsAt
        ) {
          void maybeEnsureAiBattleRound(roomId);
        }
      }
    })();
  }, ROOM_CLEANUP_INTERVAL_MS);
}

