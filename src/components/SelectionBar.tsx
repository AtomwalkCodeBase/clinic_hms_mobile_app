import { View, Text, Pressable, StyleSheet } from "react-native";
import { CARD, CARD_TEXT } from "@/theme/cardSizes";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";

/** Shown while files are selected: "3 selected", Select all, Cancel. It stays pinned under the header. */
export function SelectionStrip({ count, onSelectAll, onCancel }: { count: number; onSelectAll: () => void; onCancel: () => void }) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.strip, { borderColor: theme.fill }]}>
      <Text style={styles.stripCount}>{count} selected</Text>
      <Pressable onPress={onSelectAll} hitSlop={8}><Text style={[styles.stripLink, { color: theme.text }]}>Select all</Text></Pressable>
      <Pressable onPress={onCancel} hitSlop={8}><Text style={[styles.stripLink, { color: NEUTRAL.textSecondary }]}>Cancel</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: NEUTRAL.successBg, borderWidth: 1, borderRadius: CARD.radius, paddingVertical: 11, paddingHorizontal: 14, marginBottom: CARD.gap },
  stripCount: { flex: 1, fontSize: CARD_TEXT.body, fontWeight: "700", color: NEUTRAL.textPrimary },
  stripLink: { fontSize: CARD_TEXT.body, fontWeight: "700" },
});
