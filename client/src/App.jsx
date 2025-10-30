import React, { useEffect, useState, useMemo, useCallback } from "react";
import { socket } from "./socket";

// Extracted Components
import HomeScreen from "./screens/HomeScreenV2.jsx";
import DuelGameScreen from "./screens/DuelGameScreen.jsx";
import SharedDuelGameScreen from "./screens/SharedDuelGameScreen.jsx";
import DailyGameScreen from "./screens/DailyGameScreen.jsx";
import BattleGameScreen from "./screens/BattleGameScreen.jsx";
import HostSpectateScreen from "./screens/HostSpectateScreen.jsx";
import VictoryModal from "./components/VictoryModal.jsx";
import NavHeaderV2 from "./components/ui/NavHeaderV2.jsx";
import Backdrop from "./components/Backdrop.jsx";
import { RefreshCw } from "lucide-react";

// Extracted Hooks
import { useGameState } from "@/hooks/useGameState";
import { useSocketConnection } from "./hooks/useSocketConnection.js";
import { useGameActions } from "./hooks/useGameActions.js";
import { useRoomManagement } from "./hooks/useRoomManagement.js";
import { buildLetterStates } from "./modes/utils.js";

// Error Notification System
import { ErrorNotificationProvider } from "./contexts/ErrorNotificationContext.jsx";

// UI Components

const LS_LAST_ROOM = "wp.lastRoomId";
const LS_LAST_NAME = "wp.lastName";
const LS_LAST_MODE = "wp.lastMode";
const LS_LAST_SOCKET = "wp.lastSocketId";

export default function App() {
  const [screen, setScreen] = useState("home");
  const [name, setName] = useState(localStorage.getItem(LS_LAST_NAME) || "");
  const [roomId, setRoomId] = useState(
    localStorage.getItem(LS_LAST_ROOM) || ""
  );
  const [mode, setMode] = useState(
    localStorage.getItem(LS_LAST_MODE) || "duel"
  );

  // Battle
  const [hostWord, setHostWord] = useState("");

  const [msg, setMsg] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const [showActiveError, setShowActiveError] = useState(false);
  const [currentGuess, setCurrentGuess] = useState("");
  const [dailyChallenge, setDailyChallenge] = useState(null);
  const [dailyGuesses, setDailyGuesses] = useState([]);
  const [dailyPatternResponses, setDailyPatternResponses] = useState([]);
  const [dailyCurrentGuess, setDailyCurrentGuess] = useState("");
  const [dailyStatus, setDailyStatus] = useState("");
  const [dailyGameOver, setDailyGameOver] = useState(false);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyCorrectWord, setDailyCorrectWord] = useState(null);
  const [dailyShakeKey, setDailyShakeKey] = useState(0);
  const [dailyGuessFlipKey, setDailyGuessFlipKey] = useState(0);
  const [dailyShowActiveError, setDailyShowActiveError] = useState(false);
  const [dailyNotificationMessage, setDailyNotificationMessage] = useState("");
  const maxDailyGuessesDefault = 6;
  const dailyWordLengthDefault = 5;
  const [showVictory, setShowVictory] = useState(false);
  const wasHost =
    (typeof window !== "undefined" &&
      localStorage.getItem("wp.lastSocketId.wasHost") === "true") ||
    false;

  // consider yourself host if server says so OR you were host moments ago
  // Room state management
  const [room, setRoom] = useState(null);

  // Derive winner from room state
  const winner = useMemo(() => {
    if (!room) return null;
    if (room.mode === "duel") return room.winner;
    if (room.mode === "battle" || room.mode === "battle_ai")
      return room.battle?.winner;
    return null;
  }, [room]);
  useEffect(() => {
    const onState = (data) => {
      // Room state updated
      setRoom(data);
    };
    socket.on("roomState", onState);
    return () => socket.off("roomState", onState);
  }, []);

  // Extracted hooks
  const {
    me,
    players,
    allPlayers,
    otherPlayers,
    opponent,
    isHost,
    canGuessDuel,
    canGuessBattle,
    // added in useGameState
    canGuessShared,
    letterStates,
    shouldShowVictory,
    duelSecrets,
  } = useGameState(room);

  const dailyWordLength = dailyChallenge?.wordLength || dailyWordLengthDefault;
  const maxDailyGuesses = dailyChallenge?.maxGuesses || maxDailyGuessesDefault;
  const dailyGuessEntries = useMemo(
    () =>
      dailyGuesses.map((guess, idx) => {
        const pattern = dailyPatternResponses[idx] || [];
        const padded = Array.from({ length: dailyWordLength }, (_, i) => {
          const value = pattern[i];
          if (value === "green" || value === "correct") return "green";
          if (value === "yellow" || value === "present") return "yellow";
          if (value === "gray" || value === "absent") return "gray";
          return "empty";
        });
        return { guess, pattern: padded };
      }),
    [dailyGuesses, dailyPatternResponses, dailyWordLength]
  );
  const dailyLetterStates = useMemo(
    () => buildLetterStates(dailyGuessEntries),
    [dailyGuessEntries]
  );

  const { canRejoin, doRejoin, savedRoomId } = useSocketConnection(
    room,
    setScreen
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (name && name.trim()) {
      window.localStorage.setItem(LS_LAST_NAME, name.trim());
    } else {
      window.localStorage.removeItem(LS_LAST_NAME);
    }
  }, [name]);

  const rejoinNavControl = canRejoin ? (
    <button
      type="button"
      onClick={doRejoin}
      className="inline-flex items-center gap-2 h-9 px-3 rounded-full border border-white/20 bg-white/10 text-xs font-semibold uppercase tracking-wide text-white/90 hover:bg-white/20 transition"
      aria-label={
        savedRoomId
          ? `Rejoin room ${savedRoomId.toUpperCase()}`
          : "Rejoin your last room"
      }
    >
      <RefreshCw className="w-4 h-4 text-white/80" />
      <span className="hidden sm:inline">
        Rejoin {savedRoomId?.toUpperCase() || "room"}
      </span>
      <span className="sm:hidden">Rejoin</span>
    </button>
  ) : null;

  const actionsByMode = useGameActions();
  const duelActions = actionsByMode.duel;
  const sharedActions = actionsByMode.shared;
  const battleActions = actionsByMode.battle;
  const aiBattleActions = actionsByMode["battle_ai"];
  const dailyActions = actionsByMode.daily;

  const battlePendingStart = Boolean(
    room?.battle?.pendingStart || room?.battle?.aiHost?.pendingStart
  );

  const {
    createRoom,
    joinRoom,
    persistSession,
    getSavedSession,
    clearSavedSession,
    goHome,
  } = useRoomManagement();

  const resetDailyProgress = useCallback(() => {
    setDailyChallenge(null);
    setDailyGuesses([]);
    setDailyPatternResponses([]);
    setDailyCurrentGuess("");
    setDailyStatus("");
    setDailyGameOver(false);
    setDailyLoading(false);
    setDailyCorrectWord(null);
    setDailyShakeKey(0);
    setDailyGuessFlipKey(0);
    setDailyShowActiveError(false);
    setDailyNotificationMessage("");
  }, []);

  const startDailyMode = useCallback(async () => {
    persistSession({ name, mode: "daily" });
    setMode("daily");
    setMsg("");
    goHome();
    setRoom(null);
    setRoomId("");
    setCurrentGuess("");
    setShowVictory(false);
    resetDailyProgress();
    setScreen("daily");
    setDailyLoading(true);
    try {
      const response = await dailyActions.loadChallenge();
      if (response?.error) {
        setDailyStatus(response.error);
        setDailyChallenge(null);
        return;
      }
      setDailyChallenge(response);
      const responseWordLength = response?.wordLength || dailyWordLengthDefault;
      if (Array.isArray(response?.guesses)) {
        setDailyGuesses(
          response.guesses.map((g) => String(g || "").toUpperCase())
        );
      }
      if (Array.isArray(response?.patterns)) {
        setDailyPatternResponses(
          response.patterns.map((pattern = []) =>
            Array.from({ length: responseWordLength }, (_, i) => {
              const value = pattern[i];
              if (value === "green" || value === "correct") return "green";
              if (value === "yellow" || value === "present") return "yellow";
              if (value === "gray" || value === "absent") return "gray";
              return "empty";
            })
          )
        );
      }
      setDailyGuessFlipKey(0);
      if (typeof response?.currentGuess === "string") {
        setDailyCurrentGuess(response.currentGuess.toUpperCase());
      }
      if (typeof response?.status === "string") {
        setDailyStatus(response.status);
      } else {
        setDailyStatus("");
      }
      if (response?.gameOver) {
        setDailyGameOver(true);
      }
      if (response?.word) {
        setDailyCorrectWord(response.word.toUpperCase());
      }
    } catch (err) {
      setDailyStatus(err?.message || "Unable to load daily challenge");
      setDailyChallenge(null);
    } finally {
      setDailyLoading(false);
    }
  }, [dailyActions, name, persistSession, resetDailyProgress]);

  const handleDailySubmit = useCallback(async () => {
    if (screen !== "daily") return;
    if (!dailyChallenge) return;
    if (dailyGameOver) return;
    if (dailyLoading) return;
    if (dailyGuesses.length >= maxDailyGuesses) {
      setDailyNotificationMessage("No more guesses left");
      setDailyGameOver(true);
      return;
    }
    if (dailyCurrentGuess.length !== dailyWordLength) {
      setDailyNotificationMessage(`Need ${dailyWordLength} letters`);
      setDailyShakeKey((prev) => prev + 1);
      setDailyShowActiveError(true);
      setTimeout(() => setDailyShowActiveError(false), 250);
      return;
    }
    if (dailyGuesses.includes(dailyCurrentGuess)) {
      setDailyNotificationMessage("Already tried that word");
      setDailyShakeKey((prev) => prev + 1);
      setDailyShowActiveError(true);
      setTimeout(() => setDailyShowActiveError(false), 250);
      return;
    }

    setDailyLoading(true);
    try {
      const result = await dailyActions.submitGuess(
        dailyCurrentGuess.toLowerCase()
      );
      if (result?.error) {
        setDailyNotificationMessage(result.error);
        setDailyShakeKey((prev) => prev + 1);
        setDailyShowActiveError(true);
        setTimeout(() => setDailyShowActiveError(false), 250);
        return;
      }

      const patternRaw = Array.isArray(result?.pattern) ? result.pattern : [];
      const normalized = Array.from({ length: dailyWordLength }, (_, idx) => {
        const value = patternRaw[idx];
        if (value === "green" || value === "correct") return "green";
        if (value === "yellow" || value === "present") return "yellow";
        if (value === "gray" || value === "absent") return "gray";
        return "empty";
      });

      const nextGuessCount = dailyGuesses.length + 1;
      const solved =
        normalized.every((state) => state === "green") ||
        Boolean(result?.correct);
      const exhausted = nextGuessCount >= maxDailyGuesses;

      setDailyGuesses((prev) => [...prev, dailyCurrentGuess]);
      setDailyPatternResponses((prev) => [...prev, normalized]);
      setDailyGuessFlipKey((prev) => prev + 1);
      setDailyCurrentGuess("");
      setDailyGameOver(
        solved || exhausted || Boolean(result?.complete || result?.gameOver)
      );

      // Store correct word if game is over
      if (result?.word) {
        setDailyCorrectWord(result.word.toUpperCase());
        // Show correct word in notification if player lost
        if (!solved && (exhausted || result?.gameOver)) {
          setDailyNotificationMessage(
            `The word was: ${result.word.toUpperCase()}`
          );
        }
      }

      if (solved) {
        setShowVictory(true);
      }
    } catch (err) {
      setDailyNotificationMessage(err?.message || "Unable to submit guess");
      setDailyShakeKey((prev) => prev + 1);
      setDailyShowActiveError(true);
      setTimeout(() => setDailyShowActiveError(false), 250);
    } finally {
      setDailyLoading(false);
    }
  }, [
    screen,
    dailyActions,
    dailyChallenge,
    dailyCurrentGuess,
    dailyGameOver,
    dailyGuesses,
    dailyLoading,
    dailyWordLength,
    maxDailyGuesses,
  ]);

  const handleDailyKey = useCallback(
    (key) => {
      if (screen !== "daily") return;
      if (!dailyChallenge) return;
      if (dailyGameOver || dailyLoading) return;

      if (key === "ENTER") {
        handleDailySubmit();
      } else if (key === "BACKSPACE") {
        setDailyCurrentGuess((prev) => prev.slice(0, -1));
        setDailyNotificationMessage("");
      } else if (
        /^[A-Z]$/.test(key) &&
        dailyCurrentGuess.length < dailyWordLength
      ) {
        setDailyCurrentGuess((prev) => prev + key);
        setDailyNotificationMessage("");
      }
    },
    [
      screen,
      dailyChallenge,
      dailyGameOver,
      dailyLoading,
      dailyCurrentGuess,
      dailyWordLength,
      handleDailySubmit,
    ]
  );

  useEffect(() => {
    if (screen !== "daily") return;

    const onKeyDown = (e) => {
      const key =
        e.key === "Enter"
          ? "ENTER"
          : e.key === "Backspace"
          ? "BACKSPACE"
          : /^[a-zA-Z]$/.test(e.key)
          ? e.key.toUpperCase()
          : null;
      if (!key) return;
      handleDailyKey(key);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [screen, handleDailyKey]);

  // Show victory when there is a real outcome (not just started=false at lobby)
  useEffect(() => {
    if (!room) return;

    if (room.mode === "duel") {
      // show ONLY if we have a winner or a duelReveal payload
      const shouldShow = Boolean(room.winner) || Boolean(room.duelReveal);
      setShowVictory(shouldShow);
      return;
    }

    if (room.mode === "shared") {
      // show ONLY if we have a winner or the game ended
      const shouldShow =
        Boolean(room.shared?.winner) || Boolean(room.shared?.lastRevealedWord);
      setShowVictory(shouldShow);
      return;
    }

    if (room.mode === "battle" || room.mode === "battle_ai") {
      // For battle mode, don't show victory modal - let host directly start new rounds
      // The game results are shown in the HostSpectateScreen instead
      setShowVictory(false);
    }
  }, [
    room?.mode,
    room?.winner,
    room?.duelReveal,
    room?.shared?.winner,
    room?.shared?.lastRevealedWord,
    room?.battle?.started,
    room?.battle?.winner,
    room?.battle?.reveal,
  ]);

  // small transient toast support
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 2000);
    return () => clearTimeout(t);
  }, [msg]);

  // actions
  async function create(targetMode = mode) {
    const effectiveMode = targetMode || mode || "duel";
    if (effectiveMode !== mode) {
      setMode(effectiveMode);
    }
    const result = await createRoom(name, effectiveMode);
    if (result?.success) {
      setRoomId(result.roomId);
      setCurrentGuess("");
      setShowVictory(false);
      // For both modes, go directly to game screen
      setScreen("game");
    } else {
      setMsg(result?.error || "Failed to create room");
    }
  }

  async function join(targetRoomId = roomId, preferredMode) {
    const normalizedId = (targetRoomId || "").toUpperCase();
    const result = await joinRoom(name, normalizedId);
    if (result?.error) {
      setMsg(result.error);
    } else {
      const joinedMode = result?.mode || preferredMode;
      if (joinedMode && joinedMode !== mode) {
        setMode(joinedMode);
      }
      setRoomId(normalizedId);
      setCurrentGuess("");
      setShowVictory(false);
      setScreen("game");
    }
  }

  function bumpActiveRowError() {
    setShowActiveError(true);
    setShakeKey((k) => k + 1);
    // turn it back off so the next error can retrigger
    setTimeout(() => setShowActiveError(false), 300);
  }

  async function handleSubmitDuelGuess() {
    if (!(canGuessDuel || canGuessShared)) return;
    if (currentGuess.length !== 5) {
      bumpActiveRowError();
      return;
    }

    // Use appropriate function based on mode
    const v =
      room?.mode === "shared"
        ? await sharedActions.submitGuess(roomId, currentGuess, canGuessShared)
        : await duelActions.submitGuess(roomId, currentGuess, canGuessDuel);

    if (v?.error) {
      bumpActiveRowError();
      return;
    }
    setCurrentGuess("");
    setShowActiveError(false);
  }

  // Keyboard handlers
  const handleDuelKey = (key) => {
    if (!(canGuessDuel || canGuessShared)) return;
    if (key === "ENTER") handleSubmitDuelGuess();
    else if (key === "BACKSPACE") setCurrentGuess((p) => p.slice(0, -1));
    else if (currentGuess.length < 5 && /^[A-Z]$/.test(key))
      setCurrentGuess((p) => p + key);
  };

  const handleBattleKey = async (key) => {
    if (!canGuessBattle) return;
    if (key === "ENTER") {
      if (currentGuess.length === 5) {
        const actions =
          room?.mode === "battle_ai" ? aiBattleActions : battleActions;
        const result = await actions?.submitGuess?.(
          roomId,
          currentGuess,
          canGuessBattle
        );
        if (result?.error) {
          bumpActiveRowError();
          return;
        }
        setCurrentGuess("");
        setShowActiveError(false);
      } else {
        setShowActiveError(true);
        setShakeKey((k) => k + 1);
      }
    } else if (key === "BACKSPACE") setCurrentGuess((p) => p.slice(0, -1));
    else if (currentGuess.length < 5 && /^[A-Z]$/.test(key))
      setCurrentGuess((p) => p + key);
  };

  useEffect(() => {
    if (screen !== "game") return;

    const onKeyDown = (e) => {
      // If I'm the host in Battle and the round hasn't started yet,
      // we're on the "type secret" screen â€” don't handle keys globally.
      const hostTyping =
        room?.mode === "battle" ||
        (room?.mode === "battle_ai" &&
          (isHost || wasHost) &&
          !room?.battle?.started);
      if (hostTyping) return;
      const key =
        e.key === "Enter"
          ? "ENTER"
          : e.key === "Backspace"
          ? "BACKSPACE"
          : /^[a-zA-Z]$/.test(e.key)
          ? e.key.toUpperCase()
          : null;
      if (!key) return;
      if (room?.mode === "duel") handleDuelKey(key);
      if (room?.mode === "shared") handleDuelKey(key); // Shared mode uses same logic as duel
      if (room?.mode === "battle" || room?.mode === "battle_ai") {
        // Hosts type the secret word; don't capture their keys here.
        if (isHost && !room?.battle?.started) return;
        handleBattleKey(key);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    screen,
    room?.mode,
    room?.battle?.started,
    isHost,
    wasHost,
    canGuessDuel,
    canGuessShared,
    canGuessBattle,
    currentGuess,
  ]);
  useEffect(() => {
    if (room?.mode === "duel" && room?.started) {
      setScreen("game");
      setCurrentGuess("");
    } else if (room?.mode === "battle" || room?.mode === "battle_ai") {
      // For battle mode, always go to game screen (which shows host spectate view or player view)
      setScreen("game");
      setCurrentGuess("");
    }
  }, [
    room?.started,
    room?.battle?.started,
    room?.battle?.winner,
    room?.battle?.reveal,
    room?.mode,
  ]);

  const viewingHost =
    (room?.mode === "battle" || room?.mode === "battle_ai") &&
    (isHost || (wasHost && me?.id === room?.hostId));
  useEffect(() => {
    if (room?.mode === "battle" || room?.mode === "battle_ai") {
      localStorage.setItem("wp.lastSocketId.wasHost", String(isHost));
    }
  }, [room?.mode, isHost]);

  return (
    <div
      className="overflow-x-hidden"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <Backdrop />

      {/* Game screens occupy full viewport */}
      {screen === "game" && (
        <div className="flex h-[100dvh] flex-col overflow-hidden">
          <NavHeaderV2
            onHomeClick={() => {
              goHome();
              setRoom(null);
              setScreen("home");
              setRoomId("");
              setCurrentGuess("");
              setShowVictory(false);
            }}
            modeLabel={
              room?.mode === "shared"
                ? "Shared Wordle"
                : room?.mode === "duel"
                ? "Duel Mode"
                : room?.mode === "battle" || room?.mode === "battle_ai"
                ? "Battle Royale"
                : null
            }
            right={rejoinNavControl}
            roomId={room?.id}
            profileMenuVariant="game"
          />

          <div className="relative flex-1 overflow-hidden">
            {/* Victory Modal shown while in-game as overlay */}
            {showVictory && (
              <VictoryModal
                open={showVictory}
                onOpenChange={setShowVictory}
                mode={room?.mode}
                winnerName={
                  room?.mode === "shared"
                    ? room?.shared?.winner && room?.shared?.winner !== "draw"
                      ? room?.players?.[room.shared.winner]?.name
                      : null
                    : room?.mode === "duel"
                    ? room?.winner && room?.winner !== "draw"
                      ? room?.players?.[room.winner]?.name
                      : null
                    : null
                }
                leftName={
                  room?.mode === "duel"
                    ? Object.values(room?.players || {})[0]?.name
                    : null
                }
                rightName={
                  room?.mode === "duel"
                    ? Object.values(room?.players || {})[1]?.name
                    : null
                }
                leftSecret={
                  room?.mode === "duel"
                    ? room?.duelReveal?.[Object.keys(room?.players || {})[0]]
                    : null
                }
                rightSecret={
                  room?.mode === "duel"
                    ? room?.duelReveal?.[Object.keys(room?.players || {})[1]]
                    : null
                }
                battleSecret={
                  room?.mode === "shared"
                    ? room?.shared?.lastRevealedWord
                    : room?.battle?.lastRevealedWord
                }
                onPlayAgain={
                  room?.mode === "shared" || room?.mode === "duel"
                    ? async () => {
                        setShowVictory(false);
                        try {
                          await duelActions.playAgain(roomId);
                        } catch (e) {}
                      }
                    : () => setShowVictory(false)
                }
                showPlayAgain={room?.mode === "shared" || room?.mode === "duel"}
              />
            )}

            <div className="h-full overflow-hidden">
              {/* DUEL GAME */}
              {room?.mode === "duel" && (
                <DuelGameScreen
                  room={room}
                  me={me}
                  opponent={opponent}
                  currentGuess={currentGuess}
                  shakeKey={shakeKey}
                  showActiveError={showActiveError}
                  letterStates={letterStates}
                  onKeyPress={handleDuelKey}
                  onSubmitSecret={async (secret) => {
                    const result = await duelActions.submitSecret(
                      roomId,
                      secret
                    ); // { ok: true } or { error: "..." }
                    if (result?.error) setMsg(result.error);
                    return result;
                  }}
                  onRematch={async () => {
                    try {
                      await duelActions.playAgain(roomId);
                    } catch (e) {
                      // no-op; UI will still update via roomState events
                    }
                  }}
                />
              )}

              {/* SHARED DUEL */}
              {room?.mode === "shared" && (
                <SharedDuelGameScreen
                  room={room}
                  me={me}
                  currentGuess={currentGuess}
                  letterStates={letterStates}
                  onKeyPress={handleDuelKey}
                  onStartShared={async () => {
                    const res = await sharedActions.startRound(roomId);
                    if (res?.error) {
                      console.error("Start shared error:", res.error);
                      setMsg(res.error || "Failed to start shared duel");
                    }
                    return res;
                  }}
                  onRematch={async () => {
                    try {
                      await sharedActions.playAgain(roomId);
                    } catch (e) {
                      // no-op
                    }
                  }}
                />
              )}

              {/* BATTLE ROYALE - Host sees spectate view, players see game view */}
              {(room?.mode === "battle" || room?.mode === "battle_ai") &&
                (viewingHost ? (
                  <HostSpectateScreen
                    key="host"
                    room={room}
                    players={players}
                    onWordSubmit={async (word) => {
                      const actions =
                        room?.mode === "battle_ai"
                          ? aiBattleActions
                          : battleActions;
                      const result = await actions?.setWordAndStart?.(
                        room.id,
                        word
                      );
                      if (result?.error) {
                        setMsg(result.error);
                      }
                    }}
                    onStartAiRound={async () => {
                      console.debug("onStartAiRound called", { roomId: room?.id });
                      if (!room?.id) {
                        const error = "No room id available";
                        setMsg(error);
                        console.warn("onStartAiRound failed:", error);
                        return { error };
                      }
                      try {
                        if (!aiBattleActions?.startRound) {
                          throw new Error("AI battle actions not available");
                        }
                        const result = await aiBattleActions.startRound(room.id);
                        console.debug("aiBattleActions.startRound result", result);
                        if (result?.error) {
                          setMsg(result.error);
                          return result;
                        }
                        return { success: true };
                      } catch (err) {
                        const error = err?.message || "Failed to start AI battle";
                        setMsg(error);
                        console.error("onStartAiRound error", err);
                        return { error };
                      }
                    }}
                    onReleaseHost={
                      room?.mode === "battle_ai"
                        ? async () => {
                            const result = await aiBattleActions?.releaseHost?.(
                              room.id
                            );
                            if (result?.error) setMsg(result.error);
                          }
                        : undefined
                    }
                  />
                ) : (
                  <BattleGameScreen
                    key="player" // force a full swap
                    room={room}
                    players={players}
                    allPlayers={allPlayers}
                    otherPlayers={otherPlayers}
                    me={me}
                    isHost={isHost}
                    currentGuess={currentGuess}
                    shakeKey={shakeKey}
                    showActiveError={showActiveError}
                    letterStates={letterStates}
                    canGuessBattle={canGuessBattle}
                    onKeyPress={handleBattleKey}
                    deadline={room?.battle?.deadline ?? null}
                    countdownEndsAt={room?.battle?.countdownEndsAt ?? null}
                    pendingStart={room?.battle?.pendingStart ?? false}
                    onClaimHost={
                      room?.mode === "battle_ai"
                        ? async () => {
                            const result = await aiBattleActions?.claimHost?.(
                              room.id
                            );
                            if (result?.error) setMsg(result.error);
                          }
                        : undefined
                    }
                    onStartAiRound={async () => {
                      console.debug("onStartAiRound (player view) called", {
                        roomId: room?.id,
                      });
                      if (!room?.id) {
                        const error = "No room id available";
                        setMsg(error);
                        console.warn("onStartAiRound failed:", error);
                        return { error };
                      }
                      try {
                        if (!aiBattleActions?.startRound) {
                          throw new Error("AI battle actions not available");
                        }
                        const result = await aiBattleActions.startRound(room.id);
                        console.debug("aiBattleActions.startRound result", result);
                        if (result?.error) {
                          setMsg(result.error);
                          return result;
                        }
                        return { success: true };
                      } catch (err) {
                        const error = err?.message || "Failed to start AI battle";
                        setMsg(error);
                        console.error("onStartAiRound error", err);
                        return { error };
                      }
                    }}
                  />
                ))}
            </div>
          </div>
        </div>
      )}

      {screen === "daily" && (
        <div className="min-h-screen flex flex-col">
          <NavHeaderV2
            onHomeClick={() => {
              goHome();
              resetDailyProgress();
              setScreen("home");
              setMode("daily");
              setRoom(null);
              setRoomId("");
              setShowVictory(false);
            }}
            modeLabel="Daily Challenge"
            roomId={room?.id}
            profileMenuVariant="game"
          />
          <div className="flex-1">
            <DailyGameScreen
              challenge={dailyChallenge}
              guesses={dailyGuessEntries}
              currentGuess={dailyCurrentGuess}
              letterStates={dailyLetterStates}
              onKeyPress={handleDailyKey}
              statusMessage={dailyStatus}
              loading={dailyLoading}
              gameOver={dailyGameOver}
              correctWord={dailyCorrectWord}
              won={dailyGuessEntries.some((g) =>
                g.pattern?.every((s) => s === "green")
              )}
              shakeKey={dailyShakeKey}
              showActiveError={dailyShowActiveError}
              notificationMessage={dailyNotificationMessage}
              onNotificationDismiss={() => setDailyNotificationMessage("")}
              guessFlipKey={dailyGuessFlipKey}
            />
          </div>
          {/* Victory Modal for Daily Challenge */}
          {showVictory && dailyGameOver && (
            <VictoryModal
              open={showVictory}
              onOpenChange={setShowVictory}
              mode="daily"
              winnerName={name}
              showPlayAgain={false}
            />
          )}
        </div>
      )}

      {/* Main app container for home/lobby screens - Constrained width */}
      {screen !== "game" && screen !== "daily" && (
        <div className="min-h-screen overflow-y-auto">
          <NavHeaderV2
            onHomeClick={() => {
              goHome();
              setRoom(null);
              setScreen("home");
              setRoomId("");
              setCurrentGuess("");
              setShowVictory(false);
            }}
            modeLabel={
              screen === "home"
                ? null
                : mode === "shared"
                ? "Shared Wordle"
                : mode === "duel"
                ? "Duel Mode"
                : mode === "battle"
                ? "Battle Royale"
                : null
            }
            right={!viewingHost ? rejoinNavControl : null}
            roomId={screen === "home" ? null : roomId}
          />

          <div className="max-w-7xl mx-auto p-4 font-sans">
            {screen === "home" && (
              <HomeScreen
                name={name}
                setName={setName}
                roomId={roomId}
                setRoomId={setRoomId}
                mode={mode}
                setMode={setMode}
                onCreate={create}
                onJoin={join}
                onPlayDaily={startDailyMode}
                message={msg}
              />
            )}
            {/* Victory Modal */}
            {showVictory && (
              <VictoryModal
                open={showVictory}
                onOpenChange={setShowVictory}
                mode={room?.mode}
                winnerName={
                  room?.mode === "shared"
                    ? room?.shared?.winner && room?.shared?.winner !== "draw"
                      ? room?.players?.[room.shared.winner]?.name
                      : null
                    : room?.mode === "duel"
                    ? room?.winner && room?.winner !== "draw"
                      ? room?.players?.[room.winner]?.name
                      : null
                    : null
                }
                leftName={
                  room?.mode === "duel"
                    ? Object.values(room?.players || {})[0]?.name
                    : null
                }
                rightName={
                  room?.mode === "duel"
                    ? Object.values(room?.players || {})[1]?.name
                    : null
                }
                leftSecret={
                  room?.mode === "duel"
                    ? room?.duelReveal?.[Object.keys(room?.players || {})[0]]
                    : null
                }
                rightSecret={
                  room?.mode === "duel"
                    ? room?.duelReveal?.[Object.keys(room?.players || {})[1]]
                    : null
                }
                battleSecret={
                  room?.mode === "shared"
                    ? room?.shared?.lastRevealedWord
                    : room?.battle?.lastRevealedWord
                }
                onPlayAgain={
                  room?.mode === "shared" || room?.mode === "duel"
                    ? async () => {
                        setShowVictory(false);
                        try {
                          if (room?.mode === "duel") {
                            await duelActions.playAgain(roomId);
                          } else {
                            await sharedActions.playAgain(roomId);
                          }
                        } catch (e) {
                          // noop
                        }
                      }
                    : () => setShowVictory(false)
                }
                showPlayAgain={room?.mode === "shared" || room?.mode === "duel"}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
