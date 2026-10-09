import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { FileText, Image as ImageIcon, Trash2 } from "lucide-react-native";
import type { PatientDocument } from "@/api/types";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { isEdited, isReviewable, currentType, ReviewEntry } from "@/utils/reviewDraft";
import { CARD, CARD_ICON, CARD_TEXT } from "@/theme/cardSizes";

/**
 * One uploaded file on the Bulk Upload screen.
 *   Needs Review   the file, what the system made of it ("Classified as Lab Report" or "Your selection: Prescription"
 *                  once changed, "Not classified" when the rules couldn't tell) and, under it, Confirm / Change.
 *   Ready to Submit the file and its final type, with a "Move back" link.
 * A file that is still being read shows that instead of any buttons, and has no delete icon: the server is still using
 * it. Every file that has been read, and every file that failed, has a red delete icon at the right.
 */
export function ReviewRow({
  doc, entry, mode, labelOf, onView, onConfirm, onChange, onMoveBack, onRetry, onDelete,
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
  /** delete the file for good (asks first); offered once the file has been read, and for a file that failed */
  onDelete: () => void;
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
      <View style={styles.top}>
        <Pressable onPress={onView} style={styles.left}>
          <View style={[styles.icon, { backgroundColor: NEUTRAL.surfaceAlt }]}>
            {working ? <ActivityIndicator size="small" color={theme.fill} /> : <Icon size={20} color={NEUTRAL.textSecondary} strokeWidth={2} />}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name} numberOfLines={1}>{doc.file_name || doc.title}</Text>
            {line}
            {failed && (
              <Pressable onPress={onRetry} hitSlop={8} style={styles.sideLink}>
                <Text style={[styles.sideLinkText, { color: theme.text }]}>Try again</Text>
              </Pressable>
            )}
            {!failed && !working && mode === "ready" && (
              <Pressable onPress={onMoveBack} hitSlop={8} style={styles.sideLink}>
                <Text style={[styles.sideLinkText, { color: theme.text }]}>Move back</Text>
              </Pressable>
            )}
          </View>
        </Pressable>

        {!working && (
          <Pressable onPress={onDelete} hitSlop={6} style={styles.del} accessibilityRole="button" accessibilityLabel="Delete this file">
            <Trash2 size={19} color={NEUTRAL.danger} strokeWidth={2} />
          </Pressable>
        )}
      </View>

      {!failed && !working && mode === "review" && (
        <View style={styles.buttons}>
          <Pressable onPress={onConfirm} style={[styles.btn, { backgroundColor: theme.fill }, !type && { opacity: 0.45 }]}>
            <Text style={[styles.btnText, { color: theme.on }]}>Confirm</Text>
          </Pressable>
          <Pressable onPress={onChange} style={[styles.btn, styles.btnOutline]}>
            <Text style={[styles.btnText, { color: NEUTRAL.textPrimary }]}>Change</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { backgroundColor: NEUTRAL.surface, borderRadius: CARD.radius, borderWidth: 0.5, borderColor: NEUTRAL.border, padding: CARD.padding, marginBottom: CARD.gap },
  top: { flexDirection: "row", alignItems: "center", gap: 10 },
  left: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: CARD_ICON, height: CARD_ICON, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  name: { fontSize: CARD_TEXT.title, fontWeight: "600", color: NEUTRAL.textPrimary },
  lineRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginTop: 3 },
  sub: { fontSize: CARD_TEXT.meta, color: NEUTRAL.textSecondary, marginTop: 3 },
  subStrong: { fontWeight: "700", color: NEUTRAL.textPrimary },
  edited: { fontSize: CARD_TEXT.tiny, color: NEUTRAL.warning, backgroundColor: NEUTRAL.warningBg, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 8, marginLeft: 6, overflow: "hidden" },
  sideLink: { alignSelf: "flex-start", marginTop: 6 },
  sideLinkText: { fontSize: CARD_TEXT.body, fontWeight: "600" },
  del: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: NEUTRAL.dangerBg, borderWidth: 0.5, borderColor: NEUTRAL.danger },
  buttons: { flexDirection: "row", gap: 10, marginTop: 12 },
  btn: { flex: 1, paddingVertical: 11, borderRadius: 11, alignItems: "center" },
  btnOutline: { borderWidth: 0.5, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface },
  btnText: { fontSize: CARD_TEXT.body, fontWeight: "700" },
});
