import * as Application from "expo-application";

/**
 * Human-facing version shown at the top of the sign-in / unlock screens, e.g. "v1.0.2".
 *
 * nativeApplicationVersion is the version *name*, from app.json's `version`. The build number (Android versionCode) is
 * deliberately not shown: EAS counts it per build and people only need the version name.
 *
 * It is null on web and in bare JS contexts; inside Expo Go it reports Expo Go's own number, not the app's. The label
 * just degrades gracefully.
 */
export const APP_VERSION_LABEL = (() => {
  const name = Application.nativeApplicationVersion;
  return name ? `v${name}` : "";
})();

/** The build number EAS gives each build (Android versionCode), for the profile page; empty where there is none (Expo Go, web). */
export const APP_VERSION_CODE_LABEL = (() => {
  const code = Application.nativeBuildVersion;
  return code ? `Version code ${code}` : "";
})();
