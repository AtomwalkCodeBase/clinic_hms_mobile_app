import { BRAND, NEUTRAL } from "@/theme/themes";

/** The colours of the two health charts. The greens and greys are the app's; the blues are the growth chart's own (WHO bands). */
export const CHART = {
  grid: "#E4E9EF",
  track: NEUTRAL.surfaceAlt,
  ink: NEUTRAL.textPrimary,
  label: NEUTRAL.textSecondary,
  muted: NEUTRAL.textMuted,
  chronic: "#2A5BD6",
  acute: NEUTRAL.textSecondary,
  serious: "#E0803A",
  critical: NEUTRAL.danger,
  good: BRAND,
  warning: "#E0A02A",
  bandInner: "#CDE2FB",
  bandOuter: "#EAF2FC",
  median: "#3987E5",
  selected: "#2A5BD6",
  flagged: "#C0501A",
};

export const DAY_MS = 86400000;
export const MONTH_DAYS = 30.4375;

export const toMs = (iso: string) => new Date(`${iso}T00:00:00`).getTime();

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2025-03-12" -> "12 Mar 2025" */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** 21 -> "21st", 22 -> "22nd", 4 -> "4th" */
export function ordinal(n: number): string {
  const v = Math.round(n);
  const tens = v % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[v % 10] ?? "th";
  return `${v}${suffix}`;
}

/** How a growth flag from the server reads to a parent. */
export const GROWTH_FLAG_LABEL: Record<string, string> = {
  SEVERE_LOW: "Well below expected",
  LOW: "Below expected",
  HIGH: "Above expected",
  SEVERE_HIGH: "Well above expected",
};

/** "Round" tick values between min and max, about `count` of them: 2, 4, 6 ... or 40, 60, 80 */
export function niceTicks(min: number, max: number, count = 5): number[] {
  const rough = (max - min) / Math.max(count - 1, 1);
  const pow = Math.pow(10, Math.floor(Math.log10(rough || 1)));
  const f = rough / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
