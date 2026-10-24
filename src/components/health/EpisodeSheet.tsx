import { StyleSheet, Text, View } from "react-native";
import { FileText } from "lucide-react-native";
import { DetailSheet } from "@/components/DetailSheet";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { NEUTRAL } from "@/theme/themes";
import { LaneChart } from "./LaneChart";
import { ChipRow } from "./JourneyBits";
import { Marker } from "./Marker";
import { SOFT_LINE } from "./journeyTheme";
import type { EpisodeModel, LaneModel } from "@/utils/journey";

/**
 * The details of one condition, as the sheet that slides up when its mark or card is tapped: why it is marked, a small
 * chart of just this condition, every episode with its report, and a way to book a follow-up.
 */
export function EpisodeSheet({
  model, lane, dob, onClose, onReport, onBook,
}: {
  model: EpisodeModel | null;
  lane: LaneModel | null;
  dob: string;
  onClose: () => void;
  onReport: (documentId: number) => void;
  onBook: (complaint: string) => void;
}) {
  if (!model || !lane) return null;
  const strip: LaneModel = { ...lane, label: `Episodes (${model.rows.length})`, recurrent: false };
  return (
    <DetailSheet visible onClose={onClose} title={model.title}>
      <ChipRow chips={model.chips} />
      {model.lines.length > 0 && (
        <View style={styles.why}>
          <Text style={styles.whyTitle}>Why this is marked</Text>
          {model.lines.map((l) => <Text key={l} style={styles.whyText}>{l}</Text>)}
        </View>
      )}
      <View style={{ marginTop: 12 }}>
        <LaneChart lanes={[strip]} dob={dob} from={model.from} to={model.to} axis="date" fit compact />
      </View>
      <Text style={styles.heading}>Episodes</Text>
      {model.rows.map((r) => (
        <View key={r.key} style={styles.row}>
          <Marker shape={r.critical ? "diamond" : model.chronic ? "bar" : "dot"} tone={r.critical ? "critical" : model.chronic ? "chronic" : "acute"} size={12} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.rowTitle}>{r.range}</Text>
            <Text style={styles.rowMeta}>
              Age {r.age} · {r.visits} doctor visit{r.visits === 1 ? "" : "s"}{r.critical ? ` · ${r.severityLabel}` : ""}
            </Text>
          </View>
          {r.documentId ? <SecondaryButton label="Report" icon={FileText} compact onPress={() => onReport(r.documentId!)} style={{ alignSelf: "center" }} /> : null}
        </View>
      ))}
      <View style={{ marginTop: 14 }}>
        <PrimaryButton label="Book a follow-up" onPress={() => onBook(`Follow-up: ${model.title}`)} />
      </View>
    </DetailSheet>
  );
}

const styles = StyleSheet.create({
  why: { backgroundColor: NEUTRAL.surfaceAlt, borderRadius: 14, padding: 12, gap: 5, marginTop: 10 },
  whyTitle: { fontSize: 15, fontWeight: "700", color: NEUTRAL.textPrimary },
  whyText: { fontSize: 13.5, lineHeight: 19, color: NEUTRAL.textPrimary },
  heading: { fontSize: 15, fontWeight: "700", color: NEUTRAL.textPrimary, marginTop: 14, marginBottom: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 9, borderTopWidth: 1, borderTopColor: SOFT_LINE },
  rowTitle: { fontSize: 14, fontWeight: "600", color: NEUTRAL.textPrimary },
  rowMeta: { fontSize: 12, color: NEUTRAL.textSecondary, marginTop: 1 },
});
