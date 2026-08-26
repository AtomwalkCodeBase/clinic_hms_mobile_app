import React from "react";
import { ScrollView, Pressable, Text, StyleSheet } from "react-native";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  const { theme } = useAppTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.row}>
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[
              styles.pill,
              { borderColor: active ? theme.fill : NEUTRAL.border, backgroundColor: active ? theme.fill : NEUTRAL.surface },
            ]}
          >
            <Text style={[styles.label, { color: active ? theme.on : NEUTRAL.textPrimary }]}>{opt.label}</Text>
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
  label: { fontSize: 11.5, fontWeight: "500" },
});
