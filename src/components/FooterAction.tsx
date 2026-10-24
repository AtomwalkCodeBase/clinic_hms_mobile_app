import { Pressable, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { NEUTRAL } from "@/theme/themes";
import { ACTION, ON_ACTION, BUTTON_RADIUS } from "@/theme/buttons";

/**
 * The one button that sits at the bottom of a screen: Add record, Upload, Add a vaccine. Full width on a white strip,
 * 52 high, flat action green. Every screen uses this so they all look the same.
 */
export function FooterAction({ label, onPress, icon: Icon, loading, disabled, above }: {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  /** something to show on the strip above the button (e.g. "Move 3 to Ready to Submit") */
  above?: React.ReactNode;
}) {
  return (
    <View style={styles.bar}>
      {above}
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [styles.btn, (pressed || disabled) && { opacity: 0.85 }]}
      >
        {loading ? <ActivityIndicator color={ON_ACTION} /> : (
          <View style={styles.row}>
            {Icon && <Icon size={20} color={ON_ACTION} strokeWidth={2.4} />}
            <Text style={[styles.text, { color: ON_ACTION }]}>{label}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingTop: 12, paddingBottom: 12, paddingHorizontal: 10, backgroundColor: NEUTRAL.surface, borderTopWidth: 0.5, borderTopColor: NEUTRAL.border },
  btn: { height: 52, borderRadius: BUTTON_RADIUS, backgroundColor: ACTION, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  text: { fontSize: 17, fontWeight: "800" },
});
