import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, StyleSheet } from "react-native";

/** A dialog's frame: the dimmed backdrop fades in while the card zooms up from slightly smaller, and both ease out on close. */
export function PopModal({ visible, onRequestClose, children }: { visible: boolean; onRequestClose: () => void; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(visible);
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(v, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(v, { toValue: 0, duration: 160, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible]);
  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onRequestClose} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity: v }]}>
        <Animated.View style={[styles.wrap, { transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }]}>{children}</Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(14,42,35,0.45)", alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  wrap: { width: "100%", alignItems: "center" },
});
