import { View, Text, StyleSheet, Pressable, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { IconBadge } from "@/components/IconBadge";
import { NEUTRAL } from "@/theme/themes";
import { WHISPER_GREEN } from "@/theme/gadgetSurface";
import type { LucideIcon } from "@/theme/icons";

/**
 * A tinted structural shape for the per-person colours in theme/familyColors.ts (age/gender-derived tints used on the
 * Health detail screens' list rows) — not used by GadgetCard itself any more.
 */
export interface GadgetTint {
  bg: readonly [string, string, string];
  icon: readonly [string, string, string];
  shadow: string;
  border: string;
}

/**
 * The gadget tile used on the Home and Health tabs. Every tile has the same Whisper green surface and the same emerald
 * icon badge (see theme/gadgetSurface.ts), so the grids read as one family.
 */
export function GadgetCard({
  icon,
  title,
  subtitle,
  onPress,
  disabled,
  iconSize = 36,
  radius = 16,
  cardPadding = 14,
  badge,
  style,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onPress: () => void;
  disabled?: boolean;
  iconSize?: number;
  /** Overrides the default 16px corner radius — e.g. the bigger, more curved tiles on Home and Health. */
  radius?: number;
  cardPadding?: number;
  /** A small gold pill in the card's corner, e.g. "3 to review". */
  badge?: string;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.wrap, { borderRadius: radius, shadowColor: WHISPER_GREEN.shadow, shadowOpacity: WHISPER_GREEN.shadowOpacity }, disabled && styles.disabled, style]}
    >
      <LinearGradient
        colors={WHISPER_GREEN.bg}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, { borderRadius: radius, padding: cardPadding, borderColor: WHISPER_GREEN.border }]}
      >
        <LinearGradient
          colors={WHISPER_GREEN.sheen}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.8, y: 0.9 }}
          style={StyleSheet.absoluteFill}
        />
        {!!badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
        <View style={styles.content}>
          <IconBadge icon={icon} size={iconSize} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 7,
    elevation: 3,
  },
  disabled: { opacity: 0.65 },
  // flex: 1 so the visible gradient card fills whatever height the outer Pressable ends up with when a 2-up grid row
  // stretches it to match a taller sibling — without it, the shadow (attached to the taller, stretched Pressable) sat
  // below an invisible gap under the shorter visible card, reading as a misaligned floating shadow.
  card: { flex: 1, borderRadius: 16, padding: 14, borderWidth: 1, overflow: "hidden" },
  content: { position: "relative" },
  badge: { position: "absolute", top: 10, right: 10, backgroundColor: "#F2B544", borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1.5, zIndex: 2 },
  badgeText: { fontSize: 10.5, fontWeight: "700", color: "#3B2A05" },
  title: { fontSize: 13, fontWeight: "700", color: NEUTRAL.textPrimary, marginTop: 10 },
  sub: { fontSize: 10.5, color: NEUTRAL.textSecondary, marginTop: 4, lineHeight: 14 },
});
