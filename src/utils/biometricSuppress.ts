// Opening the camera, photo library, or system file picker briefly sends
// this app to the background and back — from BiometricGate's AppState
// listener, that's indistinguishable from someone switching away and
// coming back, so without this every photo/file pick was re-triggering
// the fingerprint prompt the instant the picker closed. Anything in
// fileHelpers.ts that launches a native picker wraps itself in
// withBiometricSuppressed so BiometricGate knows to skip that one resume.
let suppressed = 0;

export function isBiometricCheckSuppressed(): boolean {
  return suppressed > 0;
}

export async function withBiometricSuppressed<T>(fn: () => Promise<T>): Promise<T> {
  suppressed++;
  try {
    return await fn();
  } finally {
    suppressed--;
  }
}
