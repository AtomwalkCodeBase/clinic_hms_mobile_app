import { ScrollView, Pressable, Text, StyleSheet } from "react-native";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  large = false,
}: {
  /** `color`, when given, replaces the shared theme accent for THIS option
   * only — e.g. each family member's own age/gender-derived color, so every
   * pill hints at its owner's color even before it's tapped, not just the
   * active one. Options without a `color` keep the original shared-theme
   * look untouched. */
  options: { key: T; label: string; color?: { fill: string; on: string } }[];
  value: T;
  onChange: (key: T) => void;
  /** Bigger pills and text, for the main switch of a page (Upcoming / Past visits). */
  large?: boolean;
}) {
  const { theme } = useAppTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.row}>
      {options.map((opt) => {
        const active = opt.key === value;
        const fill = opt.color?.fill ?? theme.fill;
        const on = opt.color?.on ?? theme.on;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[
              styles.pill,
              large && styles.pillLarge,
              { borderColor: active ? fill : (opt.color ? fill : NEUTRAL.border), backgroundColor: active ? fill : NEUTRAL.surface },
            ]}
          >
            <Text style={[styles.label, large && styles.labelLarge, { color: active ? on : (opt.color ? fill : NEUTRAL.textPrimary) }]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginBottom: 12 },
  row: { gap: 6, paddingRight: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 0.5 },
  pillLarge: { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 24, borderWidth: 1 },
  label: { fontSize: 11.5, fontWeight: "500" },
  labelLarge: { fontSize: 15, fontWeight: "700" },
});
