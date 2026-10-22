import { Modal, Pressable, View, Text, ScrollView, StyleSheet } from "react-native";
import { ACTION, ON_ACTION } from "@/theme/buttons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CloseButton } from "@/components/IconButtons";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import type { LucideIcon } from "@/theme/icons";

export interface HelpItem { icon: LucideIcon; title: string; text: string }

/** The sheet behind a screen's "?" button: what the screen can do, including the actions that aren't labelled. */
export function HelpSheet({ visible, onClose, items, title = "What you can do here", large = false }: { visible: boolean; onClose: () => void; items: HelpItem[]; title?: string; large?: boolean }) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={[styles.sheet, { paddingBottom: Math.max(18, insets.bottom + 10) }]} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <Text style={[styles.title, large && styles.titleLarge]}>{title}</Text>
            <CloseButton onPress={onClose} />
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {items.map((it) => (
              <View key={it.title} style={styles.item}>
                <it.icon size={large ? 24 : 20} color={theme.fill} strokeWidth={2} style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemTitle, large && styles.itemTitleLarge]}>{it.title}</Text>
                  <Text style={[styles.itemText, large && styles.itemTextLarge]}>{it.text}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
          <Pressable onPress={onClose} style={[styles.done, { backgroundColor: ACTION }]}>
            <Text style={[styles.doneText, { color: ON_ACTION }]}>Got it</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(12,35,64,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: NEUTRAL.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 18, paddingTop: 8, maxHeight: "86%" },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: NEUTRAL.border, alignSelf: "center", marginBottom: 10 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 15.5, fontWeight: "700", color: NEUTRAL.textPrimary },
  item: { flexDirection: "row", gap: 12, marginBottom: 14 },
  titleLarge: { fontSize: 18 },
  itemTitleLarge: { fontSize: 16 },
  itemTextLarge: { fontSize: 14.5, lineHeight: 21, marginTop: 3 },
  itemTitle: { fontSize: 13.5, fontWeight: "600", color: NEUTRAL.textPrimary },
  itemText: { fontSize: 12, color: NEUTRAL.textSecondary, marginTop: 2, lineHeight: 17 },
  done: { marginTop: 4, paddingVertical: 13, borderRadius: 24, alignItems: "center" },
  doneText: { fontSize: 14, fontWeight: "700" },
});
