import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, false = logged out
  const [config, setConfig] = useState(null);

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
  }, [refreshAccessToken]);

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

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("ayana_token");
    localStorage.removeItem("ayana_refresh_token");
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, config, refreshUser, loginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
