import { StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AURORA } from "@/theme/themes";

/**
 * The green-to-sky fill of every main button, laid over a button-shaped parent (which must clip with `overflow: "hidden"`
 * and carry its own radius). Used by the buttons that are not PrimaryButton: the bottom action bar, the Book card on Home
 * and the selected pills.
 */
export function ActionGradient() {
  return <LinearGradient colors={AURORA.action} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} pointerEvents="none" style={StyleSheet.absoluteFill} />;
}
