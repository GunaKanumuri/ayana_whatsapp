import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, false = logged out
  const [config, setConfig] = useState(null);
  const inactivityTimerRef = useRef(null);

  const logout = useCallback(async () => {
    try { await api.post("/auth/logout"); } catch {}
    // Tokens were in HttpOnly cookies — backend clears them on /auth/logout.
    // localStorage is no longer the source of truth.
    setUser(false);
  }, []);

  // Check for page refresh on initial mount and force logout if refreshed
  useEffect(() => {
    const isReload =
      (window.performance?.getEntriesByType?.("navigation")?.[0])?.type === "reload" ||
      window.performance?.navigation?.type === 1;

    if (isReload) {
      logout();
    }
  }, [logout]);

  const refreshAccessToken = useCallback(async () => {
    try {
      // Cookies (withCredentials: true) carry the refresh token automatically.
      const { data } = await api.post("/auth/refresh", {});
      // Backend sets new HttpOnly cookies; no manual storage needed.
      if (data.user) setUser(data.user);
      return true;
    } catch {
      setUser(false);
      return false;
    }
  }, []);

  const refreshUser = useCallback(async () => {
    // If a page refresh happened, don't restore session
    const isReload =
      (window.performance?.getEntriesByType?.("navigation")?.[0])?.type === "reload" ||
      window.performance?.navigation?.type === 1;

    if (isReload) {
      logout();
      return;
    }

    // Auth is handled entirely via HttpOnly cookies — no localStorage check needed.
    // Just verify the session is still valid by hitting the server.
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      // Try refresh token on access token failure (cookies auto-sent)
      const refreshed = await refreshAccessToken();
      if (!refreshed) return;
      // After refresh, try fetching user again
      try {
        const { data } = await api.get("/auth/me");
        setUser(data);
      } catch {
        setUser(false);
      }
    }
  }, [refreshAccessToken, logout]);

  // Inactivity auto-logout timer (5 minutes of no activity)
  useEffect(() => {
    if (!user) return;

    const resetInactivityTimer = () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      inactivityTimerRef.current = setTimeout(() => {
        logout();
      }, INACTIVITY_TIMEOUT_MS);
    };

    // Events to track user activity
    const activityEvents = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    activityEvents.forEach((evt) => window.addEventListener(evt, resetInactivityTimer));

    // Initialize timer
    resetInactivityTimer();

    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      activityEvents.forEach((evt) => window.removeEventListener(evt, resetInactivityTimer));
    };
  }, [user, logout]);

  useEffect(() => {
    refreshUser();
    let cancelled = false;
    const loadConfig = async (attempt = 0) => {
      try {
        const { data } = await api.get("/config");
        if (!cancelled) setConfig(data);
      } catch {
        if (!cancelled && attempt < 6) {
          setTimeout(() => loadConfig(attempt + 1), 700 * (attempt + 1));
        }
      }
    };
    loadConfig();
    return () => { cancelled = true; };
  }, [refreshUser]);

  // Login/register/refresh all set HttpOnly cookies server-side.
  // This just updates local React state with the user payload returned by the API.
  const loginWithToken = (_accessToken, _refreshToken, userData) => {
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, config, refreshUser, loginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
