import { Modal, Pressable, View, Text, ScrollView, StyleSheet } from "react-native";
import { ACTION, ON_ACTION } from "@/theme/buttons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CloseButton } from "@/components/IconButtons";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import type { LucideIcon } from "@/theme/icons";

export interface HelpItem { icon: LucideIcon; title: string; text: string }

/** The sheet behind a screen's "?" button: what the screen can do, including the actions that aren't labelled. */
export function HelpSheet({ visible, onClose, items, title = "What you can do here" }: { visible: boolean; onClose: () => void; items: HelpItem[]; title?: string }) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        {/* The tap-outside-to-close area sits behind the sheet, not around it: a touch handler on a parent of the list takes the
            touch first and blocks the list from scrolling. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: Math.max(18, insets.bottom + 10) }]}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <Text style={styles.title}>{title}</Text>
            <CloseButton onPress={onClose} />
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={styles.list} contentContainerStyle={styles.listContent} nestedScrollEnabled>
            {items.map((it) => (
              <View key={it.title} style={styles.item}>
                <it.icon size={22} color={theme.fill} strokeWidth={2} style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{it.title}</Text>
                  <Text style={styles.itemText}>{it.text}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
          <Pressable onPress={onClose} style={[styles.done, { backgroundColor: ACTION }]}>
            <Text style={[styles.doneText, { color: ON_ACTION }]}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(12,35,64,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: NEUTRAL.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 18, paddingTop: 8, maxHeight: "86%" },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: NEUTRAL.border, alignSelf: "center", marginBottom: 10 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 16.5, fontWeight: "700", color: NEUTRAL.textPrimary },
  list: { flexShrink: 1 },
  listContent: { paddingBottom: 4 },
  item: { flexDirection: "row", gap: 12, marginBottom: 14 },
  itemTitle: { fontSize: 14.5, fontWeight: "600", color: NEUTRAL.textPrimary },
  itemText: { fontSize: 13.5, color: NEUTRAL.textSecondary, marginTop: 2, lineHeight: 19 },
  done: { marginTop: 4, paddingVertical: 13, borderRadius: 24, alignItems: "center" },
  doneText: { fontSize: 14, fontWeight: "700" },
});
