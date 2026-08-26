import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { NEUTRAL } from "@/theme/themes";
import type { LucideIcon } from "@/theme/icons";
import { Pill } from "./Pill";
import { IconBadge } from "./IconBadge";

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
}) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <IconBadge icon={icon} size={30} colors={iconColors} shadowColor={iconShadowColor} />
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
    gap: 10,
    backgroundColor: NEUTRAL.surface,
    borderWidth: 0.5,
    borderColor: NEUTRAL.border,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  mid: { flex: 1, minWidth: 0 },
  title: { fontSize: 12.5, fontWeight: "600", color: NEUTRAL.textPrimary },
  subtitle: { fontSize: 11, color: NEUTRAL.textSecondary, marginTop: 2 },
  chev: { marginLeft: 2 },
});
