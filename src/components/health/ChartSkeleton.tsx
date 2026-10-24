import { StyleSheet, View } from "react-native";
import { SkeletonBlock } from "@/components/Skeleton";
import { CARD } from "@/theme/cardSizes";
import { NEUTRAL } from "@/theme/themes";

// a touch darker than the shared placeholder so the shapes read on white
const TONE = { backgroundColor: "#DDE5EE" };

const MARKS = [[0.38, 0.72], [0.82], [0.12, 0.3, 0.55], [0.52], [0.28, 0.62], [0.7], [0.2, 0.8], [0.45]];

/** The lane chart while it loads: a label and a few shimmering marks on every row, like the chart that replaces it. */
export function LaneChartSkeleton({ rows = 6, compact = false }: { rows?: number; compact?: boolean }) {
  const h = compact ? 40 : 46;
  return (
    <View accessibilityLabel="Loading the timeline">
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={[styles.lane, { height: h }, !compact && styles.laneRule]}>
          <View style={{ width: compact ? 86 : 98 }}><SkeletonBlock width={`${60 + ((i * 13) % 30)}%`} height={10} style={TONE} /></View>
          <View style={styles.marks}>
            {MARKS[i % MARKS.length].map((at, k) => <SkeletonBlock key={k} width={16} height={16} radius={8} style={{ ...TONE, position: "absolute", left: `${at * 100}%` }} />)}
          </View>
        </View>
      ))}
      <View style={styles.axis}>
        {[0, 1, 2].map((i) => <SkeletonBlock key={i} width={36} height={10} style={TONE} />)}
      </View>
    </View>
  );
}

/** The growth chart while it loads: the expected-range band and a few dots. */
export function GrowthChartSkeleton({ height = 230 }: { height?: number }) {
  const plotH = height - 44;
  const dots = [{ x: 0.06, y: 0.82 }, { x: 0.2, y: 0.66 }, { x: 0.36, y: 0.56 }, { x: 0.52, y: 0.46 }, { x: 0.7, y: 0.38 }, { x: 0.86, y: 0.3 }];
  return (
    <View style={{ height }} accessibilityLabel="Loading the growth chart">
      <View style={{ flex: 1, flexDirection: "row" }}>
        <View style={{ width: 36, justifyContent: "space-between", paddingVertical: 4, alignItems: "flex-start" }}>
          {[0, 1, 2, 3].map((i) => <SkeletonBlock key={i} width={20} height={10} style={TONE} />)}
        </View>
        <View style={{ flex: 1, height: plotH }}>
          <SkeletonBlock height={plotH * 0.5} radius={6} style={{ backgroundColor: "#E4ECF6", position: "absolute", left: 0, right: 0, top: plotH * 0.18 }} />
          {dots.map((d, i) => <SkeletonBlock key={i} width={18} height={18} radius={9} style={{ position: "absolute", left: `${d.x * 100}%`, top: d.y * plotH, backgroundColor: "#CBD6E2" }} />)}
        </View>
      </View>
      <View style={[styles.axis, { paddingLeft: 36 }]}>
        {[0, 1, 2].map((i) => <SkeletonBlock key={i} width={40} height={10} style={TONE} />)}
      </View>
    </View>
  );
}

/** The summary tiles at the top of the overview while they load. */
export function TilesSkeleton() {
  return (
    <View style={styles.tiles}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.tile}>
          <SkeletonBlock width="55%" height={16} style={TONE} />
          <SkeletonBlock width="85%" height={10} style={{ ...TONE, marginTop: 8 }} />
        </View>
      ))}
    </View>
  );
}

/** Three timeline cards while the list loads. */
export function FeedSkeleton() {
  return (
    <View>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.feed}>
          <SkeletonBlock width={12} height={12} radius={6} style={TONE} />
          <View style={styles.feedCard}>
            <SkeletonBlock width="45%" height={10} style={TONE} />
            <SkeletonBlock width="70%" height={14} style={{ ...TONE, marginTop: 8 }} />
            <SkeletonBlock width="55%" height={10} style={{ ...TONE, marginTop: 8 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** The vaccines tab while it loads: the summary card and a few age-group rows. */
export function VaccinesSkeleton() {
  return (
    <View>
      <View style={styles.card}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <SkeletonBlock width={64} height={64} radius={32} style={TONE} />
          <View style={{ flex: 1 }}>
            <SkeletonBlock width="80%" height={16} style={TONE} />
            <SkeletonBlock width="60%" height={10} style={{ ...TONE, marginTop: 8 }} />
          </View>
        </View>
      </View>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[styles.card, { marginTop: 8 }]}>
          <SkeletonBlock width="40%" height={14} style={TONE} />
          <SkeletonBlock width="75%" height={10} style={{ ...TONE, marginTop: 8 }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  lane: { flexDirection: "row", alignItems: "center" },
  laneRule: { borderBottomWidth: 1, borderBottomColor: "#E3E9ED" },
  marks: { flex: 1, height: 20, justifyContent: "center" },
  axis: { flexDirection: "row", justifyContent: "space-around", paddingTop: 8 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { width: "48.5%", backgroundColor: NEUTRAL.surface, borderRadius: 14, padding: 10 },
  feed: { flexDirection: "row", gap: 12, marginBottom: 8, alignItems: "flex-start" },
  feedCard: { flex: 1, backgroundColor: NEUTRAL.surface, borderRadius: 14, padding: 12 },
  card: { backgroundColor: NEUTRAL.surface, borderRadius: CARD.radius, padding: 12 },
});
