import { memo, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { InteractionManager, Pressable, StyleSheet, Text, View } from "react-native";
import type { HealthTimeline } from "@/api/types";
import { EmptyState } from "@/components/Layout";
import { LaneChart } from "@/components/health/LaneChart";
import { FeedSkeleton, LaneChartSkeleton } from "@/components/health/ChartSkeleton";
import { FloatingCard, type Anchor } from "@/components/health/FloatingCard";
import { ChipRow, Legend, MarkDetail } from "@/components/health/JourneyBits";
import { Marker } from "@/components/health/Marker";
import { SlidingTabs } from "@/components/SlidingTabs";
import { J } from "@/components/health/journeyStyles";
import { formatRange, feedItems, groupByYear, visibleLanes, FEED_FILTERS, type FeedFilter, type FeedItem, type LaneModel, type Mark } from "@/utils/journey";
import { NEUTRAL } from "@/theme/themes";
import { journey, useJourney } from "./journeyStore";
import type { Shape, Tone } from "@/utils/journey";


/** The list draws this many cards at first and this many more each time the scroll nears the bottom. */
const BATCH = 15;
const setFilter = (filter: FeedFilter) => journey.set({ filter });
const FILTER_OPTIONS = FEED_FILTERS.map((f) => ({ key: f.key, label: f.label }));
/** The very first paint is smaller still, so the tab opens at once; the rest is drawn a moment later. */
const FIRST = 6;

const LEGEND: { shape: Shape; tone: Tone; label: string }[] = [
  { shape: "bar", tone: "chronic", label: "Ongoing" },
  { shape: "dot", tone: "acute", label: "Short illness" },
  { shape: "recurrent", tone: "serious", label: "Happens often" },
  { shape: "diamond", tone: "critical", label: "Hospital care" },
  { shape: "check", tone: "good", label: "Vaccine given" },
  { shape: "cross", tone: "critical", label: "Overdue" },
];

/** Memoised: a long list must not redraw every card when only the filter or the batch size changes. */
const FeedCard = memo(function FeedCard({ item, onOpen }: { item: FeedItem; onOpen: (item: FeedItem) => void }) {
  const onPress = item.target ? () => onOpen(item) : undefined;
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
});

/**
 * The timeline as a list (grouped by year, with filters) or as a chart. The List / Chart and By age / By date switches
 * are in the screen's pinned top. A tap on a mark opens a card next to it; the cross or a tap outside closes it.
 */
export function TimelineSection({
  timeline, lanes, onEpisode, onReport, onSection, loadMore,
}: {
  timeline: HealthTimeline | undefined;
  lanes: LaneModel[];
  onEpisode: (laneId: string) => void;
  onReport: (documentId: number) => void;
  onSection: (s: "growth" | "vaccines") => void;
  /** The screen calls this when its scroll nears the bottom; the list puts its way of adding the next batch here. */
  loadMore: MutableRefObject<(() => void) | null>;
}) {
  const view = useJourney("view");
  const axis = useJourney("axis");
  const filter = useJourney("filter");
  const [popped, setPopped] = useState<{ mark: Mark; anchor: Anchor } | null>(null);
  const groups = useMemo(() => {
    if (!timeline) return [];
    const items = feedItems(timeline).filter((i) => filter === "all" || i.filter === filter);
    return groupByYear(items, timeline.patient.dob);
  }, [timeline, filter]);
  const total = useMemo(() => groups.reduce((n, g) => n + g.items.length, 0), [groups]);
  const [count, setCount] = useState(FIRST);
  // another period or filter starts the list again from the top batch and closes any open mark card
  const periodKey = timeline ? `${timeline.period.from}|${timeline.period.to}` : "";
  useEffect(() => { setCount(FIRST); setPopped(null); }, [filter, periodKey]);
  // once the first batch is on screen and the taps have settled, one more is drawn ahead; after that only the scroll adds more
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setCount((c) => Math.max(c, BATCH * 2)));
    return () => task.cancel();
  }, [filter, total > 0]);
  useEffect(() => {
    loadMore.current = () => setCount((c) => Math.min(c + BATCH, total));
    return () => { loadMore.current = null; };
  }, [loadMore, total]);
  const shownGroups = useMemo(() => {
    let left = count;
    const out: typeof groups = [];
    for (const g of groups) {
      if (left <= 0) break;
      out.push(left >= g.items.length ? g : { ...g, items: g.items.slice(0, left) });
      left -= g.items.length;
    }
    return out;
  }, [groups, count]);
  const chartLanes = useMemo(() => (timeline ? visibleLanes(lanes, timeline.period.from, timeline.period.to) : []), [lanes, timeline]);

  // The handlers come from the screen and may change each render; the cards get one stable function that calls the latest.
  const handlers = useRef({ onEpisode, onSection, onReport });
  handlers.current = { onEpisode, onSection, onReport };
  const open = useCallback((item: FeedItem) => {
    const t = item.target;
    if (!t) return;
    if (t.type === "episode") handlers.current.onEpisode(t.laneId);
    else if (t.type === "section") handlers.current.onSection(t.section);
    else handlers.current.onReport(t.id);
  }, []);

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
      <SlidingTabs label="Show" look="chips" options={FILTER_OPTIONS} value={filter} onChange={setFilter} />
      {!timeline ? <FeedSkeleton /> : groups.length === 0 ? <EmptyState text="Nothing recorded for this filter and period." /> : (
        <>
          {shownGroups.map((g) => (
            <View key={g.year}>
              <Text style={styles.year}>{g.title}</Text>
              {g.items.map((it) => <FeedCard key={it.id} item={it} onOpen={open} />)}
            </View>
          ))}
          <Text style={[J.caption, { textAlign: "center" }]}>
            {count < total ? "Older entries load as you scroll." : "Built from uploaded reports. Tap an item to see where it came from."}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  year: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5, color: NEUTRAL.textMuted, marginLeft: 34, marginTop: 4, marginBottom: 6 },
  feedRow: { flexDirection: "row", gap: 10 },
  rail: { width: 24, alignItems: "center" },
  railLine: { flex: 1, width: 2, backgroundColor: NEUTRAL.border, marginTop: 4 },
  feedCard: { flex: 1, backgroundColor: NEUTRAL.surface, borderRadius: 14, padding: 12, marginBottom: 8, gap: 3 },
});
