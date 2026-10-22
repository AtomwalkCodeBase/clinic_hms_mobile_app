import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BackButton } from "@/components/IconButtons";
import { HEADER_GRADIENT } from "@/theme/themes";
import { GlassSheen } from "@/components/GlassSheen";

// The brand mark stays a fixed dark green regardless of the user's chosen
// accent theme (see theme/themes.ts) — this hero uses the same fixed
// palette rather than `theme.fill`, so branding is consistent even when a
// patient picks blue/plum/purple/coral as their personal accent.
// The hero sits directly under the screen's flat status-bar strip, exactly like My Documents' header band. Its top edge
// is the strip's own green (HEADER_GREEN) across the whole width and it only deepens downwards, so the two meet with no
// line. (It used to run diagonally from a lighter green with a white sheen, and was pulled up under the status bar and
// clipped, so its first visible row was never the strip's colour.)
const METAL_STOPS = HEADER_GRADIENT;

/**
 * Full-bleed metallic-green hero, meant to sit as the first child inside
 * Screen's padded scroll content — cancels Screen's 16px padding with a
 * negative margin so it reaches the screen edges, then re-adds that 16px
 * as inner padding so children line up with the rest of the page.
 */
/**
 * Soft translucent circles layered into every hero, on the right side only (like the one on Home's "Book an
 * appointment" card), so they never run through the greeting: a large ring, a filled circle and a small dot. They stay
 * inside the hero (nothing is cut off at its top edge), so the hero still meets the status bar in one flat green, and
 * they sit behind the hero's content.
 */
function Decoration() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.blob, styles.blobRing, { width: 132, height: 132, borderRadius: 66, top: 8, right: -36 }]} />
      <View style={[styles.blob, { width: 74, height: 74, borderRadius: 37, top: 30, right: 74, backgroundColor: "rgba(255,255,255,0.28)" }]} />
      <View style={[styles.blob, { width: 34, height: 34, borderRadius: 17, bottom: 16, right: 56, backgroundColor: "rgba(255,255,255,0.30)" }]} />
    </View>
  );
}

export function MetalHero({
  children,
  style,
  compact,
  curved,
  onBack,
  overrideColor,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  compact?: boolean;
  /** Replaces the fixed brand-green gradient with a flat fill of this color
   * (sheen kept, for the same glossy texture) — an explicit, opt-in
   * exception to the brand-consistency rule above, for the one place that
   * needs to break it on purpose: the Health tab's family-member switcher,
   * where the hero recoloring per selected person IS the point. Every other
   * caller leaves this unset and keeps the fixed green untouched. */
  overrideColor?: string;
  /** Rounds the bottom edge instead of cutting off square — opt-in so the
   * hero reads as flowing into the page on screens designed for it (Home),
   * without changing the edge-to-edge look everywhere else this is used. */
  curved?: boolean;
  /** Renders a back button as the hero's own first line instead of a
   * separate BackHeader row above it — for auth sub-screens (Forgot
   * password, Register, OTP login) that used to stack BackHeader on plain
   * background above the hero, leaving a flat, unstyled strip (status bar
   * inset + header row) before the green ever started. The on-page heading
   * already restates the screen's purpose, so the header row's title text
   * wasn't carrying anything unique — folding back-navigation into the hero
   * itself lets these screens reach the top the same way Login/Welcome do. */
  onBack?: () => void;
}) {
  return (
    <View style={[styles.wrap, compact ? styles.compactPad : styles.pad, curved && styles.curved, style]}>
      {overrideColor ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: overrideColor }]} />
      ) : (
        <LinearGradient
          colors={METAL_STOPS}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <GlassSheen />
      <Decoration />
      <View style={styles.content}>
        {!!onBack && (
          <BackButton onPress={onBack} variant="circle" diameter={32} size={20} background="rgba(255,255,255,0.35)" style={styles.backBtn} />
        )}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: -10, marginTop: -16, overflow: "hidden" },
  curved: { borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  pad: { paddingHorizontal: 10, paddingTop: 18, paddingBottom: 26 },
  compactPad: { paddingHorizontal: 10, paddingTop: 14, paddingBottom: 18 },
  content: { position: "relative" },
  backBtn: { marginBottom: 10 },
  blob: { position: "absolute" },
  blobRing: { backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.55)" },
});
