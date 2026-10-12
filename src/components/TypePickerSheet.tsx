import { Modal, Pressable, View, Text, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { NEUTRAL } from "@/theme/themes";
import { docTypeStyle } from "@/theme/docTypes";
import { TypeAvatar } from "@/components/TypeAvatar";
import { useDocumentTypes } from "@/hooks/useDocumentTypes";

/**
 * "Select document type" — the one list of categories (from the server) as a bottom sheet, a coloured two-column grid. Used wherever a patient
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
            <View style={styles.grid}>
              {types.map((t) => {
                const on = t.code === selected;
                const st = docTypeStyle(t.code);
                return (
                  <Pressable
                    key={t.code}
                    onPress={() => onSelect(t.code)}
                    style={[styles.cell, { backgroundColor: st.tint, borderColor: on ? st.ink : "transparent" }]}
                  >
                    <TypeAvatar code={t.code} size={34} selected={on} onTint />
                    <Text style={[styles.cellText, { color: st.ink }]} numberOfLines={2}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>
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
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingBottom: 6 },
  cell: { width: "47.5%", flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 14, borderWidth: 1.5 },
  cellText: { flex: 1, fontSize: 13.5, fontWeight: "700" },
});
