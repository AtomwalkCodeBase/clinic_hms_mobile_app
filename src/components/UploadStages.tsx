import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Check } from "lucide-react-native";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";

type StepState = "pending" | "active" | "done";

function Step({ label, detail, state }: { label: string; detail: string; state: StepState }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.step}>
      <View style={[styles.dot, state === "done" && { backgroundColor: theme.fill, borderColor: theme.fill }]}>
        {state === "done" ? <Check size={12} color={theme.on} strokeWidth={3} /> : state === "active" ? <ActivityIndicator size="small" color={theme.fill} style={styles.spinner} /> : null}
      </View>
      <Text style={[styles.label, state === "pending" && { color: NEUTRAL.textMuted }]}>{label}</Text>
      <Text style={[styles.detail, state === "pending" && { color: NEUTRAL.textMuted }]}>{detail}</Text>
    </View>
  );
}

/**
 * What is happening to the files just sent: Upload (the phone sending them), Extracting (the server pulling the text
 * out of each one) and Reading (working out what each one is). The counts come from the documents' own status, so
 * they are the server's real progress, and a file only appears in the list once its reading is finished.
 */
export function UploadStages({
  uploading, uploadPct, total, extracted, read,
}: {
  uploading: boolean;
  uploadPct: number;
  total: number;
  extracted: number;
  read: number;
}) {
  const { theme } = useAppTheme();
  const overall = uploading ? Math.round(uploadPct / 3) : Math.round(100 / 3 + ((extracted + read) / (2 * Math.max(total, 1))) * (200 / 3));
  const extractState: StepState = uploading ? "pending" : extracted >= total ? "done" : "active";
  const readState: StepState = uploading ? "pending" : read >= total ? "done" : "active";

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{uploading ? "Uploading your files" : "Getting your documents ready"}</Text>
      <View style={styles.bar}><View style={[styles.fill, { width: `${overall}%`, backgroundColor: theme.fill }]} /></View>
      <Step
        label="Upload"
        detail={uploading ? `${uploadPct}%` : `Complete · ${total} file${total === 1 ? "" : "s"}`}
        state={uploading ? "active" : "done"}
      />
      <Step label="Extracting text" detail={uploading ? "Waiting" : `${Math.min(extracted, total)} of ${total}`} state={extractState} />
      <Step label="Reading" detail={uploading ? "Waiting" : `${Math.min(read, total)} of ${total}`} state={readState} />
      {!uploading && <Text style={styles.hint}>Each file appears below as soon as it has been read. You can leave this screen; reading carries on.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: NEUTRAL.surface, borderRadius: 14, borderWidth: 0.5, borderColor: NEUTRAL.border, padding: 12, marginBottom: 14 },
  title: { fontSize: 13, fontWeight: "600", color: NEUTRAL.textPrimary },
  bar: { height: 6, borderRadius: 3, backgroundColor: NEUTRAL.surfaceAlt, overflow: "hidden", marginTop: 9, marginBottom: 8 },
  fill: { height: "100%", borderRadius: 3 },
  step: { flexDirection: "row", alignItems: "center", paddingVertical: 5 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: NEUTRAL.border, alignItems: "center", justifyContent: "center", marginRight: 9 },
  spinner: { transform: [{ scale: 0.6 }] },
  label: { flex: 1, fontSize: 12.5, fontWeight: "600", color: NEUTRAL.textPrimary },
  detail: { fontSize: 12, color: NEUTRAL.textSecondary },
  hint: { fontSize: 11, color: NEUTRAL.textMuted, marginTop: 6 },
});
