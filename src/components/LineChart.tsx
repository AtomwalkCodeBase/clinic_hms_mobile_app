import React, { useState } from "react";
import { View, Text, StyleSheet, LayoutChangeEvent } from "react-native";
import Svg, { Polyline, Circle, Line, Text as SvgText } from "react-native-svg";
import { NEUTRAL } from "@/theme/themes";

export interface ChartPoint {
  label: string; // x-axis label (e.g. date)
  value: number | null;
}

interface Props {
  points: ChartPoint[];
  color: string;
  unit?: string;
  height?: number;
}

const PADDING_X = 28;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 28;
const MIN_WIDTH = 220;

export function LineChart({ points, color, unit = "", height = 160 }: Props) {
  const [width, setWidth] = useState(0);

  const values = points.map((p) => p.value).filter((v): v is number => v != null);
  if (values.length === 0) {
    return null;
  }

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - width) > 1) setWidth(w);
  };

  // Render nothing on the very first frame (width unknown yet) — avoids a
  // flash at the wrong size before onLayout reports the real container width.
  if (width === 0) {
    return <View onLayout={onLayout} style={{ height }} />;
  }

  const chartWidth = Math.max(width, MIN_WIDTH);
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const range = Math.max(maxVal - minVal, 1);
  const plotW = chartWidth - PADDING_X * 2;
  const plotH = height - PADDING_TOP - PADDING_BOTTOM;

  const usable = points.filter((p) => p.value != null) as { label: string; value: number }[];
  const step = usable.length > 1 ? plotW / (usable.length - 1) : 0;

  const coords = usable.map((p, i) => {
    const x = PADDING_X + (usable.length === 1 ? plotW / 2 : i * step);
    const y = PADDING_TOP + plotH - ((p.value - minVal) / range) * plotH;
    return { x, y, value: p.value, label: p.label };
  });

  const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(" ");

  // Show every label when there's room, otherwise thin them out so text
  // doesn't overlap on a long history.
  const labelStride = Math.max(1, Math.ceil(coords.length / 5));

  return (
    <View onLayout={onLayout}>
      <Svg width={chartWidth} height={height}>
        <Line
          x1={PADDING_X}
          y1={PADDING_TOP + plotH}
          x2={chartWidth - PADDING_X}
          y2={PADDING_TOP + plotH}
          stroke={NEUTRAL.border}
          strokeWidth={1}
        />
        {coords.length > 1 && (
          <Polyline points={polylinePoints} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {coords.map((c, i) => (
          <Circle key={i} cx={c.x} cy={c.y} r={3.5} fill={color} />
        ))}
        {coords.map((c, i) =>
          i % labelStride === 0 || i === coords.length - 1 ? (
            <SvgText key={`l-${i}`} x={c.x} y={height - 8} fontSize={9} fill={NEUTRAL.textMuted} textAnchor="middle">
              {c.label}
            </SvgText>
          ) : null
        )}
      </Svg>
      {coords.length > 0 && (
        <Text style={styles.latest}>
          Latest: {coords[coords.length - 1].value}
          {unit}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  latest: { fontSize: 10.5, color: NEUTRAL.textMuted, marginTop: 6, textAlign: "center" },
});
