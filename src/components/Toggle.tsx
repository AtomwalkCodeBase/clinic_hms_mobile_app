import { View, Pressable, StyleSheet } from "react-native";

/**
 * An on/off switch drawn by the app. It shows exactly the `on` it is given and moves once when `on` changes, so a screen
 * that updates its state on the tap sees it slide a single time. With `onPress` it is a tappable switch; without, just
 * the picture of one, for a control that is tappable as a whole (ShareToggle).
 */
export function Toggle({ on, color, offColor = "#BEC3CC", onPress, disabled }: {
  on: boolean;
  color: string;
  offColor?: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const track = (
    <View style={[styles.track, { backgroundColor: on ? color : offColor }, disabled && { opacity: 0.6 }]}>
      <View style={[styles.thumb, on && { alignSelf: "flex-end" }]} />
    </View>
  );
  if (!onPress) return track;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled: !!disabled }}
    >
      {track}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: 46, height: 26, borderRadius: 13, padding: 3, justifyContent: "center" },
  thumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#FFFFFF" },
});
