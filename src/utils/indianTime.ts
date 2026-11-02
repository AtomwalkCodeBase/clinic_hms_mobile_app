/**
 * Times and dates the way the app shows them: Indian Standard Time, and the 12-hour clock with AM and PM ("7:00 PM",
 * never "19:00"). The server sends appointment times as "HH:MM" text for the hospital's own clock, so they are only
 * re-written, not converted.
 */

const IST_OFFSET_MS = 330 * 60 * 1000;
const IST = "Asia/Kolkata";

/** "19:00" or "19:00:00" as "7:00 PM"; "00:30" as "12:30 AM". Anything that is not a 24-hour time is returned as it came. */
export function formatTime12(time?: string | null): string {
  if (!time) return "";
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(time.trim());
  if (!m) return time;
  const h = Number(m[1]);
  if (h > 23) return time;
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}

/** A moment as an Indian clock time: "7:00 PM". */
export function formatClock(date: Date | string | number): string {
  return new Date(date)
    .toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: IST })
    .replace(/[  ]/g, " ")
    .replace(/\b(am|pm)\b/i, (s) => s.toUpperCase());
}

/** Today's date in India as "2026-11-02", `offsetDays` days on. The phone's own time zone does not matter. */
export function istDateIso(offsetDays = 0): string {
  return new Date(Date.now() + IST_OFFSET_MS + offsetDays * 86400000).toISOString().slice(0, 10);
}

/** The hour (0-23) it is now in India. */
export function istHour(): number {
  return new Date(Date.now() + IST_OFFSET_MS).getUTCHours();
}

/** "2026-11-04" as "Wed, 4 Nov". Built from its parts so the day never shifts with the phone's time zone. */
export function shortDayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

/** Today's date for a greeting: "Monday, 2 November". */
export function istTodayLong(): string {
  return new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: IST });
}
