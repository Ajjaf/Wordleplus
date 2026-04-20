import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { socket } from "../socket";
import { useErrorNotification } from "../contexts/ErrorNotificationContext";
import { logger } from "../utils/logger";
import { getOrCreatePlayerId } from "../utils/playerId";

const LS_ROOM = "wp.lastRoomId";
const LS_SOCKET = "wp.lastSocketId";
const LS_LAST_NAME = "wp.lastName";
const RESUME_ACK_TIMEOUT_MS = 5000;

/** Drives emit + timeout handling for all resume entry points. */
const RESUME_MODE = {
  CONNECT_IN_ROOM: "connectInRoom",
  CONNECT_SAVED_SESSION: "connectSavedSession",
  MANUAL_REJOIN: "manualRejoin",
};

/** Ack callback only; if no ack within timeout, onTimeout runs (existing flow unchanged). */
function emitResumeWithTimeout(resumePayload, { onAck, onTimeout }) {
  if (typeof window === "undefined") {
    socket.emit("resume", resumePayload, onAck);
    return;
  }
  let settled = false;
  const timerId = window.setTimeout(() => {
    if (!settled) {
      settled = true;
      onTimeout();
    }
  }, RESUME_ACK_TIMEOUT_MS);

  socket.emit("resume", resumePayload, (res) => {
    if (!settled) {
      settled = true;
      window.clearTimeout(timerId);
      onAck(res);
    }
  });
}

export function useSocketConnection(room, onGameResumed) {
  const [connected, setConnected] = useState(socket.connected);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [rejoinOffered, setRejoinOffered] = useState(false);
  const { showNotification, dismissNotification } = useErrorNotification();

  // Prevent multiple resume attempts (StrictMode or rapid reconnects)
  const triedResumeRef = useRef(false);
  const hasShownDisconnectRef = useRef(false);
  const hasConnectedOnceRef = useRef(socket.connected);
  const disconnectNotificationIdRef = useRef(null);

  useEffect(() => {
    getOrCreatePlayerId();
  }, []);

  // Read these once; they rarely change during a session
  const savedRoomId = useMemo(
    () => (typeof window !== "undefined" ? localStorage.getItem(LS_ROOM) || "" : ""),
    []
  );
  const savedName = useMemo(
    () => (typeof window !== "undefined" ? localStorage.getItem(LS_LAST_NAME) || "" : ""),
    []
  );

  const attemptResume = useCallback(
    (roomId, mode) => {
      const oldId = typeof window !== "undefined" ? localStorage.getItem(LS_SOCKET + ".old") : null;
      if (!oldId || !roomId) return;

      const payload = { roomId, oldId, playerId: getOrCreatePlayerId() };

      const joinRoomFallback = () => {
        const targetName =
          typeof window !== "undefined"
            ? localStorage.getItem(LS_LAST_NAME) || savedName
            : savedName;
        socket.emit(
          "joinRoom",
          { name: targetName, roomId, playerId: getOrCreatePlayerId() },
          (res2) => {
            if (res2?.ok) {
              localStorage.setItem(LS_SOCKET, socket.id);
              localStorage.removeItem(LS_SOCKET + ".old");
              onGameResumed?.(roomId);
              setRejoinOffered(false);
            }
          }
        );
      };

      emitResumeWithTimeout(payload, {
        onAck: (res) => {
          if (mode === RESUME_MODE.CONNECT_IN_ROOM) {
            localStorage.setItem(LS_SOCKET, socket.id);
            localStorage.removeItem(LS_SOCKET + ".old");
            setRejoinOffered(false);
            if (!res?.ok) {
              setRejoinOffered(Boolean(savedRoomId && savedName));
            }
            return;
          }

          if (res?.ok) {
            sessionStorage.setItem("wp.reconnected", "1");
            localStorage.setItem(LS_SOCKET, socket.id);
            localStorage.removeItem(LS_SOCKET + ".old");
            onGameResumed?.(roomId);
            setRejoinOffered(false);
          } else if (mode === RESUME_MODE.MANUAL_REJOIN) {
            joinRoomFallback();
          } else {
            setRejoinOffered(Boolean(savedRoomId && savedName));
          }
        },
        onTimeout: () => {
          if (mode === RESUME_MODE.CONNECT_IN_ROOM) {
            setRejoinOffered(Boolean(savedRoomId && savedName));
          } else if (mode === RESUME_MODE.MANUAL_REJOIN) {
            joinRoomFallback();
          } else {
            setRejoinOffered(Boolean(savedRoomId && savedName));
          }
        },
      });
    },
    [onGameResumed, savedName, savedRoomId]
  );

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      setReconnecting(false);
      setReconnectAttempt(0);
      hasConnectedOnceRef.current = true;

      if (disconnectNotificationIdRef.current) {
        dismissNotification(disconnectNotificationIdRef.current);
        disconnectNotificationIdRef.current = null;
      }

      // Show reconnected notification if we previously disconnected
      if (hasShownDisconnectRef.current) {
        showNotification("Reconnected to server", "success", {
          duration: 2500,
        });
        hasShownDisconnectRef.current = false;
      }

      // If we're already in an active room, we may still need to re-register
      // the new socket ID with the server. This happens on mobile when the user
      // tabs out: the socket drops, React state is kept, but the server still
      // holds the player under the old socket ID. Without re-registering, every
      // subsequent emit is rejected with "Player not in room".
      if (room?.id) {
        const oldId = localStorage.getItem(LS_SOCKET + ".old");
        if (oldId && !triedResumeRef.current) {
          triedResumeRef.current = true;
          attemptResume(room.id, RESUME_MODE.CONNECT_IN_ROOM);
        } else {
          localStorage.setItem(LS_SOCKET, socket.id);
          triedResumeRef.current = true;
          setRejoinOffered(false);
        }
        return;
      }

      const oldId = localStorage.getItem(LS_SOCKET + ".old");

      // Try resume exactly once per page session
      if (!triedResumeRef.current && savedRoomId && oldId) {
        triedResumeRef.current = true;
        attemptResume(savedRoomId, RESUME_MODE.CONNECT_SAVED_SESSION);
      } else {
        // Nothing to resume, but we can offer rejoin if a saved session exists
        setRejoinOffered(Boolean(savedRoomId && savedName && !room?.id));
      }
    };

    const onDisconnect = () => {
      if (!hasConnectedOnceRef.current) {
        return;
      }
      const last = localStorage.getItem(LS_SOCKET);
      if (last) localStorage.setItem(LS_SOCKET + ".old", last);
      setConnected(false);
      setReconnecting(true);
      hasShownDisconnectRef.current = true;
      if (!disconnectNotificationIdRef.current) {
        disconnectNotificationIdRef.current = showNotification(
          "Connection lost - Reconnecting...",
          "warning",
          { duration: 6000 }
        );
      }
      // Allow a new resume attempt on next connect
      triedResumeRef.current = false;
    };

    const onConnectError = (error) => {
      logger.error("Socket connection error:", error);
      showNotification("Connection error - Please check your network", "error");
    };

    const manager = socket.io;
    const onReconnectAttempt = (attempt) => {
      setReconnectAttempt(typeof attempt === "number" ? attempt : 1);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    manager?.on?.("reconnect_attempt", onReconnectAttempt);
    return () => {
      if (disconnectNotificationIdRef.current) {
        dismissNotification(disconnectNotificationIdRef.current);
        disconnectNotificationIdRef.current = null;
      }
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      manager?.off?.("reconnect_attempt", onReconnectAttempt);
    };
  }, [
    attemptResume,
    room?.id,
    savedRoomId,
    savedName,
    onGameResumed,
    showNotification,
    dismissNotification,
  ]);

  useEffect(() => {
    if (!connected || room?.id) return;
    if (typeof window === "undefined") return;

    const latestRoomId = localStorage.getItem(LS_ROOM) || "";
    const latestName = localStorage.getItem(LS_LAST_NAME) || "";

    if (latestRoomId && latestName) {
      setRejoinOffered(true);
    }
  }, [connected, room?.id]);

  const canRejoin = connected && !room?.id && rejoinOffered;

  const doRejoin = () => {
    const targetRoomId =
      typeof window !== "undefined"
        ? localStorage.getItem(LS_ROOM) || savedRoomId
        : savedRoomId;
    const targetName =
      typeof window !== "undefined"
        ? localStorage.getItem(LS_LAST_NAME) || savedName
        : savedName;

    if (!targetRoomId || !targetName) return;
    const oldId = localStorage.getItem(LS_SOCKET + ".old");

    // Prefer resume to preserve state
    if (oldId) {
      attemptResume(targetRoomId, RESUME_MODE.MANUAL_REJOIN);
    } else {
      socket.emit(
        "joinRoom",
        { name: targetName, roomId: targetRoomId, playerId: getOrCreatePlayerId() },
        (res2) => {
          if (res2?.ok) {
            localStorage.setItem(LS_SOCKET, socket.id);
            onGameResumed?.(targetRoomId);
            setRejoinOffered(false);
          }
        }
      );
    }
  };

  return {
    connected,
    reconnecting,
    reconnectAttempt,
    canRejoin,
    doRejoin,
    savedRoomId,
    savedName,
    rejoinOffered,
  };
}
