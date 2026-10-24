import { StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { HEADER_SHEEN } from "@/theme/themes";

/**
 * The glass look of the green headers and the status bar above them: one soft highlight that sweeps left to right
 * across the full height. It depends only on the horizontal position, so the status bar strip and the header under it
 * get exactly the same colour at every point and read as one piece of glass, with no line between them.
 */
export function GlassSheen() {
  return (
    <LinearGradient
      colors={HEADER_SHEEN}
      locations={[0, 0.55, 1]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    />
  );
}
