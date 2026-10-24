import { memo, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { EpisodeSheet } from "@/components/health/EpisodeSheet";
import { getGrowthSeries, getHealthTimeline, getImmunization } from "@/api/portal";
import type { HealthTimeline } from "@/api/types";
import { episodeModel, laneModels, withoutVaccines } from "@/utils/journey";
import { OverviewSection } from "./OverviewSection";
import { TimelineSection } from "./TimelineSection";
import { GrowthSection } from "./GrowthSection";
import { VaccinesSection } from "./VaccinesSection";
import { journey, periodStart, refreshers, useJourney, type Section } from "./journeyStore";

const OverviewSectionM = memo(OverviewSection);
const TimelineSectionM = memo(TimelineSection);
const GrowthSectionM = memo(GrowthSection);
const VaccinesSectionM = memo(VaccinesSection);

export type PaneProps = {
  awpid: string | undefined;
  /** an adult has no vaccine schedule: no vaccine marks or alerts anywhere */
  child: boolean;
  /** date of birth known before the data arrives */
  dob: string | undefined;
  onBook: (complaint: string) => void;
  onReport: (documentId: number) => void;
};

/**
 * A section is built the first time it is opened and then only hidden, so coming back to it is instant and it keeps its own
 * scroll, selection and data. Hiding is one style on this wrapper; the section inside is not redrawn by it.
 */
export function Pane({ name, children }: { name: Section; children: ReactNode }) {
  const section = useJourney("section");
  const [built, setBuilt] = useState(section === name);
  if (section === name && !built) setBuilt(true);
  if (!built) return null;
  return <View style={section === name ? undefined : styles.hidden}>{children}</View>;
}

/** Reload and loading/error reporting for the pane, while it is the one on screen. */
function usePaneStatus(name: Section, queries: UseQueryResult<unknown>[]) {
  const visible = useJourney("section") === name;
  const latest = useRef(queries);
  latest.current = queries;
  useEffect(() => {
    refreshers[name] = () => Promise.all(latest.current.map((q) => q.refetch()));
    return () => { delete refreshers[name]; };
  }, [name]);
  const fetching = queries.some((q) => q.isFetching);
  const error = queries.map((q) => q.error).find(Boolean) ?? null;
  useEffect(() => { if (visible) journey.set({ fetching, error }); }, [visible, fetching, error]);
  useRefreshOnFocus(visible ? queries.map((q) => ({ isStale: q.isStale, refetch: q.refetch })) : []);
}

function useTimelineQuery(awpid: string | undefined, period: Parameters<typeof periodStart>[0]) {
  return useQuery({ queryKey: ["healthTimeline", awpid, period], queryFn: () => getHealthTimeline(awpid!, periodStart(period)), enabled: !!awpid });
}

function usePersonal(data: HealthTimeline | undefined, child: boolean) {
  return useMemo(() => (child || !data ? data : withoutVaccines(data)), [data, child]);
}

function useEpisodes(timeline: HealthTimeline | undefined, lanes: ReturnType<typeof laneModels>, dob: string | undefined, props: PaneProps, resetKey: unknown) {
  const [episodeLane, setEpisodeLane] = useState<string | null>(null);
  useEffect(() => { setEpisodeLane(null); }, [resetKey]);
  const episode = useMemo(() => (timeline && episodeLane ? episodeModel(timeline, episodeLane) : null), [timeline, episodeLane]);
  const close = useCallback(() => setEpisodeLane(null), []);
  const { onBook } = props;
  const bookFromSheet = useCallback((c: string) => { setEpisodeLane(null); onBook(c); }, [onBook]);
  const sheet = (
    <EpisodeSheet model={episode} lane={lanes.find((l) => l.id === episodeLane) ?? null} dob={dob ?? ""} onClose={close} onReport={props.onReport} onBook={bookFromSheet} />
  );
  return { open: setEpisodeLane, sheet };
}

export function OverviewPane(props: PaneProps) {
  const { awpid, child, dob, onBook } = props;
  const q = useTimelineQuery(awpid, "3y");
  usePaneStatus("overview", [q]);
  const overview = usePersonal(q.data, child);
  const lanes = useMemo(() => (overview ? laneModels(overview) : []), [overview]);
  const episodes = useEpisodes(overview, lanes, overview?.patient.dob ?? dob, props, awpid);
  const openChart = useCallback(() => journey.set({ view: "chart", period: "3y", section: "timeline" }), []);
  return (
    <>
      <OverviewSectionM timeline={overview} lanes={lanes} onOpenTimeline={openChart} onBook={onBook} />
      {episodes.sheet}
    </>
  );
}

export function TimelinePane(props: PaneProps & { loadMore: MutableRefObject<(() => void) | null> }) {
  const { awpid, child, dob, loadMore } = props;
  const period = useJourney("period");
  const q = useTimelineQuery(awpid, period);
  usePaneStatus("timeline", [q]);
  const timeline = usePersonal(q.data, child);
  const lanes = useMemo(() => (timeline ? laneModels(timeline) : []), [timeline]);
  const episodes = useEpisodes(timeline, lanes, timeline?.patient.dob ?? dob, props, `${awpid}|${period}`);
  const goTo = useCallback((section: "growth" | "vaccines") => journey.set({ section }), []);
  return (
    <>
      <TimelineSectionM key={awpid} timeline={timeline} lanes={lanes} onEpisode={episodes.open} onReport={props.onReport} onSection={goTo} loadMore={loadMore} />
      {episodes.sheet}
    </>
  );
}

export function GrowthPane({ awpid, child, dob }: PaneProps) {
  const indicator = useJourney("indicator");
  const fullQ = useTimelineQuery(awpid, "all");
  const growthQ = useQuery({ queryKey: ["growth", awpid, indicator], queryFn: () => getGrowthSeries(awpid!, indicator), enabled: !!awpid });
  usePaneStatus("growth", [fullQ, growthQ]);
  const full = usePersonal(fullQ.data, child);
  return <GrowthSectionM key={`${awpid}|${indicator}`} indicator={indicator} growth={growthQ.data} timeline={full} dob={full?.patient.dob ?? dob} />;
}

export function VaccinesPane({ awpid, dob, onBook }: PaneProps) {
  const q = useQuery({ queryKey: ["immunization", awpid], queryFn: () => getImmunization(awpid!), enabled: !!awpid });
  usePaneStatus("vaccines", [q]);
  return <VaccinesSectionM data={q.data} dob={dob} onBook={onBook} />;
}

const styles = StyleSheet.create({
  hidden: { display: "none" },
});
