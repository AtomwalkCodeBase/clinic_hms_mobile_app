import React from "react";
import { View, ViewStyle, StyleSheet } from "react-native";
import { NEUTRAL } from "@/theme/themes";
import { CARD } from "@/theme/cardSizes";

export function Card({ children, style, tint }: { children: React.ReactNode; style?: ViewStyle; tint?: string }) {
  return <View style={[styles.card, tint ? { backgroundColor: tint } : null, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: NEUTRAL.surfaceAlt,
    borderRadius: CARD.radius,
    padding: CARD.padding,
    marginBottom: CARD.gap,
  },
});
