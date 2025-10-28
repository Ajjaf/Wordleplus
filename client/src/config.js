// One place to rule them all
const fromEnv = import.meta.env.VITE_SERVER_URL?.replace(/\/$/, "");

const fromWindow =
  typeof window !== "undefined" && window.location
    ? window.location.origin
    : null;

// Local dev convenience: if we're on localhost:* use 8080 for API/socket
const localDefault =
  fromWindow && /localhost/i.test(fromWindow)
    ? "http://localhost:8080"
    : fromWindow;

export const SERVER_URL = fromEnv || localDefault || "http://localhost:8080";

export function buildApiUrl(path = "") {
  if (!path) return SERVER_URL;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return `${SERVER_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
