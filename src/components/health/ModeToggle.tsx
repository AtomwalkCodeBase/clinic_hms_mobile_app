import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { NEUTRAL } from "@/theme/themes";
import { INK, MIN_TAP } from "./journeyTheme";

/**
 * One switch for two modes (List / Chart, By age / By date): a single control with both names on it and a white
 * thumb under the active one. Tapping anywhere on it flips to the other mode. The thumb is half the track, by percentage,
 * so nothing has to be measured first: it is right from the first frame and cannot be left half drawn.
 */
export function ModeToggle<T extends string>({
  left, right, value, onChange, label,
}: {
  left: { key: T; label: string };
  right: { key: T; label: string };
  value: T;
  onChange: (key: T) => void;
  label: string;
}) {
  const on = value === right.key;
  const slide = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(slide, { toValue: on ? 1 : 0, duration: 170, useNativeDriver: false }).start();
  }, [on, slide]);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={`${label}: ${left.label} or ${right.label}`}
      accessibilityState={{ checked: on }}
      onPress={() => onChange(on ? left.key : right.key)}
      style={styles.track}
    >
      <View style={styles.rail} pointerEvents="none">
        <Animated.View style={[styles.thumb, { left: slide.interpolate({ inputRange: [0, 1], outputRange: ["0%", "50%"] }) }]} />
      </View>
      <View style={styles.cell}><Text style={[styles.label, !on && styles.active]} numberOfLines={1}>{left.label}</Text></View>
      <View style={styles.cell}><Text style={[styles.label, on && styles.active]} numberOfLines={1}>{right.label}</Text></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { flex: 1, minHeight: MIN_TAP, flexDirection: "row", alignItems: "stretch", padding: 2, borderRadius: 14, backgroundColor: "#E3E9EE" },
  rail: { position: "absolute", top: 2, bottom: 2, left: 2, right: 2 },
  thumb: { position: "absolute", top: 0, bottom: 0, width: "50%", borderRadius: 12, backgroundColor: NEUTRAL.surface, borderWidth: 1, borderColor: NEUTRAL.border },
  cell: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  label: { fontSize: 13, color: NEUTRAL.textSecondary },
  active: { color: INK, fontWeight: "700" },
});
