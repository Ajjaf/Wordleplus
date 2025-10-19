// client/src/socket.js
import { io } from "socket.io-client";
import { SERVER_URL } from "./config";

export const socket = io(SERVER_URL, {
  path: "/socket.io",
  transports: ["polling", "websocket"],
  withCredentials: false,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 10,
});
