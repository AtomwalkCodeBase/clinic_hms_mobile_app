import { Modal, Pressable, View, Text, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check } from "lucide-react-native";
import { CloseButton } from "@/components/IconButtons";
import { NEUTRAL, BRAND_TEXT } from "@/theme/themes";
import { docTypeStyle } from "@/theme/docTypes";
import { useDocumentTypes } from "@/hooks/useDocumentTypes";

/**
 * "Change type" — the one list of categories (from the server) as a bottom sheet: one row per type, each with its own
 * coloured icon, and a green tick on the current one. Used wherever a patient changes a document's type: the review
 * tabs, and the instant-upload confirmation.
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
  const insets = useSafeAreaInsets();
  const { types } = useDocumentTypes();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={[styles.sheet, { paddingBottom: Math.max(18, insets.bottom + 10) }]} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <Text style={styles.title}>Change type</Text>
            <CloseButton onPress={onClose} />
          </View>
          <Text style={styles.help}>Pick what this document is. You can change it again later.</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {types.map((t, i) => {
              const on = t.code === selected;
              const st = docTypeStyle(t.code);
              const Icon = st.Icon;
              return (
                <Pressable
                  key={t.code}
                  onPress={() => onSelect(t.code)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => [styles.row, i > 0 && styles.rowLine, pressed && { backgroundColor: NEUTRAL.surfaceAlt }]}
                >
                  <Icon size={21} color={st.ink} strokeWidth={2} />
                  <Text style={styles.rowText} numberOfLines={1}>{t.label}</Text>
                  {on && <Check size={20} color={BRAND_TEXT} strokeWidth={2.6} />}
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
  sheet: { backgroundColor: NEUTRAL.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 8, maxHeight: "82%" },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: NEUTRAL.border, alignSelf: "center", marginBottom: 10 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 17, fontWeight: "700", color: NEUTRAL.textPrimary },
  help: { fontSize: 12.5, color: NEUTRAL.textSecondary, marginTop: 4, marginBottom: 6, lineHeight: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 4 },
  rowLine: { borderTopWidth: 0.5, borderTopColor: NEUTRAL.border },
  rowText: { flex: 1, fontSize: 15.5, fontWeight: "700", color: NEUTRAL.textPrimary },
});
