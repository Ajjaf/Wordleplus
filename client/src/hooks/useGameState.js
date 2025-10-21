import { useState, useEffect } from "react";
import { socket } from "../socket";
import { MODES } from "../modes/index.js";

export function useGameState(room) {
  const modeKey = room?.mode || "duel";
  const module = MODES[modeKey] || MODES.duel;

  // Use useState and useEffect for initial values to avoid useMemo issues
  const [me, setMe] = useState(null);
  const [players, setPlayers] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);
  const [otherPlayers, setOtherPlayers] = useState([]);
  const [opponent, setOpponent] = useState(null);
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    if (!room?.players || !socket?.id) {
      setMe(null);
      setPlayers([]);
      setAllPlayers([]);
      setOtherPlayers([]);
      setOpponent(null);
      setIsHost(false);
      return;
    }

    // Calculate me
    const player = room.players[socket.id];
    const meValue = player ? { id: socket.id, ...player } : null;
    setMe(meValue);

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
    setPlayers(playersValue);

    // Calculate allPlayers
    const allPlayersValue = Object.entries(room.players).map(([id, p]) => ({
      id,
      ...p,
    }));
    setAllPlayers(allPlayersValue);

    // Calculate otherPlayers
    let otherPlayersValue = [];
    if (room.mode === "battle") {
      otherPlayersValue = Object.entries(room.players)
        .filter(([id]) => id !== room.hostId && id !== socket.id)
        .map(([id, p]) => ({ id, ...p }));
    }
    setOtherPlayers(otherPlayersValue);

    // Calculate opponent
    let opponentValue = null;
    if (room.mode === "duel") {
      const entry = Object.entries(room.players).find(
        ([id]) => id !== socket.id
      );
      opponentValue = entry ? { id: entry[0], ...entry[1] } : null;
    }
    setOpponent(opponentValue);

    // Calculate isHost
    setIsHost(room.hostId === socket.id);
  }, [room]);

  const [modeState, setModeState] = useState({});

  useEffect(() => {
    if (!module?.createSelectors) {
      setModeState({});
      return;
    }
    const next = module.createSelectors({
      room,
      me,
      players,
      opponent,
      isHost,
    });
    setModeState(next || {});
  }, [module, room, me, players, opponent, isHost]);

  const canGuessDuel =
    room?.mode === "duel" ? Boolean(modeState.canGuess) : false;
  const canGuessShared =
    room?.mode === "shared" ? Boolean(modeState.canGuess) : false;
  const canGuessBattle =
    room?.mode === "battle" ? Boolean(modeState.canGuess) : false;

  const letterStates = modeState.letterStates || {};
  const shouldShowVictory = Boolean(modeState.shouldShowVictory);
  const duelSecrets = modeState.duelSecrets || {
    leftSecret: null,
    rightSecret: null,
  };

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
