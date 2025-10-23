import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    try {
      setIsLoading(true);
      const response = await fetch("/api/auth/user", {
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
    }
  }

  function startAuth(mode = "login") {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams();
    if (mode && mode !== "login") {
      params.set("mode", mode);
    }
    params.set("redirect", window.location.href);

    const queryString = params.toString();
    window.location.href = `/api/login${queryString ? `?${queryString}` : ""}`;
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
    window.location.href = `/api/logout?redirect=${encodeURIComponent(
      redirectTarget
    )}`;
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
