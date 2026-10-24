import { Pressable, Text, View, StyleSheet, ActivityIndicator, ViewStyle } from "react-native";
import type { LucideIcon } from "@/theme/icons";
import { BRAND_TEXT, NEUTRAL } from "@/theme/themes";
import { ACTION, ON_ACTION, BUTTON_RADIUS, DANGER_LINE } from "@/theme/buttons";
import { useAppTheme } from "@/context/ThemeContext";

interface ButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  /** Smaller padding + type, sized to content instead of stretching — for secondary row actions (Cancel/Reschedule) that shouldn't read as big primary CTAs. */
  compact?: boolean;
}

/** The main button of a screen: flat action green with white text. A caller may pass its own backgroundColor (the red of a destructive confirm). */
export function PrimaryButton({ label, onPress, loading, disabled, style, compact, icon: Icon }: ButtonProps & { icon?: LucideIcon }) {
  const flatStyle = StyleSheet.flatten([style]) as { backgroundColor?: string } | undefined;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        { backgroundColor: flatStyle?.backgroundColor || ACTION, opacity: disabled ? 0.5 : pressed ? 0.9 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={ON_ACTION} size={compact ? "small" : undefined} />
      ) : (
        <View style={styles.content}>
          {Icon && <Icon size={compact ? 14 : 17} color={ON_ACTION} strokeWidth={2.2} />}
          <Text style={[styles.label, compact && styles.compactLabel, { color: ON_ACTION }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** The quieter button: white with a thin line and green text (red for a destructive action). */
export function SecondaryButton({ label, onPress, loading, disabled, style, danger, compact, color: colorOverride, icon: Icon }: ButtonProps & { danger?: boolean; color?: string; icon?: LucideIcon }) {
  const { neutral } = useAppTheme();
  const color = danger ? neutral.danger : colorOverride || BRAND_TEXT;
  const line = danger ? DANGER_LINE : colorOverride || NEUTRAL.border;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        styles.outline,
        compact && styles.compact,
        { borderColor: line, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} size={compact ? "small" : undefined} />
      ) : (
        <View style={styles.content}>
          {Icon && <Icon size={compact ? 14 : 17} color={color} strokeWidth={2} />}
          <Text style={[styles.label, compact && styles.compactLabel, { color }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  base: {
    paddingVertical: 13,
    borderRadius: BUTTON_RADIUS,
    alignItems: "center",
    justifyContent: "center",
  },
  compact: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  outline: {
    borderWidth: 1,
    backgroundColor: NEUTRAL.surface,
  },
  label: {
    fontWeight: "600",
    fontSize: 14,
  },
  compactLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
});
