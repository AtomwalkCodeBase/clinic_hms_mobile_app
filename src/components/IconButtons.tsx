import { Pressable, Text, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { ArrowLeft, Ellipsis, X } from "lucide-react-native";
import { NEUTRAL, ON_BRAND } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";

/**
 * The small icon buttons every screen repeats: Back, Help ("?") and Close (the cross). One place to restyle them.
 * Callers only say what happens on press; position goes in `style`.
 */

/**
 * The back arrow. `plain` is just the arrow (header bands); `circle` puts it on a round, tinted background (over the
 * hero and over the dark document viewer).
 */
export function BackButton({
  onPress, color = ON_BRAND, size = 25, variant = "plain", diameter = 34, background, style,
}: {
  onPress: () => void;
  /** arrow colour; the band's own colour when left out */
  color?: string;
  size?: number;
  variant?: "plain" | "circle";
  /** `circle` only: width and height of the circle */
  diameter?: number;
  /** `circle` only: the circle's fill */
  background?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const shape: ViewStyle = variant === "circle"
    ? { width: diameter, height: diameter, borderRadius: diameter / 2, backgroundColor: background, alignItems: "center", justifyContent: "center" }
    : styles.plainBack;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Back"
      style={({ pressed }) => [shape, pressed && { opacity: 0.7 }, style]}
    >
      <ArrowLeft size={size} color={color} strokeWidth={2.4} />
    </Pressable>
  );
}

/** The round "?" that opens a HelpSheet, for the top right of a screen header. */
export function HelpButton({ onPress, onDark = false, color: given }: { onPress: () => void; onDark?: boolean; color?: string }) {
  const { theme } = useAppTheme();
  const color = given ?? (onDark ? ON_BRAND : theme.fill);     // dark on the mint header band, the accent on a light one; `color` is a family member's band text
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Help"
      style={[styles.help, { borderColor: color }, onDark && { backgroundColor: "transparent" }]}
    >
      <Text style={[styles.helpText, { color }]}>?</Text>
    </Pressable>
  );
}

/** The round three dots after the "?" in a header: opens the "whose records?" choice. Same circle as the "?". */
export function MoreButton({ onPress, onDark = false, color: given }: { onPress: () => void; onDark?: boolean; color?: string }) {
  const { theme } = useAppTheme();
  const color = given ?? (onDark ? ON_BRAND : theme.fill);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Change person"
      style={[styles.help, { borderColor: color }, onDark && { backgroundColor: "transparent" }]}
    >
      <Ellipsis size={20} color={color} strokeWidth={2.6} />
    </Pressable>
  );
}

/**
 * The cross that closes a sheet or a full-screen view. `plain` is a black cross for a sheet's top right; `overlay` is a
 * white cross on a dark round chip, for sitting over the camera.
 */
export function CloseButton({
  onPress, variant = "plain", label = "Close", style,
}: {
  onPress: () => void;
  variant?: "plain" | "overlay";
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const overlay = variant === "overlay";
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[overlay && styles.overlay, style]}
    >
      <X size={overlay ? 22 : 24} color={overlay ? "#FFFFFF" : "#000000"} strokeWidth={2.4} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // just the arrow: no circle, no border, no background
  plainBack: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginLeft: -8 },
  help: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: "center", justifyContent: "center", backgroundColor: NEUTRAL.surface },
  helpText: { fontSize: 18, fontWeight: "700", marginTop: -1 },
  overlay: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
});
