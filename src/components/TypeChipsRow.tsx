import { ScrollView, Pressable, Text, View, StyleSheet } from "react-native";
import { docTypeStyle } from "@/theme/docTypes";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { TypeAvatar } from "@/components/TypeAvatar";

/**
 * A sideways-scrolling row of filter chips: "All files" first, then one chip per document type with its count. The
 * caller builds `items` from what is actually there, so only types that exist get a chip. Tapping a chip selects it
 * (the caller filters its list); tapping the selected chip again, or "All files", clears the filter.
 */
export function TypeChipsRow({
  items, total, selected, onSelect, labelOf, allLabel = "All files", trailing,
}: {
  items: { code: string; count: number }[];
  total: number;
  /** the type code being filtered on, or "" for everything */
  selected: string;
  onSelect: (code: string) => void;
  labelOf: (code?: string | null) => string;
  allLabel?: string;
  /** fixed at the right end of the row, outside the scrolling chips (the list / grid switch) */
  trailing?: React.ReactNode;
}) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.row}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.content}>
      <Pressable
        onPress={() => onSelect("")}
        style={[styles.chip, !selected && { backgroundColor: theme.fill, borderColor: theme.fill }]}
      >
        <Text style={[styles.count, !selected && { color: theme.on }]}>{total}</Text>
        <Text style={[styles.name, !selected && { color: theme.on }]}>{allLabel}</Text>
      </Pressable>
      {items.map((it) => {
        const s = docTypeStyle(it.code);
        const on = selected === it.code;
        return (
          <Pressable
            key={it.code}
            onPress={() => onSelect(on ? "" : it.code)}
            style={[styles.chip, on && { backgroundColor: s.tint, borderColor: s.ink }]}
          >
            <TypeAvatar code={it.code} size={22} onTint={on} />
            <Text style={[styles.count, { color: s.ink }]}>{it.count}</Text>
            <Text style={[styles.name, on && { color: s.ink }]} numberOfLines={1}>{labelOf(it.code)}</Text>
          </Pressable>
        );
      })}
      <View style={{ width: 4 }} />
    </ScrollView>
    {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  scroll: { flex: 1, flexGrow: 1 },
  content: { gap: 8, paddingRight: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4, paddingLeft: 5, paddingRight: 10, minHeight: 32, borderRadius: 16, borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface },
  count: { fontSize: 12.5, fontWeight: "800", color: NEUTRAL.textPrimary },
  name: { fontSize: 12, fontWeight: "600", color: NEUTRAL.textSecondary },
});
