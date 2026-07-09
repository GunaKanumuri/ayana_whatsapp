import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, false = logged out
  const [config, setConfig] = useState(null);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem("ayana_token");
    if (!token) {
      setUser(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      localStorage.removeItem("ayana_token");
      setUser(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
    api.get("/config").then(({ data }) => setConfig(data)).catch(() => {});
  }, [refreshUser]);

  const loginWithToken = (token, userData) => {
    localStorage.setItem("ayana_token", token);
    setUser(userData);
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("ayana_token");
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, config, refreshUser, loginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
