import { Text, View, StyleSheet, ActivityIndicator, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { LucideIcon } from "@/theme/icons";
import { AURORA, BRAND_TEXT, NEUTRAL } from "@/theme/themes";
import { ACTION, ON_ACTION, BUTTON_RADIUS, DANGER_LINE } from "@/theme/buttons";
import { useAppTheme } from "@/context/ThemeContext";
import { PressableScale } from "@/components/PressableScale";

interface ButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  /** Smaller padding + type, sized to content instead of stretching — for secondary row actions (Cancel/Reschedule) that shouldn't read as big primary CTAs. */
  compact?: boolean;
}

/**
 * The main button of a screen: the green-to-sky Aurora gradient with white text, a soft green shadow, a spring when
 * pressed and a light haptic tap. A caller may pass its own backgroundColor (the red of a destructive confirm); then
 * the button is that flat colour instead of the gradient.
 */
export function PrimaryButton({ label, onPress, loading, disabled, style, compact, icon: Icon }: ButtonProps & { icon?: LucideIcon }) {
  const flat = StyleSheet.flatten([style]) as ViewStyle | undefined;
  const custom = flat?.backgroundColor;
  const { margin, marginTop, marginBottom, marginLeft, marginRight, marginHorizontal, marginVertical, alignSelf, flex, width, ...inner } = (flat || {}) as ViewStyle;
  const outer: ViewStyle = { margin, marginTop, marginBottom, marginLeft, marginRight, marginHorizontal, marginVertical, alignSelf: alignSelf ?? (compact ? "flex-start" : undefined), flex, width };
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      haptic
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={[outer, !disabled && !custom && !compact ? styles.glow : null]}
    >
      <View style={[styles.base, compact && styles.compact, { backgroundColor: custom || ACTION, opacity: disabled ? 0.45 : 1 }, inner]}>
        {!custom && <LinearGradient colors={AURORA.action} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
        {loading ? (
          <ActivityIndicator color={ON_ACTION} size={compact ? "small" : undefined} />
        ) : (
          <View style={styles.content}>
            {Icon && <Icon size={compact ? 15 : 18} color={ON_ACTION} strokeWidth={2.3} />}
            <Text style={[styles.label, compact && styles.compactLabel, { color: ON_ACTION }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{label}</Text>
          </View>
        )}
      </View>
    </PressableScale>
  );
}

/** The quieter button: frosted white with a thin line and green text (red for a destructive action). */
export function SecondaryButton({ label, onPress, loading, disabled, style, danger, compact, color: colorOverride, icon: Icon }: ButtonProps & { danger?: boolean; color?: string; icon?: LucideIcon }) {
  const { neutral } = useAppTheme();
  const color = danger ? neutral.danger : colorOverride || BRAND_TEXT;
  const line = danger ? DANGER_LINE : colorOverride || NEUTRAL.border;
  const flat = (StyleSheet.flatten([style]) || {}) as ViewStyle;
  const { margin, marginTop, marginBottom, marginLeft, marginRight, marginHorizontal, marginVertical, alignSelf, flex, width, ...inner } = flat;
  const outer: ViewStyle = { margin, marginTop, marginBottom, marginLeft, marginRight, marginHorizontal, marginVertical, alignSelf: alignSelf ?? (compact ? "flex-start" : undefined), flex, width };
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={outer}
    >
      <View style={[styles.base, styles.outline, compact && styles.compact, { borderColor: line, opacity: disabled ? 0.5 : 1 }, inner]}>
        {loading ? (
          <ActivityIndicator color={color} size={compact ? "small" : undefined} />
        ) : (
          <View style={styles.content}>
            {Icon && <Icon size={compact ? 15 : 18} color={color} strokeWidth={2.2} />}
            <Text style={[styles.label, compact && styles.compactLabel, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{label}</Text>
          </View>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  content: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  base: {
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: BUTTON_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  glow: { borderRadius: BUTTON_RADIUS, ...AURORA.shadow, shadowColor: "#0C8A63", shadowOpacity: 0.28 },
  compact: {
    minHeight: 38,
    paddingHorizontal: 16,
    borderRadius: 13,
  },
  outline: {
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  label: {
    fontWeight: "600",
    fontSize: 15,
    letterSpacing: 0.1,
  },
  compactLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
});
