import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { NEUTRAL } from "@/theme/themes";
import type { LucideIcon } from "@/theme/icons";
import { LinearGradient } from "expo-linear-gradient";
import { WHISPER_GREEN } from "@/theme/gadgetSurface";
import { Pill } from "./Pill";
import { IconBadge } from "./IconBadge";
import { CARD, CARD_ICON, CARD_TEXT } from "@/theme/cardSizes";

type Tone = "success" | "warning" | "danger" | "neutral";

/** Condensed, tappable single row — icon, title/subtitle, an optional status pill, and a chevron. Opens a DetailSheet on tap. */
export function ListRow({
  icon,
  title,
  subtitle,
  pillLabel,
  pillTone = "neutral",
  onPress,
  iconColors,
  iconShadowColor,
  trailing,
  tinted,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  pillLabel?: string;
  pillTone?: Tone;
  onPress?: () => void;
  /** Overrides IconBadge's default green gradient — e.g. giving each row in a grouped list its own category color. */
  iconColors?: readonly [string, string, string];
  iconShadowColor?: string;
  /** Replaces the pill+chevron with a custom control (e.g. a Switch) — for a settings row that toggles in place instead of navigating. */
  trailing?: React.ReactNode;
  /** The Whisper green look (the same surface as the gadget tiles) instead of a plain white row. */
  tinted?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.row, tinted && styles.rowTinted]}>
      {tinted && (
        <LinearGradient
          colors={WHISPER_GREEN.bg}
          start={{ x: 0.05, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: CARD.radius }]}
        />
      )}
      <IconBadge icon={icon} size={CARD_ICON} colors={iconColors} shadowColor={iconShadowColor} />
      <View style={styles.mid}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {trailing ? (
        trailing
      ) : (
        <>
          {!!pillLabel && <Pill label={pillLabel} tone={pillTone} />}
          <ChevronRight size={17} color={NEUTRAL.textMuted} strokeWidth={2.2} style={styles.chev} />
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: NEUTRAL.surface,
    borderWidth: 0.5,
    borderColor: NEUTRAL.border,
    borderRadius: CARD.radius,
    paddingVertical: CARD.padding - 2,
    paddingHorizontal: CARD.padding,
    marginBottom: CARD.gap,
  },
  rowTinted: { borderColor: WHISPER_GREEN.border, borderWidth: 1, overflow: "hidden", backgroundColor: "#F2FAF6" },
  mid: { flex: 1, minWidth: 0 },
  title: { fontSize: CARD_TEXT.title, fontWeight: "600", color: NEUTRAL.textPrimary },
  subtitle: { fontSize: CARD_TEXT.meta, color: NEUTRAL.textSecondary, marginTop: 2 },
  chev: { marginLeft: 2 },
});
