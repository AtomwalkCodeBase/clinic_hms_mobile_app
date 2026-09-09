// Dormant since biometric unlock moved to cold-start-only (no re-lock on
// resume) — kept because it's the hook any future "re-lock on background"
// logic would read to ignore the brief background/foreground bounce a
// camera / photo-library / file picker causes. Anything in fileHelpers.ts
// that launches a native picker still wraps itself in withBiometricSuppressed
// so that behaviour survives if resume-locking is ever reintroduced.
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
