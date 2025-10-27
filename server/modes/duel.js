function resetRoundFlags(room) {
  room.winner = null;
  room.duelReveal = undefined;
  room.roundClosed = false;
}

function bothPlayersReady(room) {
  const ids = Object.keys(room.players || {});
  if (ids.length !== 2) return false;
  return ids.every((id) => {
    const player = room.players[id];
    return player?.ready && player?.secret;
  });
}

function playerIds(room) {
  return Object.keys(room.players || {});
}

function computeDuelWinner(room) {
  let winner = null;
  const ids = playerIds(room);
  if (ids.length === 2) {
    const [a, b] = ids;
    const A = room.players[a];
    const B = room.players[b];
    const aSolved = A.guesses.some((g) => g.guess === room.players[b].secret);
    const bSolved = B.guesses.some((g) => g.guess === room.players[a].secret);

    if (aSolved && !bSolved) winner = a;
    else if (!aSolved && bSolved) winner = b;
    else if ((A.done && B.done) || (aSolved && bSolved)) {
      const aSteps =
        A.guesses.findIndex((g) => g.guess === room.players[b].secret) + 1 || 999;
      const bSteps =
        B.guesses.findIndex((g) => g.guess === room.players[a].secret) + 1 || 999;
      if (aSteps < bSteps) winner = a;
      else if (bSteps < aSteps) winner = b;
      else winner = "draw";
    }
  }

  if (winner) {
    room.winner = winner;
    const ids = playerIds(room);
    if (ids.length === 2) {
      const [a, b] = ids;
      const A = room.players[a];
      const B = room.players[b];
      if (winner === "draw") {
        A.streak = 0;
        B.streak = 0;
      }
      room.duelReveal = { [a]: A.secret, [b]: B.secret };
      room.started = false;
      room.duelDeadline = null;
    }
  }
}

export function initDuelRoom(room) {
  resetRoundFlags(room);
}

export function canJoinDuel(room) {
  const ids = playerIds(room);
  if (ids.filter((id) => !room.players[id].disconnected).length >= 2) {
    return { error: "Duel rooms support exactly two players" };
  }
  return { ok: true };
}

export function handleSetSecret({ room, socketId, secret, isValidWord }) {
  if (!isValidWord(secret)) {
    return { error: "Invalid word" };
  }
  const player = room.players[socketId];
  if (!player) {
    return { error: "Player not in room" };
  }
  player.secret = secret.toUpperCase();
  player.ready = true;

  const started = bothPlayersReady(room);
  return { ok: true, started };
}

export function startDuelRound({ room, roundMs, scheduleTimeout }) {
  const ids = playerIds(room);
  if (ids.length !== 2) return { error: "Need two players" };

  resetRoundFlags(room);
  room.started = true;
  room.duelDeadline = Date.now() + roundMs;

  ids.forEach((id) => {
    room.players[id].guesses = [];
    room.players[id].done = false;
  });

  if (room._duelTimer) {
    clearTimeout(room._duelTimer);
    room._duelTimer = null;
  }

  if (typeof scheduleTimeout === "function") {
    room._duelTimer = scheduleTimeout();
  }

  return { ok: true };
}

export function handleDuelGuess({
  room,
  socketId,
  guess,
  scoreGuess,
  updateStatsOnWin,
  getOpponent,
}) {
  if (!room.started) return { error: "Game not started" };

  const player = room.players[socketId];
  if (!player) return { error: "Not in room" };
  if (player.done) return { error: "You already finished" };

  const oppId = getOpponent(room, socketId);
  if (!oppId) return { error: "Waiting for opponent" };
  const opp = room.players[oppId];
  if (!opp?.secret) return { error: "Opponent not ready" };

  const pattern = scoreGuess(opp.secret, guess);
  player.guesses.push({ guess, pattern });

  if (guess === opp.secret || player.guesses.length >= 6) {
    player.done = true;
  }

  computeDuelWinner(room);

  let roundEnded = false;
  const ids = playerIds(room);
  if (ids.length === 2) {
    const [a, b] = ids;
    const A = room.players[a];
    const B = room.players[b];
    const bothDone = A.done && B.done;

    if ((room.winner || bothDone) && !room.roundClosed) {
      room.started = false;
      room.duelReveal = { [a]: A.secret, [b]: B.secret };
      if (room.winner && room.winner !== "draw") {
        updateStatsOnWin(room, room.winner);
      }
      room.roundClosed = true;
      room.duelDeadline = null;
      roundEnded = true;
    }
  }

  return { ok: true, pattern, roundEnded };
}

export function clearDuelTimer(room) {
  if (room._duelTimer) {
    clearTimeout(room._duelTimer);
    room._duelTimer = null;
  }
}

export function resetDuelRound(room) {
  Object.values(room.players).forEach((p) => {
    p.guesses = [];
    p.done = false;
    p.ready = false;
    p.secret = null;
    p.rematchRequested = false;
  });
  room.started = false;
  resetRoundFlags(room);
  room.duelDeadline = null;
  clearDuelTimer(room);
}

export function resolveDuelTimeout({ room }) {
  Object.values(room.players).forEach((p) => (p.done = true));
  computeDuelWinner(room);
  if (!room.duelReveal) {
    const ids = playerIds(room);
    if (ids.length === 2) {
      const [a, b] = ids;
      room.duelReveal = {
        [a]: room.players[a].secret,
        [b]: room.players[b].secret,
      };
    }
  }
  room.started = false;
  room.duelDeadline = null;
  room.roundClosed = true;
}
