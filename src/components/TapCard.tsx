import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { ChevronDown, ChevronRight } from "lucide-react-native";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { CARD, CARD_TEXT } from "@/theme/cardSizes";
import type { LucideIcon } from "@/theme/icons";

/**
 * A card that looks tappable: a white card with a clear border, an icon (or the person's initial) on the left and a round
 * arrow on the right. `selected` turns the border and the arrow green (an opened choice). Used where the patient picks
 * one of a few things: who an appointment is for, a hospital.
 */
export function TapCard({
  icon: Icon, initial, title, subtitle, subIcon: SubIcon, children, selected = false, open, small = false, onPress, accessibilityLabel,
}: {
  icon?: LucideIcon;
  /** a letter in the round badge, instead of an icon (a family member) */
  initial?: string;
  title: string;
  subtitle?: string;
  /** a small icon in front of the subtitle (a map pin before the city) */
  subIcon?: LucideIcon;
  /** extra content under the subtitle (a tag) */
  children?: React.ReactNode;
  selected?: boolean;
  /** the arrow points down instead of right (a choice that opens a list under itself) */
  open?: boolean;
  small?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const { theme } = useAppTheme();
  const size = small ? 34 : 42;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [
        styles.card,
        small && styles.cardSmall,
        selected && { borderColor: theme.fill, borderWidth: 1.5 },
        pressed && { backgroundColor: NEUTRAL.surfaceAlt },
      ]}
    >
      <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.bg }]}>
        {Icon ? <Icon size={small ? 17 : 20} color={theme.text} strokeWidth={2.2} /> : <Text style={[styles.initial, { color: theme.text }]}>{initial}</Text>}
      </View>
      <View style={styles.mid}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {!!subtitle && (
          <View style={styles.subRow}>
            {SubIcon && <SubIcon size={13} color={NEUTRAL.textSecondary} strokeWidth={2.2} />}
            <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
          </View>
        )}
        {children}
      </View>
      <ArrowChip selected={selected} open={open} />
    </Pressable>
  );
}

/** The round arrow at the right end of a tappable card: right-pointing, or down for a choice that opens a list. */
export function ArrowChip({ selected = false, open }: { selected?: boolean; open?: boolean }) {
  const { theme } = useAppTheme();
  const Arrow = open !== undefined ? ChevronDown : ChevronRight;
  return (
    <View style={[styles.arrow, selected && { backgroundColor: theme.fill }]}>
      <Arrow size={17} color={selected ? "#FFFFFF" : NEUTRAL.textPrimary} strokeWidth={2.4} />
    </View>
  );
}

/** The look of a card that opens something when tapped: white, with a clear border (a plain Card is grey and flat). */
export const TAPPABLE_CARD = { backgroundColor: NEUTRAL.surface, borderWidth: 1, borderColor: NEUTRAL.border } as const;

/** A small grey tag under a card's text ("12 doctors"). */
export function CardTag({ icon: Icon, label }: { icon?: LucideIcon; label: string }) {
  return (
    <View style={styles.tag}>
      {Icon && <Icon size={13} color={NEUTRAL.textSecondary} strokeWidth={2.2} />}
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: NEUTRAL.surface,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    borderRadius: CARD.radius,
    padding: CARD.padding,
    marginBottom: CARD.gap,
  },
  cardSmall: { paddingVertical: 10, marginLeft: 12 },
  badge: { alignItems: "center", justifyContent: "center" },
  initial: { fontSize: 14, fontWeight: "700" },
  mid: { flex: 1, minWidth: 0 },
  title: { fontSize: CARD_TEXT.title, fontWeight: "600", color: NEUTRAL.textPrimary },
  subRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  subtitle: { flexShrink: 1, fontSize: CARD_TEXT.meta, color: NEUTRAL.textSecondary },
  arrow: { width: 30, height: 30, borderRadius: 15, backgroundColor: NEUTRAL.surfaceAlt, alignItems: "center", justifyContent: "center" },
  tag: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: NEUTRAL.surfaceAlt, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  tagText: { fontSize: CARD_TEXT.tiny, color: NEUTRAL.textSecondary },
});
