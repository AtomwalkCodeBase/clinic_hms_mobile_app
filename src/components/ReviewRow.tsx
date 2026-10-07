import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { FileText, Image as ImageIcon } from "lucide-react-native";
import type { PatientDocument } from "@/api/types";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { isEdited, isReviewable, currentType, ReviewEntry } from "@/utils/reviewDraft";

/**
 * One uploaded file on the Bulk Upload screen.
 *   Needs Review   the file, what the system made of it ("Classified as Lab Report" + its score, or "Your selection:
 *                  Prescription" once changed) and two captioned buttons on the right: Confirm / Change.
 *   Ready to Submit the file and its final type, with a "Move back" link.
 * A file that is still being read, or could not be read, shows that instead of the buttons.
 */
export function ReviewRow({
  doc, entry, mode, labelOf, onView, onConfirm, onChange, onMoveBack, onRetry, onDismiss,
}: {
  doc: PatientDocument;
  entry?: ReviewEntry;
  mode: "review" | "ready";
  labelOf: (code?: string | null) => string;
  onView: () => void;
  onConfirm: () => void;
  onChange: () => void;
  onMoveBack: () => void;
  onRetry: () => void;
  /** remove a file that failed (only offered for a failed file) */
  onDismiss?: () => void;
}) {
  const { theme } = useAppTheme();
  const isImage = doc.mime_type?.startsWith("image/");
  const Icon = isImage ? ImageIcon : FileText;
  const type = currentType(doc, entry);
  const edited = isEdited(entry);
  const working = !isReviewable(doc) && doc.processing_status !== "failed";
  const failed = doc.processing_status === "failed";

  let line: React.ReactNode;
  if (working) {
    line = <Text style={styles.sub}>Reading your document…</Text>;
  } else if (failed) {
    line = <Text style={[styles.sub, { color: NEUTRAL.danger }]} numberOfLines={2}>{doc.error || "Couldn't read this file"}</Text>;
  } else if (mode === "ready") {
    line = <Text style={styles.sub}>{labelOf(type)}{edited ? "  ·  edited" : ""}</Text>;
  } else if (type) {
    line = (
      <View style={styles.lineRow}>
        <Text style={styles.sub} numberOfLines={2}>
          {edited ? "Your selection: " : "Classified as "}
          <Text style={styles.subStrong}>{labelOf(type)}</Text>
        </Text>
        {edited ? <Text style={styles.edited}>edited</Text>: null }
      </View>
    );
  } else {
    line = <Text style={[styles.sub, { color: NEUTRAL.warning }]}>Not classified — choose a type</Text>;
  }

  return (
    <View style={styles.row}>
      <Pressable onPress={onView} style={styles.left}>
        <View style={[styles.icon, { backgroundColor: NEUTRAL.surfaceAlt }]}>
          {working ? <ActivityIndicator size="small" color={theme.fill} /> : <Icon size={18} color={NEUTRAL.textSecondary} strokeWidth={2} />}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>{doc.file_name || doc.title}</Text>
          {line}
        </View>
      </Pressable>

      {failed ? (
        <View style={styles.failActions}>
          <Pressable onPress={onRetry} hitSlop={8} style={styles.retry}><Text style={[styles.retryText, { color: theme.text }]}>Try again</Text></Pressable>
          {onDismiss && <Pressable onPress={onDismiss} hitSlop={8} style={styles.retry}><Text style={[styles.retryText, { color: NEUTRAL.textMuted }]}>Remove</Text></Pressable>}
        </View>
      ) : working ? null : mode === "ready" ? (
        <Pressable onPress={onMoveBack} hitSlop={8}><Text style={[styles.moveBack, { color: theme.text }]}>Move back</Text></Pressable>
      ) : (
        <View style={styles.buttons}>
          <View style={styles.btnCol}>
            <Text style={styles.caption}>Looks right</Text>
            <Pressable onPress={onConfirm} style={[styles.btn, { backgroundColor: theme.fill }, !type && { opacity: 0.45 }]}>
              <Text style={[styles.btnText, { color: theme.on }]}>Confirm</Text>
            </Pressable>
          </View>
          <View style={styles.btnCol}>
            <Text style={styles.caption}>Not right</Text>
            <Pressable onPress={onChange} style={[styles.btn, styles.btnOutline]}>
              <Text style={[styles.btnText, { color: NEUTRAL.textPrimary }]}>Change</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: NEUTRAL.surface, borderRadius: 14, borderWidth: 0.5, borderColor: NEUTRAL.border, padding: 10, marginBottom: 8 },
  left: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 9 },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 13, fontWeight: "600", color: NEUTRAL.textPrimary },
  lineRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginTop: 3 },
  sub: { fontSize: 11.5, color: NEUTRAL.textSecondary, marginTop: 3 },
  subStrong: { fontWeight: "700", color: NEUTRAL.textPrimary },
  edited: { fontSize: 10.5, color: NEUTRAL.warning, backgroundColor: NEUTRAL.warningBg, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, marginLeft: 6, overflow: "hidden" },
  buttons: { flexDirection: "row", gap: 6 },
  btnCol: { width: 66, alignItems: "stretch" },
  caption: { fontSize: 10.5, color: NEUTRAL.textMuted, textAlign: "center", marginBottom: 3 },
  btn: { paddingVertical: 7, borderRadius: 9, alignItems: "center" },
  btnOutline: { borderWidth: 0.5, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface },
  btnText: { fontSize: 11.5, fontWeight: "700" },
  moveBack: { fontSize: 12, fontWeight: "600" },
  failActions: { alignItems: "flex-end", gap: 6 },
  retry: { paddingHorizontal: 4 },
  retryText: { fontSize: 12, fontWeight: "700" },
});
