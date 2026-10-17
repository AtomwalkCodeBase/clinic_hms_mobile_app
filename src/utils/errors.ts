/**
 * How the app turns a failure into words and shows it. One place, so a screen never prints "Call to function
 * 'ExponentFileSystem.readAsStringAsync' has been rejected" or "Uncaught (in promise, id: 3)" to a patient.
 *
 *   friendlyMessage(err, fallback)   the sentence to show for any error (used by apiErrorMessage)
 *   showError(err, fallback)         raises the themed error dialog (rendered by ErrorDialogHost)
 *   installGlobalErrorHandling()     the safety net: an error nobody caught, or a promise nobody handled, ends up as
 *                                    that same dialog instead of a red screen (or, in a release build, nothing)
 */

/** Words that mean "a library or the JS engine talking", not something a patient should read. */
const TECHNICAL = /rejected|\bERR_[A-Z_]+|\bE_[A-Z_]+|caused by|native ?module|exception|undefined is not|null is not|cannot read|is not a function|is not an object|network request failed|uncaught|invariant|typeerror|referenceerror|syntaxerror|json parse|\bat\s+\S+\s*\(/i;
const PERMISSION = /permission|denied|not authori[sz]ed|not allowed/i;

/** A readable sentence for `raw` (an Error's own message), or `fallback` when it is technical. */
export function friendlyMessage(raw: unknown, fallback: string): string {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return fallback;
  if (PERMISSION.test(text) && TECHNICAL.test(text)) {
    return "Permission was denied. Allow access in your phone's Settings and try again.";
  }
  if (TECHNICAL.test(text)) return fallback;
  return text;
}

// ── the dialog ──────────────────────────────────────────────────────────────────────────────────────────────
export interface ErrorNotice { title: string; message: string }
type Listener = (n: ErrorNotice | null) => void;

let listener: Listener | null = null;
let current: ErrorNotice | null = null;

/** ErrorDialogHost registers here to be told what to show. */
export function subscribeErrorDialog(fn: Listener): () => void {
  listener = fn;
  fn(current);
  return () => { if (listener === fn) listener = null; };
}

export function dismissError(): void {
  current = null;
  listener?.(null);
}

/**
 * Shows the error dialog. Only one at a time: while one is open, further errors are dropped (they are almost always
 * the same failure repeated by every query on the screen).
 */
export function showError(message: string, title = "Something went wrong"): void {
  if (current) return;
  current = { title, message };
  listener?.(current);
}

// ── the safety net ──────────────────────────────────────────────────────────────────────────────────────────
// Imported lazily so this file has no cycle with api/client.ts (which imports friendlyMessage).
function messageFor(err: unknown): string {
  const { apiErrorMessage } = require("@/api/client") as typeof import("@/api/client");
  return apiErrorMessage(err, "Something went wrong. Please try again.");
}

/** For a handler that catches an error and wants to tell the patient. */
export function reportError(err: unknown, fallback = "Something went wrong. Please try again.", title?: string): void {
  if (__DEV__) console.log("[error]", (err as any)?.stack || err);
  const { apiErrorMessage } = require("@/api/client") as typeof import("@/api/client");
  showError(apiErrorMessage(err, fallback), title);
}

let installed = false;

export function installGlobalErrorHandling(): void {
  if (installed) return;
  installed = true;
  const g = globalThis as any;

  // A thrown error nobody caught (an event handler, a timer). React Native calls every one of these "fatal", which in
  // a release build closes the app and in development paints the red screen. A failed button press should not do either:
  // say what happened and carry on. (An error while a screen is drawing is caught earlier, by AppErrorBoundary.)
  g.ErrorUtils?.setGlobalHandler?.((error: any) => {
    if (__DEV__) console.log("[uncaught]", error?.stack || String(error));
    showError(messageFor(error?.cause ?? error));
  });

  // A promise that rejected and nobody awaited or caught. React Native only tracks these in development, where it
  // paints a red screen; this replaces that with the dialog, in every build.
  const options = {
    allRejections: true,
    onUnhandled: (_id: number, reason: unknown) => {
      if (__DEV__) console.log("[unhandled rejection]", (reason as any)?.stack || reason);
      showError(messageFor(reason));
    },
    onHandled: () => {},
  };
  // Hermes's own promises and React Native's JS Promise (used when the engine has none) are tracked separately.
  try {
    g.HermesInternal?.enablePromiseRejectionTracker?.(options);
  } catch {}
  try {
    require("promise/setimmediate/rejection-tracking").enable(options);
  } catch {}
}
