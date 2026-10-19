import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import Svg, { Circle, ClipPath, Defs, G, Line, LinearGradient, Polygon, Polyline, Rect, Stop, Text as SvgText } from "react-native-svg";
import type { GrowthSeries } from "@/api/types";
import { CHART, clamp, formatMonths, niceTicks } from "./chartTheme";

const TOP = 34;
const BOTTOM = 30;
const AXIS_W = 24;          // the value labels on the left stay in place
const PAD_L = 14;           // keeps the first age label from being cut off
const PAD_R = 12;           // room for the 98th / 50th / 2nd labels at the end of the lines
const PX_PER_MONTH = 26;    // room for each month: the dots stay apart and are easy to press

/**
 * The growth chart: the WHO / IAP centile bands for the child's sex with the child's own readings on top, a big dot for
 * every reading with its value above it. The value labels stay in place and the chart scrolls sideways. Pressing a dot
 * calls `onSelect` and the screen shows that reading in a sheet. The band between -2 and +2 SD is the expected range,
 * the dashed line is the median (50th centile).
 */
export function GrowthChart({ data, unit, fromDate, selected, onSelect, height = 280 }: {
  data: GrowthSeries;
  unit: string;
  /** the first day to show, "2025-03-12"; leave out for since birth */
  fromDate?: string;
  selected: number;
  onSelect: (index: number) => void;
  height?: number;
}) {
  const [box, setBox] = useState(0);
  const scroller = useRef<ScrollView>(null);
  const toEnd = useRef(true);
  const scrollX = useRef(0);
  const seen = useRef("");

  const shown = useMemo(() => data.points.map((p, i) => ({ p, i })).filter(({ p }) => !fromDate || p.date >= fromDate), [data, fromDate]);
  const median = data.reference["0"] ?? [];
  const refEnd = median.length ? median[median.length - 1][0] : 24;
  const lastAge = shown.length ? shown[shown.length - 1].p.age_months : 0;
  const min = fromDate && shown.length ? Math.max(0, shown[0].p.age_months - 2) : 0;
  const max = Math.min(refEnd, Math.max(lastAge + 3, min + 6));
  const span = max - min;

  const viewW = Math.max(box - AXIS_W, 1);
  const pxm = Math.max(PX_PER_MONTH, (viewW - PAD_L - PAD_R) / span);
  const canvasW = span * pxm + PAD_L + PAD_R;
  const plotH = height - TOP - BOTTOM;
  const X = (m: number) => PAD_L + (m - min) * pxm;

  const y = useMemo(() => {
    const inView = (c: [number, number][]) => c.filter(([m]) => m >= min - 1 && m <= max + 1).map((q) => q[1]);
    const vals = shown.map(({ p }) => p.value);
    const lo = Math.min(...inView(data.reference["-3"] ?? []), ...vals);
    const hi = Math.max(...inView(data.reference["3"] ?? []), ...vals);
    const pad = (hi - lo) * 0.05;
    const ticks = niceTicks(lo - pad, hi + pad, 6);
    return { min: Math.min(lo - pad, ticks[0]), max: Math.max(hi + pad, ticks[ticks.length - 1]), ticks };
  }, [data, shown, min, max]);
  const Y = (v: number) => TOP + (1 - (v - y.min) / (y.max - y.min)) * plotH;

  // a new period or measure: show the latest readings first (decided while drawing, before the new size is known)
  const sig = `${fromDate ?? ""}|${shown.length}|${data.reference_note}`;
  if (seen.current !== sig) { seen.current = sig; toEnd.current = true; }
  // a reading chosen from the list: bring it into view
  useEffect(() => {
    const p = data.points[selected];
    if (p && box > 0) scroller.current?.scrollTo({ x: clamp(X(p.age_months) - viewW / 2, 0, Math.max(canvasW - viewW, 0)), animated: true });
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const xStep = [1, 2, 3, 6, 12].find((s) => s * pxm >= 58) ?? 12;
  const xTicks: number[] = [];
  for (let m = Math.ceil(min / xStep) * xStep; m <= max + 1e-9; m += xStep) xTicks.push(m);

  const path = (c: [number, number][]) => c.map(([m, v]) => `${X(m)},${Y(v)}`);
  const band = (lo: string, hi: string) => [...path(data.reference[lo] ?? []), ...path(data.reference[hi] ?? []).reverse()].join(" ");
  const line = (z: string) => path(data.reference[z] ?? []).join(" ");
  const endY = (z: string) => {
    const c = data.reference[z] ?? [];
    const last = [...c].reverse().find(([m]) => m <= max) ?? c[c.length - 1];
    return last ? Y(last[1]) : 0;
  };
  const dots = shown.map(({ p }) => `${X(p.age_months)},${Y(p.value)}`).join(" ");

  return (
    <View onLayout={(e) => setBox(e.nativeEvent.layout.width)} style={{ height }}>
      {box > 0 && (
        <View style={{ flexDirection: "row", height }}>
          <Svg width={AXIS_W} height={height}>
            <SvgText x={AXIS_W - 5} y={TOP - 14} fontSize={12} fontWeight="700" fill={CHART.label} textAnchor="end">{unit}</SvgText>
            {y.ticks.map((v) => <SvgText key={v} x={AXIS_W - 6} y={Y(v) + 4} fontSize={12} fill={CHART.label} textAnchor="end">{v}</SvgText>)}
            <Line x1={AXIS_W - 1} x2={AXIS_W - 1} y1={TOP} y2={TOP + plotH} stroke={CHART.label} strokeWidth={1.6} />
            {y.ticks.map((v) => <Line key={v} x1={AXIS_W - 4} x2={AXIS_W - 1} y1={Y(v)} y2={Y(v)} stroke={CHART.label} strokeWidth={1.6} />)}
          </Svg>
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
              <Defs>
                <ClipPath id="plot"><Rect x={0} y={TOP} width={canvasW} height={plotH} /></ClipPath>
                <LinearGradient id="inner" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#D2E5FC" />
                  <Stop offset="1" stopColor="#BFD9F8" />
                </LinearGradient>
              </Defs>
              {y.ticks.map((v) => <Line key={v} x1={0} x2={canvasW} y1={Y(v)} y2={Y(v)} stroke={CHART.grid} />)}
              {xTicks.map((m) => (
                <G key={m}>
                  <Line x1={X(m)} x2={X(m)} y1={TOP} y2={TOP + plotH} stroke={CHART.grid} strokeDasharray="2 5" />
                  <SvgText x={X(m)} y={TOP + plotH + 17} fontSize={12} fill={CHART.label} textAnchor={X(m) < 24 ? "start" : "middle"}>{formatMonths(m)}</SvgText>
                </G>
              ))}

              <Line x1={0} x2={canvasW} y1={TOP + plotH} y2={TOP + plotH} stroke={CHART.label} strokeWidth={1.6} />
              {xTicks.map((m) => <Line key={`t${m}`} x1={X(m)} x2={X(m)} y1={TOP + plotH} y2={TOP + plotH + 5} stroke={CHART.label} strokeWidth={1.6} />)}
              <G clipPath="url(#plot)">
                <Polygon points={band("-3", "3")} fill={CHART.bandOuter} />
                <Polygon points={band("-2", "2")} fill="url(#inner)" />
                <Polyline points={line("2")} fill="none" stroke="#7FAEE8" strokeWidth={1.2} />
                <Polyline points={line("-2")} fill="none" stroke="#7FAEE8" strokeWidth={1.2} />
                <Polyline points={line("0")} fill="none" stroke={CHART.median} strokeWidth={1.8} strokeDasharray="6 4" />
              </G>
              <SvgText x={canvasW - PAD_R - 4} y={endY("2") - 6} fontSize={11.5} fontWeight="700" fill="#4F86D6" textAnchor="end">98th</SvgText>
              <SvgText x={canvasW - PAD_R - 4} y={endY("0") - 6} fontSize={11.5} fontWeight="700" fill={CHART.median} textAnchor="end">50th</SvgText>
              <SvgText x={canvasW - PAD_R - 4} y={endY("-2") - 6} fontSize={11.5} fontWeight="700" fill="#4F86D6" textAnchor="end">2nd</SvgText>

              <Polyline points={dots} fill="none" stroke={CHART.ink} strokeOpacity={0.12} strokeWidth={9} strokeLinejoin="round" strokeLinecap="round" />
              <Polyline points={dots} fill="none" stroke={CHART.ink} strokeWidth={3.2} strokeLinejoin="round" strokeLinecap="round" />

              {shown.map(({ p, i }) => {
                const cx = X(p.age_months);
                const cy = Y(p.value);
                const on = i === selected;
                const tone = p.flag ? CHART.flagged : CHART.ink;
                return (
                  <G key={p.date}>
                    {on && <Circle cx={cx} cy={cy} r={21} fill={CHART.selected} opacity={0.16} />}
                    {p.flag
                      ? <Polygon points={`${cx},${cy - 12} ${cx + 12},${cy} ${cx},${cy + 12} ${cx - 12},${cy}`} fill={CHART.flagged} stroke="#FFFFFF" strokeWidth={2.5} />
                      : <Circle cx={cx} cy={cy} r={on ? 11 : 9} fill="#FFFFFF" stroke={on ? CHART.selected : tone} strokeWidth={on ? 4 : 3.5} />}
                    <SvgText x={cx} y={cy - 17} fontSize={12} fontWeight="700" fill={tone} textAnchor="middle">{p.value}</SvgText>
                    <Circle cx={cx} cy={cy} r={26} fill="transparent" onPress={() => onSelect(i)} />
                  </G>
                );
              })}
            </Svg>
          </ScrollView>
        </View>
      )}
    </View>
  );
}
