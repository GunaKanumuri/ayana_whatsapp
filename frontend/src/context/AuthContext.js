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
    localStorage.removeItem("ayana_token");
    localStorage.removeItem("ayana_refresh_token");
    sessionStorage.removeItem("ayana_active_session");
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
    const refreshToken = localStorage.getItem("ayana_refresh_token");
    if (!refreshToken) {
      localStorage.removeItem("ayana_token");
      setUser(false);
      return false;
    }
    try {
      const { data } = await api.post("/auth/refresh", {}, {
        headers: { Authorization: `Bearer ${refreshToken}` }
      });
      localStorage.setItem("ayana_token", data.access_token);
      localStorage.setItem("ayana_refresh_token", data.refresh_token);
      if (data.user) setUser(data.user);
      return true;
    } catch {
      localStorage.removeItem("ayana_token");
      localStorage.removeItem("ayana_refresh_token");
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

    const token = localStorage.getItem("ayana_token");
    if (!token) {
      // Try refresh token
      const refreshed = await refreshAccessToken();
      if (!refreshed) return;
    } else {
      try {
        const { data } = await api.get("/auth/me");
        setUser(data);
      } catch {
        // Try refresh token on access token failure
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

  const loginWithToken = (accessToken, refreshToken, userData) => {
    localStorage.setItem("ayana_token", accessToken);
    localStorage.setItem("ayana_refresh_token", refreshToken);
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, config, refreshUser, loginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
