import { Pressable, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { LucideIcon } from "lucide-react-native";
import { NEUTRAL, HEADER_GRADIENT } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";

/**
 * The one button that sits at the bottom of a screen: Add record, Upload, Add a vaccine. Full width on a white strip,
 * 52 high, flat corners, gradient fill. Every screen uses this so they all look the same.
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
  const { theme } = useAppTheme();
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
        <LinearGradient colors={HEADER_GRADIENT} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        {loading ? <ActivityIndicator color={theme.on} /> : (
          <View style={styles.row}>
            {Icon && <Icon size={20} color={theme.on} strokeWidth={2.4} />}
            <Text style={[styles.text, { color: theme.on }]}>{label}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingTop: 12, paddingBottom: 12, paddingHorizontal: 10, backgroundColor: NEUTRAL.surface, borderTopWidth: 0.5, borderTopColor: NEUTRAL.border },
  btn: { height: 52, borderRadius: 8, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  text: { fontSize: 17, fontWeight: "800" },
});
