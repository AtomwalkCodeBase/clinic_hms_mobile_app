import React, { useEffect, useRef } from "react";
import { Animated, Easing, View, StyleSheet, ViewStyle, DimensionValue } from "react-native";
import { NEUTRAL } from "@/theme/themes";

/**
 * Shimmer placeholders for a screen's TRUE first load (no cached data at
 * all yet) — as opposed to a background refetch of already-visible data,
 * which uses TopProgressBar instead (see that file). One shared looping
 * Animated.Value drives every block on screen so they shimmer in sync
 * rather than each block running its own clock slightly out of phase.
 */
const shimmer = new Animated.Value(0);
let shimmerRunning = false;
function ensureShimmerLoop() {
  if (shimmerRunning) return;
  shimmerRunning = true;
  Animated.loop(
    Animated.timing(shimmer, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true })
  ).start();
}

export function SkeletonBlock({
  width = "100%",
  height = 14,
  radius = 8,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  useEffect(() => {
    ensureShimmerLoop();
  }, []);
  const opacity = shimmer.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.55, 1, 0.55] });
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: NEUTRAL.surfaceAlt, opacity },
        style,
      ]}
    />
  );
}

export function SkeletonCircle({ size = 34, style }: { size?: number; style?: ViewStyle }) {
  return <SkeletonBlock width={size} height={size} radius={size / 2} style={style} />;
}

/** A gadget-card-shaped placeholder — icon badge + two text lines, matching GadgetCard's layout. */
export function SkeletonGadgetCard({ style }: { style?: ViewStyle }) {
  return (
    <View style={[styles.gadgetCard, style]}>
      <SkeletonCircle size={34} style={{ borderRadius: 12 }} />
      <SkeletonBlock width="70%" height={11} style={{ marginTop: 12 }} />
      <SkeletonBlock width="45%" height={9} style={{ marginTop: 6 }} />
    </View>
  );
}

/** A list-row-shaped placeholder — icon + title line + subtitle line, matching ListRow's layout. */
export function SkeletonRow({ style }: { style?: ViewStyle }) {
  return (
    <View style={[styles.row, style]}>
      <SkeletonCircle size={36} style={{ borderRadius: 10 }} />
      <View style={{ flex: 1 }}>
        <SkeletonBlock width="65%" height={12} />
        <SkeletonBlock width="40%" height={10} style={{ marginTop: 7 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gadgetCard: { backgroundColor: NEUTRAL.surface, borderRadius: 20, padding: 16, height: 96 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11 },
});
