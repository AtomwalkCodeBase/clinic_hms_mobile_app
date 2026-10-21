import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import { ChevronRight } from "lucide-react-native";
import { NEUTRAL } from "@/theme/themes";
import { Marker } from "./Marker";
import { INK, MIN_TAP, TONES } from "./journeyTheme";
import type { Chip as ChipModel, Mark, Shape, Tone } from "@/utils/journey";

/** A small rounded label: "Happens often", "Hospital care needed". Text never relies on colour alone. */
export function Chip({ text, tone = "acute" }: { text: string; tone?: Tone }) {
  const c = TONES[tone];
  return (
    <View style={[styles.chip, { backgroundColor: c.tint }]}>
      <Text style={[styles.chipText, { color: c.text }]}>{text}</Text>
    </View>
  );
}

export function ChipRow({ chips }: { chips: ChipModel[] }) {
  if (!chips.length) return null;
  return <View style={styles.chips}>{chips.map((c) => <Chip key={c.text} text={c.text} tone={c.tone} />)}</View>;
}

/** The four counts at the top of the overview, small so the timeline below gets the room. */
export function SummaryTiles({ counts, hints }: {
  counts: { chronic: number; acute: number; recurrent: number; hospital: number };
  hints: { chronic: string; acute: string; recurrent: string; hospital: string };
}) {
  const tiles = [
    { marker: <Marker shape="bar" tone="chronic" size={11} />, value: counts.chronic, label: "Ongoing", hint: hints.chronic },
    { marker: <Marker shape="dot" tone="acute" size={13} />, value: counts.acute, label: "Short illnesses", hint: hints.acute },
    { marker: <Marker shape="recurrent" size={11} />, value: counts.recurrent, label: "Happen often", hint: hints.recurrent },
    { marker: <Marker shape="diamond" tone="critical" size={11} />, value: counts.hospital, label: counts.hospital === 1 ? "Hospital stay" : "Hospital stays", hint: hints.hospital },
  ];
  return (
    <View style={styles.tiles}>
      {tiles.map((t) => (
        <View key={t.label} style={styles.tile} accessibilityLabel={`${t.value} ${t.label}. ${t.hint}`}>
          <View style={styles.tileTop}>
            {t.marker}
            <Text style={styles.tileValue}>{t.value}</Text>
            <Text style={styles.tileLabel} numberOfLines={1}>{t.label}</Text>
          </View>
          <Text style={styles.tileHint} numberOfLines={1}>{t.hint}</Text>
        </View>
      ))}
    </View>
  );
}

/** What a tapped mark says, inside the floating card: when, what, and a way on to the episode or the report. */
export function MarkDetail({ mark, onEpisode, onReport }: { mark: Mark; onEpisode: (laneId: string) => void; onReport: (id: number) => void }) {
  const link = mark.episodeLaneId
    ? { label: "See details", go: () => onEpisode(mark.episodeLaneId!) }
    : mark.documentId
      ? { label: mark.kind === "admission" ? "View discharge summary" : "Open report", go: () => onReport(mark.documentId!) }
      : null;
  return (
    <View style={{ gap: 6 }}>
      <View>
        {!!mark.sub && <Text style={styles.markSub}>{mark.sub}</Text>}
        <Text style={styles.markTitle}>{mark.title}</Text>
      </View>
      {mark.chip ? <Chip text={mark.chip.text} tone={mark.chip.tone} /> : null}
      {link ? (
        <Pressable accessibilityRole="link" onPress={link.go} style={styles.markLink}>
          <Text style={styles.markLinkText}>{link.label}</Text>
          <ChevronRight size={18} color="#FFFFFF" strokeWidth={2.4} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** The meaning of the marks, one line of small shapes with names: shared by the timeline and growth charts. */
export function Legend({ items }: { items: { shape: Shape; tone: Tone; label: string }[] }) {
  return (
    <View style={styles.legend}>
      {items.map((l) => (
        <View key={l.label} style={styles.legendItem}>
          <Marker shape={l.shape} tone={l.tone} size={11} />
          <Text style={styles.legendText}>{l.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** The ring of the vaccines tab: the share of due doses that are given. */
export function VaccineRing({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  return (
    <Svg width={64} height={64} accessibilityLabel={`${Math.round(p)} percent of due doses given`}>
      <Circle cx={32} cy={32} r={r} stroke={NEUTRAL.surfaceAlt} strokeWidth={7} fill="none" />
      <Circle cx={32} cy={32} r={r} stroke={TONES.good.fg} strokeWidth={7} fill="none" strokeLinecap="round" strokeDasharray={`${(c * p) / 100} ${c}`} transform="rotate(-90 32 32)" />
      <SvgText x={32} y={36} fontSize={Math.round(p) >= 100 ? 12 : 14} fontWeight="700" fill={INK} textAnchor="middle">{`${Math.round(p)}%`}</SvgText>
    </Svg>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  chipText: { fontSize: 12, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { width: "48.5%", backgroundColor: NEUTRAL.surface, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8 },
  tileTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  tileValue: { fontSize: 20, fontWeight: "700", color: INK, fontVariant: ["tabular-nums"] },
  tileLabel: { flex: 1, minWidth: 0, fontSize: 12, fontWeight: "600", color: INK },
  tileHint: { fontSize: 11, color: NEUTRAL.textMuted, marginTop: 1 },
  markSub: { fontSize: 12, color: "#C9D3D9" },
  markTitle: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  legend: { flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 6, paddingTop: 8, paddingHorizontal: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendText: { fontSize: 11.5, color: NEUTRAL.textSecondary },
  markLink: { minHeight: MIN_TAP, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.2)", marginTop: 4 },
  markLinkText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
});
