import axios, { AxiosError } from "axios";
import Constants from "expo-constants";
import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from "@/utils/storage";

// 10.0.2.2 is the Android emulator's alias for the host machine's localhost —
// point this at your real deployed API for a production build (see app.json).
const BASE_URL = (Constants.expoConfig?.extra?.apiBaseUrl as string) || "http://10.0.2.2:8000/api/v1";

export const api = axios.create({ baseURL: BASE_URL, timeout: 15000 });

let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(fn: () => void) {
  onSessionExpired = fn;
}

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Refresh-on-401 — queues concurrent requests behind a single refresh call
// instead of firing a refresh per failed request.
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = await getRefreshToken();
  if (!refresh) return null;
  try {
    const res = await axios.post(`${BASE_URL}/auth/token/refresh/`, { refresh });
    const { access, refresh: newRefresh } = res.data.data as { access: string; refresh: string };
    await saveTokens(access, newRefresh);
    return access;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as any;
    if (error.response?.status === 401 && original && !original._retried) {
      original._retried = true;
      if (!refreshing) {
        refreshing = refreshAccessToken().finally(() => {
          refreshing = null;
        });
      }
      const newAccess = await refreshing;
      if (newAccess) {
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      }
      await clearTokens();
      onSessionExpired?.();
    }
    return Promise.reject(error);
  }
);

/**
 * Standardized error message extraction — most views return the standard
 * {message} shape (core/response.py), but a chunk of
 * apps/patients/portal_views.py (PortalBookView among them) predates that
 * helper and hand-rolls Response({"error": "..."}, status=...) instead, same
 * intent, different key. Without the .error fallback, every specific, real
 * reason a booking/action failed (date in the past, slot just taken, hospital
 * not enrolled for online booking, etc.) silently collapsed into the generic
 * fallback message instead of reaching the user — mirrors the identical fix
 * already applied on the web app's own error normaliser
 * (frontend/src/services/api.client.js's normaliseError). Also surfaces a
 * plain (non-axios) Error's own message, so device-side failures (e.g.
 * "Sharing isn't available on this device.") reach the user instead of
 * collapsing into the generic fallback.
 */
export function apiErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const e = err as AxiosError<any>;
  const data = e?.response?.data;
  if (data?.message) return data.message;
  if (data?.error) return data.error;
  // DRF's own default error shapes — {detail: "..."} (permissions, 404,
  // throttling) and {non_field_errors: [...]} / first field error (serializer
  // validation). Without these, a real 4xx reason collapses into the fallback.
  if (data?.detail) return String(data.detail);
  if (Array.isArray(data?.non_field_errors) && data.non_field_errors[0]) return String(data.non_field_errors[0]);
  if (data && typeof data === "object") {
    const first = Object.values(data).flat()[0];
    if (typeof first === "string" && first) return first;
  }
  // No structured body (e.g. a 500 HTML page or a network failure) — say so,
  // with the status, instead of a generic "try again" that hides everything.
  if (e?.response?.status) return `${fallback} (server error ${e.response.status})`;
  if (e?.isAxiosError && (e.code === "ECONNABORTED" || e.message?.includes("timeout"))) {
    return "The server took too long to respond. Check your connection and try again.";
  }
  if (e?.isAxiosError && e.message === "Network Error") return "Can't reach the server. Check your connection and try again.";
  if (err instanceof Error && !e?.isAxiosError && err.message) return err.message;
  return fallback;
}
