import React, { createContext, useContext, useState, useMemo } from "react";
import { sanitizeRoomId, sanitizePlayerName } from "../utils/sanitize";

const LS_LAST_ROOM = "wp.lastRoomId";
const LS_LAST_NAME = "wp.lastName";
const LS_LAST_MODE = "wp.lastMode";

const GameContext = createContext(null);

export function GameProvider({ children }) {
  // Screen navigation
  const [screen, setScreen] = useState("home");
  
  // User info
  const [name, setName] = useState(() => {
    const stored = localStorage.getItem(LS_LAST_NAME) || "";
    return sanitizePlayerName(stored);
  });
  
  const [roomId, setRoomId] = useState(() => {
    const stored = localStorage.getItem(LS_LAST_ROOM) || "";
    return sanitizeRoomId(stored);
  });
  
  const [mode, setMode] = useState(
    localStorage.getItem(LS_LAST_MODE) || "duel"
  );

  // Room state
  const [room, setRoom] = useState(null);

  // Game state
  const [currentGuess, setCurrentGuess] = useState("");
  const [showVictory, setShowVictory] = useState(false);
  const [msg, setMsg] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const [showActiveError, setShowActiveError] = useState(false);

  // Persist name to localStorage
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const sanitizedName = sanitizePlayerName(name);
    if (sanitizedName) {
      window.localStorage.setItem(LS_LAST_NAME, sanitizedName);
    } else {
      window.localStorage.removeItem(LS_LAST_NAME);
    }
  }, [name]);

  // Persist mode to localStorage
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (mode) {
      window.localStorage.setItem(LS_LAST_MODE, mode);
    }
  }, [mode]);

  const value = useMemo(
    () => ({
      // Screen
      screen,
      setScreen,
      // User
      name,
      setName,
      roomId,
      setRoomId,
      mode,
      setMode,
      // Room
      room,
      setRoom,
      // Game state
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
    }),
    [
      screen,
      name,
      roomId,
      mode,
      room,
      currentGuess,
      showVictory,
      msg,
      shakeKey,
      showActiveError,
    ]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGameContext() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGameContext must be used within GameProvider");
  }
  return context;
}

