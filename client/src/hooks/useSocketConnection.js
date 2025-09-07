import { useEffect, useMemo, useRef, useState } from "react";
import { socket } from "../socket";

const LS_LAST_ROOM = "wp.lastRoomId";
const LS_LAST_NAME = "wp.lastName";
const LS_LAST_SOCKET = "wp.lastSocketId";

export function useSocketConnection(room, setScreen) {
  const [connected, setConnected] = useState(socket.connected);
  const [rejoinOffered, setRejoinOffered] = useState(false);

  // Prevent multiple resume attempts (StrictMode or rapid reconnects)
  const triedResumeRef = useRef(false);

  // Read these once; they rarely change during a session
  const savedRoomId = useMemo(
    () => localStorage.getItem(LS_LAST_ROOM) || "",
    []
  );
  const savedName = useMemo(() => localStorage.getItem(LS_LAST_NAME) || "", []);

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);

      // If we already have a room in state, nothing to resume.
      if (room?.id) {
        localStorage.setItem(LS_LAST_SOCKET, socket.id);
        triedResumeRef.current = true;
        setRejoinOffered(false);
        return;
      }

      const oldId = localStorage.getItem(LS_LAST_SOCKET + ".old");

      // Try resume exactly once per page session
      if (!triedResumeRef.current && savedRoomId && oldId) {
        triedResumeRef.current = true;
        socket.emit("resume", { roomId: savedRoomId, oldId }, (res) => {
          if (res?.ok) {
            // One-shot banner for this page session
            sessionStorage.setItem("wp.reconnected", "1");
            // Store the new, current socket id and clear old
            localStorage.setItem(LS_LAST_SOCKET, socket.id);
            localStorage.removeItem(LS_LAST_SOCKET + ".old");

            setScreen?.("game");
            setRejoinOffered(false);
          } else {
            // Couldn’t resume—offer manual rejoin
            setRejoinOffered(Boolean(savedRoomId && savedName));
          }
        });
      } else {
        // Nothing to resume, but we can offer rejoin if a saved session exists
        setRejoinOffered(Boolean(savedRoomId && savedName && !room?.id));
      }
    };

    const onDisconnect = () => {
      const last = localStorage.getItem(LS_LAST_SOCKET);
      if (last) localStorage.setItem(LS_LAST_SOCKET + ".old", last);
      setConnected(false);
      // Allow a new resume attempt on next connect
      triedResumeRef.current = false;
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [room?.id, savedRoomId, savedName, setScreen]);

  const canRejoin = connected && !room?.id && rejoinOffered;

  const doRejoin = () => {
    if (!savedRoomId || !savedName) return;
    const oldId = localStorage.getItem(LS_LAST_SOCKET + ".old");

    // Prefer resume to preserve state
    if (oldId) {
      socket.emit("resume", { roomId: savedRoomId, oldId }, (res) => {
        if (res?.ok) {
          sessionStorage.setItem("wp.reconnected", "1");
          localStorage.setItem(LS_LAST_SOCKET, socket.id);
          localStorage.removeItem(LS_LAST_SOCKET + ".old");
          setScreen?.("game");
          setRejoinOffered(false);
        } else {
          // Fallback: regular join
          socket.emit(
            "joinRoom",
            { name: savedName, roomId: savedRoomId },
            (res2) => {
              if (res2?.ok) {
                localStorage.setItem(LS_LAST_SOCKET, socket.id);
                localStorage.removeItem(LS_LAST_SOCKET + ".old");
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
            localStorage.setItem(LS_LAST_SOCKET, socket.id);
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
