// Pure data shaping for the Health journey screens: no React, no network. Everything the screens show is worked out here
// from the three server responses (health-timeline, growth, immunization), so it can be tested on its own.
import type { GrowthSeries, HealthTimeline, Immunization, ImmunizationRow, TimelineEpisode, TimelineLane } from "@/api/types";
import { DAY_MS, MONTH_DAYS, formatDate, niceTicks, toMs } from "@/components/health/chartTheme";

export type Tone = "ink" | "chronic" | "critical" | "serious" | "good" | "acute" | "info" | "warning" | "muted";
export type Shape = "bar" | "dot" | "diamond" | "check" | "cross" | "ring" | "recurrent";
type MarkKind = "birth" | "growth" | "vaccines" | "episode" | "admission" | "lab";
export type Chip = { text: string; tone: Tone };

export interface Mark {
  id: string;
  laneId: string;
  kind: MarkKind;
  start: string;
  end: string;
  shape: Shape;
  tone: Tone;
  /** what the dark card under the chart says when the mark is tapped */
  title: string;
  sub: string;
  chip?: Chip;
  /** the report this mark came from */
  documentId?: number | null;
  /** the episode sheet this mark opens (acute and chronic lanes) */
  episodeLaneId?: string;
}

export interface LaneModel {
  id: string;
  type: TimelineLane["type"];
  label: string;
  recurrent: boolean;
  marks: Mark[];
}

// ------------------------------------------------------------------ who the vaccine schedule is for
/** The vaccination schedule is a child's: it says nothing useful about an adult. */
export function isChildDob(dob: string | null | undefined): boolean {
  return !dob || (Date.now() - new Date(`${dob}T00:00:00`).getTime()) / (365.25 * DAY_MS) < 18;
}

/** The timeline without its vaccine row, for an adult. */
export function withoutVaccines(t: HealthTimeline): HealthTimeline {
  return { ...t, lanes: t.lanes.filter((l) => l.type !== "immunization") };
}

// ------------------------------------------------------------------ dates and ages
export const isoOf = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const daysBetween = (a: string, b: string): number => Math.round((toMs(b) - toMs(a)) / DAY_MS);

/** "birth", "5 months", "1 y 6 m", "2 y" - the child's age on a day. */
export function ageOn(dob: string, on: string): string {
  const m = Math.floor(daysBetween(dob, on) / MONTH_DAYS);
  if (m < 1) return "birth";
  if (m < 12) return `${m} month${m > 1 ? "s" : ""}`;
  const y = Math.floor(m / 12);
  const r = m % 12;
  return r ? `${y} y ${r} m` : `${y} y`;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthYear = (iso: string): string => {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
};

/** "3 – 9 Apr 2026", "12 Jun 2026", "30 Mar – 2 Apr 2026" */
export function formatRange(start: string, end?: string | null): string {
  if (!end || end === start) return formatDate(start);
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  if (sy === ey && sm === em) return `${sd} – ${formatDate(end)}`;
  return `${formatDate(start)} – ${formatDate(end)}`;
}

/** "Wheezing episode" -> "Wheezing", "Cold / upper respiratory infection" -> "Cold": fits a lane label */
export const shortLabel = (label: string): string => label.split(" / ")[0].replace(/ episode$/, "");

const pronoun = (sex: string, forms: [string, string]) => (sex === "female" ? forms[1] : forms[0]);

// ------------------------------------------------------------------ lanes (the chart)
const worstVaccine = (rows: ImmunizationRow[]): ImmunizationRow =>
  rows.find((r) => r.status === "OVERDUE") ?? rows.find((r) => r.status === "DUE") ?? rows[0];

const vaccineLabel = (r: ImmunizationRow) => `${cleanVaccineName(r.vaccine)}${r.dose > 1 ? ` ${r.dose}` : ""}`;

function episodeMark(lane: Extract<TimelineLane, { type: "acute" | "chronic" }>, ep: TimelineEpisode, i: number, dob: string, to: string): Mark {
  const chronic = lane.type === "chronic";
  const end = ep.end ?? (chronic ? to : ep.start);
  const multi = end !== ep.start;
  const crit = ep.peak_severity === "CRITICAL";
  const abnormal = ep.peak_severity === "ABNORMAL";
  return {
    id: `${lane.id}#${i}`, laneId: lane.id, kind: "episode", start: ep.start, end,
    shape: chronic ? "bar" : multi ? "bar" : crit ? "diamond" : "dot",
    tone: chronic ? "chronic" : crit ? "critical" : abnormal ? "serious" : "acute",
    title: lane.label,
    sub: `${formatRange(ep.start, chronic ? null : ep.end)} · age ${ageOn(dob, ep.start)}`,
    chip: crit || abnormal ? { text: ep.peak_severity_label, tone: crit ? "critical" : "serious" } : undefined,
    episodeLaneId: lane.id,
  };
}

/** One row per lane of the timeline response, each with its marks ready to draw and describe. */
export function laneModels(t: HealthTimeline): LaneModel[] {
  const dob = t.patient.dob;
  const to = t.period.to;
  const out: LaneModel[] = [];
  for (const lane of t.lanes) {
    const marks: Mark[] = [];
    let recurrent = false;
    if (lane.type === "birth") {
      const b = lane.items[0];
      if (b) {
        const parts = [b.gestation_weeks && `${b.gestation_weeks} weeks`, b.birth_weight_kg && `${b.birth_weight_kg} kg`, b.nicu_admission && `NICU ${b.nicu_days ?? "?"} days`].filter(Boolean);
        marks.push({ id: `${lane.id}#0`, laneId: lane.id, kind: "birth", start: b.date, end: b.date, shape: b.nicu_admission ? "diamond" : "dot", tone: b.nicu_admission ? "serious" : "acute", title: "Born", sub: parts.join(" · "), documentId: b.document_id });
      }
    } else if (lane.type === "growth") {
      const byDate = new Map<string, { weight?: number; height?: number; head?: number; flag?: string | null }>();
      const take = (key: "weight" | "height" | "head", pts: { date: string; value: number; flag: string | null }[] | undefined) =>
        (pts ?? []).forEach((p) => {
          const row = byDate.get(p.date) ?? {};
          row[key] = p.value;
          if (p.flag && !row.flag) row.flag = p.flag;
          byDate.set(p.date, row);
        });
      take("weight", lane.series.weight_kg);
      take("height", lane.series.height_cm);
      take("head", lane.series.head_circ_cm);
      const dips = new Set(lane.alerts.map((a) => a.to));
      Array.from(byDate.keys()).sort().forEach((date, i) => {
        const r = byDate.get(date)!;
        const severe = !!r.flag && r.flag.startsWith("SEVERE");
        const flagged = !!r.flag || dips.has(date);
        const sub = [r.weight != null && `${r.weight} kg`, r.height != null && `${r.height} cm`, r.head != null && `head ${r.head} cm`].filter(Boolean).join(" · ");
        marks.push({
          id: `${lane.id}#${i}`, laneId: lane.id, kind: "growth", start: date, end: date, shape: flagged ? "diamond" : "dot",
          tone: severe ? "critical" : flagged ? "serious" : "ink", title: "Growth check", sub: sub || "Measured",
        });
      });
    } else if (lane.type === "immunization") {
      const byDate = new Map<string, ImmunizationRow[]>();
      lane.items.filter((r) => r.status === "GIVEN" || r.status === "OVERDUE" || r.status === "DUE").forEach((r) => {
        byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]);
      });
      Array.from(byDate.keys()).sort().forEach((date, i) => {
        const rows = byDate.get(date)!;
        const worst = worstVaccine(rows);
        const given = rows.filter((r) => r.status === "GIVEN").map(vaccineLabel);
        const late = rows.filter((r) => r.status !== "GIVEN").map(vaccineLabel);
        const status = worst.status;
        marks.push({
          id: `${lane.id}#${i}`, laneId: lane.id, kind: "vaccines", start: date, end: date,
          shape: status === "OVERDUE" ? "cross" : status === "DUE" ? "dot" : "check", tone: status === "OVERDUE" ? "critical" : status === "DUE" ? "warning" : "good",
          title: `Vaccines · ${formatDate(date)}`,
          sub: [given.length && `${given.join(", ")} (Given)`, late.length && `${late.join(", ")} (${status === "OVERDUE" ? "Overdue" : "Due"})`].filter(Boolean).join(" · "),
        });
      });
    } else if (lane.type === "chronic") {
      marks.push(episodeMark(lane, lane.episode, 0, dob, to));
    } else if (lane.type === "acute") {
      recurrent = lane.is_recurrent;
      lane.episodes.forEach((ep, i) => marks.push(episodeMark(lane, ep, i, dob, to)));
    } else if (lane.type === "hospital") {
      lane.items.forEach((h, i) => {
        if (h.kind === "ADMISSION") {
          const ward = h.ward && h.ward !== "WARD" ? ` · ${h.ward}` : "";
          marks.push({
            id: `${lane.id}#${i}`, laneId: lane.id, kind: "admission", start: h.start, end: h.end ?? to, shape: "bar", tone: h.is_critical ? "critical" : "serious",
            title: `${h.reason || "Hospital stay"}${ward}`, sub: `${formatRange(h.start, h.end)} · age ${ageOn(dob, h.start)}`,
            chip: { text: h.label, tone: h.is_critical ? "critical" : "serious" }, documentId: h.document_id,
          });
        } else {
          marks.push({
            id: `${lane.id}#${i}`, laneId: lane.id, kind: "lab", start: h.start, end: h.start, shape: "diamond", tone: "critical",
            title: "Test result needed attention", sub: `${formatDate(h.start)} · age ${ageOn(dob, h.start)}`, chip: { text: h.label, tone: "critical" }, documentId: h.document_id,
          });
        }
      });
    }
    out.push({ id: lane.id, type: lane.type, label: lane.label, recurrent, marks });
  }
  return out;
}

/** The lanes that have something inside the period: a row with nothing to show would only be an empty line. */
export function visibleLanes(lanes: LaneModel[], from: string, to: string): LaneModel[] {
  return lanes.filter((l) => l.marks.some((m) => m.start <= to && m.end >= from));
}

/** The overview's "At a glance": what is ongoing, what keeps coming back, hospital care, growth and vaccines. */
export function glanceLanes(lanes: LaneModel[]): LaneModel[] {
  const pick = [
    ...lanes.filter((l) => l.type === "chronic"),
    ...lanes.filter((l) => l.type === "acute" && l.recurrent),
    ...lanes.filter((l) => l.type === "hospital").map((l) => ({ ...l, label: "Hospital" })),
    ...lanes.filter((l) => l.type === "growth"),
    ...lanes.filter((l) => l.type === "immunization"),
  ];
  return pick.slice(0, 6);
}

// ------------------------------------------------------------------ the axis of the lane chart
interface Tick { iso: string; label: string }

/**
 * The labels along the bottom of the lane chart: ages ("3 m", "1 y") or calendar months. A short period is labelled more
 * closely; the long, scrollable chart every 3 months.
 */
export function laneTicks(dob: string, from: string, to: string, axis: "age" | "date", fit: boolean): Tick[] {
  const spanM = daysBetween(from, to) / MONTH_DAYS;
  const out: Tick[] = [];
  if (axis === "age") {
    const step = fit ? (spanM <= 14 ? 3 : 12) : 3;
    const first = daysBetween(dob, from) / MONTH_DAYS;
    for (let m = Math.ceil(first / step) * step; ; m += step) {
      const ms = toMs(dob) + m * MONTH_DAYS * DAY_MS;
      if (ms > toMs(to)) break;
      out.push({ iso: isoOf(ms), label: m === 0 ? "Birth" : m < 24 ? (m % 12 === 0 ? `${m / 12} y` : `${m} m`) : m % 12 === 0 ? `${m / 12} y` : `${Math.floor(m / 12)} y ${m % 12} m` });
    }
    return out;
  }
  const step = spanM <= 5 ? 1 : 3;
  const f = new Date(`${from}T00:00:00`);
  let d = new Date(f.getFullYear(), f.getMonth() + (f.getDate() > 1 ? 1 : 0), 1);
  const end = toMs(to);
  while (d.getTime() <= end) {
    if (d.getMonth() % step === 0) out.push({ iso: isoOf(d.getTime()), label: d.getMonth() === 0 ? String(d.getFullYear()) : MONTH_NAMES[d.getMonth()] });
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  }
  return out;
}

// ------------------------------------------------------------------ the list
export type FeedFilter = "all" | "illness" | "hospital" | "vaccines" | "growth";
export const FEED_FILTERS: { key: FeedFilter; label: string }[] = [
  { key: "all", label: "All" }, { key: "illness", label: "Illness" }, { key: "hospital", label: "Hospital" },
  { key: "vaccines", label: "Vaccines" }, { key: "growth", label: "Growth" },
];

type FeedTarget = { type: "episode"; laneId: string } | { type: "section"; section: "growth" | "vaccines" } | { type: "document"; id: number } | null;

export interface FeedItem {
  id: string;
  date: string;
  endDate?: string | null;
  age: string;
  filter: Exclude<FeedFilter, "all">;
  marker: { shape: Shape; tone: Tone };
  title: string;
  detail: string;
  chips: Chip[];
  target: FeedTarget;
}

export function feedItems(t: HealthTimeline): FeedItem[] {
  const dob = t.patient.dob;
  const items: FeedItem[] = [];
  const push = (o: Omit<FeedItem, "age">) => items.push({ ...o, age: ageOn(dob, o.date) });
  const doc = (id: number | null | undefined): FeedTarget => (id ? { type: "document", id } : null);

  for (const lane of t.lanes) {
    if (lane.type === "birth" && lane.items[0] && lane.items[0].date >= t.period.from) {
      const b = lane.items[0];
      const parts = [b.gestation_weeks && `${b.gestation_weeks} weeks`, b.birth_weight_kg && `${b.birth_weight_kg} kg`, b.nicu_admission && `NICU ${b.nicu_days ?? "?"} days`].filter(Boolean);
      push({ id: "birth", date: b.date, filter: "hospital", marker: { shape: b.nicu_admission ? "diamond" : "dot", tone: b.nicu_admission ? "serious" : "acute" }, title: "Born", detail: parts.join(" · "), chips: b.preterm ? [{ text: "Born early", tone: "serious" }] : [], target: doc(b.document_id) });
    }
    if (lane.type === "growth") {
      const w = lane.series.weight_kg ?? [];
      const last = w[w.length - 1];
      if (last) {
        const h = (lane.series.height_cm ?? []).find((p) => p.date === last.date);
        const hc = (lane.series.head_circ_cm ?? []).find((p) => p.date === last.date);
        const flagged = [last, h, hc].some((p) => p && p.flag);
        const vals = [`${last.value} kg`, h && `${h.value} cm`, hc && `head ${hc.value} cm`].filter(Boolean).join(" · ");
        push({ id: `growth:${last.date}`, date: last.date, filter: "growth", marker: { shape: "dot", tone: "ink" }, title: "Latest growth check", detail: vals,
          chips: [flagged ? { text: "Outside usual range", tone: "serious" } : { text: "Within expected range", tone: "good" }], target: { type: "section", section: "growth" } });
      }
      lane.alerts.forEach((a) => push({ id: `dip:${a.from}`, date: a.to, filter: "growth", marker: { shape: "diamond", tone: "serious" }, title: "Weight dropped",
        detail: `Weight fell across centile lines between ${monthYear(a.from)} and ${monthYear(a.to)}.`, chips: [], target: { type: "section", section: "growth" } }));
    }
    if (lane.type === "immunization") {
      const byDate = new Map<string, ImmunizationRow[]>();
      lane.items.forEach((r) => byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]));
      byDate.forEach((rows, date) => {
        const given = rows.filter((r) => r.status === "GIVEN");
        if (given.length) {
          push({ id: `vax:${date}`, date, filter: "vaccines", marker: { shape: "check", tone: "good" }, title: given.length === 1 ? "Vaccine given" : `${given.length} vaccines given`,
            detail: given.map(vaccineLabel).join(", "), chips: given.some((r) => r.late) ? [{ text: "Given late", tone: "warning" }] : [], target: { type: "section", section: "vaccines" } });
        }
        rows.filter((r) => r.status === "OVERDUE" || r.status === "DUE").forEach((r) => push({
          id: `vax:${r.code}`, date: r.due_on, filter: "vaccines", marker: { shape: r.status === "OVERDUE" ? "cross" : "dot", tone: r.status === "OVERDUE" ? "critical" : "warning" },
          title: `${cleanVaccineName(r.vaccine)} dose ${r.dose}`, detail: `Due ${formatDate(r.due_on)}`, chips: [{ text: r.status_label, tone: r.status === "OVERDUE" ? "critical" : "warning" }], target: { type: "section", section: "vaccines" },
        }));
      });
    }
    if (lane.type === "chronic") {
      const ep = lane.episode;
      push({ id: `chronic:${ep.key}`, date: ep.start, filter: "illness", marker: { shape: "bar", tone: "chronic" }, title: `${lane.label} diagnosed`, detail: `Ongoing condition, since ${formatDate(ep.start)}.`,
        chips: [{ text: "Ongoing", tone: "info" }], target: { type: "episode", laneId: lane.id } });
    }
    if (lane.type === "acute") {
      lane.episodes.forEach((ep) => {
        const crit = ep.peak_severity === "CRITICAL";
        const chips: Chip[] = [];
        if (crit) chips.push({ text: ep.peak_severity_label, tone: "critical" });
        else if (ep.peak_severity === "ABNORMAL") chips.push({ text: ep.peak_severity_label, tone: "serious" });
        if (lane.is_recurrent) chips.push({ text: "↻ Happens often", tone: "serious" });
        push({ id: `acute:${ep.key}`, date: ep.start, endDate: ep.end, filter: "illness", marker: { shape: crit ? "diamond" : "dot", tone: crit ? "critical" : "acute" }, title: lane.label,
          detail: `${ep.event_count} doctor visit${ep.event_count === 1 ? "" : "s"}`, chips, target: { type: "episode", laneId: lane.id } });
      });
    }
    if (lane.type === "hospital") {
      lane.items.forEach((h) => {
        if (h.kind === "ADMISSION") {
          const days = h.end ? daysBetween(h.start, h.end) : null;
          push({ id: `adm:${h.start}`, date: h.start, endDate: h.end, filter: "hospital", marker: { shape: "diamond", tone: h.is_critical ? "critical" : "serious" },
            title: h.reason ? `Hospital stay: ${h.reason.toLowerCase()}` : "Hospital stay",
            detail: [h.ward && h.ward !== "WARD" && h.ward, days != null && `${days} day${days === 1 ? "" : "s"}`].filter(Boolean).join(" · "),
            chips: [{ text: h.label, tone: h.is_critical ? "critical" : "serious" }], target: doc(h.document_id) });
        } else {
          push({ id: `lab:${h.start}:${h.analyte}`, date: h.start, filter: "hospital", marker: { shape: "diamond", tone: "critical" }, title: "Test result",
            detail: "A result your doctor looked at closely", chips: [{ text: h.label, tone: "critical" }], target: doc(h.document_id) });
        }
      });
    }
  }
  items.sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : b.date.localeCompare(a.date)));
  return items;
}

interface FeedGroup { year: string; title: string; items: FeedItem[] }

/** Newest first, a heading per year with the child's age then: "2026 · AGE 2", "2024 · AGE UNDER 1". */
export function groupByYear(items: FeedItem[], dob: string): FeedGroup[] {
  const groups: FeedGroup[] = [];
  for (const it of items) {
    const year = it.date.slice(0, 4);
    let g = groups[groups.length - 1];
    if (!g || g.year !== year) {
      const age = Math.floor(daysBetween(dob, it.date) / 365.25);
      g = { year, title: `${year} · AGE ${age < 1 ? "UNDER 1" : age}`, items: [] };
      groups.push(g);
    }
    g.items.push(it);
  }
  return groups;
}

// ------------------------------------------------------------------ the overview
interface TileHints { chronic: string; acute: string; recurrent: string; hospital: string }

/** The small line under each count: the names behind the number. */
export function tileHints(t: HealthTimeline, todayIso: string): TileHints {
  const chronic = t.lanes.filter((l): l is Extract<TimelineLane, { type: "chronic" }> => l.type === "chronic");
  const acute = t.lanes.filter((l): l is Extract<TimelineLane, { type: "acute" }> => l.type === "acute");
  const lastYear = acute.flatMap((l) => l.episodes).filter((e) => daysBetween(e.start, todayIso) <= 365 && daysBetween(e.start, todayIso) >= 0).length;
  const stays = (t.lanes.find((l) => l.type === "hospital") as Extract<TimelineLane, { type: "hospital" }> | undefined)?.items.filter((h) => h.kind === "ADMISSION") ?? [];
  return {
    chronic: chronic.map((l) => `${l.label}, since ${l.episode.start.slice(0, 4)}`).join("; ") || "None recorded",
    acute: `${lastYear} in the last year`,
    recurrent: acute.filter((l) => l.is_recurrent).map((l) => shortLabel(l.label)).join(", ") || "None",
    hospital: stays.map((h) => (h.age_label === "Birth" ? "At birth" : (h.reason || h.ward || "Hospital stay").toLowerCase())).join(", ") || "None",
  };
}

interface Attention { id: string; title: string; detail: string; complaint: string }

/** Overdue or due vaccines, as the cards at the top of the overview. Several of them become one card. */
export function attentionItems(t: HealthTimeline): Attention[] {
  const imm = t.lanes.find((l) => l.type === "immunization") as Extract<TimelineLane, { type: "immunization" }> | undefined;
  const rows = (imm?.items ?? []).filter((r) => r.status === "OVERDUE" || r.status === "DUE").sort((a, b) => a.due_on.localeCompare(b.due_on));
  if (!rows.length) return [];
  const overdue = rows.some((r) => r.status === "OVERDUE");
  if (rows.length === 1) {
    const r = rows[0];
    return [{ id: r.code, title: `${cleanVaccineName(r.vaccine)} vaccine is ${overdue ? "overdue" : "due"}`, detail: `Dose ${r.dose} was due on ${formatDate(r.due_on)}.`, complaint: complaintFor(rows) }];
  }
  return [{ id: "many", title: `${rows.length} vaccines are ${overdue ? "overdue or due" : "due"}`, detail: `The oldest was due on ${formatDate(rows[0].due_on)}.`, complaint: complaintFor(rows) }];
}

// ------------------------------------------------------------------ the episode sheet
interface EpisodeRow { key: string; range: string; age: string; visits: number; critical: boolean; severityLabel: string; documentId: number | null }
export interface EpisodeModel {
  laneId: string;
  title: string;
  chronic: boolean;
  chips: Chip[];
  lines: string[];
  rows: EpisodeRow[];
  /** the dates the small strip chart spans: a month before the first episode to a month after the last */
  from: string;
  to: string;
}

const addMonthsIso = (iso: string, months: number): string => {
  const d = new Date(`${iso}T00:00:00`);
  d.setMonth(d.getMonth() + months);
  return isoOf(d.getTime());
};

export function episodeModel(t: HealthTimeline, laneId: string): EpisodeModel | null {
  const lane = t.lanes.find((l) => l.id === laneId);
  if (!lane || (lane.type !== "chronic" && lane.type !== "acute")) return null;
  const dob = t.patient.dob;
  const eps = (lane.type === "chronic" ? [lane.episode] : lane.episodes).slice().sort((a, b) => b.start.localeCompare(a.start));
  const rec = lane.type === "acute" ? lane.recurrence : null;
  const chips: Chip[] = [];
  const lines: string[] = [];
  if (lane.type === "chronic") {
    chips.push({ text: "Ongoing condition", tone: "info" });
    lines.push(`Ongoing since ${formatDate(lane.episode.start)}, when ${pronoun(t.patient.sex, ["he", "she"])} was ${lane.episode.onset_age} old.`);
  }
  if (rec?.is_recurrent && rec.rule) {
    chips.push({ text: "↻ Happens often", tone: "serious" });
    const n = rec.rule.min_count;
    const wm = rec.rule.window_months;
    const window = wm >= 1200 ? "at any age" : wm % 12 === 0 ? `within ${wm === 12 ? "a year" : `${wm / 12} years`}` : `within ${wm} months`;
    const dates = rec.episode_keys.map((k) => k.split(":").pop() as string).filter(Boolean).sort();
    const span = dates.length ? `, between ${monthYear(dates[0])} and ${monthYear(dates[dates.length - 1])}` : "";
    lines.push(`${shortLabel(lane.label)} came back ${n} times ${window}${span}.`);
    lines.push(`The clinic is alerted when this happens ${n} times ${window}.`);
  } else if (rec?.context === "typical for age") {
    lines.push(`${rec.episodes_last_12m} in the last 12 months. This is typical for ${pronoun(t.patient.sex, ["his", "her"])} age.`);
  }
  const worst = eps.find((e) => e.peak_severity === "CRITICAL") ?? eps.find((e) => e.peak_severity === "ABNORMAL");
  if (worst && !chips.some((c) => c.text === worst.peak_severity_label)) chips.push({ text: worst.peak_severity_label, tone: worst.peak_severity === "CRITICAL" ? "critical" : "serious" });
  const starts = eps.map((e) => e.start).sort();
  const ends = eps.map((e) => e.end ?? t.period.to).sort();
  const to = addMonthsIso(ends[ends.length - 1], 1);
  return {
    laneId, title: shortLabel(lane.label), chronic: lane.type === "chronic", chips, lines,
    rows: eps.map((e) => ({
      key: e.key, range: lane.type === "chronic" ? `Since ${formatDate(e.start)}` : formatRange(e.start, e.end), age: ageOn(dob, e.start), visits: e.event_count,
      critical: e.peak_severity === "CRITICAL", severityLabel: e.peak_severity_label, documentId: e.document_ids?.[0] ?? null,
    })),
    from: addMonthsIso(starts[0], -1) < dob ? dob : addMonthsIso(starts[0], -1),
    to: to > t.period.to ? t.period.to : to,
  };
}

// ------------------------------------------------------------------ vaccines
const cleanVaccineName = (v: string): string => v.replace("DTwP/DTaP", "DTaP").replace(" (PCV)", "");

export type DoseStatus = "given" | "overdue" | "due" | "upcoming" | "later";
export interface DoseRow { code: string; vaccine: string; dose: number; dueOn: string; givenOn: string | null; status: DoseStatus; late: boolean; documentId: number | null; bookable: boolean }
export interface VaccineGroup { label: string; rows: DoseRow[]; names: string[]; status: DoseStatus; given: number; total: number; overdue: number; pending: DoseRow[] }

const STATUS_OF: Record<ImmunizationRow["status"], DoseStatus> = { GIVEN: "given", OVERDUE: "overdue", DUE: "due", UPCOMING: "upcoming", SCHEDULED: "later" };
const BUCKETS: [number, string][] = [[0, "Birth"], [120, "6–14 weeks"], [300, "6–9 months"], [600, "12–18 months"], [2200, "4–6 years"], [Infinity, "9–12 years"]];

const isBookable = (s: DoseStatus) => s === "overdue" || s === "due" || s === "upcoming";

function doseRow(r: ImmunizationRow): DoseRow {
  const status = STATUS_OF[r.status] ?? "later";
  return { code: r.code, vaccine: cleanVaccineName(r.vaccine), dose: r.dose, dueOn: r.due_on, givenOn: r.given_on, status, late: r.late, documentId: r.document_id, bookable: isBookable(status) };
}

/** The doses in age groups ("Birth", "6–14 weeks" ...), in schedule order. */
export function vaccineGroups(imm: Immunization, dob: string): VaccineGroup[] {
  const groups: VaccineGroup[] = [];
  const rows = imm.rows.slice().sort((a, b) => a.due_on.localeCompare(b.due_on) || a.vaccine.localeCompare(b.vaccine));
  for (const r of rows) {
    const days = daysBetween(dob, r.due_on);
    const label = (BUCKETS.find(([max]) => days <= max) ?? BUCKETS[BUCKETS.length - 1])[1];
    let g = groups.find((x) => x.label === label);
    if (!g) { g = { label, rows: [], names: [], status: "later", given: 0, total: 0, overdue: 0, pending: [] }; groups.push(g); }
    g.rows.push(doseRow(r));
  }
  for (const g of groups) {
    const count = (s: DoseStatus) => g.rows.filter((r) => r.status === s).length;
    g.names = Array.from(new Set(g.rows.map((r) => r.vaccine)));
    g.given = count("given");
    g.total = g.rows.length;
    g.overdue = count("overdue");
    g.pending = g.rows.filter((r) => r.bookable);
    g.status = g.overdue ? "overdue" : count("due") ? "due" : g.given === g.total ? "given" : count("upcoming") ? "upcoming" : "later";
  }
  return groups;
}

export function nextScheduled(imm: Immunization): DoseRow | null {
  const r = imm.rows.filter((x) => x.status === "UPCOMING" || x.status === "SCHEDULED").sort((a, b) => a.due_on.localeCompare(b.due_on))[0];
  return r ? doseRow(r) : null;
}

/** The reason shown at the booking: the vaccines' names, the first few when there are many. */
export function complaintFor(rows: { vaccine: string; dose: number }[]): string {
  const names = Array.from(new Set(rows.map((r) => `${cleanVaccineName(r.vaccine)} ${r.dose}`)));
  return `Vaccination: ${names.slice(0, 6).join(", ")}${names.length > 6 ? ` +${names.length - 6} more` : ""}`;
}

// ------------------------------------------------------------------ growth
interface GrowthScale { xMax: number; yMin: number; yMax: number; yTicks: number[]; xTicks: number[]; minPxPerMonth: number }

/** The ranges of the growth chart: how far the age axis runs, and the weight/height/head range that holds the bands and the readings. */
export function growthScale(series: GrowthSeries): GrowthScale {
  const median = series.reference["0"] ?? [];
  const lastRef = median.length ? median[median.length - 1][0] : 36;
  const lastPoint = series.points.length ? Math.max(...series.points.map((p) => p.age_months)) : 0;
  const xMax = Math.max(12, Math.ceil(Math.max(lastRef, lastPoint)));
  const values: number[] = [];
  (series.reference["-3"] ?? []).forEach(([m, v]) => { if (m <= xMax) values.push(v); });
  (series.reference["3"] ?? []).forEach(([m, v]) => { if (m <= xMax) values.push(v); });
  series.points.forEach((p) => values.push(p.value));
  const lo = values.length ? Math.min(...values) : 0;
  const hi = values.length ? Math.max(...values) : 10;
  const first = niceTicks(lo, hi, 5);
  const step = first.length > 1 ? first[1] - first[0] : 1;
  const yMin = Math.floor(lo / step) * step;
  const yMax = Math.ceil(hi / step) * step;
  const yTicks = niceTicks(yMin, yMax, 6);
  const xStep = xMax <= 60 ? 3 : 12;
  const xTicks: number[] = [];
  for (let m = 0; m <= xMax; m += xStep) xTicks.push(m);
  return { xMax, yMin, yMax, yTicks, xTicks, minPxPerMonth: xMax <= 48 ? 24 : xMax <= 120 ? 12 : 6 };
}

export const growthTickLabel = (m: number): string => (m === 0 ? "Birth" : m % 12 === 0 ? `${m / 12} y` : `${m} m`);
