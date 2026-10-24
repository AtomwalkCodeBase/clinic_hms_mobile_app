import { useSyncExternalStore } from "react";
import type { GrowthIndicator } from "@/api/types";
import type { FeedFilter } from "@/utils/journey";

export type Section = "overview" | "timeline" | "growth" | "vaccines";
export type PeriodKey = "6m" | "1y" | "3y" | "all";
export type View2 = "list" | "chart";
export type Axis = "age" | "date";

export const PERIODS: { key: PeriodKey; label: string; months: number }[] = [
  { key: "6m", label: "6 months", months: 6 }, { key: "1y", label: "1 year", months: 12 }, { key: "3y", label: "3 years", months: 36 }, { key: "all", label: "Since birth", months: 0 },
];

/** The first day of a period, "2026-04-17"; since birth has none. */
export function periodStart(key: PeriodKey): string | undefined {
  const p = PERIODS.find((x) => x.key === key);
  if (!p || !p.months) return undefined;
  const d = new Date();
  d.setMonth(d.getMonth() - p.months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type State = {
  section: Section;
  period: PeriodKey;
  view: View2;
  axis: Axis;
  filter: FeedFilter;
  indicator: GrowthIndicator;
  /** the visible section is fetching in the background (drives the thin "Updating" bar) */
  fetching: boolean;
  /** the visible section's load error, if any */
  error: unknown;
};

const INITIAL: State = { section: "overview", period: "all", view: "list", axis: "age", filter: "all", indicator: "weight_kg", fetching: false, error: null };

let state: State = INITIAL;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

/**
 * What the Health journey's controls have chosen. It lives outside the screen on purpose: a tap on a switch changes one value
 * here, and only the pieces that read that value are redrawn (the switch itself and the section it controls), not the whole
 * screen with every other switch and section in it.
 */
export const journey = {
  get: <K extends keyof State>(key: K): State[K] => state[key],
  set(patch: Partial<State>) {
    const changed = (Object.keys(patch) as (keyof State)[]).some((k) => !Object.is(state[k], patch[k]));
    if (!changed) return;
    state = { ...state, ...patch };
    listeners.forEach((fn) => fn());
  },
  reset() { state = INITIAL; },
};

export function useJourney<K extends keyof State>(key: K): State[K] {
  return useSyncExternalStore(subscribe, () => state[key]);
}

/** Each mounted section registers how to reload itself; pull-to-refresh and "Try again" call the visible one's. */
export const refreshers: Partial<Record<Section, () => Promise<unknown>>> = {};
