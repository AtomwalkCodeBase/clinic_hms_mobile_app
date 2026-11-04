import { StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { NEUTRAL } from "@/theme/themes";

/**
 * The page wash of the prototype: a soft mint glow in the top left and a soft sky-blue glow in the top right on the page
 * colour. The same two radial gradients the CSS draws, sized as a share of the screen. It sits behind everything and
 * ignores touches.
 */
export function AuroraBackground() {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: NEUTRAL.bg }]}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="mint" cx="0%" cy="0%" rx="130%" ry="36%" gradientUnits="objectBoundingBox">
            <Stop offset="0" stopColor="#CDEFE1" stopOpacity={1} />
            <Stop offset="0.62" stopColor="#CDEFE1" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="sky" cx="100%" cy="0%" rx="100%" ry="30%" gradientUnits="objectBoundingBox">
            <Stop offset="0" stopColor="#DCE8FF" stopOpacity={1} />
            <Stop offset="0.62" stopColor="#DCE8FF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#mint)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#sky)" />
      </Svg>
    </View>
  );
}
