import { socket } from "../socket";

const LS_LAST_ROOM = "wp.lastRoomId";
const LS_LAST_NAME = "wp.lastName";
const LS_LAST_MODE = "wp.lastMode";
const LS_LAST_SOCKET = "wp.lastSocketId";

export function useRoomManagement() {
  // Persist session basics
  const persistSession = ({ name, roomId, mode }) => {
    if (name) localStorage.setItem(LS_LAST_NAME, name);
    if (roomId) localStorage.setItem(LS_LAST_ROOM, roomId);
    if (mode) localStorage.setItem(LS_LAST_MODE, mode);
  };

  // After a successful create/join, also set socket flags cleanly
  const persistAfterJoinOrCreate = ({ name, roomId, mode }) => {
    persistSession({ name, roomId, mode });
    // capture current socket id for future resume attempts
    if (socket?.id) localStorage.setItem(LS_LAST_SOCKET, socket.id);
    // clear stale "old" id; we just (re)joined successfully
    localStorage.removeItem(LS_LAST_SOCKET + ".old");
    // clear any "reconnected" banner for a fresh session
    sessionStorage.removeItem("wp.reconnected");
    // optional: also clear legacy host flag
    localStorage.removeItem(LS_LAST_SOCKET + ".wasHost");
  };

  // Create a new room
  const createRoom = (name, mode) => {
    return new Promise((resolve) => {
      socket.emit("createRoom", { name, mode }, (resp) => {
        if (resp?.roomId) {
          persistAfterJoinOrCreate({ name, roomId: resp.roomId, mode });
          resolve({ success: true, roomId: resp.roomId });
        } else {
          resolve({ error: resp?.error || "Failed to create room" });
        }
      });
    });
  };

  // Join an existing room
  const joinRoom = (name, roomId) => {
    return new Promise((resolve) => {
      socket.emit("joinRoom", { name, roomId }, (resp) => {
        if (resp?.error) {
          resolve({ error: resp.error });
        } else {
          const respMode = resp?.mode;
          persistAfterJoinOrCreate({ name, roomId, mode: respMode });
          resolve({ success: true, mode: respMode });
        }
      });
    });
  };

  // Get saved session data
  const getSavedSession = () => {
    return {
      name: localStorage.getItem(LS_LAST_NAME) || "",
      roomId: localStorage.getItem(LS_LAST_ROOM) || "",
      mode: localStorage.getItem(LS_LAST_MODE) || "duel",
    };
  };

  // Clear ALL saved session data (name/room/mode)
  const clearSavedSession = () => {
    localStorage.removeItem(LS_LAST_ROOM);
    localStorage.removeItem(LS_LAST_NAME);
    localStorage.removeItem(LS_LAST_MODE);
  };

  // Go home: leave the room (stop auto-resume), but keep your name & mode
  const goHome = (roomId = null, { clearRoom = false } = {}) => {
    try {
      if (socket?.connected) {
        socket.emit("leaveRoom", roomId ? { roomId } : {});
      }
    } catch (error) {
      console.error("[goHome] failed to emit leaveRoom", error);
    }
    if (roomId && !clearRoom) {
      localStorage.setItem(LS_LAST_ROOM, roomId);
    } else if (clearRoom) {
      localStorage.removeItem(LS_LAST_ROOM);
    }

    if (socket?.id) {
      const currentSocketId = socket.id;
      const previousSocketId = localStorage.getItem(LS_LAST_SOCKET);

      if (previousSocketId && previousSocketId !== currentSocketId) {
        localStorage.setItem(LS_LAST_SOCKET + ".old", previousSocketId);
      } else {
        localStorage.setItem(LS_LAST_SOCKET + ".old", currentSocketId);
      }

      localStorage.setItem(LS_LAST_SOCKET, currentSocketId);
    }

    localStorage.removeItem(LS_LAST_SOCKET + ".wasHost"); // legacy host flag
    if (clearRoom) {
      localStorage.removeItem(LS_LAST_SOCKET);
      localStorage.removeItem(LS_LAST_SOCKET + ".old");
      sessionStorage.removeItem("wp.reconnected"); // clear banner
    }
    return { success: true };
  };

  return {
    createRoom,
    joinRoom,
    persistSession,
    getSavedSession,
    clearSavedSession,
    goHome,
  };
}
