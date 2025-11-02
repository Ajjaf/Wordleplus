import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { buildApiUrl } from "../config";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const loadingRef = useRef(false);

  const loadUser = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      setIsLoading(true);
      const response = await fetch(buildApiUrl("/api/auth/user"), {
        credentials: "include",
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Failed to load user:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }

    const handleFocus = () => {
      if (!user || user.isAnonymous) {
        loadUser();
      }
    };

    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        (!user || user.isAnonymous)
      ) {
        loadUser();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadUser, user]);

  function startAuth(mode = "login") {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams();
    if (mode && mode !== "login") {
      params.set("mode", mode);
    }
    params.set("redirect", window.location.href);

    const queryString = params.toString();
    window.location.href = buildApiUrl(
      `/api/login${queryString ? `?${queryString}` : ""}`
    );
  }

  function login() {
    startAuth("login");
  }

  function signup() {
    startAuth("signup");
  }

  function logout() {
    if (typeof window === "undefined") return;

    const redirectTarget = window.location.origin;
    window.location.href = buildApiUrl(
      `/api/logout?redirect=${encodeURIComponent(redirectTarget)}`
    );
  }

  const value = {
    user,
    isLoading,
    isAuthenticated: user && !user.isAnonymous,
    isAnonymous: user?.isAnonymous ?? true,
    login,
    signup,
    logout,
    refreshUser: loadUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === null || context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
