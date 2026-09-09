import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WifiOff } from "lucide-react-native";
import { useNetwork } from "@/context/NetworkContext";

/**
 * App-wide "no connection" indicator. A slim floating pill low on the
 * screen — deliberately non-blocking (pointerEvents none) and above the tab
 * bar, so the app stays fully usable while it's shown. Fades in/out on the
 * offline <-> online transition; renders nothing while online.
 */
export function OfflineBanner() {
  const { isOffline } = useNetwork();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: isOffline ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [isOffline, opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { bottom: insets.bottom + 58, opacity }]}
    >
      <View style={styles.pill}>
        <WifiOff size={13} color="#FFFFFF" strokeWidth={2.4} />
        <Text style={styles.text}>No internet connection</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#1F2933",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  text: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
});
