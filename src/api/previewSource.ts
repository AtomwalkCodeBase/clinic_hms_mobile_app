import { api, refreshSessionToken } from "@/api/client";
import { getAccessToken } from "@/utils/storage";

/**
 * The address of a document's preview picture (GET /portal/documents/<id>/preview/): a small JPEG of one page,
 * drawn by the server when asked. The address is the same every time, so expo-image's disk cache keys on it and a
 * picture is fetched once per phone. The request carries the login token as a header.
 */
export function previewUrl(id: number, opts?: { width?: number; page?: number; patientAwpid?: string }) {
  const q = [`width=${opts?.width ?? 300}`, `page=${opts?.page ?? 1}`];
  if (opts?.patientAwpid) q.push(`patient_awpid=${encodeURIComponent(opts.patientAwpid)}`);
  return `${api.defaults.baseURL}/portal/documents/${id}/preview/?${q.join("&")}`;
}

/** True when the token's own expiry time (its `exp` claim) has passed or is under 30 seconds away. */
function isExpired(token: string): boolean {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const exp = JSON.parse(atob(part)).exp as number | undefined;
    return !!exp && exp * 1000 < Date.now() + 30_000;
  } catch {
    return false; // can't read it: send it as it is and let the server decide
  }
}

/**
 * Preview pictures are fetched by the image loader, not by axios, so the app's usual "refresh on 401" does not see
 * them. Refresh here instead when the token has run out, so a screen left open for a long time keeps its pictures.
 */
export async function previewHeaders(): Promise<Record<string, string>> {
  let token = await getAccessToken();
  if (token && isExpired(token)) token = (await refreshSessionToken()) ?? token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
