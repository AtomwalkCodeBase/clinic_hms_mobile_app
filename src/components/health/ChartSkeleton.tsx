import { StyleSheet, View } from "react-native";
import { SkeletonBlock } from "@/components/Skeleton";
import { CHART } from "./chartTheme";

// a touch darker than the shared placeholder so the shapes read on the chart's white and pale-grey rows
const TONE = { backgroundColor: "#DDE5EE" };

const LANE_H = 56;
const LABEL_W = 100;
const AXIS_W = 24;

type Mark = { at: number; bar?: number };
const LANES: Mark[][] = [
  [{ at: 0.38 }, { at: 0.72 }],
  [{ at: 0.82 }],
  [{ at: 0.12, bar: 0.74 }],
  [{ at: 0.52 }],
  [{ at: 0.28 }, { at: 0.62 }],
];

/** The timeline while it loads: the same frame as the chart (age row, one row per lane, a label at the left) with shimmering marks. */
export function TimelineChartSkeleton() {
  return (
    <View style={styles.frame}>
      <View style={styles.axisRow}>
        <View style={{ width: LABEL_W, paddingLeft: 12 }}><SkeletonBlock width={34} height={10} style={TONE} /></View>
        <View style={styles.axisTicks}>
          <SkeletonBlock width={42} height={10} style={TONE} />
          <SkeletonBlock width={42} height={10} style={TONE} />
          <SkeletonBlock width={42} height={10} style={TONE} />
        </View>
      </View>
      {LANES.map((marks, i) => (
        <View key={i} style={[styles.lane, { backgroundColor: i % 2 ? "#FFFFFF" : "#F6F8FA" }]}>
          <View style={{ width: LABEL_W, paddingLeft: 12 }}><SkeletonBlock width={i % 2 ? 56 : 70} height={12} style={TONE} /></View>
          <View style={styles.track}>
            {marks.map((m, k) => m.bar
              ? <SkeletonBlock key={k} width={`${m.bar * 100}%`} height={16} radius={8} style={{ ...TONE, position: "absolute", left: `${m.at * 100}%`, top: (LANE_H - 16) / 2 }} />
              : <SkeletonBlock key={k} width={18} height={18} radius={9} style={{ ...TONE, position: "absolute", left: `${m.at * 100}%`, top: (LANE_H - 18) / 2 }} />)}
          </View>
        </View>
      ))}
    </View>
  );
}

const DOTS = [{ x: 0.2, y: 0.62 }, { x: 0.5, y: 0.5 }, { x: 0.78, y: 0.4 }];

/** The growth chart while it loads: the two axes, a shimmering expected-range band and three shimmering dots. */
export function GrowthChartSkeleton({ height = 280 }: { height?: number }) {
  const plotH = height - 64;
  return (
    <View style={{ height }}>
      <View style={{ flexDirection: "row", marginTop: 34 }}>
        <View style={{ width: AXIS_W, height: plotH, justifyContent: "space-between", alignItems: "flex-end", paddingRight: 8 }}>
          {[0, 1, 2, 3].map((i) => <SkeletonBlock key={i} width={16} height={10} style={TONE} />)}
        </View>
        <View style={[styles.plot, { height: plotH }]}>
          <SkeletonBlock height={plotH * 0.5} radius={4} style={{ ...TONE, backgroundColor: "#E4ECF6", position: "absolute", left: 0, right: 0, top: plotH * 0.18 }} />
          {DOTS.map((d, i) => (
            <SkeletonBlock key={i} width={22} height={22} radius={11} style={{ position: "absolute", left: `${d.x * 100}%`, top: d.y * plotH, backgroundColor: "#CBD6E2" }} />
          ))}
        </View>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-around", marginLeft: AXIS_W, marginTop: 10 }}>
        {[0, 1, 2].map((i) => <SkeletonBlock key={i} width={40} height={10} style={TONE} />)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: CHART.grid },
  axisRow: { flexDirection: "row", alignItems: "center", height: 38, backgroundColor: "#F0F3F6" },
  axisTicks: { flex: 1, flexDirection: "row", justifyContent: "space-around" },
  lane: { flexDirection: "row", alignItems: "center", height: LANE_H },
  track: { flex: 1, height: LANE_H },
  plot: { flex: 1, borderLeftWidth: 1.6, borderBottomWidth: 1.6, borderColor: CHART.label },
});
