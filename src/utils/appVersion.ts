import Constants from "expo-constants";
import * as Application from "expo-application";

/**
 * Human-facing version shown on the sign-in / unlock screens and at the top right of the Profile page, e.g. "v1.0.2".
 *
 * It is the app's own version from app.json (`version`), read from the app's configuration. The phone's native version is
 * only a fallback: inside Expo Go that one is Expo Go's own number (e.g. 57.0.9), not this app's. The build number
 * (Android versionCode) is deliberately not shown: EAS counts it per build and people only need the version name.
 */
export const APP_VERSION_LABEL = (() => {
  const name = Constants.expoConfig?.version ?? Application.nativeApplicationVersion;
  return name ? `v${name}` : "";
})();
