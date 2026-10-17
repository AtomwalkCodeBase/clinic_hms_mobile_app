import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { usePeople, usePersonSwitcher, paramsFor } from "@/hooks/usePeople";
import { Screen, BackHeader, EmptyState, ErrorBanner } from "@/components/Layout";
import { HelpButton, MoreButton } from "@/components/IconButtons";
import { HelpSheet, HelpItem } from "@/components/HelpSheet";
import { SegmentedControl } from "@/components/SegmentedControl";
import { FilterPill, FilterSheet } from "@/components/TypeFilter";
import { ListRow } from "@/components/ListRow";
import { Pill } from "@/components/Pill";
import { SecondaryButton } from "@/components/Buttons";
import { DetailSheet, DetailRow } from "@/components/DetailSheet";
import { SkeletonBlock } from "@/components/Skeleton";
import { TimelineChart, TimelineMark, timelineList } from "@/components/health/TimelineChart";
import { GrowthChart } from "@/components/health/GrowthChart";
import { CHART, GROWTH_FLAG_LABEL, formatDate, formatMonths, ordinal } from "@/components/health/chartTheme";
import { getGrowthSeries, getHealthTimeline } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import type { GrowthIndicator, GrowthSeries, HealthTimeline } from "@/api/types";
import { AppStackParamList } from "@/navigation/types";
import { CARD, CARD_TEXT } from "@/theme/cardSizes";
import { BRAND_TEXT, NEUTRAL } from "@/theme/themes";
import type { LucideIcon } from "@/theme/icons";
import {
  Activity, ArrowDownUp, Bandage, Building2, Calendar, ListFilter, Repeat, Ruler, Stethoscope, Syringe, TrendingUp, Clock, Users,
} from "lucide-react-native";

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Tab = "timeline" | "growth";
type Axis = "age" | "date" | "list";

const PERIODS: { code: string; label: string; months: number }[] = [
  { code: "6m", label: "6 months", months: 6 },
  { code: "1y", label: "1 year", months: 12 },
  { code: "3y", label: "3 years", months: 36 },
];
const INDICATORS: { key: GrowthIndicator; label: string; unit: string }[] = [
  { key: "weight_kg", label: "Weight", unit: "kg" },
  { key: "height_cm", label: "Height", unit: "cm" },
  { key: "head_circ_cm", label: "Head size", unit: "cm" },
];
const READINGS_PER_PAGE = 5;

/** The first day of a period, "2026-04-17"; "" (since birth) has none. */
function periodStart(code: string): string | undefined {
  const p = PERIODS.find((x) => x.code === code);
  if (!p) return undefined;
  const d = new Date();
  d.setMonth(d.getMonth() - p.months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const sheetIcon = (Icon: LucideIcon) => () => ({ Icon, ink: BRAND_TEXT });

const HELP: HelpItem[] = [
  { icon: Clock, title: "Timeline", text: "Tap any mark to see what happened and when, and slide the chart sideways to go back in time. A long bar is a condition that continues, a dot is a short illness, a diamond is hospital care, a tick is a given vaccine and a cross an overdue one. A circular arrow means it keeps coming back." },
  { icon: TrendingUp, title: "Growth", text: "Choose Weight, Height or Head size, then tap a dot or a reading to see its date, age, centile and status. The blue band is the expected range for the child's age (2nd to 98th centile) and the dashed line is the 50th. An orange diamond is a reading to talk to the doctor about. A child born early is measured by corrected age until 2 years." },
  { icon: Calendar, title: "Period", text: "Changes how far back the timeline, the growth chart and the numbers at the top go: 6 months, 1 year, 3 years or since birth." },
  { icon: ListFilter, title: "Age, date and list", text: "Show the timeline by the child's age or by calendar date, or as a plain list of illnesses and hospital care." },
  { icon: Users, title: "Another person", text: "The three dots at the top right, next to this ?, switch to another family member's records." },
];

export function HealthTimelineScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<AppStackParamList, "HealthTimeline">>();
  const { patientAwpid, patientName, headerColor, headerOn } = route.params;

  const [tab, setTab] = useState<Tab>("timeline");
  const [axis, setAxis] = useState<Axis>("age");
  const [period, setPeriod] = useState("");
  const [indicator, setIndicator] = useState<GrowthIndicator>("weight_kg");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [mark, setMark] = useState<TimelineMark | null>(null);

  const { people } = usePeople();
  const awpid = patientAwpid ?? people.find((p) => p.isSelf)?.awpid;
  const switcher = usePersonSwitcher(people, awpid, (p) => navigation.setParams(paramsFor(p)));

  const from = periodStart(period);
  const timelineQ = useQuery({
    queryKey: ["healthTimeline", awpid, period],
    queryFn: () => getHealthTimeline(awpid!, from),
    enabled: !!awpid,
    placeholderData: keepPreviousData,
  });
  const growthQ = useQuery({
    queryKey: ["growth", awpid, indicator],
    queryFn: () => getGrowthSeries(awpid!, indicator),
    enabled: !!awpid && tab === "growth",
    placeholderData: keepPreviousData,
  });
  const active = tab === "growth" ? [timelineQ, growthQ] : [timelineQ];
  useRefreshOnFocus(active);
  const { refreshing: pulling, onRefresh: pullRefresh } = usePullToRefresh(() => Promise.all(active.map((q) => q.refetch())));

  // another person: nothing selected on the last one carries over
  useEffect(() => { setMark(null); }, [awpid]);

  const timeline = timelineQ.data;
  const error = timelineQ.error || growthQ.error;
  const periodLabel = PERIODS.find((p) => p.code === period)?.label ?? "Since birth";

  return (
    <Screen
      topColor={headerColor}
      onRefresh={pullRefresh}
      refreshing={pulling}
      backgroundLoading={(timelineQ.isFetching || growthQ.isFetching) && !pulling}
      header={
        <>
          <BackHeader
            title={`Health timeline — ${patientName}`}
            onBack={() => navigation.goBack()}
            color={headerColor}
            onColor={headerOn}
            right={<><HelpButton onPress={() => setHelpOpen(true)} onDark color={headerOn} /><MoreButton onPress={switcher.open} onDark color={headerOn} /></>}
          />
          {!!error && <ErrorBanner message={apiErrorMessage(error)} onRetry={() => active.forEach((q) => q.refetch())} />}
          {timeline ? <SummaryStrip timeline={timeline} /> : <SkeletonBlock height={104} radius={CARD.radius} style={{ marginBottom: CARD.gap }} />}
          <View style={styles.controls}>
            <View style={styles.toggle}>
              <SegmentedControl
                options={[{ key: "timeline", label: "Timeline" }, { key: "growth", label: "Growth" }]}
                value={tab}
                onChange={setTab}
                large
              />
            </View>
            <FilterPill label={periodLabel} active={!!period} onPress={() => setPeriodOpen(true)} />
          </View>
          {tab === "timeline" ? (
            <SegmentedControl
              options={[{ key: "age", label: "By age" }, { key: "date", label: "By date" }, { key: "list", label: "List" }]}
              value={axis}
              onChange={setAxis}
            />
          ) : (
            <SegmentedControl options={INDICATORS.map((i) => ({ key: i.key, label: i.label }))} value={indicator} onChange={setIndicator} />
          )}
        </>
      }
    >
      {tab === "timeline" ? (
        <TimelineSection timeline={timeline} axis={axis} selectedKey={mark?.key} onSelect={setMark} />
      ) : (
        <GrowthSection
          key={`${awpid}-${indicator}`}
          data={growthQ.data}
          indicator={INDICATORS.find((i) => i.key === indicator)!}
          fromDate={from}
        />
      )}

      <DetailSheet visible={!!mark} onClose={() => setMark(null)} title={mark?.title || ""}>
        {mark && (
          <>
            <DetailRow label="Type" value={mark.tag} />
            {mark.rows.map(([label, value]) => <DetailRow key={label + value} label={label} value={value} />)}
          </>
        )}
      </DetailSheet>

      <FilterSheet
        visible={periodOpen}
        items={PERIODS.map((p) => ({ code: p.code }))}
        selected={period}
        onSelect={setPeriod}
        onClose={() => setPeriodOpen(false)}
        labelOf={(code) => PERIODS.find((p) => p.code === code)?.label ?? ""}
        allLabel="Since birth"
        title="Period"
        subtitle="How far back to show."
        iconOf={sheetIcon(Calendar)}
        clearLabel=""
      />
      <HelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} items={HELP} title="How to read this screen" />
      {switcher.sheet}
    </Screen>
  );
}

/** Six numbers for the period: what is ongoing, what keeps coming back, hospital care, what is overdue. */
function SummaryStrip({ timeline }: { timeline: HealthTimeline }) {
  const s = timeline.summary;
  const cells: { icon: LucideIcon; value: number; label: string; tone: "neutral" | "warning" | "danger" | "success" }[] = [
    { icon: Activity, value: s.chronic_conditions, label: "Ongoing conditions", tone: "neutral" },
    { icon: Bandage, value: s.acute_episodes, label: "Short illnesses", tone: "neutral" },
    { icon: Repeat, value: s.recurrent_conditions, label: "Happen often", tone: s.recurrent_conditions ? "warning" : "neutral" },
    { icon: Building2, value: s.hospital_stays, label: "Hospital stays", tone: s.hospital_stays ? "danger" : "neutral" },
    { icon: Syringe, value: s.vaccines_overdue, label: "Vaccines overdue", tone: s.vaccines_overdue ? "danger" : "success" },
    { icon: Ruler, value: s.growth_flags, label: "Growth checks", tone: s.growth_flags ? "warning" : "success" },
  ];
  const TONE = {
    neutral: { bg: NEUTRAL.surfaceAlt, fg: NEUTRAL.textSecondary },
    warning: { bg: NEUTRAL.warningBg, fg: NEUTRAL.warning },
    danger: { bg: NEUTRAL.dangerBg, fg: NEUTRAL.danger },
    success: { bg: NEUTRAL.successBg, fg: NEUTRAL.success },
  };
  return (
    <View style={styles.strip}>
      {cells.map((c, i) => (
        <View key={c.label} style={[styles.cell, i % 3 !== 2 && styles.cellDivider, i < 3 && styles.cellRule]}>
          <View style={[styles.cellIcon, { backgroundColor: TONE[c.tone].bg }]}>
            <c.icon size={15} color={TONE[c.tone].fg} strokeWidth={2.3} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cellValue}>{c.value}</Text>
            <Text style={styles.cellLabel} numberOfLines={2}>{c.label}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function TimelineSection({ timeline, axis, selectedKey, onSelect }: {
  timeline?: HealthTimeline;
  axis: Axis;
  selectedKey?: string;
  onSelect: (m: TimelineMark) => void;
}) {
  if (!timeline) return <SkeletonBlock height={320} radius={CARD.radius} />;
  if (timeline.lanes.length === 0) return <EmptyState text="Nothing recorded in this period." />;
  if (axis === "list") {
    const marks = timelineList(timeline);
    return marks.length === 0 ? <EmptyState text="No illnesses or hospital care in this period." /> : (
      <>
        {marks.map((m) => (
          <ListRow key={m.key} icon={m.tag === "Ongoing" ? Activity : Stethoscope} title={m.title} subtitle={`${formatDate(m.date)} · ${m.tag}`} onPress={() => onSelect(m)} />
        ))}
      </>
    );
  }
  return (
    <View style={styles.chartCard}>
      <TimelineChart payload={timeline} axis={axis} selectedKey={selectedKey} onSelect={onSelect} />
    </View>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{text}</Text>
    </View>
  );
}

/** What the colours on the growth chart mean. */
function GrowthKey({ data }: { data: GrowthSeries }) {
  return (
    <>
      <View style={styles.legend}>
        <Legend color={CHART.bandInner} text="Expected range (2nd–98th)" />
        <Legend color={CHART.bandOuter} text="Outer range" />
        <Legend color={CHART.ink} text="Your child" />
        <Legend color={CHART.flagged} text="Outside expected" />
      </View>
      <Text style={styles.note}>{data.reference_note}.{data.uses_corrected_age ? " Born early, so age is corrected until 2 years." : ""}</Text>
    </>
  );
}

function GrowthSection({ data, indicator, fromDate }: {
  data?: GrowthSeries;
  indicator: { key: GrowthIndicator; label: string; unit: string };
  fromDate?: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [newestFirst, setNewestFirst] = useState(true);
  const [outsideOnly, setOutsideOnly] = useState(false);
  const [visible, setVisible] = useState(READINGS_PER_PAGE);
  const [sheet, setSheet] = useState<"sort" | "show" | null>(null);
  const [opened, setOpened] = useState<number | null>(null);

  if (!data) return <SkeletonBlock height={340} radius={CARD.radius} />;
  const inPeriod = data.points.map((p, i) => ({ p, i })).filter(({ p }) => !fromDate || p.date >= fromDate);
  if (inPeriod.length === 0) {
    return <EmptyState text={`No ${indicator.label.toLowerCase()} readings ${fromDate ? "in this period" : "yet. They are picked up from prescriptions automatically"}.`} />;
  }
  const current = selected != null && inPeriod.some(({ i }) => i === selected) ? selected : inPeriod[inPeriod.length - 1].i;
  const cur = data.points[current];
  const outside = inPeriod.filter(({ p }) => p.flag);
  const list = (outsideOnly ? outside : inPeriod).slice();
  if (newestFirst) list.reverse();
  const rows = list.slice(0, visible);
  const select = (i: number) => setSelected(i);

  return (
    <>
      <View style={[styles.card, styles.reading]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.readingMeta}>{indicator.label} · {formatDate(cur.date)}</Text>
          <Text style={styles.readingValue}>{cur.value} <Text style={styles.readingUnit}>{indicator.unit}</Text></Text>
          <Text style={styles.readingMeta}>Age {formatMonths(cur.age_months)}{data.uses_corrected_age ? " (corrected)" : ""}{cur.percentile != null ? ` · ${ordinal(cur.percentile)} centile` : ""}</Text>
        </View>
        <Pill label={cur.flag ? GROWTH_FLAG_LABEL[cur.flag] ?? "To discuss" : "Within expected range"} tone={cur.flag ? "warning" : "success"} />
      </View>

      <View style={styles.chartCard}>
        <GrowthChart data={data} unit={indicator.unit} fromDate={fromDate} selected={current} onSelect={(i) => { select(i); setOpened(i); }} />
        <GrowthKey data={data} />
      </View>

      <DetailSheet visible={opened != null} onClose={() => setOpened(null)} title={`${indicator.label}: ${opened != null ? data.points[opened].value : ""} ${indicator.unit}`}>
        {opened != null && (() => {
          const r = data.points[opened];
          return (
            <>
              <DetailRow label="Date" value={formatDate(r.date)} />
              <DetailRow label="Age" value={`${formatMonths(r.age_months)}${data.uses_corrected_age ? " (corrected)" : ""}`} />
              {r.percentile != null && <DetailRow label="Centile" value={`${ordinal(r.percentile)}`} />}
              <DetailRow label="Status" value={r.flag ? GROWTH_FLAG_LABEL[r.flag] ?? "To discuss" : "Within the expected range"} valueColor={r.flag ? CHART.flagged : undefined} />
            </>
          );
        })()}
      </DetailSheet>

      <View style={styles.card}>
        <Text style={styles.readingsTitle}>Readings</Text>
        <View style={styles.filters}>
          <FilterPill label={newestFirst ? "Newest first" : "Oldest first"} active={!newestFirst} onPress={() => setSheet("sort")} />
          <FilterPill label={outsideOnly ? "Outside expected" : "All readings"} count={outsideOnly ? outside.length : inPeriod.length} active={outsideOnly} onPress={() => setSheet("show")} />
        </View>
        {rows.length === 0 ? <EmptyState text="No readings outside the expected range." /> : rows.map(({ p, i }) => (
          <Pressable key={p.date} onPress={() => select(i)} style={[styles.readingRow, i === current && styles.readingRowOn]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{formatDate(p.date)}</Text>
              <Text style={styles.rowMeta}>Age {formatMonths(p.age_months)}{data.uses_corrected_age ? " (corrected)" : ""}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowTitle}>{p.value} {indicator.unit}</Text>
              <Text style={[styles.rowMeta, !!p.flag && styles.rowFlag]}>{p.flag ? GROWTH_FLAG_LABEL[p.flag] ?? "To discuss" : p.percentile != null ? `${ordinal(p.percentile)} centile` : ""}</Text>
            </View>
          </Pressable>
        ))}
        {list.length > visible && <SecondaryButton label="Load more" onPress={() => setVisible((v) => v + READINGS_PER_PAGE)} style={styles.loadMore} />}
      </View>

      <FilterSheet
        visible={sheet === "sort"}
        items={[{ code: "oldest" }]}
        selected={newestFirst ? "" : "oldest"}
        onSelect={(c) => { setNewestFirst(c === ""); setVisible(READINGS_PER_PAGE); }}
        onClose={() => setSheet(null)}
        labelOf={() => "Oldest first"}
        allLabel="Newest first"
        title="Sort readings"
        subtitle=""
        iconOf={sheetIcon(ArrowDownUp)}
        clearLabel=""
      />
      <FilterSheet
        visible={sheet === "show"}
        items={[{ code: "outside", count: outside.length }]}
        total={inPeriod.length}
        selected={outsideOnly ? "outside" : ""}
        onSelect={(c) => { setOutsideOnly(c === "outside"); setVisible(READINGS_PER_PAGE); }}
        onClose={() => setSheet(null)}
        labelOf={() => "Outside expected"}
        allLabel="All readings"
        title="Show readings"
        subtitle="Outside expected means below the 2nd or above the 98th centile."
        iconOf={sheetIcon(ListFilter)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  controls: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  toggle: { flex: 1 },
  strip: {
    flexDirection: "row", flexWrap: "wrap", backgroundColor: NEUTRAL.surface, borderRadius: CARD.radius, borderWidth: 0.5, borderColor: NEUTRAL.border,
    marginBottom: CARD.gap, overflow: "hidden",
  },
  cell: { width: "33.333%", flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 9, paddingHorizontal: 9 },
  cellDivider: { borderRightWidth: 0.5, borderRightColor: NEUTRAL.border },
  cellRule: { borderBottomWidth: 0.5, borderBottomColor: NEUTRAL.border },
  cellIcon: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  cellValue: { fontSize: 18, fontWeight: "800", color: NEUTRAL.textPrimary, lineHeight: 20 },
  cellLabel: { fontSize: 10.5, color: NEUTRAL.textSecondary, lineHeight: 12 },
  chartCard: { backgroundColor: NEUTRAL.surface, borderRadius: CARD.radius, borderWidth: 0.5, borderColor: NEUTRAL.border, padding: 10, marginBottom: CARD.gap },
  card: { backgroundColor: NEUTRAL.surface, borderRadius: CARD.radius, borderWidth: 0.5, borderColor: NEUTRAL.border, padding: 12, marginBottom: CARD.gap },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 6, columnGap: 14, marginTop: 8, paddingHorizontal: 2 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 11, height: 11, borderRadius: 3 },
  legendText: { fontSize: 11.5, color: NEUTRAL.textSecondary, fontWeight: "500" },
  note: { fontSize: CARD_TEXT.tiny, color: NEUTRAL.textSecondary, marginTop: 8, paddingHorizontal: 2 },
  reading: { flexDirection: "row", alignItems: "center", gap: 10 },
  readingMeta: { fontSize: CARD_TEXT.meta, color: NEUTRAL.textSecondary },
  readingValue: { fontSize: 30, fontWeight: "800", color: NEUTRAL.textPrimary, lineHeight: 36 },
  readingUnit: { fontSize: 15, fontWeight: "600", color: NEUTRAL.textSecondary },
  readingsTitle: { fontSize: 16, fontWeight: "800", color: NEUTRAL.textPrimary, marginBottom: 10 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 },
  readingRow: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 10,
    borderTopWidth: 0.5, borderTopColor: NEUTRAL.border, borderLeftWidth: 4, borderLeftColor: "transparent",
  },
  readingRowOn: { backgroundColor: "#EAF2FD", borderLeftColor: CHART.selected, borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
  rowTitle: { fontSize: CARD_TEXT.title, fontWeight: "700", color: NEUTRAL.textPrimary },
  rowMeta: { fontSize: CARD_TEXT.meta, color: NEUTRAL.textSecondary, marginTop: 1 },
  rowRight: { alignItems: "flex-end" },
  rowFlag: { color: CHART.flagged, fontWeight: "700" },
  loadMore: { alignSelf: "stretch", marginTop: 10 },
});
