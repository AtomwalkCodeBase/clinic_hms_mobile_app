import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InteractionManager, StyleSheet, View } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import { Calendar, Camera, Clock, ListFilter, Plus, Syringe, TrendingUp, Users } from "lucide-react-native";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { usePeople, usePersonSwitcher, paramsFor } from "@/hooks/usePeople";
import { Screen, BackHeader } from "@/components/Layout";
import { HelpButton, MoreButton } from "@/components/IconButtons";
import { HelpSheet, HelpItem } from "@/components/HelpSheet";
import { SecondaryButton } from "@/components/Buttons";
import { getGrowthSeries, getHealthTimeline, getImmunization } from "@/api/portal";
import { AppStackParamList } from "@/navigation/types";
import { NEUTRAL } from "@/theme/themes";
import { isChildDob } from "@/utils/journey";
import { INDICATORS } from "./journey/GrowthSection";
import { LoadError, SectionControls, SectionTabs } from "./journey/Controls";
import { GrowthPane, OverviewPane, Pane, TimelinePane, VaccinesPane, type PaneProps } from "./journey/Panes";
import { journey, PERIODS, periodStart, refreshers, useJourney } from "./journey/journeyStore";

type Nav = NativeStackNavigationProp<AppStackParamList>;

const HELP: HelpItem[] = [
  { icon: Clock, title: "Overview", text: "The counts for the last 3 years at the top, anything that needs attention, and a short timeline of what matters most in those 3 years." },
  { icon: ListFilter, title: "Timeline", text: "Tap any mark to see what happened, and slide the chart sideways to go back in time. A long bar is a condition that continues, a dot is a short illness, a diamond is hospital care, a tick is a given vaccine and a cross an overdue one. A circular arrow means it keeps coming back. The two switches flip between list and chart, and between age and date." },
  { icon: TrendingUp, title: "Growth", text: "Choose Weight, Height or Head size, then tap a dot to see its date, age and centile. The blue band is the expected range for the child's age (2nd to 98th centile) and the dashed line is the 50th. An orange diamond is a reading to talk to the doctor about. A child born early is measured by corrected age until 2 years." },
  { icon: Syringe, title: "Vaccines", text: "Tap an age group to see its doses. Book a dose that is overdue, due or coming up, one at a time or the whole group. Scan a card or add a vaccine by hand with the buttons at the bottom." },
  { icon: Calendar, title: "Period", text: "Changes how far back the timeline goes: 6 months, 1 year, 3 years or since birth." },
  { icon: Users, title: "Another person", text: "The three dots at the top right, next to this ?, switch to another family member's records." },
];

/** The scan and add buttons pinned at the bottom of the Vaccines tab; it reads the tab itself so the screen need not. */
function VaccinesFooter({ patientAwpid, patientName, child }: { patientAwpid: string | undefined; patientName: string; child: boolean }) {
  const navigation = useNavigation<Nav>();
  const section = useJourney("section");
  if (section !== "vaccines" || !child) return null;
  return (
    <View style={styles.footer}>
      <SecondaryButton label="Scan vaccination card" icon={Camera} onPress={() => navigation.navigate("DocumentUpload", { patientAwpid })} style={{ flex: 1 }} />
      <SecondaryButton label="Add a vaccine" icon={Plus} onPress={() => navigation.navigate("AddVaccine", { patientAwpid, patientName })} style={{ flex: 1 }} />
    </View>
  );
}

/**
 * One screen for a child's whole health story: Overview, Timeline, Growth and Vaccines as four sections. The tabs and the
 * controls of the section stay pinned at the top, only the content scrolls, and on the Vaccines tab the scan and add buttons
 * stay pinned at the bottom. The episode details are a sheet over it; a tapped mark or dot opens a floating card.
 *
 * This component only holds what everything on it shares (who, the header, the help sheet). The choices (section, period,
 * view, filter, measurement) live in journeyStore and each section loads its own data, so a tap redraws just the switch that
 * was tapped and the section it belongs to; this function does not run again.
 */
export function HealthJourneyScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<AppStackParamList, "HealthJourney">>();
  const { patientAwpid, patientName, headerColor, headerOn } = route.params;
  const queryClient = useQueryClient();
  const started = useRef(false);
  if (!started.current) { started.current = true; journey.reset(); }       // a new visit starts on Overview

  const [helpOpen, setHelpOpen] = useState(false);
  const { people } = usePeople();
  const awpid = patientAwpid ?? people.find((p) => p.isSelf)?.awpid;
  const person = people.find((p) => p.awpid === awpid);
  const switcher = usePersonSwitcher(people, awpid, (p) => navigation.setParams(paramsFor(p)));
  const child = isChildDob(person?.date_of_birth);
  const dob = person?.date_of_birth ?? undefined;
  useEffect(() => { if (!child && journey.get("section") === "vaccines") journey.set({ section: "overview" }); }, [child]);

  const fetching = useJourney("fetching");
  const loadMore = useRef<(() => void) | null>(null);
  const nearEnd = useCallback(() => {
    if (journey.get("section") === "timeline" && journey.get("view") === "list") loadMore.current?.();
  }, []);
  const refreshVisible = useCallback(() => refreshers[journey.get("section")]?.() ?? Promise.resolve(), []);
  const { refreshing: pulling, onRefresh: pullRefresh } = usePullToRefresh(refreshVisible);

  // The other periods, growth charts and vaccines are loaded quietly one at a time once the screen has settled, so opening
  // them later is instant; "fresh for a minute" keeps what the sections have just loaded from being asked for twice.
  useEffect(() => {
    if (!awpid) return undefined;
    let stopped = false;
    const jobs: { queryKey: unknown[]; queryFn: () => Promise<unknown>; staleTime: number }[] = [
      ...PERIODS.map((p) => ({ queryKey: ["healthTimeline", awpid, p.key], queryFn: () => getHealthTimeline(awpid, periodStart(p.key)), staleTime: 60_000 })),
      ...INDICATORS.map((i) => ({ queryKey: ["growth", awpid, i.key], queryFn: () => getGrowthSeries(awpid, i.key), staleTime: 60_000 })),
      { queryKey: ["immunization", awpid], queryFn: () => getImmunization(awpid), staleTime: 60_000 },
    ];
    const t = setTimeout(async () => {
      for (const job of jobs) {
        if (stopped) return;
        await new Promise<void>((resolve) => InteractionManager.runAfterInteractions(() => resolve()));
        await queryClient.prefetchQuery(job);
      }
    }, 1500);
    return () => { stopped = true; clearTimeout(t); };
  }, [awpid, queryClient]);

  const book = useCallback((complaint: string) => navigation.navigate("FindDoctors", { initialComplaint: complaint, patientAwpid, patientName }), [navigation, patientAwpid, patientName]);
  const openReport = useCallback((id: number) => navigation.navigate("DocumentViewer", { ids: [id], index: 0, patientAwpid }), [navigation, patientAwpid]);

  const header = useMemo(() => (
    <>
      <BackHeader
        title={`Health journey — ${patientName}`}
        onBack={() => navigation.goBack()}
        color={headerColor}
        onColor={headerOn}
        right={<><HelpButton onPress={() => setHelpOpen(true)} onDark color={headerOn} /><MoreButton onPress={switcher.open} onDark color={headerOn} /></>}
      />
      <View style={styles.controls}>
        <SectionTabs child={child} />
        <SectionControls />
        <LoadError />
      </View>
    </>
  ), [patientName, navigation, headerColor, headerOn, switcher.open, child]);

  const pane: PaneProps = useMemo(() => ({ awpid, child, dob, onBook: book, onReport: openReport }), [awpid, child, dob, book, openReport]);
  const panes = useMemo(() => (
    <>
      <Pane name="overview"><OverviewPane key={awpid} {...pane} /></Pane>
      <Pane name="timeline"><TimelinePane key={awpid} {...pane} loadMore={loadMore} /></Pane>
      <Pane name="growth"><GrowthPane key={awpid} {...pane} /></Pane>
      <Pane name="vaccines"><VaccinesPane key={awpid} {...pane} /></Pane>
    </>
  ), [pane, awpid]);

  return (
    <Screen
      topColor={headerColor}
      onRefresh={pullRefresh}
      refreshing={pulling}
      backgroundLoading={fetching && !pulling}
      header={header}
      footer={<VaccinesFooter patientAwpid={patientAwpid} patientName={patientName} child={child} />}
      onNearEnd={nearEnd}
    >
      {panes}
      <HelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} items={HELP} title="How to read this screen" large />
      {switcher.sheet}
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: { gap: 8, paddingBottom: 8 },
  footer: { flexDirection: "row", gap: 8, paddingTop: 10, paddingBottom: 10, paddingHorizontal: 10, backgroundColor: NEUTRAL.surface, borderTopWidth: 0.5, borderTopColor: NEUTRAL.border },
});
