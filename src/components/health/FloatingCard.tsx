import { useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { X } from "lucide-react-native";
import { INK } from "./journeyTheme";

export interface Anchor { x: number; y: number }

const WIDTH = 258;
const GAP = 16;
const EDGE = 10;

/**
 * A card that opens right next to the point that was tapped (above it, or below when there is no room), with a cross in
 * the corner. It exists only after a tap: the cross, a tap anywhere outside it, or the back button closes it.
 */
export function FloatingCard({ anchor, onClose, children }: { anchor: Anchor | null; onClose: () => void; children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  const [h, setH] = useState(0);
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!anchor || !h) return;
    pop.setValue(0);
    Animated.timing(pop, { toValue: 1, duration: 160, useNativeDriver: true }).start();
  }, [anchor, h, pop]);
  useEffect(() => { if (!anchor) setH(0); }, [anchor]);

  if (!anchor) return null;
  const above = anchor.y > height * 0.42;
  const left = Math.max(EDGE, Math.min(anchor.x - WIDTH / 2, width - WIDTH - EDGE));
  const top = above ? anchor.y - h - GAP : anchor.y + GAP;
  const arrowLeft = Math.max(16, Math.min(anchor.x - left - 6, WIDTH - 28));
  const shift = above ? 8 : -8;
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close details" />
      <Animated.View
        onLayout={(e) => setH(e.nativeEvent.layout.height)}
        style={[styles.card, { left, top: h ? top : -1000, opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }, { translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [shift, 0] }) }] }]}
        accessibilityViewIsModal
      >
        <View style={[styles.arrow, { left: arrowLeft }, above ? { bottom: -6 } : { top: -6 }]} />
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
          <X size={16} color="#FFFFFF" strokeWidth={2.6} />
        </Pressable>
        <View style={{ paddingRight: 34 }}>{children}</View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { position: "absolute", width: WIDTH, backgroundColor: INK, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, elevation: 8, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  arrow: { position: "absolute", width: 12, height: 12, backgroundColor: INK, transform: [{ rotate: "45deg" }] },
  close: { position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
});
