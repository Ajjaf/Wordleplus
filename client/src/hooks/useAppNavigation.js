import { useMemo, useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useGameContext } from "../contexts/GameContext";

const VALID_MODES = ["duel", "battle", "shared"];

function parseRoute(pathname) {
  const parts = pathname.split("/").filter(Boolean);

  if (parts[0] === "daily") {
    return { screen: "daily", urlMode: null, urlRoomId: null };
  }

  if (VALID_MODES.includes(parts[0]) && parts[1]) {
    return {
      screen: "game",
      urlMode: parts[0],
      urlRoomId: parts[1].toUpperCase(),
    };
  }

  return { screen: "home", urlMode: null, urlRoomId: null };
}

/**
 * Maps server room modes (including battle_ai) to a URL-safe segment.
 * battle_ai rooms appear as /battle/:id in the URL.
 */
export function modeToUrlSegment(mode) {
  if (mode === "battle_ai") return "battle";
  return mode;
}

export function useAppNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setScreen, setMode, setRoomId } = useGameContext();

  const route = useMemo(() => parseRoute(location.pathname), [location.pathname]);

  const syncedRef = useRef(false);

  // Keep GameContext.screen in sync with the URL so downstream components
  // (GameRouter, etc.) that read `screen` continue to work unchanged.
  useEffect(() => {
    setScreen(route.screen);
    if (route.urlMode) setMode(route.urlMode);
    if (route.urlRoomId) setRoomId(route.urlRoomId);
    syncedRef.current = true;
  }, [route.screen, route.urlMode, route.urlRoomId, setScreen, setMode, setRoomId]);

  const navigateToGame = useCallback(
    (mode, roomId, opts) => {
      const seg = modeToUrlSegment(mode);
      navigate(`/${seg}/${roomId}`, opts);
    },
    [navigate],
  );

  const navigateHome = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const navigateDaily = useCallback(() => {
    navigate("/daily");
  }, [navigate]);

  return {
    screen: route.screen,
    urlMode: route.urlMode,
    urlRoomId: route.urlRoomId,
    navigateToGame,
    navigateHome,
    navigateDaily,
    navigate,
  };
}
