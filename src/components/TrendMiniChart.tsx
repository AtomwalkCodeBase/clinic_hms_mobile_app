import React, { useState } from "react";
import { View, LayoutChangeEvent } from "react-native";
import Svg, { Path, Rect, Circle, Text as SvgText, Line } from "react-native-svg";
import { NEUTRAL } from "@/theme/themes";

export interface TrendChartPoint {
  date: string; // "YYYY-MM-DD"
  value: number;
  status: "high" | "low" | "normal" | null;
}

/**
 * The AI Trends screen's chart — one component, two variants, switched by
 * the screen's own Trend/By report toggle rather than two separate chart
 * implementations (they share all the same layout/tap-tooltip math, only
 * the marks differ: a smooth line + area fill vs. individual bars + a
 * dashed connector). Tapping any point/bar shows its exact date, value,
 * and status in a tooltip — the touch-screen equivalent of hovering a
 * point on the web version's chart.
 */
export function TrendMiniChart({
  points, unit, variant, accentColor,
}: {
  points: TrendChartPoint[];
  unit: string;
  variant: "line" | "bar";
  accentColor: string;
}) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const height = 168;
  const PAD_X = 26, PAD_TOP = 34, PAD_BOTTOM = 26;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - width) > 1) { setWidth(w); setActive(null); }
  };
  if (width === 0 || points.length === 0) return <View onLayout={onLayout} style={{ height }} />;

  const values = points.map((p) => p.value);
  const min = Math.min(...values), max = Math.max(...values);
  const pad = (max - min) * 0.28 || Math.max(1, Math.abs(max) * 0.1) || 1;
  const yMin = min - pad, yMax = max + pad;
  const plotW = width - PAD_X * 2;
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const n = points.length;

  const xFor = (i: number) => PAD_X + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yFor = (v: number) => PAD_TOP + (1 - (v - yMin) / (yMax - yMin)) * plotH;
  const flagged = (p: TrendChartPoint) => p.status === "high" || p.status === "low";
  const markColor = (p: TrendChartPoint) => (flagged(p) ? NEUTRAL.danger : variant === "line" ? accentColor : NEUTRAL.border);

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(p.value).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${xFor(n - 1).toFixed(1)} ${PAD_TOP + plotH} L ${xFor(0).toFixed(1)} ${PAD_TOP + plotH} Z`;
  const barWidth = Math.min(34, plotW / n / 1.8);

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };
  const fmtDateFull = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  const activePoint = active !== null ? points[active] : null;
  const tipW = 116, tipH = 34;
  const tipX = activePoint ? Math.max(2, Math.min(width - tipW - 2, xFor(active!) - tipW / 2)) : 0;
  const tipY = 2;

  return (
    <View onLayout={onLayout}>
      <Svg width={width} height={height}>
        {variant === "line" ? (
          <>
            <Path d={areaPath} fill={accentColor} fillOpacity={0.08} stroke="none" />
            <Path d={linePath} fill="none" stroke={accentColor} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          </>
        ) : (
          <>
            <Line x1={PAD_X} y1={PAD_TOP + plotH} x2={width - PAD_X} y2={PAD_TOP + plotH} stroke={NEUTRAL.surfaceAlt} strokeWidth={1} />
            <Path d={linePath} fill="none" stroke={NEUTRAL.textMuted} strokeWidth={1.5} strokeDasharray="3,4" />
            {points.map((p, i) => (
              <Rect
                key={`bar-${i}`}
                x={xFor(i) - barWidth / 2} y={yFor(p.value)} width={barWidth} height={PAD_TOP + plotH - yFor(p.value)}
                rx={5} fill={markColor(p)}
              />
            ))}
          </>
        )}

        {points.map((p, i) => (
          <React.Fragment key={`pt-${i}`}>
            {variant === "line" && (
              <Circle cx={xFor(i)} cy={yFor(p.value)} r={flagged(p) ? 5.5 : 4.5} fill={markColor(p)} stroke={NEUTRAL.surface} strokeWidth={2} />
            )}
            <SvgText
              x={xFor(i)} y={variant === "line" ? yFor(p.value) - 10 : yFor(p.value) - 8}
              fontSize={11} fontWeight="700" fill={flagged(p) ? NEUTRAL.danger : NEUTRAL.textPrimary} textAnchor="middle"
            >
              {p.value}
            </SvgText>
            <SvgText
              x={xFor(i)} y={height - 8} fontSize={10} fontWeight={flagged(p) ? "700" : "400"}
              fill={flagged(p) ? NEUTRAL.danger : NEUTRAL.textMuted} textAnchor="middle"
            >
              {fmtDate(p.date)}
            </SvgText>
            {/* Larger invisible hit target — the visible mark is too small to tap reliably */}
            <Circle cx={xFor(i)} cy={yFor(p.value)} r={16} fill="transparent" onPress={() => setActive(active === i ? null : i)} />
          </React.Fragment>
        ))}

        {activePoint && (
          <>
            <Rect x={tipX} y={tipY} width={tipW} height={tipH} rx={9} fill={NEUTRAL.textPrimary} />
            <SvgText x={tipX + tipW / 2} y={tipY + 14} fontSize={9.5} fontWeight="700" fill={NEUTRAL.surface} textAnchor="middle">
              {fmtDateFull(activePoint.date)}
            </SvgText>
            <SvgText x={tipX + tipW / 2} y={tipY + 27} fontSize={10.5} fill={NEUTRAL.surface} textAnchor="middle">
              {activePoint.value}{unit}{activePoint.status && activePoint.status !== "normal" ? ` · ${activePoint.status === "high" ? "High" : "Low"}` : ""}
            </SvgText>
          </>
        )}
      </Svg>
    </View>
  );
}
