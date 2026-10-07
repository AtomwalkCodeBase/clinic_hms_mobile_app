import { View, Text, Pressable, StyleSheet } from "react-native";
import { Check, X } from "lucide-react-native";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { ReadyState, useDocumentUpload } from "@/context/DocumentUploadContext";

/**
 * A slim bar for files that were just uploaded: a progress bar while the server reads them, then "ready to review"
 * with a Review button once they have been (the same message goes out as a notification if the app is in the
 * background). Renders nothing when there is nothing to report.
 */
export function UploadStatusBar({ onReview }: { onReview: (ready: ReadyState) => void }) {
  const { theme } = useAppTheme();
  const { reading, ready, clearReady } = useDocumentUpload();

  if (reading) {
    const pct = Math.max(8, Math.round((reading.finished / reading.total) * 100));      // never an empty bar
    return (
      <View style={styles.card}>
        <View style={styles.top}>
          <Text style={styles.title}>Reading your document{reading.total === 1 ? "" : "s"}…</Text>
          {reading.total > 1 && <Text style={styles.num}>{reading.finished} of {reading.total}</Text>}
        </View>
        <View style={styles.bar}><View style={[styles.fill, { width: `${pct}%`, backgroundColor: theme.fill }]} /></View>
        <Text style={styles.hint}>You can keep using the app. We'll tell you when it's ready.</Text>
      </View>
    );
  }

  if (ready) {
    const n = ready.ids.length;
    const text = n
      ? `${n === 1 ? "Your document is" : `${n} documents are`} ready to review${ready.failed ? `, ${ready.failed} couldn't be read` : ""}`
      : `${ready.failed === 1 ? "A document" : `${ready.failed} documents`} couldn't be read`;
    return (
      <View style={[styles.card, styles.readyCard]}>
        <View style={[styles.tick, { backgroundColor: n ? theme.fill : NEUTRAL.warning }]}>
          <Check size={12} color="#fff" strokeWidth={3} />
        </View>
        <Text style={styles.readyText}>{text}</Text>
        <Pressable onPress={() => { clearReady(); onReview(ready); }} hitSlop={8}>
          <Text style={[styles.action, { color: theme.text }]}>{n ? "Review" : "Open"}</Text>
        </Pressable>
        <Pressable onPress={clearReady} hitSlop={10} accessibilityLabel="Dismiss"><X size={15} color={NEUTRAL.textMuted} /></Pressable>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  card: { backgroundColor: NEUTRAL.surface, borderRadius: 14, borderWidth: 0.5, borderColor: NEUTRAL.border, padding: 12, marginBottom: 12 },
  readyCard: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 13, fontWeight: "600", color: NEUTRAL.textPrimary },
  num: { fontSize: 12, color: NEUTRAL.textSecondary },
  bar: { height: 5, borderRadius: 3, backgroundColor: NEUTRAL.surfaceAlt, overflow: "hidden", marginTop: 9 },
  fill: { height: "100%", borderRadius: 3 },
  hint: { fontSize: 11, color: NEUTRAL.textMuted, marginTop: 8 },
  tick: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  readyText: { flex: 1, fontSize: 12.5, fontWeight: "600", color: NEUTRAL.textPrimary },
  action: { fontSize: 13, fontWeight: "700" },
});
