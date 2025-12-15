import React, { useEffect, useMemo } from "react";
import { socket } from "./socket";
import { useGameContext } from "./contexts/GameContext";
import { useGameState } from "@/hooks/useGameState";
import { useSocketConnection } from "./hooks/useSocketConnection.js";
import { useGameActions } from "./hooks/useGameActions.js";
import { useRoomManagement } from "./hooks/useRoomManagement.js";
import { useDailyGame } from "./hooks/useDailyGame.js";
import { useDuelGame } from "./hooks/useDuelGame.js";
import { useBattleGame } from "./hooks/useBattleGame.js";
import GameRouter from "./components/GameRouter.jsx";
import NavHeaderV2 from "./components/ui/NavHeaderV2.jsx";
import Backdrop from "./components/Backdrop.jsx";
import { RefreshCw } from "lucide-react";
import { logger } from "./utils/logger";
import { sanitizeRoomId, sanitizePlayerName } from "./utils/sanitize";

const LS_LAST_SOCKET = "wp.lastSocketId";

export default function App() {
  const {
    screen,
    setScreen,
    name,
    setName,
    roomId,
    setRoomId,
    mode,
    setMode,
    room,
    setRoom,
    currentGuess,
    setCurrentGuess,
    showVictory,
    setShowVictory,
    msg,
    setMsg,
    shakeKey,
    setShakeKey,
    showActiveError,
    setShowActiveError,
  } = useGameContext();

  const wasHost =
    (typeof window !== "undefined" &&
      localStorage.getItem("wp.lastSocketId.wasHost") === "true") ||
    false;

  // Room state from socket
  useEffect(() => {
    const onState = (data) => {
      setRoom(data);
    };
    socket.on("roomState", onState);
    return () => socket.off("roomState", onState);
  }, [setRoom]);

  // Game state derived from room
  const {
    me,
    players,
    allPlayers,
    otherPlayers,
    opponent,
    isHost,
    canGuessDuel,
    canGuessBattle,
    canGuessShared,
    letterStates,
    shouldShowVictory,
  } = useGameState(room);

  // Socket connection management
  const { canRejoin, doRejoin, savedRoomId, reconnecting } = useSocketConnection(room, setScreen);

  // Game actions by mode
  const actionsByMode = useGameActions();
  const duelActions = actionsByMode.duel;
  const sharedActions = actionsByMode.shared;
  const battleActions = actionsByMode.battle;
  const aiBattleActions = actionsByMode["battle_ai"];
  const dailyActions = actionsByMode.daily;

  // Room management
  const { createRoom, joinRoom, persistSession, goHome } = useRoomManagement();

  // Daily game hook
  const dailyGame = useDailyGame(screen, dailyActions, persistSession, goHome);

  // Duel game hook
  const { handleDuelKey, submittingGuess: submittingDuelGuess } = useDuelGame(
    room,
    canGuessDuel,
    canGuessShared,
    duelActions,
    sharedActions
  );

  // Battle game hook
  const { handleBattleKey, submittingGuess: submittingBattleGuess } = useBattleGame(
    room,
    canGuessBattle,
    isHost,
    wasHost,
    battleActions,
    aiBattleActions
  );

  // Show victory for duel mode - separate effect to reduce dependencies
  useEffect(() => {
    if (!room || room.mode !== "duel") return;
    const shouldShow = Boolean(room.winner) || Boolean(room.duelReveal);
    setShowVictory(shouldShow);
  }, [room?.mode, room?.winner, room?.duelReveal, setShowVictory]);

  // Show victory for shared mode - separate effect to reduce dependencies
  useEffect(() => {
    if (!room || room.mode !== "shared") return;
    const shouldShow =
      Boolean(room.shared?.winner) || Boolean(room.shared?.lastRevealedWord);
    setShowVictory(shouldShow);
  }, [room?.mode, room?.shared?.winner, room?.shared?.lastRevealedWord, setShowVictory]);

  // Hide victory for battle modes - separate effect to reduce dependencies
  useEffect(() => {
    if (!room || (room.mode !== "battle" && room.mode !== "battle_ai")) return;
    setShowVictory(false);
  }, [room?.mode, setShowVictory]);

  // Transient toast support
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 2000);
    return () => clearTimeout(t);
  }, [msg, setMsg]);

  // Navigate to game screen when duel room starts - separate effect
  useEffect(() => {
    if (room?.mode === "duel" && room?.started) {
      setScreen("game");
      setCurrentGuess("");
    }
  }, [room?.mode, room?.started, setScreen, setCurrentGuess]);

  // Navigate to game screen for battle modes - separate effect
  useEffect(() => {
    if (room?.mode === "battle" || room?.mode === "battle_ai") {
      setScreen("game");
      setCurrentGuess("");
    }
  }, [room?.mode, setScreen, setCurrentGuess]);

  // Track wasHost for battle mode
  useEffect(() => {
    if (room?.mode === "battle" || room?.mode === "battle_ai") {
      localStorage.setItem("wp.lastSocketId.wasHost", String(isHost));
    }
  }, [room?.mode, isHost]);

  const viewingHost =
    (room?.mode === "battle" || room?.mode === "battle_ai") &&
    (isHost || (wasHost && me?.id === room?.hostId));

  // Room creation and joining
  const create = async (targetMode = mode) => {
    const effectiveMode = targetMode || mode || "duel";
    if (effectiveMode !== mode) {
      setMode(effectiveMode);
    }
    const sanitizedName = sanitizePlayerName(name);
    if (!sanitizedName) {
      setMsg("Please enter a valid name");
      return;
    }
    const result = await createRoom(sanitizedName, effectiveMode);
    if (result?.success) {
      setRoomId(sanitizeRoomId(result.roomId));
      setCurrentGuess("");
      setShowVictory(false);
      setScreen("game");
    } else {
      setMsg(result?.error || "Failed to create room");
    }
  };

  const join = async (targetRoomId = roomId, preferredMode) => {
    const sanitizedRoomId = sanitizeRoomId(targetRoomId || "");
    const sanitizedName = sanitizePlayerName(name);

    if (!sanitizedRoomId) {
      setMsg("Please enter a valid room code");
      return;
    }
    if (!sanitizedName) {
      setMsg("Please enter a valid name");
      return;
    }

    const result = await joinRoom(sanitizedName, sanitizedRoomId);
    if (result?.error) {
      setMsg(result.error);
    } else {
      const joinedMode = result?.mode || preferredMode;
      if (joinedMode && joinedMode !== mode) {
        setMode(joinedMode);
      }
      setRoomId(sanitizedRoomId);
      setCurrentGuess("");
      setShowVictory(false);
      setScreen("game");
    }
  };

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

  const handleHomeClick = () => {
    goHome(room?.id);
    if (screen === "daily") {
      dailyGame.resetDailyProgress();
      setMode("daily");
    }
    setRoom(null);
    setScreen("home");
    setRoomId("");
    setCurrentGuess("");
    setShowVictory(false);
  };

  const getModeLabel = () => {
    if (screen === "game") {
      if (room?.mode === "shared") return "Shared Wordle";
      if (room?.mode === "duel") return "Duel Mode";
      if (room?.mode === "battle" || room?.mode === "battle_ai") return "Battle Royale";
    }
    if (screen === "daily") return "Daily Challenge";
    if (screen === "home") return null;
    if (mode === "shared") return "Shared Wordle";
    if (mode === "duel") return "Duel Mode";
    if (mode === "battle") return "Battle Royale";
    return null;
  };

  return (
    <div
      className="overflow-x-hidden"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <Backdrop />

      {/* Game and Daily screens occupy full viewport */}
      {(screen === "game" || screen === "daily") && (
        <div className="flex h-[100dvh] flex-col overflow-hidden">
          <NavHeaderV2
            onHomeClick={handleHomeClick}
            modeLabel={getModeLabel()}
            right={screen === "game" ? rejoinNavControl : null}
            roomId={screen === "game" ? room?.id : null}
            profileMenuVariant="game"
          />

          <div className="relative flex-1 overflow-hidden">
            <GameRouter
              screen={screen}
              room={room}
              me={me}
              opponent={opponent}
              players={players}
              allPlayers={allPlayers}
              otherPlayers={otherPlayers}
              isHost={isHost}
              wasHost={wasHost}
              canGuessDuel={canGuessDuel}
              canGuessShared={canGuessShared}
              canGuessBattle={canGuessBattle}
              letterStates={letterStates}
              currentGuess={currentGuess}
              shakeKey={shakeKey}
              showActiveError={showActiveError}
              dailyProps={{
                challenge: dailyGame.dailyChallenge,
                guesses: dailyGame.dailyGuesses,
                currentGuess: dailyGame.dailyCurrentGuess,
                letterStates: dailyGame.dailyLetterStates,
                status: dailyGame.dailyStatus,
                loading: dailyGame.dailyLoading,
                gameOver: dailyGame.dailyGameOver,
                correctWord: dailyGame.dailyCorrectWord,
                won: dailyGame.won,
                shakeKey: dailyGame.dailyShakeKey,
                showActiveError: dailyGame.dailyShowActiveError,
                notificationMessage: dailyGame.dailyNotificationMessage,
                setDailyNotificationMessage: dailyGame.setDailyNotificationMessage,
                guessFlipKey: dailyGame.dailyGuessFlipKey,
                handleDailyKey: dailyGame.handleDailyKey,
              }}
              handleDuelKey={handleDuelKey}
              handleBattleKey={handleBattleKey}
              duelActions={duelActions}
              sharedActions={sharedActions}
              battleActions={battleActions}
              aiBattleActions={aiBattleActions}
              roomId={roomId}
              setMsg={setMsg}
              setShowVictory={setShowVictory}
              showVictory={showVictory}
              onPlayDaily={dailyGame.startDailyMode}
              name={name}
              mode={mode}
              contextRoomId={roomId}
              setName={setName}
              setRoomId={setRoomId}
              setMode={setMode}
              onCreate={create}
              onJoin={join}
              message={msg}
            />
          </div>
        </div>
      )}

      {/* Home screen */}
      {screen !== "game" && screen !== "daily" && (
        <div className="min-h-screen overflow-y-auto">
          <NavHeaderV2
            onHomeClick={handleHomeClick}
            modeLabel={getModeLabel()}
            right={!viewingHost ? rejoinNavControl : null}
            roomId={screen === "home" ? null : roomId}
            reconnecting={reconnecting}
          />

          <div className="max-w-7xl mx-auto p-4 font-sans">
            <GameRouter
              screen={screen}
              room={room}
              me={me}
              opponent={opponent}
              players={players}
              allPlayers={allPlayers}
              otherPlayers={otherPlayers}
              isHost={isHost}
              wasHost={wasHost}
              canGuessDuel={canGuessDuel}
              canGuessShared={canGuessShared}
              canGuessBattle={canGuessBattle}
              letterStates={letterStates}
              currentGuess={currentGuess}
              shakeKey={shakeKey}
              showActiveError={showActiveError}
              dailyProps={null}
              handleDuelKey={handleDuelKey}
              handleBattleKey={handleBattleKey}
              duelActions={duelActions}
              sharedActions={sharedActions}
              battleActions={battleActions}
              aiBattleActions={aiBattleActions}
              roomId={roomId}
              setMsg={setMsg}
              setShowVictory={setShowVictory}
              showVictory={showVictory}
              onPlayDaily={dailyGame.startDailyMode}
              name={name}
              mode={mode}
              contextRoomId={roomId}
              setName={setName}
              setRoomId={setRoomId}
              setMode={setMode}
              onCreate={create}
              onJoin={join}
              message={msg}
            />
          </div>
        </div>
      )}
    </div>
  );
}

