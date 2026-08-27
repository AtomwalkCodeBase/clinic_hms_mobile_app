import React from "react";
import { View, Text, StyleSheet, Pressable, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { IconBadge } from "@/components/IconBadge";
import { NEUTRAL } from "@/theme/themes";
import type { LucideIcon } from "@/theme/icons";

/**
 * Shared "colorful metallic card" used for both the Home dashboard's quick
 * actions and the Health hub's gadgets — was previously two separate flat
 * NEUTRAL.surface cards (all identical grey) rebuilt independently. Each
 * category gets its own gradient identity, and every card gets a real
 * highlight sheen + inner top border on top of the base tint (same layered
 * technique as MetalHero/IconBadge) so it reads as glossy/3D rather than a
 * flat pastel rectangle.
 */
export const GADGET_TINTS = {
  green: { bg: ["#EAF8EF", "#CBEBD9", "#AEE0C6"] as const, icon: ["#2eb166", "#15803D", "#0d4b26"] as const, shadow: "#0a4020", border: "#B7E4C7" },
  blue: { bg: ["#EAF3FC", "#CBE3F8", "#AAD3F3"] as const, icon: ["#4c93da", "#185FA5", "#0c3f6e"] as const, shadow: "#0a2e50", border: "#B9D9F5" },
  coral: { bg: ["#FCEFEA", "#F9D8C7", "#F5BFA3"] as const, icon: ["#e2703a", "#993C1D", "#5e2310"] as const, shadow: "#4a1c0d", border: "#F3CBB4" },
  purple: { bg: ["#EFEDFD", "#DAD3FA", "#C4B8F6"] as const, icon: ["#7c72d1", "#534AB7", "#332c74"] as const, shadow: "#241f52", border: "#D6CBF8" },
  amber: { bg: ["#FDF4E6", "#FBE4BE", "#F8D294"] as const, icon: ["#e0a83e", "#B7791F", "#6b4610"] as const, shadow: "#432c0a", border: "#F6DFAF" },
  muted: { bg: ["#F0F3F6", "#E4E9ED", "#D6DDE3"] as const, icon: ["#9aa7b3", "#7c8894", "#5a6470"] as const, shadow: "#40474e", border: "#DCE2E7" },
};

// A second, distinct family for the Home dashboard's quick-access grid —
// previously reused GADGET_TINTS in the same order the Health hub uses
// (green/blue/coral/purple/amber for both), so the two grids read as
// visually identical/duplicate features even though they link to different
// places. Different hues entirely, not just a reshuffle of the same five,
// so Home and Health read as distinct sections of the app.
export const DASHBOARD_TINTS = {
  teal: { bg: ["#E6F7F5", "#C4ECE6", "#9EDFD5"] as const, icon: ["#2FC2AC", "#0F8577", "#0A4F46"] as const, shadow: "#062E29", border: "#A9E4DA" },
  indigo: { bg: ["#EDEDFC", "#D4D2F8", "#B6B2F0"] as const, icon: ["#8480E6", "#4A46B8", "#2C2977"] as const, shadow: "#1C1A4D", border: "#C6C3F5" },
  rose: { bg: ["#FDEEF2", "#FAD2DE", "#F5AEC3"] as const, icon: ["#EA6C97", "#C22A5F", "#7A1A3C"] as const, shadow: "#4A1024", border: "#F4C1D1" },
  slate: { bg: ["#EEF1F4", "#D9E0E6", "#BFCAD3"] as const, icon: ["#8CA0B3", "#54677A", "#33414E"] as const, shadow: "#20282F", border: "#CCD6DE" },
  gold: { bg: ["#FDF6E3", "#F9E7B8", "#F3D687"] as const, icon: ["#DDB13A", "#A67C1B", "#6B4E0F"] as const, shadow: "#3E2C08", border: "#F1DC9E" },
};

export type GadgetTint = (typeof GADGET_TINTS)[keyof typeof GADGET_TINTS];

const SHEEN = ["rgba(255,255,255,0.55)", "rgba(255,255,255,0.08)", "rgba(255,255,255,0)"] as const;

export function GadgetCard({
  icon,
  title,
  subtitle,
  onPress,
  tint,
  disabled,
  iconSize = 36,
  radius = 16,
  cardPadding = 14,
  style,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onPress: () => void;
  tint: GadgetTint;
  disabled?: boolean;
  iconSize?: number;
  /** Overrides the default 16px corner radius — e.g. Home's bigger, more
   * curved dashboard tiles, without affecting other GadgetCard users
   * (Health hub) that still want the original radius. */
  radius?: number;
  cardPadding?: number;
  style?: ViewStyle;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.wrap, { borderRadius: radius, shadowColor: tint.shadow }, disabled && styles.disabled, style]}>
      <LinearGradient colors={tint.bg} start={{ x: 0.05, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, { borderRadius: radius, padding: cardPadding, borderColor: tint.border }]}>
        <LinearGradient
          colors={SHEEN}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.8, y: 0.9 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.content}>
          <IconBadge icon={icon} size={iconSize} colors={tint.icon} shadowColor={tint.shadow} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 7,
    elevation: 4,
  },
  disabled: { opacity: 0.65 },
  // flex: 1 so the visible gradient card fills whatever height the outer
  // Pressable ends up with when a 2-up grid row stretches it to match a
  // taller sibling (e.g. Vaccinations next to Health timeline's longer
  // subtitle) — without it, the shadow (attached to the taller, stretched
  // Pressable) sat below an invisible gap under the shorter visible card,
  // reading as a misaligned floating shadow.
  card: { flex: 1, borderRadius: 16, padding: 14, borderWidth: 1, overflow: "hidden" },
  content: { position: "relative" },
  title: { fontSize: 13, fontWeight: "700", color: NEUTRAL.textPrimary, marginTop: 10 },
  sub: { fontSize: 10.5, color: NEUTRAL.textSecondary, marginTop: 4, lineHeight: 14 },
});
