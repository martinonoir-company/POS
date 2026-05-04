"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import type { AdminUser } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";
const REFRESH_TOKEN_KEY = "mn_pos_refresh_token";

interface AuthState {
  user: AdminUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => string | null;
  refresh: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const tokenRef = useRef<string | null>(null);
  tokenRef.current = state.accessToken;

  const setTokens = useCallback(
    (accessToken: string, refreshToken: string, user?: AdminUser) => {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      tokenRef.current = accessToken;
      setState((prev) => ({
        ...prev,
        accessToken,
        user: user ?? prev.user,
        isAuthenticated: true,
        isLoading: false,
      }));
    },
    []
  );

  const clearAuth = useCallback(() => {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    tokenRef.current = null;
    setState({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
  }, []);

  const fetchProfile = useCallback(async (token: string): Promise<AdminUser | null> => {
    try {
      const res = await fetch(`${API_BASE}/account/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data as AdminUser;
    } catch {
      return null;
    }
  }, []);

  const refresh = useCallback(async (): Promise<boolean> => {
    const stored = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!stored) return false;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: stored }),
      });
      if (!res.ok) return false;
      const json = await res.json();
      const { accessToken, refreshToken } = json.data;
      const user = await fetchProfile(accessToken);
      if (user) setTokens(accessToken, refreshToken, user);
      else setTokens(accessToken, refreshToken);
      return true;
    } catch {
      return false;
    }
  }, [fetchProfile, setTokens]);

  useEffect(() => {
    (async () => {
      const stored = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (!stored) {
        setState((s) => ({ ...s, isLoading: false }));
        return;
      }
      const ok = await refresh();
      if (!ok) clearAuth();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = Array.isArray(json.message)
          ? json.message.join(", ")
          : json.message ?? "Login failed";
        throw new Error(msg);
      }
      const { accessToken, refreshToken } = json.data;
      const user = await fetchProfile(accessToken);
      if (!user) throw new Error("Could not fetch user profile");
      setTokens(accessToken, refreshToken, user);
    },
    [fetchProfile, setTokens]
  );

  const logout = useCallback(async () => {
    const stored = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (stored && tokenRef.current) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenRef.current}`,
          },
          body: JSON.stringify({ refreshToken: stored }),
        });
      } catch { /* ignore */ }
    }
    clearAuth();
  }, [clearAuth]);

  const getToken = useCallback(() => tokenRef.current, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, getToken, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
