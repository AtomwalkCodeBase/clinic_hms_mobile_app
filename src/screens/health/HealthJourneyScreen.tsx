import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Camera, Clock, ListFilter, Plus, Syringe, TrendingUp, Users } from "lucide-react-native";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { usePeople, usePersonSwitcher, paramsFor } from "@/hooks/usePeople";
import { Screen, BackHeader, ErrorBanner } from "@/components/Layout";
import { HelpButton, MoreButton } from "@/components/IconButtons";
import { HelpSheet, HelpItem } from "@/components/HelpSheet";
import { SecondaryButton } from "@/components/Buttons";
import { PillTabs, SegmentBar } from "@/components/health/Segments";
import { ModeToggle } from "@/components/health/ModeToggle";
import { EpisodeSheet } from "@/components/health/EpisodeSheet";
import { getGrowthSeries, getHealthTimeline, getImmunization } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import type { GrowthIndicator } from "@/api/types";
import { AppStackParamList } from "@/navigation/types";
import { NEUTRAL } from "@/theme/themes";
import { episodeModel, isChildDob, laneModels, withoutVaccines, type FeedFilter } from "@/utils/journey";
import { OverviewSection } from "./journey/OverviewSection";
import { TimelineSection, type Axis, type View2 } from "./journey/TimelineSection";
import { GrowthSection, INDICATORS } from "./journey/GrowthSection";
import { VaccinesSection } from "./journey/VaccinesSection";

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Section = "overview" | "timeline" | "growth" | "vaccines";
type PeriodKey = "6m" | "1y" | "3y" | "all";

const SECTIONS: { key: Section; label: string }[] = [
  { key: "overview", label: "Overview" }, { key: "timeline", label: "Timeline" }, { key: "growth", label: "Growth" }, { key: "vaccines", label: "Vaccines" },
];
const PERIODS: { key: PeriodKey; label: string; months: number }[] = [
  { key: "6m", label: "6 months", months: 6 }, { key: "1y", label: "1 year", months: 12 }, { key: "3y", label: "3 years", months: 36 }, { key: "all", label: "Since birth", months: 0 },
];

/** The first day of a period, "2026-04-17"; since birth has none. */
function periodStart(key: PeriodKey): string | undefined {
  const p = PERIODS.find((x) => x.key === key);
  if (!p || !p.months) return undefined;
  const d = new Date();
  d.setMonth(d.getMonth() - p.months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const HELP: HelpItem[] = [
  { icon: Clock, title: "Overview", text: "The counts for the last 3 years at the top, anything that needs attention, and a short timeline of what matters most in those 3 years." },
  { icon: ListFilter, title: "Timeline", text: "Tap any mark to see what happened, and slide the chart sideways to go back in time. A long bar is a condition that continues, a dot is a short illness, a diamond is hospital care, a tick is a given vaccine and a cross an overdue one. A circular arrow means it keeps coming back. The two switches flip between list and chart, and between age and date." },
  { icon: TrendingUp, title: "Growth", text: "Choose Weight, Height or Head size, then tap a dot to see its date, age and centile. The blue band is the expected range for the child's age (2nd to 98th centile) and the dashed line is the 50th. An orange diamond is a reading to talk to the doctor about. A child born early is measured by corrected age until 2 years." },
  { icon: Syringe, title: "Vaccines", text: "Tap an age group to see its doses. Book a dose that is overdue, due or coming up, one at a time or the whole group. Scan a card or add a vaccine by hand with the buttons at the bottom." },
  { icon: Calendar, title: "Period", text: "Changes how far back the timeline goes: 6 months, 1 year, 3 years or since birth." },
  { icon: Users, title: "Another person", text: "The three dots at the top right, next to this ?, switch to another family member's records." },
];

/**
 * One screen for a child's whole health story: Overview, Timeline, Growth and Vaccines as four sections. The tabs and the
 * controls of the section stay pinned at the top, only the content scrolls, and on the Vaccines tab the scan and add buttons
 * stay pinned at the bottom. The episode details are a sheet over it; a tapped mark or dot opens a floating card.
 */
export function HealthJourneyScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<AppStackParamList, "HealthJourney">>();
  const { patientAwpid, patientName, headerColor, headerOn } = route.params;
  const queryClient = useQueryClient();

  const [picked, setSection] = useState<Section>("overview");
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [view, setView] = useState<View2>("list");
  const [axis, setAxis] = useState<Axis>("age");
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [indicator, setIndicator] = useState<GrowthIndicator>("weight_kg");
  const [episodeLane, setEpisodeLane] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const { people } = usePeople();
  const awpid = patientAwpid ?? people.find((p) => p.isSelf)?.awpid;
  const person = people.find((p) => p.awpid === awpid);
  const switcher = usePersonSwitcher(people, awpid, (p) => navigation.setParams(paramsFor(p)));
  // an adult has no vaccine schedule: no Vaccines tab, and no vaccine marks or alerts anywhere
  const child = isChildDob(person?.date_of_birth);
  const section: Section = !child && picked === "vaccines" ? "overview" : picked;
  const sections = child ? SECTIONS : SECTIONS.filter((x) => x.key !== "vaccines");

  // One cached answer per child and period: the overview is the "3y" one, the timeline whichever period is chosen, growth
  // and vaccines use "all" (its weight dips). The others are loaded in the background once the first has come.
  const timelineQuery = (key: PeriodKey, enabled: boolean) => ({
    queryKey: ["healthTimeline", awpid, key], queryFn: () => getHealthTimeline(awpid!, periodStart(key)), enabled: !!awpid && enabled,
  });
  const overviewQ = useQuery(timelineQuery("3y", section === "overview"));
  const timelineQ = useQuery(timelineQuery(period, section === "timeline"));
  const fullQ = useQuery(timelineQuery("all", section === "growth" || section === "vaccines"));
  const growthQ = useQuery({ queryKey: ["growth", awpid, indicator], queryFn: () => getGrowthSeries(awpid!, indicator), enabled: !!awpid && section === "growth" });
  const immunizationQ = useQuery({ queryKey: ["immunization", awpid], queryFn: () => getImmunization(awpid!), enabled: !!awpid && section === "vaccines" });

  const active = section === "overview" ? [overviewQ] : section === "timeline" ? [timelineQ] : section === "growth" ? [fullQ, growthQ] : [fullQ, immunizationQ];
  useRefreshOnFocus(active);
  const { refreshing: pulling, onRefresh: pullRefresh } = usePullToRefresh(() => Promise.all(active.map((q) => q.refetch())));

  const loaded = overviewQ.isSuccess || timelineQ.isSuccess || fullQ.isSuccess;
  useEffect(() => {
    if (!awpid || !loaded) return undefined;
    const t = setTimeout(() => {
      PERIODS.forEach((p) => queryClient.prefetchQuery({ queryKey: ["healthTimeline", awpid, p.key], queryFn: () => getHealthTimeline(awpid, periodStart(p.key)) }));
      INDICATORS.forEach((i) => queryClient.prefetchQuery({ queryKey: ["growth", awpid, i.key], queryFn: () => getGrowthSeries(awpid, i.key) }));
      queryClient.prefetchQuery({ queryKey: ["immunization", awpid], queryFn: () => getImmunization(awpid) });
    }, 600);
    return () => clearTimeout(t);
  }, [awpid, loaded, queryClient]);

  // another person, or another period: nothing selected on the last one carries over
  useEffect(() => { setEpisodeLane(null); }, [awpid, period]);

  const forPerson = <T extends Parameters<typeof withoutVaccines>[0] | undefined>(t: T): T => (child || !t ? t : (withoutVaccines(t) as T));
  const overview = useMemo(() => forPerson(overviewQ.data), [overviewQ.data, child]); // eslint-disable-line react-hooks/exhaustive-deps
  const timeline = useMemo(() => forPerson(timelineQ.data), [timelineQ.data, child]); // eslint-disable-line react-hooks/exhaustive-deps
  const full = useMemo(() => forPerson(fullQ.data), [fullQ.data, child]); // eslint-disable-line react-hooks/exhaustive-deps
  const dob = (overview ?? timeline ?? full)?.patient.dob ?? person?.date_of_birth ?? undefined;
  const overviewLanes = useMemo(() => (overview ? laneModels(overview) : []), [overview]);
  const timelineLanes = useMemo(() => (timeline ? laneModels(timeline) : []), [timeline]);
  // the episode sheet reads from whichever timeline the tapped card belongs to
  const sheetTimeline = section === "overview" ? overview : timeline;
  const sheetLanes = section === "overview" ? overviewLanes : timelineLanes;
  const episode = useMemo(() => (sheetTimeline && episodeLane ? episodeModel(sheetTimeline, episodeLane) : null), [sheetTimeline, episodeLane]);
  const error = active.map((q) => q.error).find(Boolean);

  const book = (complaint: string) => navigation.navigate("FindDoctors", { initialComplaint: complaint, patientAwpid, patientName });
  const openReport = (id: number) => navigation.navigate("DocumentViewer", { ids: [id], index: 0, patientAwpid });

  const header = (
    <>
      <BackHeader
        title={`Health journey — ${patientName}`}
        onBack={() => navigation.goBack()}
        color={headerColor}
        onColor={headerOn}
        right={<><HelpButton onPress={() => setHelpOpen(true)} onDark color={headerOn} /><MoreButton onPress={switcher.open} onDark color={headerOn} /></>}
      />
      <View style={styles.controls}>
        <PillTabs label="Journey sections" options={sections} value={section} onChange={setSection} />
        {section === "timeline" && <SegmentBar label="Period" options={PERIODS.map((p) => ({ key: p.key, label: p.label }))} value={period} onChange={setPeriod} />}
        {section === "timeline" && (
          <View style={styles.toggles}>
            <ModeToggle label="Timeline view" left={{ key: "list", label: "List" }} right={{ key: "chart", label: "Chart" }} value={view} onChange={setView} />
            {view === "chart" && <ModeToggle label="Time axis" left={{ key: "age", label: "By age" }} right={{ key: "date", label: "By date" }} value={axis} onChange={setAxis} />}
          </View>
        )}
        {section === "growth" && <SegmentBar label="Measurement" options={INDICATORS.map((i) => ({ key: i.key, label: i.label }))} value={indicator} onChange={setIndicator} />}
        {!!error && <ErrorBanner message={apiErrorMessage(error)} onRetry={() => active.forEach((q) => q.refetch())} />}
      </View>
    </>
  );

  const footer = section === "vaccines" ? (
    <View style={styles.footer}>
      <SecondaryButton label="Scan vaccination card" icon={Camera} onPress={() => navigation.navigate("DocumentUpload", { patientAwpid })} style={{ flex: 1 }} />
      <SecondaryButton label="Add a vaccine" icon={Plus} onPress={() => navigation.navigate("AddVaccine", { patientAwpid, patientName })} style={{ flex: 1 }} />
    </View>
  ) : undefined;

  return (
    <Screen
      topColor={headerColor}
      onRefresh={pullRefresh}
      refreshing={pulling}
      backgroundLoading={active.some((q) => q.isFetching) && !pulling}
      header={header}
      footer={footer}
    >
      {section === "overview" && <OverviewSection timeline={overview} lanes={overviewLanes} onOpenTimeline={() => { setView("chart"); setPeriod("3y"); setSection("timeline"); }} onBook={book} />}
      {section === "timeline" && (
        <TimelineSection key={`${awpid}|${period}`} timeline={timeline} lanes={timelineLanes} view={view} axis={axis} filter={filter} onFilter={setFilter}
          onEpisode={setEpisodeLane} onReport={openReport} onSection={setSection} />
      )}
      {section === "growth" && <GrowthSection key={`${awpid}|${indicator}`} indicator={indicator} growth={growthQ.data} timeline={full} dob={dob} />}
      {section === "vaccines" && <VaccinesSection data={immunizationQ.data} dob={dob} onBook={book} />}

      <EpisodeSheet model={episode} lane={sheetLanes.find((l) => l.id === episodeLane) ?? null} dob={dob ?? ""} onClose={() => setEpisodeLane(null)}
        onReport={openReport} onBook={(c) => { setEpisodeLane(null); book(c); }} />
      <HelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} items={HELP} title="How to read this screen" large />
      {switcher.sheet}
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: { gap: 8, paddingBottom: 8 },
  toggles: { flexDirection: "row", gap: 8 },
  footer: { flexDirection: "row", gap: 8, paddingTop: 10, paddingBottom: 10, paddingHorizontal: 10, backgroundColor: NEUTRAL.surface, borderTopWidth: 0.5, borderTopColor: NEUTRAL.border },
});
