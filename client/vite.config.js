import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
    proxy: {
      // REST
      "/api": {
        target: "https://wordleplus-1-8f2s.onrender.com",
        changeOrigin: true,
        secure: true,
      },
      // WebSocket (Socket.IO)
      "/socket.io": {
        target: "https://wordleplus-1-8f2s.onrender.com",
        ws: true,
        changeOrigin: true,
        secure: true,
      },
      // optional: health passthrough
      "/health": {
        target: "https://wordleplus-1-8f2s.onrender.com",
        changeOrigin: true,
        secure: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
