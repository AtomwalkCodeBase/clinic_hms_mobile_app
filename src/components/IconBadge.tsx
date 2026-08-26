import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { LucideIcon } from "@/theme/icons";

/**
 * Glossy metallic-green icon badge — layered gradient (depth) + a
 * top-left highlight sheen (gloss) + a real drop shadow, used everywhere
 * an icon needs to read as a polished 3D-ish badge instead of a flat
 * colored circle: list rows, gadget tiles, quick-access icons.
 *
 * Two nested Views because Android elevation/shadow gets clipped by
 * overflow:hidden on the same View — the outer one carries the shadow,
 * the inner one clips the gradient to the rounded corners.
 */
export function IconBadge({
  icon: Icon,
  size = 30,
  colors = ["#2eb166", "#15803D", "#0d4b26"],
  shadowColor = "#0a4020",
}: {
  icon: LucideIcon;
  size?: number;
  /** 3-stop gradient — defaults to the brand green used everywhere else. */
  colors?: readonly [string, string, string];
  shadowColor?: string;
}) {
  const radius = size * 0.32;
  return (
    <View style={[styles.shadowWrap, { width: size, height: size, borderRadius: radius, shadowColor }]}>
      <View style={[styles.clip, { borderRadius: radius }]}>
        <LinearGradient colors={colors} start={{ x: 0.15, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={["rgba(255,255,255,0.4)", "rgba(255,255,255,0.05)", "rgba(255,255,255,0)"]}
          locations={[0, 0.4, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.7, y: 0.8 }}
          style={StyleSheet.absoluteFill}
        />
        <Icon size={size * 0.5} color="#FFFFFF" strokeWidth={2.2} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    shadowColor: "#0a4020",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 3,
    elevation: 3,
  },
  clip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
