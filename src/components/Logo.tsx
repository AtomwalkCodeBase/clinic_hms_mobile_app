import { View, Image, Text, StyleSheet } from "react-native";
import { NEUTRAL } from "@/theme/themes";

// Real aspect ratio of assets/logo.png (1981x1009) — used so the mark scales
// cleanly at any height without distortion instead of hardcoding a width.
const LOGO_ASPECT = 1981 / 1009;

/** The actual Atomwalk Technologies lockup (icon + wordmark) — never a placeholder. */
function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <Image
      source={require("../../assets/logo.png")}
      resizeMode="contain"
      style={{ height: size, width: size * LOGO_ASPECT }}
    />
  );
}

/** Logo on a white pill — for placing on top of the metallic green hero, where a bare logo would lose contrast against the dark edges of the gradient. Padding scales with size so bigger placements (e.g. the Login hero) don't look cramped. */
export function LogoPill({ size = 20 }: { size?: number }) {
  return (
    <View style={[styles.pill, { paddingHorizontal: size * 0.42, paddingVertical: size * 0.22, borderRadius: size * 0.4 }]}>
      <LogoMark size={size} />
    </View>
  );
}

/** The HealthNet mark for the welcome and sign-in pages: the app icon with the name beside it, centred as one piece. */
export function HealthNetLogo({ size = 52 }: { size?: number }) {
  return (
    <View style={styles.brand} accessible accessibilityRole="image" accessibilityLabel="HealthNet">
      <Image source={require("../../assets/icon.png")} style={{ width: size, height: size, borderRadius: size * 0.29 }} />
      <Text style={[styles.brandName, { fontSize: size * 0.5 }]}>HealthNet</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: 12 },
  brandName: { fontWeight: "700", color: NEUTRAL.textPrimary, letterSpacing: -0.4 },
  pill: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },
});
