import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { NEUTRAL } from "@/theme/themes";

type Tone = "success" | "warning" | "danger" | "neutral";

const TONE_STYLES: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: NEUTRAL.successBg, fg: NEUTRAL.success },
  warning: { bg: NEUTRAL.warningBg, fg: NEUTRAL.warning },
  danger: { bg: NEUTRAL.dangerBg, fg: NEUTRAL.danger },
  neutral: { bg: NEUTRAL.surfaceAlt, fg: NEUTRAL.textMuted },
};

export function Pill({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const c = TONE_STYLES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

/** The actual color behind a tone — for coloring plain text (e.g. a detail row) to match a status pill elsewhere on the same screen. */
export function toneColor(tone: Tone): string {
  return TONE_STYLES[tone].fg;
}

/** Maps common backend status strings to a sensible pill tone. */
export function statusTone(status: string): Tone {
  const s = status.toLowerCase();
  if (["confirmed", "scheduled", "waiting", "completed", "done", "verified"].includes(s)) return "success";
  if (["pending", "vitals_done", "in_progress", "pending_review"].includes(s)) return "warning";
  if (["no_show", "cancelled", "rejected"].includes(s)) return "danger";
  return "neutral";
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: 20, alignSelf: "flex-start" },
  text: { fontSize: 10, fontWeight: "600" },
});
