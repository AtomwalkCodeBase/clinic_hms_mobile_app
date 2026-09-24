import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

/**
 * A small, quiet pill for a BACKGROUND refetch of data that's already on
 * screen (see useRefreshOnFocus) — not a spinner over content, not a bar
 * spanning the width. Floats just under the header, centered, sized to
 * its own label, so a routine "this got a little stale, quietly getting
 * the latest copy" refresh reads as a passing detail, not as the screen
 * loading again. Contrast with Skeleton.tsx, used only for a screen's
 * true first load, when there's nothing real yet to show instead.
 */
export function TopProgressBar({ visible, color }: { visible: boolean; color: string }) {
  const spin = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spinAnim = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 700, easing: Easing.linear, useNativeDriver: true })
    );
    spinAnim.start();
    return () => spinAnim.stop();
  }, [spin]);

  useEffect(() => {
    Animated.timing(fade, { toValue: visible ? 1 : 0, duration: 160, useNativeDriver: true }).start();
  }, [visible, fade]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Animated.View
      style={[styles.pill, { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }] }]}
      pointerEvents="none"
    >
      <Animated.View style={[styles.ring, { borderTopColor: color, transform: [{ rotate }] }]} />
      <Text style={styles.label}>Updating</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: "absolute",
    top: 8,
    alignSelf: "center",
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(20,20,20,0.72)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  ring: { width: 11, height: 11, borderRadius: 6, borderWidth: 1.6, borderColor: "rgba(255,255,255,0.3)" },
  label: { color: "#FFFFFF", fontSize: 10.5, fontWeight: "600" },
});
