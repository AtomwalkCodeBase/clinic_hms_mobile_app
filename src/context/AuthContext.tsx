import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from "@/utils/storage";
import { loginPatient, logout as apiLogout } from "@/api/auth";
import { setSessionExpiredHandler } from "@/api/client";

interface AuthContextValue {
  isLoading: boolean; // true only during the initial "do we have a saved session" check
  isAuthenticated: boolean;
  login: (mobile: string, password: string) => Promise<void>;
  /** Completes sign-in with a JWT pair already issued elsewhere — used by the passwordless OTP login flow, which gets tokens directly from /auth/login/patient/otp/ instead of loginPatient. */
  loginWithTokens: (access: string, refresh: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  // No profile fields here on purpose — the login response only ever
  // contains {access, refresh} (see loginPatient's comment), never
  // user_id/full_name/awpid/email. Every screen that needs real profile
  // data already fetches it itself via getProfile()/getHealthSummary(),
  // so this only needs to track whether a session exists at all.
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // On every cold start: check for a stored token before rendering any UI.
  // If one exists, skip the login screen entirely and resume straight into
  // the app — this is the "open directly, like normal apps" behavior.
  useEffect(() => {
    (async () => {
      const access = await getAccessToken();
      setIsAuthenticated(!!access);
      setIsLoading(false);
    })();
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setIsAuthenticated(false);
    });
  }, []);

  const login = useCallback(async (mobile: string, password: string) => {
    const tokens = await loginPatient(mobile, password);
    await saveTokens(tokens.access, tokens.refresh);
    setIsAuthenticated(true);
  }, []);

  const loginWithTokens = useCallback(async (access: string, refresh: string) => {
    await saveTokens(access, refresh);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    const refresh = await getRefreshToken();
    try {
      await apiLogout(refresh);
    } catch {
      // best-effort — clear local session regardless of server call outcome
    }
    await clearTokens();
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isLoading, isAuthenticated, login, loginWithTokens, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
