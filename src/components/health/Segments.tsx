import { Pressable, StyleSheet, Text, View } from "react-native";
import { NEUTRAL } from "@/theme/themes";
import { ACTION, ON_ACTION } from "@/theme/buttons";
import { INK, MIN_TAP } from "./journeyTheme";

type Option<T extends string> = { key: T; label: string };

/**
 * The four sections under the header: equal-width pills that always fit the screen. The text shrinks a little rather
 * than running off the edge.
 */
export function PillTabs<T extends string>({ options, value, onChange, label }: { options: Option<T>[]; value: T; onChange: (k: T) => void; label: string }) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={styles.tabRow}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(o.key)}
            style={[styles.tab, on ? { backgroundColor: ACTION, borderColor: ACTION } : { backgroundColor: NEUTRAL.surface, borderColor: NEUTRAL.border }]}>
            <Text style={[styles.tabText, { color: on ? ON_ACTION : INK }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A grouped bar of equal options (the period, or Weight / Height / Head size): the active one sits on a white thumb. */
export function SegmentBar<T extends string>({ options, value, onChange, label }: { options: Option<T>[]; value: T; onChange: (k: T) => void; label: string }) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={styles.bar}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(o.key)}
            style={[styles.seg, on && styles.segOn]}>
            <Text style={[styles.segText, on && { color: INK, fontWeight: "700" }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabRow: { flexDirection: "row", gap: 5 },
  tab: { flex: 1, minWidth: 0, minHeight: MIN_TAP - 2, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  tabText: { fontSize: 13, fontWeight: "700" },
  bar: { flexDirection: "row", gap: 2, padding: 2, borderRadius: 14, backgroundColor: "#E3E9EE" },
  seg: { flex: 1, minWidth: 0, minHeight: MIN_TAP - 4, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 2 },
  segOn: { backgroundColor: NEUTRAL.surface, borderWidth: 1, borderColor: NEUTRAL.border },
  segText: { fontSize: 12.5, color: NEUTRAL.textSecondary },
});
