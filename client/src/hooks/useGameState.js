import { useMemo, useEffect, useState } from "react";
import { socket } from "../socket";
import { MODES } from "../modes/index.js";

export function useGameState(room) {
  const modeKey = room?.mode || "duel";
  const module = MODES[modeKey] || MODES.duel;
  const socketId = socket?.id;

  // Memoize computed player data to avoid unnecessary recalculations
  const { me, players, allPlayers, otherPlayers, opponent, isHost } = useMemo(() => {
    if (!room?.players || !socketId) {
      return {
        me: null,
        players: [],
        allPlayers: [],
        otherPlayers: [],
        opponent: null,
        isHost: false,
      };
    }

    // Calculate me
    const player = room.players[socketId];
    const meValue = player ? { id: socketId, ...player } : null;

    // Calculate players
    let playersValue = [];
    if (room.mode === "battle") {
      playersValue = Object.entries(room.players)
        .filter(([id]) => id !== room.hostId)
        .map(([id, p]) => ({ id, ...p }));
    } else {
      playersValue = Object.entries(room.players).map(([id, p]) => ({
        id,
        ...p,
      }));
    }

    // Calculate allPlayers
    const allPlayersValue = Object.entries(room.players).map(([id, p]) => ({
      id,
      ...p,
    }));

    // Calculate otherPlayers
    let otherPlayersValue = [];
    if (room.mode === "battle") {
      otherPlayersValue = Object.entries(room.players)
        .filter(([id]) => id !== room.hostId && id !== socketId)
        .map(([id, p]) => ({ id, ...p }));
    } else if (room.mode === "battle_ai") {
      otherPlayersValue = Object.entries(room.players)
        .filter(([id]) => id !== socketId)
        .map(([id, p]) => ({ id, ...p }));
    }

    // Calculate opponent
    let opponentValue = null;
    if (room.mode === "duel") {
      const entry = Object.entries(room.players).find(
        ([id]) => id !== socketId
      );
      opponentValue = entry ? { id: entry[0], ...entry[1] } : null;
    }

    // Calculate isHost
    const isHostValue = room.hostId === socketId;

    return {
      me: meValue,
      players: playersValue,
      allPlayers: allPlayersValue,
      otherPlayers: otherPlayersValue,
      opponent: opponentValue,
      isHost: isHostValue,
    };
  }, [room?.players, room?.mode, room?.hostId, socketId]);

  // Memoize mode state selectors to avoid recalculating on every render
  const modeState = useMemo(() => {
    if (!module?.createSelectors) {
      return {};
    }
    return module.createSelectors({
      room,
      me,
      players,
      opponent,
      isHost,
    }) || {};
  }, [module, room, me, players, opponent, isHost]);

  // Memoize derived values from modeState
  const canGuessDuel = useMemo(
    () => (room?.mode === "duel" ? Boolean(modeState.canGuess) : false),
    [room?.mode, modeState.canGuess]
  );
  
  const canGuessShared = useMemo(
    () => (room?.mode === "shared" ? Boolean(modeState.canGuess) : false),
    [room?.mode, modeState.canGuess]
  );
  
  const canGuessBattle = useMemo(
    () =>
      room?.mode === "battle" || room?.mode === "battle_ai"
        ? Boolean(modeState.canGuess)
        : false,
    [room?.mode, modeState.canGuess]
  );

  const letterStates = useMemo(
    () => modeState.letterStates || {},
    [modeState.letterStates]
  );
  
  const shouldShowVictory = useMemo(
    () => Boolean(modeState.shouldShowVictory),
    [modeState.shouldShowVictory]
  );
  
  const duelSecrets = useMemo(
    () => modeState.duelSecrets || {
      leftSecret: null,
      rightSecret: null,
    },
    [modeState.duelSecrets]
  );

  return {
    me,
    players,
    allPlayers,
    otherPlayers,
    opponent,
    isHost,
    canGuessDuel,
    canGuessShared,
    canGuessBattle,
    letterStates,
    shouldShowVictory,
    duelSecrets,
  };
}
