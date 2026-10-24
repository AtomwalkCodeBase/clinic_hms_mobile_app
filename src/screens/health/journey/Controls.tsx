import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { ErrorBanner } from "@/components/Layout";
import { SlidingTabs } from "@/components/SlidingTabs";
import { apiErrorMessage } from "@/api/client";
import type { GrowthIndicator } from "@/api/types";
import { INDICATORS } from "./GrowthSection";
import { journey, PERIODS, refreshers, useJourney, type Axis, type PeriodKey, type Section, type View2 } from "./journeyStore";

const SECTIONS: { key: Section; label: string }[] = [
  { key: "overview", label: "Overview" }, { key: "timeline", label: "Timeline" }, { key: "growth", label: "Growth" }, { key: "vaccines", label: "Vaccines" },
];
const SECTIONS_ADULT = SECTIONS.filter((x) => x.key !== "vaccines");
const PERIOD_OPTIONS = PERIODS.map((p) => ({ key: p.key, label: p.label }));
const VIEW_OPTIONS: { key: View2; label: string }[] = [{ key: "list", label: "List" }, { key: "chart", label: "Chart" }];
const AXIS_OPTIONS: { key: Axis; label: string }[] = [{ key: "age", label: "By age" }, { key: "date", label: "By date" }];
const INDICATOR_OPTIONS = INDICATORS.map((i) => ({ key: i.key, label: i.label }));

const setSection = (section: Section) => journey.set({ section });
const setPeriod = (period: PeriodKey) => journey.set({ period });
const setView = (view: View2) => journey.set({ view });
const setAxis = (axis: Axis) => journey.set({ axis });
const setIndicator = (indicator: GrowthIndicator) => journey.set({ indicator });

/**
 * The switches pinned at the top. Each one reads only the choice it shows, so a tap redraws that switch (and the section it
 * controls, which reads the same choice) and nothing else.
 */
export const SectionTabs = memo(function SectionTabs({ child }: { child: boolean }) {
  const section = useJourney("section");
  return <SlidingTabs label="Journey sections" look="tabs" options={child ? SECTIONS : SECTIONS_ADULT} value={section} onChange={setSection} />;
});

export const SectionControls = memo(function SectionControls() {
  const section = useJourney("section");
  const period = useJourney("period");
  const view = useJourney("view");
  const axis = useJourney("axis");
  const indicator = useJourney("indicator");
  if (section === "timeline") {
    return (
      <>
        <SlidingTabs label="Period" look="bar" options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
        <View style={styles.toggles}>
          <SlidingTabs label="Timeline view" look="bar" style={styles.toggle} options={VIEW_OPTIONS} value={view} onChange={setView} />
          {view === "chart" && <SlidingTabs label="Time axis" look="bar" style={styles.toggle} options={AXIS_OPTIONS} value={axis} onChange={setAxis} />}
        </View>
      </>
    );
  }
  if (section === "growth") return <SlidingTabs label="Measurement" look="bar" options={INDICATOR_OPTIONS} value={indicator} onChange={setIndicator} />;
  return null;
});

const retry = () => { refreshers[journey.get("section")]?.(); };

export const LoadError = memo(function LoadError() {
  const error = useJourney("error");
  return error ? <ErrorBanner message={apiErrorMessage(error)} onRetry={retry} /> : null;
});

const styles = StyleSheet.create({
  toggles: { flexDirection: "row", gap: 8 },
  toggle: { flex: 1 },
});
