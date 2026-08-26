import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

// The brand mark stays a fixed dark green regardless of the user's chosen
// accent theme (see theme/themes.ts) — this hero uses the same fixed
// palette rather than `theme.fill`, so branding is consistent even when a
// patient picks blue/plum/purple/coral as their personal accent.
const METAL_STOPS = ["#249c57", "#15803D", "#0f5c2e", "#0a4020"] as const;
const METAL_LOCATIONS = [0, 0.3, 0.62, 1] as const;
const SHEEN_STOPS = [
  "rgba(255,255,255,0.30)",
  "rgba(255,255,255,0.02)",
  "rgba(255,255,255,0)",
  "rgba(255,255,255,0.14)",
  "rgba(255,255,255,0)",
] as const;
const SHEEN_LOCATIONS = [0, 0.26, 0.55, 0.78, 1] as const;

/**
 * Full-bleed metallic-green hero, meant to sit as the first child inside
 * Screen's padded scroll content — cancels Screen's 16px padding with a
 * negative margin so it reaches the screen edges, then re-adds that 16px
 * as inner padding so children line up with the rest of the page.
 */
/**
 * Large translucent circles layered into the hero, the same "abstract
 * shape" texture used behind onboarding/auth screens in premium reference
 * apps. Rendered ON TOP of the sheen (not underneath) and at real opacity —
 * a first attempt at this sat under the sheen at ~0.05-0.08 opacity and was
 * effectively invisible against the metallic gradient. Positions are kept
 * mostly within the hero's own bounds (only small negative offsets) so they
 * still read on the `compact` hero (Register), which isn't tall enough to
 * afford the larger offsets a full-size hero could clip without losing them
 * entirely. Never applied to data-dense screens (Home/Health/Appointments)
 * where it would fight the content — opt-in via the `decorative` prop.
 */
function Decoration() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.blob, styles.blobRing, { width: 170, height: 170, borderRadius: 85, top: -50, right: -30 }]} />
      <View style={[styles.blob, { width: 110, height: 110, borderRadius: 55, top: -20, right: 40, backgroundColor: "rgba(255,255,255,0.16)" }]} />
      <View style={[styles.blob, styles.blobRing, { width: 90, height: 90, borderRadius: 45, bottom: -30, left: -20 }]} />
      <View style={[styles.blob, { width: 46, height: 46, borderRadius: 23, bottom: 10, left: "42%", backgroundColor: "rgba(255,255,255,0.14)" }]} />
    </View>
  );
}

export function MetalHero({
  children,
  style,
  compact,
  decorative,
  curved,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  compact?: boolean;
  /** Adds the soft background-circle texture — opt-in for auth screens. */
  decorative?: boolean;
  /** Rounds the bottom edge instead of cutting off square — opt-in so the
   * hero reads as flowing into the page on screens designed for it (Home),
   * without changing the edge-to-edge look everywhere else this is used. */
  curved?: boolean;
}) {
  return (
    <View style={[styles.wrap, compact ? styles.compactPad : styles.pad, curved && styles.curved, style]}>
      <LinearGradient
        colors={METAL_STOPS}
        locations={METAL_LOCATIONS}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={SHEEN_STOPS}
        locations={SHEEN_LOCATIONS}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {decorative && <Decoration />}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: -16, marginTop: -16, overflow: "hidden" },
  curved: { borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  pad: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 26 },
  compactPad: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 18 },
  content: { position: "relative" },
  blob: { position: "absolute" },
  blobRing: { backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.22)" },
});
