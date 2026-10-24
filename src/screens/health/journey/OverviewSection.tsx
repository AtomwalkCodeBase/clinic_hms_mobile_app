import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import type { HealthTimeline } from "@/api/types";
import { PrimaryButton } from "@/components/Buttons";
import { LaneChart } from "@/components/health/LaneChart";
import { LaneChartSkeleton, TilesSkeleton } from "@/components/health/ChartSkeleton";
import { SummaryTiles } from "@/components/health/JourneyBits";
import { Marker } from "@/components/health/Marker";
import { TONES } from "@/components/health/journeyTheme";
import { J } from "@/components/health/journeyStyles";
import { attentionItems, glanceLanes, isoOf, tileHints, visibleLanes, type LaneModel } from "@/utils/journey";

/**
 * The overview: four small counts and a short timeline of what matters most, both for the last 3 years, and anything
 * that needs attention. `timeline` is the last-3-years response.
 */
export function OverviewSection({ timeline, lanes, onOpenTimeline, onBook }: {
  timeline: HealthTimeline | undefined;
  lanes: LaneModel[];
  onOpenTimeline: () => void;
  onBook: (complaint: string) => void;
}) {
  const attention = useMemo(() => (timeline ? attentionItems(timeline) : []), [timeline]);
  const glance = useMemo(() => (timeline ? glanceLanes(visibleLanes(lanes, timeline.period.from, timeline.period.to)) : []), [lanes, timeline]);

  if (!timeline) {
    return (
      <View style={J.stack}>
        <Text style={J.caption}>Last 3 years</Text>
        <TilesSkeleton />
        <View style={J.card}><LaneChartSkeleton rows={5} compact /></View>
      </View>
    );
  }

  const s = timeline.summary;
  const hints = tileHints(timeline, isoOf(Date.now()));
  return (
    <View style={J.stack}>
      <Text style={J.caption}>Last 3 years</Text>
      <SummaryTiles counts={{ chronic: s.chronic_conditions, acute: s.acute_episodes, recurrent: s.recurrent_conditions, hospital: s.hospital_stays }} hints={hints} />

      {attention.map((a) => (
        <View key={a.id} accessibilityRole="alert" style={[J.card, J.row, { backgroundColor: TONES.critical.tint, gap: 12, alignItems: "flex-start" }]}>
          <Marker shape="cross" tone="critical" size={24} />
          <View style={{ flex: 1, gap: 8 }}>
            <View>
              <Text style={J.cardTitle}>{a.title}</Text>
              <Text style={J.body}>{a.detail}</Text>
            </View>
            <PrimaryButton label="Book vaccination" compact onPress={() => onBook(a.complaint)} style={{ alignSelf: "flex-start" }} />
          </View>
        </View>
      ))}

      {glance.length > 0 && (
        <View style={[J.card, { paddingBottom: 0 }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <Text style={J.cardTitle}>At a glance</Text>
            <Text style={J.caption}>Last 3 years</Text>
          </View>
          <LaneChart lanes={glance} dob={timeline.patient.dob} from={timeline.period.from} to={timeline.period.to} axis="age" fit compact />
          <Pressable accessibilityRole="link" onPress={onOpenTimeline} style={[J.linkRow, { marginTop: 4 }]}>
            <Text style={J.linkText}>Open full timeline</Text>
            <ChevronRight size={18} color="#0F4A3A" strokeWidth={2.4} />
          </Pressable>
        </View>
      )}
    </View>
  );
}
