import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// expo-secure-store keeps tokens in the platform keystore/keychain on
// Android/iOS — appropriate for auth tokens on a health app. It has no web
// implementation at all (throws immediately), so web falls back to
// localStorage — fine for local dev/testing in a browser, never used on a
// real device build.
const ACCESS_KEY = "aw_access_token";
const REFRESH_KEY = "aw_refresh_token";
const BIOMETRIC_LOCK_KEY = "aw_biometric_lock_enabled";
const WELCOME_SEEN_KEY = "aw_welcome_seen";
const BIOMETRIC_PROMPT_SEEN_KEY = "aw_biometric_prompt_seen";
const HOME_CHECKLIST_DISMISSED_KEY = "aw_home_checklist_dismissed";
const isWeb = Platform.OS === "web";

async function setItem(key: string, value: string) {
  if (isWeb) {
    window.localStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    return window.localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string) {
  if (isWeb) {
    window.localStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

export async function saveTokens(access: string, refresh: string) {
  await setItem(ACCESS_KEY, access);
  await setItem(REFRESH_KEY, refresh);
}

export async function getAccessToken() {
  return getItem(ACCESS_KEY);
}

export async function getRefreshToken() {
  return getItem(REFRESH_KEY);
}

export async function clearTokens() {
  await deleteItem(ACCESS_KEY);
  await deleteItem(REFRESH_KEY);
}

// Off by default — a patient has to explicitly opt in from Profile before
// BiometricGate ever prompts. Nothing changes for anyone who doesn't.
export async function getBiometricLockEnabled(): Promise<boolean> {
  return (await getItem(BIOMETRIC_LOCK_KEY)) === "1";
}

export async function setBiometricLockEnabled(enabled: boolean) {
  if (enabled) {
    await setItem(BIOMETRIC_LOCK_KEY, "1");
  } else {
    await deleteItem(BIOMETRIC_LOCK_KEY);
  }
}

// Persists across sign-out — once someone's seen the welcome screen (either
// by creating an account or by choosing "I already have an account"), a
// later sign-out drops them straight back on Login, not Welcome again.
export async function getWelcomeSeen(): Promise<boolean> {
  return (await getItem(WELCOME_SEEN_KEY)) === "1";
}

export async function setWelcomeSeen() {
  await setItem(WELCOME_SEEN_KEY, "1");
}

// Tracks whether the one-time "enable fingerprint unlock?" screen has ever
// been shown, independent of whether the patient said yes — declining
// still marks it seen, since the point is to ask once per account on this
// device, not nag on every login.
export async function getBiometricPromptSeen(): Promise<boolean> {
  return (await getItem(BIOMETRIC_PROMPT_SEEN_KEY)) === "1";
}

export async function setBiometricPromptSeen() {
  await setItem(BIOMETRIC_PROMPT_SEEN_KEY, "1");
}

// The Home "Get started" checklist — purely a first-run nudge, never a
// gate. Dismissing it is permanent on this device; nothing it points at
// stops being reachable through the normal tabs either way.
export async function getHomeChecklistDismissed(): Promise<boolean> {
  return (await getItem(HOME_CHECKLIST_DISMISSED_KEY)) === "1";
}

export async function setHomeChecklistDismissed() {
  await setItem(HOME_CHECKLIST_DISMISSED_KEY, "1");
}
