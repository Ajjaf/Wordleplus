import { buildLetterStates } from "../utils.js";

export function createSelectors({ room, me }) {
  const battle = room?.battle;
  const hostMode = battle?.aiHost?.mode || "auto";
  const hostClaimedBy = battle?.aiHost?.claimedBy || null;
  const isClaimedHost = hostMode === "player" && hostClaimedBy === me?.id;

  const canGuess =
    room?.mode === "battle_ai" &&
    Boolean(battle?.started) &&
    Boolean(me) &&
    !isClaimedHost &&
    !me?.done &&
    (me?.guesses?.length ?? 0) < 6;

  const letterStates = buildLetterStates(me?.guesses);

  return {
    canGuess,
    letterStates,
    shouldShowVictory: false,
    deadline: battle?.deadline ?? null,
    countdownEndsAt: battle?.countdownEndsAt ?? null,
    hostMode,
    hostClaimedBy,
    isClaimedHost,
    pendingStart: Boolean(battle?.pendingStart || battle?.aiHost?.pendingStart),
  };
}


