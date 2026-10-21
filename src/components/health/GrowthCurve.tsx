import { ReactElement, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Svg, { Circle, G, Line, Polygon, Polyline, Rect, Text as SvgText } from "react-native-svg";
import type { GrowthSeries } from "@/api/types";
import { idOf, useChartReady, useScrollToEnd } from "@/hooks/useChartReady";
import { GrowthChartSkeleton } from "./ChartSkeleton";
import { CHART } from "./chartTheme";
import type { Anchor } from "./FloatingCard";
import { NEUTRAL } from "@/theme/themes";
import { growthScale, growthTickLabel } from "@/utils/journey";

const AXIS_W = 36;
const PLOT_H = 190;
const TOP = 12;
const BOTTOM = 24;
const PAD = 10;
const DIP = "#B3541E";

type Pt = [number, number];

// The drawn chart, kept per set of readings: coming back to a tab or a measure builds nothing again.
const pictures = new WeakMap<GrowthSeries, Map<string, ReactElement>>();

/**
 * A growth chart: the child's readings on the WHO / IAP bands. The value scale stays fixed at the left; the age axis
 * slides sideways (at least 24 px per month, so a dot is easy to tap) and opens at the latest reading. A tap on a dot
 * reports it together with where it is on the screen, for the floating card.
 */
export function GrowthCurve({
  series, dipDates, selectedIndex, onSelect,
}: {
  series: GrowthSeries;
  /** the dates of readings where the weight dropped across centile lines */
  dipDates: string[];
  selectedIndex: number | null;
  onSelect: (index: number, anchor: Anchor) => void;
}) {
  const [box, setBox] = useState(0);
  const holder = useRef<View>(null);
  const key = `${idOf(series)}|${dipDates.join(",")}`;
  const ready = useChartReady(key);
  const scroll = useScrollToEnd(`${key}|${box > 0}`);

  const outer = (inner: React.ReactNode) => (
    <View ref={holder} onLayout={(e) => setBox(e.nativeEvent.layout.width)}>{inner}</View>
  );
  if (!ready || box === 0) return outer(<GrowthChartSkeleton />);

  const sc = growthScale(series);
  const avail = Math.max(box - AXIS_W, 80);
  const plotW = Math.max(avail, sc.xMax * sc.minPxPerMonth + PAD * 2);
  const X = (m: number) => PAD + (Math.min(Math.max(m, 0), sc.xMax) / sc.xMax) * (plotW - PAD * 2);
  const Y = (v: number) => TOP + (1 - (v - sc.yMin) / Math.max(sc.yMax - sc.yMin, 1e-6)) * PLOT_H;
  const pts = series.points;
  const lastIndex = pts.length - 1;
  const height = TOP + PLOT_H + BOTTOM;

  const select = (i: number) => {
    holder.current?.measureInWindow((wx, wy) => {
      onSelect(i, { x: wx + AXIS_W + X(pts[i].age_months) - scroll.x.current, y: wy + Y(pts[i].value) });
    });
  };

  const cacheKey = `${plotW}`;
  let byKey = pictures.get(series);
  if (!byKey) { byKey = new Map(); pictures.set(series, byKey); }
  let picture = byKey.get(cacheKey);
  if (!picture) {
    const curve = (z: string): Pt[] => (series.reference[z] ?? []).filter(([m]) => m <= sc.xMax);
    const band = (lo: Pt[], hi: Pt[]) => (lo.length && hi.length ? [...hi, ...[...lo].reverse()].map(([m, v]) => `${X(m)},${Y(v)}`).join(" ") : "");
    const median = curve("0");
    picture = (
      <>
        {sc.yTicks.map((t) => <Line key={`y${t}`} x1={0} y1={Y(t)} x2={plotW} y2={Y(t)} stroke={CHART.grid} strokeWidth={1} />)}
        {sc.xTicks.map((m) => (
          <G key={`x${m}`}>
            <Line x1={X(m)} y1={TOP} x2={X(m)} y2={TOP + PLOT_H} stroke="#EEF2F5" strokeWidth={1} />
            <SvgText x={X(m)} y={TOP + PLOT_H + 16} fontSize={11} fill={NEUTRAL.textSecondary} textAnchor="middle">{growthTickLabel(m)}</SvgText>
          </G>
        ))}
        {band(curve("-3"), curve("3")) ? <Polygon points={band(curve("-3"), curve("3"))} fill={CHART.bandOuter} /> : null}
        {band(curve("-2"), curve("2")) ? <Polygon points={band(curve("-2"), curve("2"))} fill={CHART.bandInner} /> : null}
        {median.length ? (
          <>
            <Polyline points={median.map(([m, v]) => `${X(m)},${Y(v)}`).join(" ")} fill="none" stroke={CHART.median} strokeWidth={1.5} strokeDasharray="4 3" />
            <SvgText x={X(median[median.length - 1][0]) - 2} y={Y(median[median.length - 1][1]) - 6} fontSize={11} fill="#1D4FB0" textAnchor="end">50th</SvgText>
          </>
        ) : null}
        {pts.length > 1 ? <Polyline points={pts.map((p) => `${X(p.age_months)},${Y(p.value)}`).join(" ")} fill="none" stroke={CHART.ink} strokeWidth={2} /> : null}
        {pts.map((p, i) => {
          const x = X(p.age_months);
          const y = Y(p.value);
          const flagged = !!p.flag || dipDates.includes(p.date);
          return (
            <G key={p.date + i}>
              {flagged
                ? <Polygon points={`${x},${y - 8} ${x + 8},${y} ${x},${y + 8} ${x - 8},${y}`} fill={DIP} />
                : <Circle cx={x} cy={y} r={i === lastIndex ? 7 : 5} fill={CHART.ink} stroke="#FFFFFF" strokeWidth={1.5} />}
            </G>
          );
        })}
      </>
    );
    byKey.set(cacheKey, picture);
  }
  const ring = selectedIndex != null && pts[selectedIndex]
    ? <Circle cx={X(pts[selectedIndex].age_months)} cy={Y(pts[selectedIndex].value)} r={13} fill="none" stroke={CHART.ink} strokeWidth={2} />
    : null;

  // the invisible tap targets are rebuilt every time: they hold the handlers, the cached drawing holds none
  const targets = pts.map((p, i) => <Rect key={`t${p.date}${i}`} x={X(p.age_months) - 18} y={Y(p.value) - 22} width={36} height={44} fill="transparent" onPress={() => select(i)} />);

  return outer(
    <View style={styles.row} accessibilityLabel="Growth chart">
      <Svg width={AXIS_W} height={height}>
        {sc.yTicks.map((t) => <SvgText key={t} x={AXIS_W - 6} y={Y(t) + 4} fontSize={11} fill={NEUTRAL.textSecondary} textAnchor="end">{t}</SvgText>)}
      </Svg>
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
        <Svg width={plotW} height={height}>{picture}{ring}{targets}</Svg>
      </ScrollView>
    </View>,
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
});
