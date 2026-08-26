import React from "react";
import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAppTheme } from "@/context/ThemeContext";

// A diagonal highlight overlaid on the flat theme fill — the same layered
// technique MetalHero/IconBadge use for a glossy/metallic look — without
// needing a bespoke gradient per accent color (theme.fill is a single hex,
// user-switchable across 5 accents; this works on top of any of them).
const GLOSS = ["rgba(255,255,255,0.35)", "rgba(255,255,255,0.04)", "rgba(255,255,255,0)"] as const;

interface ButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  /** Smaller padding + type, sized to content instead of stretching — for secondary row actions (Cancel/Reschedule) that shouldn't read as big primary CTAs. */
  compact?: boolean;
}

export function PrimaryButton({ label, onPress, loading, disabled, style, compact }: ButtonProps) {
  const { theme } = useAppTheme();
  // style may carry a caller-supplied backgroundColor (e.g. the danger-red
  // override in ConfirmDialog) — honor it as the gloss's base instead of
  // always forcing the theme accent underneath.
  const flatStyle = StyleSheet.flatten([style]) as { backgroundColor?: string } | undefined;
  const baseColor = flatStyle?.backgroundColor || theme.fill;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        styles.primaryShadow,
        compact && styles.compact,
        { backgroundColor: baseColor, shadowColor: theme.text, opacity: disabled ? 0.5 : pressed ? 0.9 : 1, overflow: "hidden" },
        style,
      ]}
    >
      <LinearGradient colors={GLOSS} locations={[0, 0.45, 1]} start={{ x: 0.1, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
      {loading ? (
        <ActivityIndicator color={theme.on} size={compact ? "small" : undefined} />
      ) : (
        <Text style={[styles.label, compact && styles.compactLabel, { color: theme.on }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, loading, disabled, style, danger, compact }: ButtonProps & { danger?: boolean }) {
  const { theme, neutral } = useAppTheme();
  const color = danger ? neutral.danger : theme.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        styles.outline,
        compact && styles.compact,
        { borderColor: color, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} size={compact ? "small" : undefined} />
      ) : (
        <Text style={[styles.label, compact && styles.compactLabel, { color }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 13,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryShadow: {
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 3,
  },
  compact: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 18,
    alignSelf: "flex-start",
  },
  outline: {
    borderWidth: 1,
    backgroundColor: "transparent",
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
