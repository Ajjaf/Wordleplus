import React, { Suspense, lazy } from "react";
import ErrorBoundary from "./ErrorBoundary";
import VictoryModal from "./VictoryModal";
import LoadingSpinner, { LoadingOverlay } from "./ui/LoadingSpinner";

// Lazy load screen components for code splitting
const DuelGameScreen = lazy(() => import("../screens/DuelGameScreen"));
const SharedDuelGameScreen = lazy(() => import("../screens/SharedDuelGameScreen"));
const BattleGameScreen = lazy(() => import("../screens/BattleGameScreen"));
const HostSpectateScreen = lazy(() => import("../screens/HostSpectateScreen"));
const DailyGameScreen = lazy(() => import("../screens/DailyGameScreen"));
const HomeScreen = lazy(() => import("../screens/HomeScreenV2"));

// Loading fallback component for lazy-loaded screens
const ScreenLoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <LoadingSpinner size="lg" variant="primary" text="Loading..." />
  </div>
);

export default function GameRouter({
  screen,
  room,
  // Game state
  me,
  opponent,
  players,
  allPlayers,
  otherPlayers,
  isHost,
  wasHost,
  canGuessDuel,
  canGuessShared,
  canGuessBattle,
  letterStates,
  currentGuess,
  shakeKey,
  showActiveError,
  // Daily game props
  dailyProps,
  // Actions
  handleDuelKey,
  handleBattleKey,
  duelActions,
  sharedActions,
  battleActions,
  aiBattleActions,
  submittingDuelGuess = false,
  submittingBattleGuess = false,
  roomId,
  setMsg,
  setShowVictory,
  showVictory,
  // Daily actions
  onPlayDaily,
  name,
  mode,
  roomId: contextRoomId,
  setName,
  setRoomId,
  setMode,
  onCreate,
  onJoin,
  message,
}) {
  if (screen === "game") {
    return (
      <div className="h-full overflow-hidden">
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

        {/* DUEL GAME */}
        {room?.mode === "duel" && (
          <ErrorBoundary componentName="DuelGameScreen">
            <Suspense fallback={<ScreenLoadingFallback />}>
              <DuelGameScreen
              room={room}
              me={me}
              opponent={opponent}
              currentGuess={currentGuess}
              shakeKey={shakeKey}
              showActiveError={showActiveError}
              letterStates={letterStates}
              onKeyPress={handleDuelKey}
              submittingGuess={submittingDuelGuess}
              onSubmitSecret={async (secret) => {
                const result = await duelActions.submitSecret(roomId, secret);
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
            </Suspense>
          </ErrorBoundary>
        )}

        {/* SHARED DUEL */}
        {room?.mode === "shared" && (
          <ErrorBoundary componentName="SharedDuelGameScreen">
            <Suspense fallback={<ScreenLoadingFallback />}>
              <SharedDuelGameScreen
              room={room}
              me={me}
              currentGuess={currentGuess}
              letterStates={letterStates}
              onKeyPress={handleDuelKey}
              submittingGuess={submittingDuelGuess}
              onStartShared={async () => {
                const res = await sharedActions.startRound(roomId);
                if (res?.error) {
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
            </Suspense>
          </ErrorBoundary>
        )}

        {/* BATTLE ROYALE - Host sees spectate view, players see game view */}
        {(room?.mode === "battle" || room?.mode === "battle_ai") &&
          (isHost || (wasHost && me?.id === room?.hostId) ? (
            <ErrorBoundary componentName="HostSpectateScreen">
              <Suspense fallback={<ScreenLoadingFallback />}>
                <HostSpectateScreen
                key="host"
                room={room}
                players={players}
                onWordSubmit={async (word) => {
                  const actions =
                    room?.mode === "battle_ai"
                      ? aiBattleActions
                      : battleActions;
                  const result = await actions?.setWordAndStart?.(room.id, word);
                  if (result?.error) {
                    setMsg(result.error);
                  }
                }}
                onStartAiRound={async () => {
                  if (!room?.id) {
                    const error = "No room id available";
                    setMsg(error);
                    return { error };
                  }
                  try {
                    if (!aiBattleActions?.startRound) {
                      throw new Error("AI battle actions not available");
                    }
                    const result = await aiBattleActions.startRound(room.id);
                    if (result?.error) {
                      setMsg(result.error);
                      return result;
                    }
                    return { success: true };
                  } catch (err) {
                    const error = err?.message || "Failed to start AI battle";
                    setMsg(error);
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
              </Suspense>
            </ErrorBoundary>
          ) : (
            <ErrorBoundary componentName="BattleGameScreen">
              <Suspense fallback={<ScreenLoadingFallback />}>
                <BattleGameScreen
                key="player"
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
                submittingGuess={submittingBattleGuess}
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
                  if (!room?.id) {
                    const error = "No room id available";
                    setMsg(error);
                    return { error };
                  }
                  try {
                    if (!aiBattleActions?.startRound) {
                      throw new Error("AI battle actions not available");
                    }
                    const result = await aiBattleActions.startRound(room.id);
                    if (result?.error) {
                      setMsg(result.error);
                      return result;
                    }
                    return { success: true };
                  } catch (err) {
                    const error = err?.message || "Failed to start AI battle";
                    setMsg(error);
                    return { error };
                  }
                }}
              />
              </Suspense>
            </ErrorBoundary>
          ))}
      </div>
    );
  }

  if (screen === "daily") {
    return (
      <div className="h-full overflow-hidden">
        <ErrorBoundary componentName="DailyGameScreen">
          <Suspense fallback={<ScreenLoadingFallback />}>
            <DailyGameScreen
            challenge={dailyProps?.challenge}
            guesses={dailyProps?.guesses}
            currentGuess={dailyProps?.currentGuess}
            letterStates={dailyProps?.letterStates}
            onKeyPress={dailyProps?.handleDailyKey}
            statusMessage={dailyProps?.status}
            loading={dailyProps?.loading}
            gameOver={dailyProps?.gameOver}
            correctWord={dailyProps?.correctWord}
            won={dailyProps?.won}
            shakeKey={dailyProps?.shakeKey}
            showActiveError={dailyProps?.showActiveError}
            notificationMessage={dailyProps?.notificationMessage}
            onNotificationDismiss={dailyProps?.setDailyNotificationMessage}
            guessFlipKey={dailyProps?.guessFlipKey}
          />
          </Suspense>
        </ErrorBoundary>
        {/* Victory Modal for Daily Challenge */}
        {showVictory && dailyProps?.gameOver && (
          <VictoryModal
            open={showVictory}
            onOpenChange={setShowVictory}
            mode="daily"
            winnerName={name}
            showPlayAgain={false}
          />
        )}
      </div>
    );
  }

  // Home screen
  return (
    <ErrorBoundary componentName="HomeScreen">
      <Suspense fallback={<ScreenLoadingFallback />}>
        <HomeScreen
        name={name}
        setName={setName}
        roomId={contextRoomId}
        setRoomId={setRoomId}
        mode={mode}
        setMode={setMode}
        onCreate={onCreate}
        onJoin={onJoin}
        onPlayDaily={onPlayDaily}
        message={message}
      />
      </Suspense>
    </ErrorBoundary>
  );
}

