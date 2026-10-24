import { ReactElement, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Line, Path, Polygon, Rect, Text as SvgText } from "react-native-svg";
import { idOf, useChartReady, useScrollToEnd } from "@/hooks/useChartReady";
import { LaneChartSkeleton } from "./ChartSkeleton";
import { CHART, MONTH_DAYS } from "./chartTheme";
import type { Anchor } from "./FloatingCard";
import { TONES } from "./journeyTheme";
import { NEUTRAL } from "@/theme/themes";
import { daysBetween, laneTicks, shortLabel, type LaneModel, type Mark } from "@/utils/journey";

const PAD = 16;
/** Marks are never closer than this many pixels per month, so a fingertip can pick one of them. */
const MIN_PX_PER_MONTH = 22;
const AXIS_H = 24;
/** Marks that matter most are drawn last, so an overdue cross is never hidden under a tick next to it. */
const DRAW_ORDER: Record<string, number> = { bar: 0, ring: 1, dot: 1, check: 1, diamond: 2, cross: 3 };

// The drawn chart, kept per set of data: coming back to a tab or a period builds nothing again.
const pictures = new WeakMap<LaneModel[], Map<string, ReactElement>>();

function MarkShape({ m, x0, x1, cy }: { m: Mark; x0: number; x1: number; cy: number }) {
  const c = TONES[m.tone].fg;
  switch (m.shape) {
    case "bar":
      return <Rect x={x0} y={cy - 6} width={Math.max(x1 - x0, 8)} height={12} rx={5} fill={c} />;
    case "diamond":
      return <Polygon points={`${x0},${cy - 8} ${x0 + 8},${cy} ${x0},${cy + 8} ${x0 - 8},${cy}`} fill={c} stroke="#FFFFFF" strokeWidth={1.5} />;
    case "check":
      return (
        <G>
          <Circle cx={x0} cy={cy} r={7} fill={c} stroke="#FFFFFF" strokeWidth={1.5} />
          <Path d={`M${x0 - 3} ${cy} L${x0 - 1} ${cy + 2.2} L${x0 + 3.2} ${cy - 2.2}`} stroke="#FFFFFF" strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </G>
      );
    case "cross":
      return (
        <G>
          <Circle cx={x0} cy={cy} r={7} fill={c} stroke="#FFFFFF" strokeWidth={1.5} />
          <Path d={`M${x0 - 2.6} ${cy - 2.6} L${x0 + 2.6} ${cy + 2.6} M${x0 + 2.6} ${cy - 2.6} L${x0 - 2.6} ${cy + 2.6}`} stroke="#FFFFFF" strokeWidth={1.7} strokeLinecap="round" />
        </G>
      );
    case "ring":
      return <Circle cx={x0} cy={cy} r={5.5} fill="#FFFFFF" stroke={c} strokeWidth={2} />;
    default:
      return <Circle cx={x0} cy={cy} r={6.5} fill={c} stroke="#FFFFFF" strokeWidth={2} />;
  }
}

/**
 * The timeline as swimlanes: one row per condition, marks placed by the child's age or by date. The row names stay put at
 * the left; the plot slides sideways and opens at the latest events. `fit` squeezes the whole period into the width (the
 * overview and the episode sheet); the full chart keeps a minimum gap between marks and scrolls instead. A tap on a mark
 * reports it together with where it is on the screen, for the floating card.
 */
export function LaneChart({
  lanes, dob, from, to, axis, fit = false, compact = false, selectedId, onSelect,
}: {
  lanes: LaneModel[];
  dob: string;
  from: string;
  to: string;
  axis: "age" | "date";
  fit?: boolean;
  compact?: boolean;
  selectedId?: string | null;
  onSelect?: (m: Mark, anchor: Anchor) => void;
}) {
  const [box, setBox] = useState(0);
  const holder = useRef<View>(null);
  const labelW = compact ? 96 : 108;
  const laneH = compact ? 40 : 46;
  const key = `${idOf(lanes)}|${from}|${to}|${axis}|${fit ? 1 : 0}|${compact ? 1 : 0}`;
  const ready = useChartReady(key);
  const scroll = useScrollToEnd(`${key}|${box > 0}`);

  // the outer view stays the same through skeleton and chart, so its width is known by the time the chart may draw
  const outer = (inner: React.ReactNode) => (
    <View ref={holder} onLayout={(e) => setBox(e.nativeEvent.layout.width)}>{inner}</View>
  );
  if (!ready || box === 0) return outer(<LaneChartSkeleton rows={Math.min(Math.max(lanes.length, 3), 9)} compact={compact} />);

  const total = Math.max(daysBetween(from, to), 1);
  const spanM = total / MONTH_DAYS;
  const avail = Math.max(box - labelW, 80);
  const plotW = fit ? avail : Math.max(avail, spanM * MIN_PX_PER_MONTH + PAD * 2);
  const X = (iso: string) => PAD + (Math.min(Math.max(daysBetween(from, iso), 0), total) / total) * (plotW - PAD * 2);
  const h = lanes.length * laneH + AXIS_H;

  const select = (m: Mark, lane: number) => {
    if (!onSelect) return;
    holder.current?.measureInWindow((wx, wy) => {
      onSelect(m, { x: wx + labelW + X(m.start) - (fit ? 0 : scroll.x.current), y: wy + lane * laneH + laneH / 2 });
    });
  };

  const cacheKey = `${axis}|${fit ? 1 : 0}|${compact ? 1 : 0}|${from}|${to}|${plotW}`;
  let byKey = pictures.get(lanes);
  if (!byKey) { byKey = new Map(); pictures.set(lanes, byKey); }
  let picture = byKey.get(cacheKey);
  if (!picture) {
    const ticks = laneTicks(dob, from, to, axis, fit);
    const xNow = X(to);
    picture = (
      <>
        {ticks.map((t) => {
          const x = X(t.iso);
          return (
            <G key={t.iso + t.label}>
              <Line x1={x} y1={0} x2={x} y2={lanes.length * laneH} stroke={CHART.grid} strokeWidth={1} />
              <SvgText x={x} y={h - 7} fontSize={11} fill={NEUTRAL.textSecondary} textAnchor="middle">{t.label}</SvgText>
            </G>
          );
        })}
        {!compact && lanes.map((l, i) => <Line key={`r${l.id}`} x1={0} y1={(i + 1) * laneH} x2={plotW} y2={(i + 1) * laneH} stroke={CHART.grid} strokeWidth={1} />)}
        <Line x1={xNow} y1={0} x2={xNow} y2={lanes.length * laneH} stroke="#C5CED4" strokeWidth={1} strokeDasharray="3 3" />
        {lanes.map((l, i) => {
          const cy = i * laneH + laneH / 2;
          return l.marks.filter((m) => m.start <= to && m.end >= from).sort((a, b) => (DRAW_ORDER[a.shape] ?? 1) - (DRAW_ORDER[b.shape] ?? 1)).map((m) => {
            return <MarkShape key={m.id} m={m} x0={X(m.start)} x1={X(m.end)} cy={cy} />;
          });
        })}
      </>
    );
    byKey.set(cacheKey, picture);
  }

  // the ring round the selected mark is the only part that changes with a tap
  let ring: ReactElement | null = null;
  if (selectedId) {
    lanes.forEach((l, i) => l.marks.forEach((m) => {
      if (m.id === selectedId) ring = <Circle cx={X(m.start)} cy={i * laneH + laneH / 2} r={14} fill="none" stroke={NEUTRAL.textPrimary} strokeWidth={2} />;
    }));
  }

  // the invisible tap targets are rebuilt every time: they hold the handlers, the cached drawing holds none
  const targets = onSelect ? lanes.map((l, i) => l.marks.filter((m) => m.start <= to && m.end >= from).map((m) => {
    const x0 = X(m.start);
    return <Rect key={`t${m.id}`} x={x0 - 18} y={i * laneH} width={Math.max(X(m.end) - x0, 0) + 36} height={laneH} fill="transparent" onPress={() => select(m, i)} />;
  })) : null;

  const plot = <Svg width={plotW} height={h}>{picture}{ring}{targets}</Svg>;

  return outer(
    <View accessibilityLabel="Health timeline chart, one row per condition" style={styles.row}>
      <View style={{ width: labelW }}>
        {lanes.map((l) => (
          <View key={l.id} style={[styles.label, { height: laneH }, !compact && styles.rule]}>
            <Text numberOfLines={compact ? 1 : 2} style={[styles.labelText, compact && { fontSize: 11.5 }, l.type === "chronic" && styles.chronic]}>
              {l.type === "hospital" ? l.label : shortLabel(l.label)}{l.recurrent ? " ↻" : ""}
            </Text>
          </View>
        ))}
      </View>
      {fit ? (
        <View style={{ flex: 1 }}>{plot}</View>
      ) : (
        <ScrollView
          ref={scroll.ref}
          horizontal
          bounces={false}
          showsHorizontalScrollIndicator={plotW > avail}
          style={{ flex: 1 }}
          scrollEventThrottle={16}
          onScroll={scroll.onScroll}
          onContentSizeChange={scroll.onContentSizeChange}
        >
          {plot}
        </ScrollView>
      )}
    </View>,
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  label: { justifyContent: "center", paddingRight: 6 },
  rule: { borderBottomWidth: 1, borderBottomColor: CHART.grid },
  labelText: { fontSize: 12.5, color: NEUTRAL.textSecondary },
  chronic: { fontWeight: "700", color: NEUTRAL.textPrimary },
});
