import { useSyncExternalStore } from "react";

/**
 * Whose documents My Documents is showing: `undefined` is the patient themself, otherwise a family member's AWPID.
 * Kept only in memory on purpose. It survives leaving the screen and coming back, and it is gone when the app process
 * is closed (swiped away from recent apps), so the next launch starts on "Myself". Signing in or out also resets it
 * (see AuthContext), so one account's choice never carries to another.
 */
let current: string | undefined;
const listeners = new Set<() => void>();

export const getViewingPerson = () => current;

export function setViewingPerson(awpid?: string) {
  if (awpid === current) return;
  current = awpid;
  listeners.forEach((l) => l());
}

export const resetViewingPerson = () => setViewingPerson(undefined);

export function useViewingPerson(): string | undefined {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getViewingPerson,
    getViewingPerson,
  );
}
