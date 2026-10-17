import { useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Line, Polygon, Polyline, Rect, Text as SvgText } from "react-native-svg";
import type { HealthTimeline, ImmunizationRow, TimelineEpisode, TimelineLane, TimelineSeverity } from "@/api/types";
import { BRAND_SOFT, NEUTRAL } from "@/theme/themes";
import { CHART, DAY_MS, GROWTH_FLAG_LABEL, MONTH_DAYS, clamp, ordinal, formatDate, formatMonthYear, formatMonths, toMs } from "./chartTheme";

/** What a tapped mark says: shown in the screen's detail sheet. Dates and what happened only, never a document. */
export interface TimelineMark {
  key: string;
  /** the day it starts, "2025-03-12" */
  date: string;
  title: string;
  tag: string;
  rows: [string, string][];
  /** a vaccine mark: the sheet offers to open the Vaccinations screen */
  vaccines?: boolean;
  /** shown in the "List" view: conditions and hospital care, not the growth checks and vaccines */
  inList?: boolean;
}

type Shape = "bar" | "band" | "diamond" | "dot" | "tick" | "check" | "cross" | "ring";
interface Item { x0: number; x1: number; lane: number; shape: Shape; color: string; mark: TimelineMark }

const LANE_H = 56;
const AXIS_H = 38;
const LABEL_W = 100;
const PAD_L = 20;
const PAD_R = 34;
const PX_PER_MONTH = 34;    // room for each month: marks stay apart and are easy to press

const SEVERITY: Record<TimelineSeverity, { color: string; shape: Shape }> = {
  CRITICAL: { color: CHART.critical, shape: "diamond" },
  ABNORMAL: { color: CHART.serious, shape: "dot" },
  MILD: { color: CHART.acute, shape: "dot" },
  NORMAL: { color: CHART.acute, shape: "dot" },
};

// worst first: a day's several doses are drawn as one mark, in the colour of the most pressing one
const VACCINE_RANK = { OVERDUE: 0, DUE: 1, UPCOMING: 2, SCHEDULED: 3, GIVEN: 4 } as const;
const VACCINE_LOOK: Record<ImmunizationRow["status"], { color: string; shape: Shape }> = {
  GIVEN: { color: CHART.good, shape: "check" },
  OVERDUE: { color: CHART.critical, shape: "cross" },
  DUE: { color: CHART.warning, shape: "dot" },
  UPCOMING: { color: CHART.muted, shape: "ring" },
  SCHEDULED: { color: CHART.muted, shape: "ring" },
};

function episodeRows(ep: TimelineEpisode): [string, string][] {
  const dates = ep.end && ep.end !== ep.start ? `${formatDate(ep.start)} to ${formatDate(ep.end)}` : formatDate(ep.start);
  return [["Date", dates], ["Age", ep.onset_age], ["Visits", String(ep.event_count)]];
}

function buildItems(payload: HealthTimeline, axis: "age" | "date"): Item[] {
  const dobMs = toMs(payload.patient.dob);
  const x = (iso: string) => (axis === "age" ? (toMs(iso) - dobMs) / DAY_MS : toMs(iso));
  const items: Item[] = [];
  const push = (lane: number, start: string, end: string | null, shape: Shape, color: string, mark: Omit<TimelineMark, "date">) =>
    items.push({ x0: x(start), x1: x(end || start), lane, shape, color, mark: { ...mark, date: start } });

  payload.lanes.forEach((lane: TimelineLane, i) => {
    switch (lane.type) {
      case "birth": {
        const b = lane.items[0];
        if (!b) break;
        const rows: [string, string][] = [];
        if (b.gestation_weeks) rows.push(["Gestation", `${b.gestation_weeks} weeks${b.preterm ? " (born early)" : ""}`]);
        if (b.birth_weight_kg) rows.push(["Birth weight", `${b.birth_weight_kg} kg`]);
        rows.push(["NICU stay", b.nicu_admission ? `${b.nicu_days ?? "?"} days` : "No"]);
        push(i, payload.patient.dob, null, b.nicu_admission ? "diamond" : "dot", b.nicu_admission ? CHART.serious : CHART.acute, { key: `${i}-birth`, title: "Birth", tag: "Milestone", rows });
        break;
      }
      case "growth": {
        // one mark per measurement day, in the colour of that day's worst flag
        const days: Record<string, Record<string, { value: number; percentile: number | null; flag: string | null }>> = {};
        Object.entries(lane.series).forEach(([indicator, pts]) => pts.forEach((p) => { (days[p.date] ||= {})[indicator] = p; }));
        const names: Record<string, [string, string]> = { weight_kg: ["Weight", "kg"], height_cm: ["Height", "cm"], head_circ_cm: ["Head size", "cm"] };
        Object.entries(days).forEach(([date, readings]) => {
          const flags = Object.values(readings).map((r) => r.flag).filter(Boolean) as string[];
          const worst = flags.find((f) => f.startsWith("SEVERE")) || flags[0];
          const rows: [string, string][] = [["Date", formatDate(date)]];
          Object.entries(readings).forEach(([k, r]) => {
            const flag = r.flag ? ` · ${GROWTH_FLAG_LABEL[r.flag] ?? r.flag}` : "";
            rows.push([names[k]?.[0] ?? k, `${r.value} ${names[k]?.[1] ?? ""}${r.percentile != null ? ` · ${ordinal(r.percentile)} centile` : ""}${flag}`]);
          });
          push(i, date, null, worst ? "diamond" : "dot", worst ? CHART.flagged : CHART.ink, { key: `${i}-${date}`, title: "Growth check", tag: worst ? GROWTH_FLAG_LABEL[worst] ?? "Check" : "Measurement", rows });
        });
        lane.alerts.forEach((a) => push(i, a.from, a.to, "band", CHART.serious, { key: `${i}-alert-${a.from}`, title: "Weight dropped across centiles", tag: "To discuss", rows: [["From", formatDate(a.from)], ["To", formatDate(a.to)], ["Change", `${a.drop} SD`]] }));
        break;
      }
      case "immunization": {
        const days: Record<string, ImmunizationRow[]> = {};
        lane.items.forEach((r) => { (days[r.date] ||= []).push(r); });
        Object.entries(days).forEach(([date, rows]) => {
          const worst = rows.reduce((a, b) => (VACCINE_RANK[b.status] < VACCINE_RANK[a.status] ? b : a));
          const look = VACCINE_LOOK[worst.status];
          push(i, date, null, look.shape, look.color, {
            key: `${i}-${date}`, title: "Vaccines", tag: worst.status_label, vaccines: true,
            rows: [["Date", formatDate(date)], ...rows.map((r): [string, string] => [r.status_label, `${r.vaccine} dose ${r.dose}${r.late ? " · late" : ""}`])],
          });
        });
        break;
      }
      case "chronic": {
        const ep = lane.episode;
        const end = ep.end || payload.period.to;
        push(i, ep.start, end, "bar", CHART.chronic, { key: `${i}-bar`, title: lane.label, tag: "Ongoing", inList: true, rows: [["Since", `${formatDate(ep.start)} (age ${ep.onset_age})`], ["Visits", String(ep.event_count)], ["Status", ep.end ? "Resolved" : "Ongoing"]] });
        ep.events.forEach((e) => {
          const look = SEVERITY[e.severity] ?? SEVERITY.NORMAL;
          push(i, e.date, null, "tick", look.color, { key: `${i}-${e.date}`, title: `${lane.label} visit`, tag: "Visit", rows: [["Date", formatDate(e.date)], ["Age", e.age_label], ["Noted as", e.text]] });
        });
        break;
      }
      case "acute":
        lane.episodes.forEach((ep) => {
          const look = SEVERITY[ep.peak_severity] ?? SEVERITY.NORMAL;
          const multiDay = !!ep.end && ep.end !== ep.start;
          push(i, ep.start, multiDay ? ep.end : null, multiDay ? "bar" : look.shape, look.color, {
            key: `${i}-${ep.start}`, title: lane.label, inList: true, tag: lane.is_recurrent ? "Happens often" : ep.peak_severity === "NORMAL" ? "Short illness" : ep.peak_severity_label, rows: episodeRows(ep),
          });
        });
        break;
      case "hospital":
        lane.items.forEach((h) => {
          const color = h.is_critical ? CHART.critical : CHART.serious;
          if (h.kind === "ADMISSION") {
            const rows: [string, string][] = [["Ward", h.ward || "Ward"], ["Dates", `${formatDate(h.start)}${h.end ? ` to ${formatDate(h.end)}` : ""}`]];
            if (h.reason) rows.push(["Reason", h.reason]);
            push(i, h.start, h.end || h.start, "bar", color, { key: `${i}-${h.start}-adm`, title: h.label, tag: h.ward || "Hospital", inList: true, rows });
          } else {
            push(i, h.start, null, "diamond", color, { key: `${i}-${h.start}-lab`, title: h.label, tag: "Result", inList: true, rows: [["Test", (h.analyte || "").replace(/_/g, " ").toLowerCase()], ["Value", `${h.value} (${(h.direction || "").toLowerCase()})`], ["Date", formatDate(h.start)]] });
          }
        });
        break;
    }
  });
  // faltering bands are drawn first, so the marks sit on top of them
  return items.sort((a, b) => Number(b.shape === "band") - Number(a.shape === "band"));
}

/** The events for the "List" view, newest first: the same marks as the chart, as plain rows. */
export function timelineList(payload: HealthTimeline): TimelineMark[] {
  return buildItems(payload, "date").map((it) => it.mark).filter((m) => m.inList).sort((a, b) => b.date.localeCompare(a.date));
}

const LANE_COLOR: Record<TimelineLane["type"], string> = {
  birth: CHART.serious, growth: CHART.ink, immunization: CHART.good, chronic: CHART.chronic, acute: CHART.acute, hospital: CHART.critical,
};

function shapeFor(it: Item, cx: number, cx1: number, cy: number) {
  const ring = { stroke: "#FFFFFF", strokeWidth: 3 };
  switch (it.shape) {
    case "bar":
      return <Rect x={cx} y={cy - 10} width={Math.max(cx1 - cx, 12)} height={20} rx={10} fill={it.color} />;
    case "band":
      return <Rect x={cx} y={cy - 20} width={Math.max(cx1 - cx, 12)} height={40} rx={8} fill={it.color} opacity={0.12} />;
    case "diamond":
      return <Polygon points={`${cx},${cy - 13} ${cx + 13},${cy} ${cx},${cy + 13} ${cx - 13},${cy}`} fill={it.color} {...ring} />;
    case "tick":
      return <Rect x={cx - 2} y={cy - 16} width={4} height={32} rx={2} fill={it.color} />;
    case "ring":
      return <Circle cx={cx} cy={cy} r={9} fill="#FFFFFF" stroke={it.color} strokeWidth={3} />;
    case "check":
      return (
        <G>
          <Circle cx={cx} cy={cy} r={12} fill={it.color} {...ring} />
          <Polyline points={`${cx - 5},${cy} ${cx - 1.5},${cy + 4} ${cx + 5.5},${cy - 4}`} stroke="#FFFFFF" strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </G>
      );
    case "cross":
      return (
        <G>
          <Circle cx={cx} cy={cy} r={12} fill={it.color} {...ring} />
          <Line x1={cx - 4.5} y1={cy - 4.5} x2={cx + 4.5} y2={cy + 4.5} stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" />
          <Line x1={cx + 4.5} y1={cy - 4.5} x2={cx - 4.5} y2={cy + 4.5} stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" />
        </G>
      );
    default:
      return <Circle cx={cx} cy={cy} r={10} fill={it.color} {...ring} />;
  }
}

/**
 * The health timeline: one row per condition or kind of event, the child's age (or the calendar) along the top. The row
 * names stay in place while the chart scrolls sideways; every mark has plenty of room and a big area to press.
 * Pressing a mark calls `onSelect`, and the screen shows what it says in a sheet. Nothing here opens a document.
 */
export function TimelineChart({ payload, axis, selectedKey, onSelect }: {
  payload: HealthTimeline;
  axis: "age" | "date";
  selectedKey?: string;
  onSelect: (mark: TimelineMark) => void;
}) {
  const [box, setBox] = useState(0);
  const scroller = useRef<ScrollView>(null);
  const toEnd = useRef(true);
  const scrollX = useRef(0);
  const seen = useRef("");

  const all = useMemo(() => buildItems(payload, axis), [payload, axis]);
  const dobMs = toMs(payload.patient.dob);
  const fromMs = toMs(payload.period.from);
  const toMsEnd = toMs(payload.period.to);
  const unit = axis === "age" ? MONTH_DAYS : MONTH_DAYS * DAY_MS;
  const xMin = axis === "age" ? Math.max(0, (fromMs - dobMs) / DAY_MS) : fromMs;
  const xMax = axis === "age" ? (toMsEnd - dobMs) / DAY_MS : toMsEnd;
  const spanM = Math.max((xMax - xMin) / unit, 0.5);

  // only what falls inside the period, and only the rows that still have something on them
  const items = useMemo(() => all.filter((it) => it.x1 >= xMin && it.x0 <= xMax), [all, xMin, xMax]);
  const rows = useMemo(() => Array.from(new Set(items.map((it) => it.lane))).sort((a, b) => a - b), [items]);
  const lanes = rows.map((i) => payload.lanes[i]);

  const viewW = Math.max(box - LABEL_W, 1);
  const pxm = Math.max(PX_PER_MONTH, (viewW - PAD_L - PAD_R) / spanM);
  const canvasW = spanM * pxm + PAD_L + PAD_R;
  const X = (v: number) => PAD_L + ((clamp(v, xMin, xMax) - xMin) / unit) * pxm;
  const height = AXIS_H + rows.length * LANE_H;

  // a new period or axis: show the latest events first (decided while drawing, before the new size is known)
  const sig = `${payload.period.from}|${axis}|${items.length}`;
  if (seen.current !== sig) { seen.current = sig; toEnd.current = true; }

  // a label every few months, as many as fit
  const stepM = [1, 2, 3, 6, 12, 24].find((s) => s * pxm >= 64) ?? 24;
  const ticks: { v: number; label: string; major: boolean }[] = [];
  if (axis === "age") {
    for (let m = Math.ceil(xMin / unit / stepM) * stepM; m * unit <= xMax; m += stepM) ticks.push({ v: m * unit, label: formatMonths(m), major: m % 12 === 0 });
  } else {
    const d = new Date(xMin);
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    for (; d.getTime() <= xMax; d.setMonth(d.getMonth() + stepM)) ticks.push({ v: d.getTime(), label: formatMonthYear(d.getTime()), major: d.getMonth() === 0 });
  }

  // bands first, then visit ticks, then bars (so a bar's name is never crossed), then the single marks
  const layer = (shape: Shape) => (shape === "band" ? 0 : shape === "tick" ? 1 : shape === "bar" ? 2 : 3);
  const drawn = [...items].sort((a, b) => layer(a.shape) - layer(b.shape));

  return (
    <View onLayout={(e) => setBox(e.nativeEvent.layout.width)}>
      {box > 0 && (
        <View style={styles.chart}>
          <View style={{ width: LABEL_W }}>
            <View style={[styles.corner, { height: AXIS_H }]}><Text style={styles.cornerText}>{axis === "age" ? "Age" : "Date"}</Text></View>
            {lanes.map((l, i) => (
              <View key={l.id} style={[styles.label, { height: LANE_H, backgroundColor: i % 2 ? "#FFFFFF" : "#F6F8FA" }]}>
                <View style={[styles.labelBar, { backgroundColor: LANE_COLOR[l.type] }]} />
                <Text style={styles.labelText} numberOfLines={3}>{l.type === "acute" && l.is_recurrent ? `${l.label} ↻` : l.label}</Text>
              </View>
            ))}
          </View>
          <ScrollView
            ref={scroller}
            horizontal
            bounces={false}
            showsHorizontalScrollIndicator
            scrollEventThrottle={32}
            onScroll={(e) => { scrollX.current = e.nativeEvent.contentOffset.x; }}
            onContentSizeChange={(w) => {
              // show the latest first; and never stay scrolled past the end of a chart that just got shorter
              const room = Math.max(w - viewW, 0);
              if (toEnd.current || scrollX.current > room) {
                toEnd.current = false;
                scrollX.current = room;
                scroller.current?.scrollTo({ x: room, animated: false });
              }
            }}
            style={{ flex: 1 }}
          >
            <Svg width={canvasW} height={height}>
              <Rect x={0} y={0} width={canvasW} height={AXIS_H} fill="#F0F3F6" />
              {lanes.map((l, i) => <Rect key={l.id} x={0} y={AXIS_H + i * LANE_H} width={canvasW} height={LANE_H} fill={i % 2 ? "#FFFFFF" : "#F6F8FA"} />)}
              {ticks.map((t) => (
                <G key={t.v}>
                  <Line x1={X(t.v)} x2={X(t.v)} y1={AXIS_H - 8} y2={height} stroke={t.major ? "#C9D6E3" : CHART.grid} strokeWidth={t.major ? 1.4 : 1} />
                  {Math.abs(X(t.v) - X(xMax)) > 46 && <SvgText x={X(t.v)} y={AXIS_H - 15} fontSize={12} fontWeight={t.major ? "800" : "500"} fill={t.major ? CHART.ink : CHART.label} textAnchor="middle">{t.label}</SvgText>}
                </G>
              ))}
              <Line x1={X(xMax)} x2={X(xMax)} y1={AXIS_H - 8} y2={height} stroke={CHART.chronic} strokeWidth={1.6} strokeDasharray="5 4" />
              <Rect x={X(xMax) - 38} y={AXIS_H - 31} width={46} height={20} rx={10} fill={CHART.chronic} />
              <SvgText x={X(xMax) - 15} y={AXIS_H - 17} fontSize={11} fontWeight="800" fill="#FFFFFF" textAnchor="middle">Today</SvgText>

              {drawn.map((it) => {
                const cy = AXIS_H + rows.indexOf(it.lane) * LANE_H + LANE_H / 2;
                const cx = X(it.x0);
                const cx1 = X(it.x1);
                const wide = it.shape === "bar" ? Math.max(cx1 - cx, 12) : 0;
                const on = it.mark.key === selectedKey;
                return (
                  <G key={it.mark.key}>
                    {on && (it.shape === "bar" || it.shape === "band"
                      ? <Rect x={cx - 5} y={cy - 15} width={wide + 10} height={30} rx={15} fill={BRAND_SOFT} opacity={0.7} />
                      : <Circle cx={cx} cy={cy} r={22} fill={BRAND_SOFT} opacity={0.75} />)}
                    {shapeFor(it, cx, cx1, cy)}
                    {it.shape === "bar" && wide > 74 && <SvgText x={cx + 12} y={cy + 4.5} fontSize={11.5} fontWeight="700" fill="#FFFFFF">{it.mark.title}</SvgText>}
                    <Rect x={cx - 22} y={cy - 28} width={wide + 44} height={56} fill="transparent" onPress={() => onSelect(it.mark)} />
                  </G>
                );
              })}
            </Svg>
          </ScrollView>
        </View>
      )}

      <View style={styles.legend}>
        {([[CHART.chronic, "Ongoing"], [CHART.acute, "Short illness"], [CHART.critical, "Hospital care"], [CHART.good, "Vaccine given"], [CHART.critical, "Overdue"]] as [string, string][]).map(([c, t]) => (
          <View key={t} style={styles.legendItem}><View style={[styles.swatch, { backgroundColor: c }]} /><Text style={styles.legendText}>{t}</Text></View>
        ))}
        <Text style={styles.legendText}>↻ Happens often</Text>
      </View>
      <Text style={styles.note}>Tap any mark to see what happened. Slide the chart sideways to go back in time.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { flexDirection: "row", borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: NEUTRAL.border },
  corner: { backgroundColor: "#F0F3F6", justifyContent: "flex-end", paddingLeft: 12, paddingBottom: 8 },
  cornerText: { fontSize: 11.5, fontWeight: "800", color: NEUTRAL.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  label: { flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 6 },
  labelBar: { width: 4, alignSelf: "stretch", marginVertical: 12, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  labelText: { flex: 1, fontSize: 12, fontWeight: "700", color: NEUTRAL.textPrimary, lineHeight: 15 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 6, columnGap: 14, marginTop: 12, paddingHorizontal: 2 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 11, height: 11, borderRadius: 3 },
  legendText: { fontSize: 11.5, color: NEUTRAL.textSecondary, fontWeight: "500" },
  note: { fontSize: 11.5, color: NEUTRAL.textSecondary, marginTop: 8, paddingHorizontal: 2 },
});
