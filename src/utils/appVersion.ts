import * as Application from "expo-application";

/**
 * Human-facing build string shown at the top of the sign-in / unlock
 * screens, e.g. "v1.0.0 (42)".
 *
 * - nativeApplicationVersion is the version *name* ("1.0.0"), from app.json's
 *   `version`.
 * - nativeBuildVersion is the version *code* — Android versionCode /
 *   iOS CFBundleVersion. EAS owns and auto-increments it per build
 *   (eas.json `appVersionSource: "remote"` + `autoIncrement: true`), so it's
 *   never written into app.json — reading it from the compiled native package
 *   at runtime is the only way to show the real number.
 *
 * Both are null on web and in bare JS contexts; inside Expo Go they report
 * Expo Go's own numbers, not the app's. The label just degrades gracefully.
 */
export const APP_VERSION_LABEL = (() => {
  const name = Application.nativeApplicationVersion;
  const build = Application.nativeBuildVersion;
  if (name && build) return `v${name} (${build})`;
  if (name) return `v${name}`;
  if (build) return `build ${build}`;
  return "";
})();
