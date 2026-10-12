import { Modal, Pressable, View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Camera, ChevronRight, Files, X } from "lucide-react-native";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import type { LucideIcon } from "@/theme/icons";

/**
 * "Add documents": the one place the patient chooses how to add files, from Bulk Upload (several files) and from the
 * + in My Documents (one file). The caller does the work: asking whose file it is, the picker, the camera.
 */
export function UploadSheet({
  visible, many, onClose, onFiles, onCamera,
}: {
  visible: boolean;
  /** several files (Bulk Upload) or one (My Documents) */
  many: boolean;
  onClose: () => void;
  onFiles: () => void;
  onCamera: () => void;
}) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const row = (Icon: LucideIcon, title: string, text: string, onPress: () => void) => (
    <Pressable onPress={onPress} style={styles.opt} accessibilityRole="button" accessibilityLabel={title}>
      <View style={[styles.optIcon, { backgroundColor: theme.bg }]}><Icon size={23} color={theme.fill} strokeWidth={2} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.optTitle}>{title}</Text>
        <Text style={styles.optText}>{text}</Text>
      </View>
      <ChevronRight size={18} color={NEUTRAL.textMuted} strokeWidth={2.2} />
    </Pressable>
  );
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={[styles.sheet, { paddingBottom: Math.max(18, insets.bottom + 10) }]} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <Text style={styles.title}>{many ? "Add documents" : "Add document"}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close"><X size={18} color={NEUTRAL.textMuted} strokeWidth={2.2} /></Pressable>
          </View>
          <Text style={styles.sub}>We will read {many ? "them" : "it"} and suggest a type. You check {many ? "each one" : "it"} before submitting.</Text>
          {row(Files, many ? "Choose files" : "Choose a file", many ? "PDFs and photos from your phone" : "One PDF or photo from your phone", onFiles)}
          {row(Camera, "Take photos or scan", "Use the camera on paper documents", onCamera)}
          <Pressable onPress={onClose} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(12,35,64,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: NEUTRAL.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 18, paddingTop: 8 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: NEUTRAL.border, alignSelf: "center", marginBottom: 10 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  title: { fontSize: 15.5, fontWeight: "700", color: NEUTRAL.textPrimary },
  sub: { fontSize: 12, color: NEUTRAL.textSecondary, marginBottom: 14, lineHeight: 17 },
  opt: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 0.5, borderColor: NEUTRAL.border, borderRadius: 14, padding: 12, marginBottom: 10, backgroundColor: NEUTRAL.surface },
  optIcon: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  optTitle: { fontSize: 14, fontWeight: "700", color: NEUTRAL.textPrimary },
  optText: { fontSize: 12, color: NEUTRAL.textSecondary, marginTop: 2 },
  cancel: { alignItems: "center", paddingVertical: 10 },
  cancelText: { fontSize: 13, fontWeight: "600", color: NEUTRAL.textSecondary },
});
