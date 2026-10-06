import React from "react";
import { View, ViewStyle, StyleSheet } from "react-native";
import { NEUTRAL } from "@/theme/themes";

export function Card({ children, style, tint }: { children: React.ReactNode; style?: ViewStyle; tint?: string }) {
  return <View style={[styles.card, tint ? { backgroundColor: tint } : null, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: NEUTRAL.surfaceAlt,
    borderRadius: 12,
    padding: 13,
    marginBottom: 10,
  },
});
