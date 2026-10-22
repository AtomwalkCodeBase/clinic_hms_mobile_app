import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { HealthTimeline } from "@/api/types";
import { EmptyState } from "@/components/Layout";
import { LaneChart } from "@/components/health/LaneChart";
import { FeedSkeleton, LaneChartSkeleton } from "@/components/health/ChartSkeleton";
import { FloatingCard, type Anchor } from "@/components/health/FloatingCard";
import { ChipRow, Legend, MarkDetail } from "@/components/health/JourneyBits";
import { Marker } from "@/components/health/Marker";
import { ACTION, ON_ACTION } from "@/theme/buttons";
import { INK, MIN_TAP } from "@/components/health/journeyTheme";
import { J } from "@/components/health/journeyStyles";
import { formatRange, feedItems, groupByYear, visibleLanes, FEED_FILTERS, type FeedFilter, type FeedItem, type LaneModel, type Mark } from "@/utils/journey";
import { NEUTRAL } from "@/theme/themes";
import type { Shape, Tone } from "@/utils/journey";

export type View2 = "list" | "chart";
export type Axis = "age" | "date";

const LEGEND: { shape: Shape; tone: Tone; label: string }[] = [
  { shape: "bar", tone: "chronic", label: "Ongoing" },
  { shape: "dot", tone: "acute", label: "Short illness" },
  { shape: "recurrent", tone: "serious", label: "Happens often" },
  { shape: "diamond", tone: "critical", label: "Hospital care" },
  { shape: "check", tone: "good", label: "Vaccine given" },
  { shape: "cross", tone: "critical", label: "Overdue" },
];

function FeedCard({ item, onPress }: { item: FeedItem; onPress: (() => void) | undefined }) {
  return (
    <View style={styles.feedRow}>
      <View style={styles.rail}>
        <View style={{ height: 18, justifyContent: "flex-end" }}><Marker shape={item.marker.shape} tone={item.marker.tone} size={14} /></View>
        <View style={styles.railLine} />
      </View>
      <Pressable accessibilityRole={onPress ? "button" : undefined} disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.feedCard, pressed && { opacity: 0.85 }]}>
        <Text style={J.caption}>{formatRange(item.date, item.endDate)} · {item.age}</Text>
        <Text style={J.cardTitle}>{item.title}</Text>
        {!!item.detail && <Text style={J.body}>{item.detail}</Text>}
        {item.chips.length > 0 && <View style={{ marginTop: 4 }}><ChipRow chips={item.chips} /></View>}
      </Pressable>
    </View>
  );
}

/**
 * The timeline as a list (grouped by year, with filters) or as a chart. The List / Chart and By age / By date switches
 * are in the screen's pinned top. A tap on a mark opens a card next to it; the cross or a tap outside closes it.
 */
export function TimelineSection({
  timeline, lanes, view, axis, filter, onFilter, onEpisode, onReport, onSection,
}: {
  timeline: HealthTimeline | undefined;
  lanes: LaneModel[];
  view: View2;
  axis: Axis;
  filter: FeedFilter;
  onFilter: (f: FeedFilter) => void;
  onEpisode: (laneId: string) => void;
  onReport: (documentId: number) => void;
  onSection: (s: "growth" | "vaccines") => void;
}) {
  const [popped, setPopped] = useState<{ mark: Mark; anchor: Anchor } | null>(null);
  const groups = useMemo(() => {
    if (!timeline) return [];
    const items = feedItems(timeline).filter((i) => filter === "all" || i.filter === filter);
    return groupByYear(items, timeline.patient.dob);
  }, [timeline, filter]);
  const chartLanes = useMemo(() => (timeline ? visibleLanes(lanes, timeline.period.from, timeline.period.to) : []), [lanes, timeline]);

  const open = (item: FeedItem): (() => void) | undefined => {
    const t = item.target;
    if (!t) return undefined;
    if (t.type === "episode") return () => onEpisode(t.laneId);
    if (t.type === "section") return () => onSection(t.section);
    return () => onReport(t.id);
  };

  if (view === "chart") {
    return (
      <View style={J.stack}>
        {!timeline ? (
          <View style={J.card}><LaneChartSkeleton rows={8} /></View>
        ) : (
          <>
            <View style={[J.card, { padding: 10, paddingBottom: 8 }]}>
              <LaneChart lanes={chartLanes} dob={timeline.patient.dob} from={timeline.period.from} to={timeline.period.to} axis={axis}
                selectedId={popped?.mark.id} onSelect={(mark, anchor) => setPopped({ mark, anchor })} />
              <Legend items={LEGEND} />
            </View>
            <Text style={J.caption}>Tap a mark to see what happened.</Text>
          </>
        )}
        <FloatingCard anchor={popped?.anchor ?? null} onClose={() => setPopped(null)}>
          {popped && <MarkDetail mark={popped.mark} onEpisode={(id) => { setPopped(null); onEpisode(id); }} onReport={(id) => { setPopped(null); onReport(id); }} />}
        </FloatingCard>
      </View>
    );
  }

  return (
    <View style={J.stack}>
      <View style={styles.chips}>
        {FEED_FILTERS.map((f) => {
          const on = f.key === filter;
          return (
            <Pressable key={f.key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onFilter(f.key)}
              style={[styles.chipBtn, on ? { backgroundColor: ACTION, borderColor: ACTION } : { backgroundColor: NEUTRAL.surface, borderColor: NEUTRAL.border }]}>
              <Text style={{ fontSize: 13, color: on ? ON_ACTION : INK, fontWeight: on ? "700" : "400" }}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {!timeline ? <FeedSkeleton /> : groups.length === 0 ? <EmptyState text="Nothing recorded for this filter and period." /> : (
        <>
          {groups.map((g) => (
            <View key={g.year}>
              <Text style={styles.year}>{g.title}</Text>
              {g.items.map((it) => <FeedCard key={it.id} item={it} onPress={open(it)} />)}
            </View>
          ))}
          <Text style={[J.caption, { textAlign: "center" }]}>Built from uploaded reports. Tap an item to see where it came from.</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chipBtn: { minHeight: MIN_TAP - 6, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, justifyContent: "center" },
  year: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5, color: NEUTRAL.textMuted, marginLeft: 34, marginTop: 4, marginBottom: 6 },
  feedRow: { flexDirection: "row", gap: 10 },
  rail: { width: 24, alignItems: "center" },
  railLine: { flex: 1, width: 2, backgroundColor: NEUTRAL.border, marginTop: 4 },
  feedCard: { flex: 1, backgroundColor: NEUTRAL.surface, borderRadius: 14, padding: 12, marginBottom: 8, gap: 3 },
});
