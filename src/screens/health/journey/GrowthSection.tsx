import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { GrowthIndicator, GrowthSeries, HealthTimeline, TimelineLane } from "@/api/types";
import { EmptyState } from "@/components/Layout";
import { GrowthCurve } from "@/components/health/GrowthCurve";
import { GrowthChartSkeleton } from "@/components/health/ChartSkeleton";
import { FloatingCard, type Anchor } from "@/components/health/FloatingCard";
import { Chip } from "@/components/health/JourneyBits";
import { Marker } from "@/components/health/Marker";
import { TONES } from "@/components/health/journeyTheme";
import { J } from "@/components/health/journeyStyles";
import { CHART, GROWTH_FLAG_LABEL, formatDate, ordinal } from "@/components/health/chartTheme";
import { ageOn, monthYear } from "@/utils/journey";
import { NEUTRAL } from "@/theme/themes";

export const INDICATORS: { key: GrowthIndicator; label: string; unit: string; noun: string }[] = [
  { key: "weight_kg", label: "Weight", unit: "kg", noun: "weight" },
  { key: "height_cm", label: "Height", unit: "cm", noun: "height" },
  { key: "head_circ_cm", label: "Head size", unit: "cm", noun: "head size" },
];

/**
 * Weight, height or head size on the WHO / IAP bands, with the latest reading and any weight dip. A tap on a dot opens a
 * card next to it; the cross or a tap outside closes it. The Weight / Height / Head size choice is in the pinned top.
 */
export function GrowthSection({ indicator, growth, timeline, dob }: {
  indicator: GrowthIndicator;
  growth: GrowthSeries | undefined;
  /** the since-birth timeline: only its weight-dip alerts are used */
  timeline: HealthTimeline | undefined;
  dob: string | undefined;
}) {
  const [popped, setPopped] = useState<{ index: number; anchor: Anchor } | null>(null);
  const ind = INDICATORS.find((i) => i.key === indicator)!;
  const growthLane = timeline?.lanes.find((l): l is Extract<TimelineLane, { type: "growth" }> => l.type === "growth");
  const alerts = growthLane?.alerts ?? [];
  const dipDates = useMemo(() => (indicator === "weight_kg" ? alerts.map((a) => a.to) : []), [alerts, indicator]);
  const pts = growth?.points ?? [];
  const last = pts[pts.length - 1];
  const sel = popped ? pts[popped.index] : null;

  if (!growth) {
    return (
      <View style={J.stack}>
        <View style={J.card}><View style={[styles.skLine, { width: "55%" }]} /><View style={[styles.skLine, { width: "35%", height: 30, marginTop: 8 }]} /></View>
        <View style={J.card}><GrowthChartSkeleton /></View>
      </View>
    );
  }
  if (pts.length === 0) return <EmptyState text={`No ${ind.noun} readings yet. They are picked up automatically from prescriptions.`} />;

  return (
    <View style={J.stack}>
      <View style={[J.card, J.row, { justifyContent: "space-between", gap: 10 }]}>
        <View style={{ flex: 1 }}>
          <Text style={J.caption}>Latest · {formatDate(last.date)}{dob ? ` · age ${ageOn(dob, last.date)}` : ""}</Text>
          <Text style={styles.value}>{last.value} <Text style={styles.unit}>{ind.unit}</Text></Text>
          {last.percentile != null && <Text style={J.body}>{ordinal(last.percentile)} centile</Text>}
        </View>
        {last.flag ? <Chip tone="serious" text={GROWTH_FLAG_LABEL[last.flag] ?? "Outside usual range"} /> : <Chip tone="good" text="✓ Expected range" />}
      </View>

      <View style={J.card}>
        <Text style={[J.caption, { marginBottom: 4 }]}>{ind.label} ({ind.unit}) by {growth.uses_corrected_age ? "corrected age" : "age"}</Text>
        <GrowthCurve series={growth} dipDates={dipDates} selectedIndex={popped?.index ?? null} onSelect={(index, anchor) => setPopped({ index, anchor })} />
        <Text style={[J.caption, { marginTop: 6 }]}>Tap a dot to see that reading. Slide the chart sideways to go back in time.</Text>
        <View style={styles.legend}>
          <View style={styles.legendItem}><View style={{ width: 14, height: 8, borderRadius: 2, backgroundColor: CHART.bandInner }} /><Text style={styles.legendText}>Expected range (2nd–98th)</Text></View>
          <View style={styles.legendItem}><View style={{ width: 16, height: 2, backgroundColor: CHART.ink }} /><Text style={styles.legendText}>Your child</Text></View>
          <View style={styles.legendItem}><View style={{ width: 16, height: 0, borderTopWidth: 1.5, borderStyle: "dashed", borderColor: CHART.median }} /><Text style={styles.legendText}>50th centile</Text></View>
          {dipDates.length > 0 && <View style={styles.legendItem}><Marker shape="diamond" tone="serious" size={11} /><Text style={styles.legendText}>Dip noted</Text></View>}
        </View>
        <Text style={[J.caption, { marginTop: 6 }]}>{growth.reference_note}.{growth.uses_corrected_age ? " Born early, so age is corrected until 2 years." : ""}</Text>
      </View>

      {indicator === "weight_kg" && alerts.map((a) => (
        <View key={a.from} style={[J.card, { backgroundColor: TONES.serious.tint, gap: 3 }]}>
          <Text style={J.cardTitle}>Weight dropped across centile lines</Text>
          <Text style={J.body}>Between {monthYear(a.from)} and {monthYear(a.to)}. Your doctor can tell you if this needs follow-up.</Text>
        </View>
      ))}

      <FloatingCard anchor={popped?.anchor ?? null} onClose={() => setPopped(null)}>
        {sel && (
          <View>
            <Text style={styles.cardSub}>{formatDate(sel.date)}{dob ? ` · age ${ageOn(dob, sel.date)}` : ""}</Text>
            <Text style={styles.cardTitle}>{sel.value} {ind.unit}</Text>
            {sel.percentile != null && <Text style={styles.cardSub}>{ordinal(sel.percentile)} centile</Text>}
          </View>
        )}
      </FloatingCard>
    </View>
  );
}

const styles = StyleSheet.create({
  value: { fontSize: 32, fontWeight: "700", color: NEUTRAL.textPrimary, lineHeight: 38 },
  unit: { fontSize: 18, fontWeight: "700" },
  legend: { flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 4, marginTop: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendText: { fontSize: 11.5, color: NEUTRAL.textSecondary },
  cardSub: { fontSize: 12, color: "#C9D3D9" },
  cardTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  skLine: { height: 12, borderRadius: 6, backgroundColor: "#DDE5EE" },
});
