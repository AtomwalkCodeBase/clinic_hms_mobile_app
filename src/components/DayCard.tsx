import { View, Text, Pressable, StyleSheet } from "react-native";
import { Building2, User } from "lucide-react-native";
import { NEUTRAL, BRAND, BRAND_TEXT, BRAND_TINT } from "@/theme/themes";
import { CardEdge } from "@/components/CardEdge";
import { CARD } from "@/theme/cardSizes";
import { docTypeStyle } from "@/theme/docTypes";
import type { DocumentDay } from "@/api/portal";

const GREEN = { bg: BRAND_TINT, text: BRAND_TEXT };
const BLUE = { bg: "#E3ECFB", text: "#2455C3" };

/** "2026-05-12" as a local date. Built from its parts: new Date("2026-05-12") is UTC midnight and can show the day before. */
export function dayFromIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "12 May 2026" - the title of a day's screen. */
export const dayTitle = (iso: string) =>
  dayFromIso(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

/** "3 files" / "1 file". */
export const filesLabel = (n: number) => `${n} ${n === 1 ? "file" : "files"}`;

/** The most kinds of document a day card names before folding the rest into "+N more". */
const MAX_BADGES = 3;

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * One upload day on the By-date view of My Documents: the date at the left (plain text, no coloured block), how many
 * files that day holds, whose they are, what kinds they are (a small badge per kind: "2 Lab Reports"), and how many
 * came from the patient and how many from a hospital. Tapping it opens that day's files.
 */
export function DayCard({
  day, forName, nameColor, labelOf, onPress,
}: {
  day: DocumentDay;
  forName: string;
  /** the colour of the person's name in "For: <name>" */
  nameColor?: string;
  labelOf: (code?: string | null) => string;
  onPress: () => void;
}) {
  const d = dayFromIso(day.date);

  const kinds = Object.entries(day.by_type).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const badges = kinds.slice(0, MAX_BADGES);
  const more = kinds.length - MAX_BADGES;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${dayTitle(day.date)}, ${filesLabel(day.total)}. Open`}
      style={({ pressed }) => [styles.frame, pressed && { backgroundColor: NEUTRAL.surfaceAlt }]}
    >
      <CardEdge color={BRAND} />
      <View style={styles.row}>
        <View style={styles.dateBox}>
          <Text style={styles.dateDay}>{d.getDate()}</Text>
          <Text style={styles.dateMonth}>{d.toLocaleDateString("en-IN", { month: "short" }).toUpperCase()}</Text>
        </View>

        <View style={styles.main}>
          <Text style={styles.title}>{filesLabel(day.total)}</Text>
          <Text style={styles.whoText} numberOfLines={1}>
          For: <Text style={[styles.whoName, !!nameColor && { color: nameColor }]}>{forName}</Text>
          </Text>
        </View>
      </View>

      {badges.length > 0 && (
        <View style={styles.badges}>
          {badges.map(([code, n]) => (
            <View key={code} style={styles.badge}>
              <View style={[styles.dot, { backgroundColor: docTypeStyle(code).ink }]} />
              <Text style={styles.badgeText}>{n} {n === 1 ? labelOf(code) : titleCase(docTypeStyle(code).plural)}</Text>
            </View>
          ))}
          {more > 0 && (
            <View style={[styles.badge, styles.moreBadge]}>
              <Text style={[styles.badgeText, { color: NEUTRAL.textSecondary }]}>+{more} more</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.src}>
          <View style={[styles.srcIcon, { backgroundColor: GREEN.bg }]}><User size={15} color={GREEN.text} strokeWidth={2.4} /></View>
          <Text style={styles.srcText} numberOfLines={1}>
            <Text style={styles.srcNum}>{day.yours}</Text> Uploaded by you
          </Text>
        </View>
        {day.hospital > 0 && (
          <View style={styles.src}>
            <View style={[styles.srcIcon, { backgroundColor: BLUE.bg }]}><Building2 size={15} color={BLUE.text} strokeWidth={2.4} /></View>
            <Text style={styles.srcText} numberOfLines={1}>
              <Text style={styles.srcNum}>{day.hospital}</Text> From hospital
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: NEUTRAL.surface, borderRadius: CARD.radius,
    paddingTop: 14, paddingHorizontal: 14, marginBottom: CARD.gap,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  // the date: green text with a thin line after it - no background
  dateBox: { width: 50, alignItems: "center", justifyContent: "center", paddingRight: 14, borderRightWidth: 0.5, borderRightColor: NEUTRAL.border, alignSelf: "stretch" },
  dateDay: { fontSize: 26, fontWeight: "800", lineHeight: 30, color: GREEN.text },
  dateMonth: { fontSize: 13, fontWeight: "700", letterSpacing: 0.8, color: GREEN.text },

  main: { flex: 1 },
  title: { fontSize: 18.5, fontWeight: "800", color: NEUTRAL.textPrimary },
  whoText: { fontSize: 15, color: NEUTRAL.textSecondary, marginTop: 4 },
  whoName: { fontWeight: "800", color: NEUTRAL.textPrimary },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: NEUTRAL.surface,
    borderWidth: 1, borderColor: NEUTRAL.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  moreBadge: { backgroundColor: "#E9EAEE", borderColor: "#E9EAEE" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  badgeText: { fontSize: 13.5, fontWeight: "700", color: NEUTRAL.textPrimary },

  footer: {
    flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 18, rowGap: 6,
    borderTopWidth: 0.5, borderTopColor: NEUTRAL.border, marginTop: 12, marginHorizontal: -14, paddingHorizontal: 14, paddingVertical: 10,
  },
  src: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  srcIcon: { width: 26, height: 26, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  srcText: { fontSize: 14, color: NEUTRAL.textSecondary, flexShrink: 1 },
  srcNum: { fontWeight: "800", color: NEUTRAL.textPrimary },
});
