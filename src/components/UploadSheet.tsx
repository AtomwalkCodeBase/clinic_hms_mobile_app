import { Pressable, View, Text, StyleSheet } from "react-native";
import { SheetModal } from "@/components/SheetModal";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Camera, Files } from "lucide-react-native";
import { CloseButton } from "@/components/IconButtons";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import type { LucideIcon } from "@/theme/icons";
import { LIMITS_LINE, SINGLE_LIMITS_LINE } from "@/utils/uploadLimits";

/**
 * "Add documents": the one place the patient chooses how to add files, from Bulk Upload (several files, chosen from the
 * phone) and from the + in My Documents (one file, chosen or photographed). The caller does the work: asking whose file
 * it is, the picker, the camera. Only a caller that passes `onCamera` gets the camera option.
 */
export function UploadSheet({
  visible, many, onClose, onFiles, onCamera,
}: {
  visible: boolean;
  /** several files (Bulk Upload) or one (My Documents) */
  many: boolean;
  onClose: () => void;
  onFiles: () => void;
  onCamera?: () => void;
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
    <SheetModal visible={visible} onClose={onClose}>
      <>
        <View style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom + 16) }]} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <Text style={styles.title}>{many ? "Add documents" : "Add document"}</Text>
            <CloseButton onPress={onClose} style={styles.close} />
          </View>
          <Text style={styles.lead}>{many ? "Choose several files from your phone." : "Choose a file or take a photo."}</Text>
          <Text style={styles.sub}>{many ? "We read them and suggest a type for each." : "We read it and suggest a type."}</Text>
          <Text style={styles.limits}>{many ? LIMITS_LINE : SINGLE_LIMITS_LINE}. Photos are made smaller automatically.</Text>
          {row(Files, many ? "Choose files" : "Choose a file", onFiles)}
          {onCamera && row(Camera, "Take photo or scan", onCamera)}
          <Pressable onPress={onClose} style={styles.cancel} accessibilityRole="button" accessibilityLabel="Cancel">
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: NEUTRAL.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20,
    paddingTop: 12, minHeight: "38%",
  },
  handle: { width: 42, height: 5, borderRadius: 3, backgroundColor: NEUTRAL.border, alignSelf: "center", marginBottom: 14 },
  head: { alignItems: "center", justifyContent: "center", minHeight: 30 },
  title: { fontSize: 21, fontWeight: "800", color: NEUTRAL.textPrimary, textAlign: "center" },
  close: { position: "absolute", right: 0, top: 3 },
  lead: { fontSize: 15, fontWeight: "600", color: NEUTRAL.textPrimary, textAlign: "center", marginTop: 6 },
  sub: { fontSize: 13.5, color: NEUTRAL.textSecondary, textAlign: "center", marginTop: 3 },
  limits: { fontSize: 12, color: NEUTRAL.textMuted, textAlign: "center", marginTop: 6, marginBottom: 18 },
  // The icon sits in the same place on every option, the title is centred between it and an equal empty box.
  opt: {
    flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: NEUTRAL.border,
    borderRadius: 18, paddingVertical: 16, paddingHorizontal: 16, marginBottom: 12, backgroundColor: NEUTRAL.surface,
  },
  optIcon: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  cancel: { alignItems: "center", paddingVertical: 12 },
  cancelText: { fontSize: 15, fontWeight: "700", color: NEUTRAL.textSecondary },
  optTitle: { flex: 1, fontSize: 18, fontWeight: "800", color: NEUTRAL.textPrimary, textAlign: "center" },
});
