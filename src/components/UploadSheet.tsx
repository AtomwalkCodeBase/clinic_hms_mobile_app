import { Modal, Pressable, View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Camera, Files } from "lucide-react-native";
import { CloseButton } from "@/components/IconButtons";
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
  const row = (Icon: LucideIcon, title: string, onPress: () => void) => (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.opt, pressed && { backgroundColor: NEUTRAL.surfaceAlt }]} accessibilityRole="button" accessibilityLabel={title}>
      <View style={[styles.optIcon, { backgroundColor: theme.bg }]}><Icon size={26} color={theme.fill} strokeWidth={2} /></View>
      <Text style={styles.optTitle}>{title}</Text>
      <View style={styles.optIcon} />
    </Pressable>
  );
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom + 16) }]} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <Text style={styles.title}>{many ? "Add documents" : "Add document"}</Text>
            <CloseButton onPress={onClose} style={styles.close} />
          </View>
          <Text style={styles.lead}>{many ? "Upload multiple files or take photos." : "Upload a single file or take a photo."}</Text>
          <Text style={styles.sub}>We read them and suggest a type for each.</Text>
          {row(Files, many ? "Choose files" : "Choose a file", onFiles)}
          {row(Camera, many?"Take photos":"Take photo or scan", onCamera)}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(12,35,64,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: NEUTRAL.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20,
    paddingTop: 12, minHeight: "38%",
  },
  handle: { width: 42, height: 5, borderRadius: 3, backgroundColor: NEUTRAL.border, alignSelf: "center", marginBottom: 14 },
  head: { alignItems: "center", justifyContent: "center", minHeight: 30 },
  title: { fontSize: 21, fontWeight: "800", color: NEUTRAL.textPrimary, textAlign: "center" },
  close: { position: "absolute", right: 0, top: 3 },
  lead: { fontSize: 15, fontWeight: "600", color: NEUTRAL.textPrimary, textAlign: "center", marginTop: 6 },
  sub: { fontSize: 13.5, color: NEUTRAL.textSecondary, textAlign: "center", marginTop: 3, marginBottom: 18 },
  // The icon sits in the same place on every option, the title is centred between it and an equal empty box.
  opt: {
    flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: NEUTRAL.border,
    borderRadius: 18, paddingVertical: 16, paddingHorizontal: 16, marginBottom: 12, backgroundColor: NEUTRAL.surface,
  },
  optIcon: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  optTitle: { flex: 1, fontSize: 18, fontWeight: "800", color: NEUTRAL.textPrimary, textAlign: "center" },
});
