import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import * as LocalAuthentication from "expo-local-authentication";
import { getAccessToken, getRefreshToken, saveTokens, clearTokens, getBiometricLockEnabled } from "@/utils/storage";
import { loginPatient, logout as apiLogout } from "@/api/auth";
import { setSessionExpiredHandler } from "@/api/client";
import { setUpNotifications } from "@/utils/pushNotifications";
import { queryClient } from "@/api/queryClient";
import { wipePrivateFiles } from "@/utils/fileHelpers";
import { clearAllDrafts } from "@/utils/reviewDraft";
import { resetViewingPerson } from "@/utils/viewingPerson";

interface AuthContextValue {
  isLoading: boolean; // true only during the initial "do we have a saved session" check
  isAuthenticated: boolean;
  /**
   * true when a resumed session still has to pass the "fingerprint or
   * password" choice on the login screen before the app opens — only ever
   * set when the patient turned Biometric unlock on AND the device can
   * actually do it. false in every other case (biometric off, no hardware,
   * or straight after a fresh password/OTP sign-in), so nothing changes for
   * anyone who hasn't opted in.
   */
  needsUnlock: boolean;
  /** Clears needsUnlock after a successful in-app biometric check — the JWT is already valid, this is just the local gate. */
  unlock: () => void;
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
  const [needsUnlock, setNeedsUnlock] = useState(false);

  // On every cold start: check for a stored token before rendering any UI.
  // If one exists, resume the session — but if Biometric unlock is on and
  // the device supports it, hold at the login screen's fingerprint/password
  // choice (needsUnlock) instead of dropping straight into the app.
  useEffect(() => {
    (async () => {
      try {
        const access = await getAccessToken();
        if (!access) {
          setIsAuthenticated(false);
          setNeedsUnlock(false);
          return;
        }
        setIsAuthenticated(true);
        let gate = false;
        if (await getBiometricLockEnabled()) {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          gate = hasHardware && (await LocalAuthentication.isEnrolledAsync());
        }
        setNeedsUnlock(gate);
      } catch {
        // the stored session could not be read: show the sign-in screen rather than a spinner for ever
        setIsAuthenticated(false);
        setNeedsUnlock(false);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setIsAuthenticated(false);
      setNeedsUnlock(false);
      // Whoever signs in next must never be shown this person's saved screens.
      queryClient.clear();
      resetViewingPerson();
    });
  }, []);

  // Once there's a real, unlocked session, get the phone ready for the "documents are ready" notification. Only
  // prompts for OS permission the very first time. Never blocks or errors the rest of the app.
  useEffect(() => {
    if (isAuthenticated && !needsUnlock) {
      setUpNotifications();
    }
  }, [isAuthenticated, needsUnlock]);

  const login = useCallback(async (mobile: string, password: string) => {
    const tokens = await loginPatient(mobile, password);
    await saveTokens(tokens.access, tokens.refresh);
    queryClient.clear();   // saved screens from a previous account must not appear under this one
    resetViewingPerson();
    wipePrivateFiles().catch(() => {});   // so must document copies left behind by an earlier session
    setNeedsUnlock(false);
    setIsAuthenticated(true);
  }, []);

  const loginWithTokens = useCallback(async (access: string, refresh: string) => {
    await saveTokens(access, refresh);
    queryClient.clear();   // same as login: start this account with an empty cache
    resetViewingPerson();
    wipePrivateFiles().catch(() => {});
    setNeedsUnlock(false);
    setIsAuthenticated(true);
  }, []);

  const unlock = useCallback(() => {
    setNeedsUnlock(false);
  }, []);

  const logout = useCallback(async () => {
    const refresh = await getRefreshToken();
    try {
      await apiLogout(refresh);
    } catch {
      // best-effort — clear local session regardless of server call outcome
    }
    await clearTokens();
    setNeedsUnlock(false);
    setIsAuthenticated(false);
    // Drop every saved screen (profile, family, documents...) so the next person to sign in on this phone starts
    // clean. Cleared after the app has switched to the login screens, so nothing still mounted refetches without a token.
    queryClient.clear();
    resetViewingPerson();
    // Signing out on purpose also forgets what is stored on the phone: unfinished review picks and document copies.
    // (A session that merely expires keeps the picks, so a timeout never costs the person their work.)
    await Promise.all([clearAllDrafts(), wipePrivateFiles().catch(() => {})]);
  }, []);

  return (
    <AuthContext.Provider value={{ isLoading, isAuthenticated, needsUnlock, unlock, login, loginWithTokens, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
