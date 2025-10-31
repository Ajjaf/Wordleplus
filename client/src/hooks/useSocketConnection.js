import { useEffect, useMemo, useRef, useState } from "react";
import { socket } from "../socket";
import { useErrorNotification } from "../contexts/ErrorNotificationContext";

const LS_ROOM = "wp.lastRoomId";
const LS_SOCKET = "wp.lastSocketId";
const LS_LAST_NAME = "wp.lastName";
//reset my works
export function useSocketConnection(room, setScreen) {
  const [connected, setConnected] = useState(socket.connected);
  const [rejoinOffered, setRejoinOffered] = useState(false);
  const { showNotification, dismissNotification } = useErrorNotification();

  // Prevent multiple resume attempts (StrictMode or rapid reconnects)
  const triedResumeRef = useRef(false);
  const hasShownDisconnectRef = useRef(false);
  const hasConnectedOnceRef = useRef(socket.connected);
  const disconnectNotificationIdRef = useRef(null);

  // Read these once; they rarely change during a session
  const savedRoomId = useMemo(() => localStorage.getItem(LS_ROOM) || "", []);
  const savedName = useMemo(() => localStorage.getItem(LS_LAST_NAME) || "", []);

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
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

      // If we already have a room in state, nothing to resume.
      if (room?.id) {
        localStorage.setItem(LS_SOCKET, socket.id);
        triedResumeRef.current = true;
        setRejoinOffered(false);
        return;
      }

      const oldId = localStorage.getItem(LS_SOCKET + ".old");

      // Try resume exactly once per page session
      if (!triedResumeRef.current && savedRoomId && oldId) {
        triedResumeRef.current = true;
        socket.emit("resume", { roomId: savedRoomId, oldId }, (res) => {
          if (res?.ok) {
            // One-shot banner for this page session
            sessionStorage.setItem("wp.reconnected", "1");
            // Store the new, current socket id and clear old
            localStorage.setItem(LS_SOCKET, socket.id);
            localStorage.removeItem(LS_SOCKET + ".old");

            setScreen?.("game");
            setRejoinOffered(false);
          } else {
            // Couldn't resume—offer manual rejoin
            setRejoinOffered(Boolean(savedRoomId && savedName));
          }
        });
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
      console.error("Socket connection error:", error);
      showNotification("Connection error - Please check your network", "error");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    return () => {
      if (disconnectNotificationIdRef.current) {
        dismissNotification(disconnectNotificationIdRef.current);
        disconnectNotificationIdRef.current = null;
      }
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
    };
  }, [
    room?.id,
    savedRoomId,
    savedName,
    setScreen,
    showNotification,
    dismissNotification,
  ]);

  const canRejoin = connected && !room?.id && rejoinOffered;

  const doRejoin = () => {
    if (!savedRoomId || !savedName) return;
    const oldId = localStorage.getItem(LS_SOCKET + ".old");

    // Prefer resume to preserve state
    if (oldId) {
      socket.emit("resume", { roomId: savedRoomId, oldId }, (res) => {
        if (res?.ok) {
          sessionStorage.setItem("wp.reconnected", "1");
          localStorage.setItem(LS_SOCKET, socket.id);
          localStorage.removeItem(LS_SOCKET + ".old");
          setScreen?.("game");
          setRejoinOffered(false);
        } else {
          // Fallback: regular join
          socket.emit(
            "joinRoom",
            { name: savedName, roomId: savedRoomId },
            (res2) => {
              if (res2?.ok) {
                localStorage.setItem(LS_SOCKET, socket.id);
                localStorage.removeItem(LS_SOCKET + ".old");
                setScreen?.("game");
                setRejoinOffered(false);
              }
            }
          );
        }
      });
    } else {
      // No old socket id—just rejoin fresh
      socket.emit(
        "joinRoom",
        { name: savedName, roomId: savedRoomId },
        (res2) => {
          if (res2?.ok) {
            localStorage.setItem(LS_SOCKET, socket.id);
            setScreen?.("game");
            setRejoinOffered(false);
          }
        }
      );
    }
  };

  return {
    connected,
    canRejoin,
    doRejoin,
    savedRoomId,
    savedName,
    rejoinOffered,
  };
}
