import { Modal, Pressable, View, Text, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, X } from "lucide-react-native";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { useDocumentTypes } from "@/hooks/useDocumentTypes";

/**
 * "Select document type" — the one list of categories (from the server) as a bottom sheet. Used wherever a patient
 * changes a document's type: the review tabs, and the instant-upload confirmation.
 */
export function TypePickerSheet({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  /** the type currently chosen for the file, if any */
  selected?: string | null;
  onSelect: (code: string) => void;
  onClose: () => void;
}) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { types } = useDocumentTypes();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={[styles.sheet, { paddingBottom: Math.max(18, insets.bottom + 10) }]} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <Text style={styles.title}>Select document type</Text>
            <Pressable onPress={onClose} hitSlop={10}><X size={18} color={NEUTRAL.textMuted} strokeWidth={2.2} /></Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {types.map((t) => {
              const on = t.code === selected;
              return (
                <Pressable key={t.code} onPress={() => onSelect(t.code)} style={[styles.opt, on && { backgroundColor: NEUTRAL.successBg }]}>
                  <Text style={[styles.optText, on && { color: NEUTRAL.success, fontWeight: "700" }]}>{t.label}</Text>
                  {on && <Check size={16} color={theme.fill} strokeWidth={2.6} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(12,35,64,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: NEUTRAL.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 14, paddingTop: 8, maxHeight: "78%" },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: NEUTRAL.border, alignSelf: "center", marginBottom: 10 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6, paddingHorizontal: 4 },
  title: { fontSize: 15, fontWeight: "700", color: NEUTRAL.textPrimary },
  opt: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 13, paddingHorizontal: 12, borderRadius: 10 },
  optText: { fontSize: 14, color: NEUTRAL.textPrimary },
});
