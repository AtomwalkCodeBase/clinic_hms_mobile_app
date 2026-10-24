import { StyleSheet } from "react-native";
import { NEUTRAL } from "@/theme/themes";
import { INK, MIN_TAP, SOFT_LINE } from "./journeyTheme";

/** Styles the four sections of the journey share. */
export const J = StyleSheet.create({
  stack: { gap: 10 },
  card: { backgroundColor: NEUTRAL.surface, borderRadius: 16, padding: 12 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: INK },
  caption: { fontSize: 12, color: NEUTRAL.textMuted },
  body: { fontSize: 13.5, lineHeight: 19, color: NEUTRAL.textSecondary },
  linkRow: { minHeight: MIN_TAP, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: SOFT_LINE },
  linkText: { fontSize: 14, fontWeight: "700", color: "#0F4A3A" },
  row: { flexDirection: "row", alignItems: "center" },
});
