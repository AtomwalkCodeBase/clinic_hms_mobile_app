import { View, StyleSheet } from "react-native";
import { CARD } from "@/theme/cardSizes";

/**
 * The coloured left edge of a card: a solid bar on the edge. Put it as the FIRST child of a card that has CARD.radius;
 * it clips itself to the card's rounded corners and never takes a touch.
 */
export function CardEdge({ color }: { color: string }) {
  return (
    <View pointerEvents="none" style={styles.clip}>
      <View style={[styles.bar, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, borderRadius: CARD.radius, overflow: "hidden" },
  bar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 7 },
});
