import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Modal, PanResponder, Pressable, StyleSheet, View } from "react-native";

const OFFSCREEN = Dimensions.get("window").height;

/**
 * A bottom sheet's frame: the dimmed backdrop fades in while the panel slides up, tapping the backdrop closes it, and
 * pulling the grab area at the top of the panel down closes it too. The panel itself (its colours, corners and content)
 * is whatever the caller passes in as children.
 */
export function SheetModal({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(visible);
  const v = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      drag.setValue(0);
      Animated.timing(v, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(v, { toValue: 0, duration: 190, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 90 || g.vy > 0.9) onClose();
        else Animated.spring(drag, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
      },
    }),
  ).current;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.fill}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.dim, { opacity: v }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.bottom} pointerEvents="box-none">
          <Animated.View
            style={{
              transform: [
                { translateY: Animated.add(v.interpolate({ inputRange: [0, 1], outputRange: [OFFSCREEN * 0.6, 0] }), drag) },
              ],
              opacity: v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
            }}
          >
            {children}
            <View {...pan.panHandlers} style={styles.grabZone} />
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  dim: { backgroundColor: "rgba(14,42,35,0.4)" },
  bottom: { flex: 1, justifyContent: "flex-end" },
  grabZone: { position: "absolute", top: 0, left: "30%", right: "30%", height: 30 },
});
