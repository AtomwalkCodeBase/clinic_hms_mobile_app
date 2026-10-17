import { View, Text, StyleSheet } from "react-native";
import Svg, { Rect, Path, Circle } from "react-native-svg";
import { Check } from "lucide-react-native";
import { docTypeStyle } from "@/theme/docTypes";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { CARD } from "@/theme/cardSizes";

/** Two sheets of paper with a tick, drawn in the app's colour. */
function DocIllustration({ color }: { color: string }) {
  return (
    <Svg width={84} height={94} viewBox="0 0 70 78">
      <Rect x={14} y={6} width={44} height={58} rx={6} fill={color} opacity={0.18} transform="rotate(8 36 35)" />
      <Rect x={9} y={8} width={44} height={58} rx={6} fill="#FFFFFF" stroke={color} strokeWidth={2} />
      <Rect x={16} y={20} width={30} height={4} rx={2} fill={color} opacity={0.45} />
      <Rect x={16} y={30} width={22} height={4} rx={2} fill={color} opacity={0.25} />
      <Rect x={16} y={40} width={28} height={4} rx={2} fill={color} opacity={0.25} />
      <Circle cx={50} cy={58} r={13} fill={color} />
      <Path d="M44 58 l5 5 l9 -10" stroke="#FFFFFF" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/**
 * The header of the Bulk Upload screen once the files have been read: "Classification complete" and one sentence that
 * says what was found, each type in its own colour ("We found 3 prescriptions, 2 lab reports and 1 bill.").
 */
export function BatchSummaryCard({ counts }: { counts: { code: string; count: number }[] }) {
  const { theme } = useAppTheme();
  if (!counts.length) return null;
  return (
    <View style={styles.card}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.titleRow}>
          <View style={[styles.tick, { backgroundColor: theme.fill }]}><Check size={15} color={theme.on} strokeWidth={3.4} /></View>
          <Text style={styles.title}>Classification complete</Text>
        </View>
        <Text style={styles.sentence}>
          We found{" "}
          {counts.map((c, i) => {
            const s = docTypeStyle(c.code);
            const last = i === counts.length - 1;
            return (
              <Text key={c.code}>
                <Text style={{ color: s.ink, fontWeight: "800" }}>{c.count} {c.count === 1 ? s.singular : s.plural}</Text>
                {last ? "." : i === counts.length - 2 ? " and " : ", "}
              </Text>
            );
          })}
        </Text>
      </View>
      <DocIllustration color={theme.fill} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: NEUTRAL.successBg, borderRadius: CARD.radius + 4, borderWidth: 0.5, borderColor: NEUTRAL.border, paddingVertical: 24, paddingLeft: 20, paddingRight: 14, marginBottom: 14 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  tick: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "800", color: NEUTRAL.textPrimary },
  sentence: { fontSize: 16, lineHeight: 24, color: NEUTRAL.textSecondary },
});
