import { View, Text, Pressable, StyleSheet } from "react-native";
import { AlertTriangle, X } from "lucide-react-native";
import { NEUTRAL } from "@/theme/themes";
import { CARD } from "@/theme/cardSizes";
import { useDocumentUpload } from "@/context/DocumentUploadContext";

const SHOWN = 4;

/**
 * Files that were left out of an upload, each with the reason: over the size limit, the wrong kind of file, empty. It
 * stays until it is dismissed (or the next upload starts), so a file that did not go is never missed. Renders nothing
 * when every file went.
 */
export function SkippedFilesNotice() {
  const { skippedFiles, clearSkippedFiles } = useDocumentUpload();
  if (!skippedFiles.length) return null;
  const n = skippedFiles.length;
  return (
    <View style={styles.card} accessibilityRole="alert">
      <View style={styles.top}>
        <AlertTriangle size={18} color={NEUTRAL.warning} strokeWidth={2.2} />
        <Text style={styles.title}>{n === 1 ? "1 file wasn't uploaded" : `${n} files weren't uploaded`}</Text>
        <Pressable onPress={clearSkippedFiles} hitSlop={10} accessibilityLabel="Dismiss"><X size={15} color={NEUTRAL.textMuted} /></Pressable>
      </View>
      {skippedFiles.slice(0, SHOWN).map((f, i) => (
        <Text key={`${f.name}-${i}`} style={styles.line}>
          <Text style={styles.name}>{f.name}</Text>
          {` — ${f.reason}`}
        </Text>
      ))}
      {n > SHOWN && <Text style={styles.line}>…and {n - SHOWN} more</Text>}
      <Text style={styles.foot}>Your other files are not affected. Make {n === 1 ? "this file" : "these files"} smaller and add {n === 1 ? "it" : "them"} again.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: NEUTRAL.warningBg, borderRadius: CARD.radius, borderWidth: 0.5, borderColor: NEUTRAL.border, padding: CARD.padding, marginBottom: CARD.gap },
  top: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  title: { flex: 1, fontSize: 13, fontWeight: "700", color: NEUTRAL.textPrimary },
  line: { fontSize: 12, color: NEUTRAL.textSecondary, marginTop: 3 },
  name: { fontWeight: "700", color: NEUTRAL.textPrimary },
  foot: { fontSize: 11.5, color: NEUTRAL.textMuted, marginTop: 8 },
});
