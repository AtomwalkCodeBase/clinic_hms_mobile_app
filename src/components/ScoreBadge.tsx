import { View, Text, StyleSheet } from "react-native";
import { NEUTRAL } from "@/theme/themes";

/**
 * The rule engine's score is points, not a percentage, so it is shown as a plain number: solid dark green for a strong
 * score (30 and up), light green for a good one (20-29), faded for a weak one.
 */
export type ScoreTone = "strong" | "good" | "low";

export function scoreTone(score?: number | null): ScoreTone {
  const n = score ?? 0;
  return n >= 30 ? "strong" : n >= 20 ? "good" : "low";
}

const TONES: Record<ScoreTone, { bg: string; fg: string; border: string }> = {
  strong: { bg: "#166534", fg: "#FFFFFF", border: "#166534" },
  good: { bg: "#DFF3E6", fg: "#166534", border: "#DFF3E6" },
  low: { bg: NEUTRAL.surfaceAlt, fg: NEUTRAL.textMuted, border: NEUTRAL.border },
};

export function ScoreBadge({ score }: { score?: number | null }) {
  if (score == null) return null;
  const c = TONES[scoreTone(score)];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.text, { color: c.fg }]}>{Math.round(score)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { minWidth: 24, paddingHorizontal: 7, paddingVertical: 1.5, borderRadius: 10, borderWidth: 0.5, alignItems: "center", marginLeft: 6 },
  text: { fontSize: 11, fontWeight: "700" },
});
