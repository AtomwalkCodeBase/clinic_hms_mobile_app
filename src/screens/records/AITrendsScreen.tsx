import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from "react-native";
import { useFocusEffect, useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import {
  Sparkles, TrendingUp, TrendingDown, Search, ChevronDown,
  FlaskConical, Droplet, HeartPulse, Shield, Zap, Beaker, Microscope,
} from "lucide-react-native";
import { Screen, BackHeader, EmptyState, ErrorBanner } from "@/components/Layout";
import { ListRow } from "@/components/ListRow";
import { CategoryFilterSheet, CategoryOption } from "@/components/CategoryFilterSheet";
import { TrendMiniChart } from "@/components/TrendMiniChart";
import { getHealthTrends, getHealthInsightNarrative } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { HealthTrendParameter } from "@/api/types";
import { AppStackParamList } from "@/navigation/types";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import type { LucideIcon } from "@/theme/icons";

const RANGE_OPTIONS = [
  { key: "3m", label: "3M" },
  { key: "6m", label: "6M" },
  { key: "12m", label: "12M" },
  { key: "all", label: "All" },
] as const;
type RangeKey = (typeof RANGE_OPTIONS)[number]["key"];

// Mirrors core/report_types.py's panel catalogue — a plain generic icon for
// any panel not in this curated set, rather than one icon per all 15.
const PANEL_ICON: Record<string, LucideIcon> = {
  cbc: FlaskConical, lipid: Droplet, lft: HeartPulse, kft: Droplet,
  thyroid: Zap, diabetes: Zap, urine: Beaker, electrolytes: Zap,
  vitamin: Sparkles, inflammation: HeartPulse, cardiac: HeartPulse,
  coagulation: Droplet, hormone: Zap, infection: Shield, culture: Microscope,
};
const PANEL_COLORS: Record<string, readonly [string, string, string]> = {
  cbc: ["#5b9bd8", "#2A72C9", "#153f61"],
  lipid: ["#e08fb3", "#C23E7E", "#6e2247"],
  cardiac: ["#e2947a", "#C96A2A", "#6b3814"],
  lft: ["#e2947a", "#C96A2A", "#6b3814"],
  kft: ["#5cc7ab", "#1F8F6E", "#0f4a3a"],
  electrolytes: ["#5cc7ab", "#1F8F6E", "#0f4a3a"],
  thyroid: ["#5cc78f", "#227A45", "#12452a"],
  hormone: ["#5cc78f", "#227A45", "#12452a"],
  diabetes: ["#e0b85c", "#BD8A25", "#5f450f"],
  inflammation: ["#e0b85c", "#BD8A25", "#5f450f"],
};
const DEFAULT_PANEL_COLOR: readonly [string, string, string] = ["#a8adb3", "#5A6B7A", "#33404b"];

function fmtDate(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function AITrendsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "AITrends">>();
  const patientAwpid = route.params?.patientAwpid;
  const { theme } = useAppTheme();

  const [range, setRange] = useState<RangeKey>("12m");
  const [parameters, setParameters] = useState<HealthTrendParameter[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<"line" | "bar">("line");

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<Set<string>>(new Set());
  const [showCatSheet, setShowCatSheet] = useState(false);

  const [narrative, setNarrative] = useState<string | null>(null);
  const [narrLoading, setNarrLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // minPoints: 1 — every analyte the patient has ANY confident reading
      // for is selectable, not just the ones that already have enough
      // history to chart. A single-reading one gets a "needs one more
      // reading" state below instead of being absent from the picker.
      const res = await getHealthTrends({ range, patientAwpid, minPoints: 1 });
      setParameters(res.parameters);
      setSelectedSlug((prev) =>
        prev && res.parameters.some((p) => p.slug === prev) ? prev : res.parameters[0]?.slug ?? null
      );
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [range, patientAwpid]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const selected = parameters.find((p) => p.slug === selectedSlug) || null;
  const hasTrend = !!selected && selected.points.length >= 2;

  // Reaching this screen at all is the patient's explicit ask — no separate
  // "yes, generate" confirm step needed on top of that. Re-fires whenever
  // the selected parameter or range changes so the narrative always matches
  // what the chart above it is showing. Skipped entirely for a parameter
  // with only one reading — core.health_insight.generate_trend_narrative
  // would just return null for it anyway, no need to spend the round trip.
  useEffect(() => {
    if (!selectedSlug || !hasTrend) { setNarrative(null); setNarrLoading(false); return; }
    let cancelled = false;
    setNarrLoading(true);
    setNarrative(null);
    getHealthInsightNarrative({ parameterSlug: selectedSlug, range, patientAwpid })
      .then((res) => { if (!cancelled) setNarrative(res.narrative); })
      .catch(() => { if (!cancelled) setNarrative(null); })
      .finally(() => { if (!cancelled) setNarrLoading(false); });
    return () => { cancelled = true; };
  }, [selectedSlug, hasTrend, range, patientAwpid]);

  const overview = (() => {
    const trending = parameters.filter((p) => p.points.length >= 2);
    if (trending.length === 0) {
      return parameters.length > 0
        ? `You have ${parameters.length} tracked value${parameters.length === 1 ? "" : "s"} so far. Add another report with the same test to start seeing trends.`
        : null;
    }
    const flagged = trending.find((p) => p.latest_status === "high" || p.latest_status === "low");
    if (flagged) {
      const first = flagged.points[0].value, last = flagged.points[flagged.points.length - 1].value;
      const dir = last > first ? "risen" : "dropped";
      return `Looking at ${trending.length > 1 ? `${trending.length} tracked values` : "your reports"}, one stands out: your ${flagged.label} has ${dir} recently.${trending.length > 1 ? " Everything else is holding steady." : ""}`;
    }
    return `Looking at ${trending.length} tracked value${trending.length === 1 ? "" : "s"} across your reports — nothing out of range right now.`;
  })();

  // Every panel present across the patient's tracked values, with a count —
  // built from real data (SharedDocument.report_categories via the API),
  // never a hardcoded catalogue that might not match what they've actually
  // had tested.
  const catOptions: CategoryOption[] = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const p of parameters) {
      for (const panel of p.panels) {
        const existing = counts.get(panel.slug);
        counts.set(panel.slug, { label: panel.label, count: (existing?.count ?? 0) + 1 });
      }
    }
    return [...counts.entries()]
      .map(([value, v]) => ({ value, label: v.label, count: v.count }))
      .sort((a, b) => b.count - a.count);
  }, [parameters]);

  const isBrowsing = search.trim().length > 0 || catFilter.size > 0;
  const results = useMemo(() => {
    if (!isBrowsing) return [];
    const q = search.trim().toLowerCase();
    return parameters.filter((p) => {
      const matchesSearch = !q || p.label.toLowerCase().includes(q);
      const matchesCat = catFilter.size === 0 || p.panels.some((pan) => catFilter.has(pan.slug));
      return matchesSearch && matchesCat;
    });
  }, [parameters, search, catFilter, isBrowsing]);

  const pickParameter = (slug: string) => {
    setSelectedSlug(slug);
    setSearch("");
    setCatFilter(new Set());
  };

  return (
    <Screen onRefresh={load} refreshing={loading}>
      <BackHeader title="AI Trends" onBack={() => navigation.goBack()} />
      {!!error && <ErrorBanner message={error} onRetry={load} />}

      {!loading && parameters.length === 0 && !error ? (
        <EmptyState text="Not enough data yet — trends need at least two readings of the same test." />
      ) : (
        <>
          {!!overview && (
            <LinearGradient
              colors={[theme.text, theme.fill]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.overviewCard}
            >
              <View style={styles.overviewIcon}>
                <Sparkles size={18} color="#fff" strokeWidth={2.2} />
              </View>
              <Text style={styles.overviewText}>{overview}</Text>
            </LinearGradient>
          )}

          <View style={styles.searchRow}>
            <Search size={14} color={NEUTRAL.textMuted} strokeWidth={2.2} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search a value (e.g. Hemoglobin, TSH)"
              placeholderTextColor={NEUTRAL.textMuted}
              style={styles.searchInput}
            />
          </View>
          {catOptions.length > 0 && (
            <Pressable
              onPress={() => setShowCatSheet(true)}
              style={[styles.catTrigger, catFilter.size > 0 && { borderColor: theme.fill }]}
            >
              <Text style={[styles.catTriggerText, catFilter.size > 0 && { color: theme.text, fontWeight: "700" }]} numberOfLines={1}>
                {catFilter.size === 0
                  ? "All categories"
                  : catFilter.size === 1
                  ? catOptions.find((o) => o.value === [...catFilter][0])?.label
                  : `${catFilter.size} categories`}
              </Text>
              <ChevronDown size={13} color={catFilter.size > 0 ? theme.fill : NEUTRAL.textMuted} />
            </Pressable>
          )}

          {isBrowsing ? (
            <View style={{ marginBottom: 14 }}>
              {results.length === 0 ? (
                <Text style={styles.noResults}>No tracked value matches that search.</Text>
              ) : (
                results.map((p) => {
                  const panel = p.panels[0];
                  const Icon = (panel && PANEL_ICON[panel.slug]) || FlaskConical;
                  const iconColors = (panel && PANEL_COLORS[panel.slug]) || DEFAULT_PANEL_COLOR;
                  const flagged = p.latest_status === "high" || p.latest_status === "low";
                  const single = p.points.length < 2;
                  return (
                    <ListRow
                      key={p.slug}
                      icon={Icon}
                      iconColors={iconColors}
                      iconShadowColor={iconColors[2]}
                      title={p.label}
                      subtitle={panel ? `${panel.label} · ${p.points.length} report${p.points.length === 1 ? "" : "s"}` : `${p.points.length} report${p.points.length === 1 ? "" : "s"}`}
                      pillLabel={flagged ? "Flagged" : single ? "1 reading" : undefined}
                      pillTone={flagged ? "danger" : single ? "warning" : undefined}
                      onPress={() => pickParameter(p.slug)}
                    />
                  );
                })
              )}
            </View>
          ) : (
            <Text style={styles.browseHint}>
              Search a value above, or filter by category, to explore everything we're tracking — {parameters.length} value{parameters.length === 1 ? "" : "s"} in total.
            </Text>
          )}

          <View style={styles.rangeRow}>
            {RANGE_OPTIONS.map((o) => {
              const on = o.key === range;
              return (
                <Pressable key={o.key} onPress={() => setRange(o.key)} style={[styles.rangeChip, on && { backgroundColor: NEUTRAL.textPrimary }]}>
                  <Text style={[styles.rangeChipT, on && { color: "#fff" }]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {selected && (
            <View style={styles.chartCard}>
              <View style={styles.chartHead}>
                <View>
                  <Text style={styles.chartTitle}>{selected.label}</Text>
                  <Text style={styles.chartSub}>{selected.unit} · {selected.points.length} report{selected.points.length === 1 ? "" : "s"}</Text>
                </View>
                {hasTrend && (() => {
                  const first = selected.points[0].value, last = selected.points[selected.points.length - 1].value;
                  const delta = last - first;
                  if (Math.abs(delta) < 0.001) return null;
                  const worsening =
                    (selected.concern === "higher_is_concern" && delta > 0) ||
                    (selected.concern === "lower_is_concern" && delta < 0);
                  const Icon = delta > 0 ? TrendingUp : TrendingDown;
                  return (
                    <View style={[styles.deltaPill, { backgroundColor: worsening ? NEUTRAL.dangerBg : NEUTRAL.surfaceAlt }]}>
                      <Icon size={13} color={worsening ? NEUTRAL.danger : NEUTRAL.textSecondary} strokeWidth={2.4} />
                      <Text style={[styles.deltaText, { color: worsening ? NEUTRAL.danger : NEUTRAL.textSecondary }]}>
                        {delta > 0 ? "+" : ""}{Math.round(delta * 10) / 10}
                      </Text>
                    </View>
                  );
                })()}
              </View>

              {hasTrend ? (
                <>
                  <View style={styles.viewToggle}>
                    <Pressable onPress={() => setView("line")} style={[styles.viewBtn, view === "line" && { backgroundColor: NEUTRAL.textPrimary }]}>
                      <Text style={[styles.viewBtnT, view === "line" && { color: "#fff" }]}>Trend</Text>
                    </Pressable>
                    <Pressable onPress={() => setView("bar")} style={[styles.viewBtn, view === "bar" && { backgroundColor: NEUTRAL.textPrimary }]}>
                      <Text style={[styles.viewBtnT, view === "bar" && { color: "#fff" }]}>By report</Text>
                    </Pressable>
                  </View>

                  <TrendMiniChart points={selected.points} unit={selected.unit} variant={view} accentColor={theme.fill} />
                  <Text style={styles.chartCaption}>
                    {view === "bar" ? "Tap any bar for its exact reading" : "Tap any point for its exact reading"}
                  </Text>
                </>
              ) : (
                <View style={styles.needsMoreBox}>
                  <Text style={styles.needsMoreValue}>
                    {selected.points[0].value}{selected.unit}
                    {selected.points[0].status && selected.points[0].status !== "normal" ? ` · ${selected.points[0].status === "high" ? "High" : "Low"}` : ""}
                  </Text>
                  <Text style={styles.needsMoreDate}>{fmtDate(selected.points[0].date)}</Text>
                  <Text style={styles.needsMoreText}>
                    Add 1 more report with a {selected.label} reading to see the trend.
                  </Text>
                </View>
              )}
            </View>
          )}

          {hasTrend && (
            <View style={[styles.narrativeCard, { backgroundColor: theme.bg }]}>
              <Sparkles size={15} color={theme.fill} style={{ marginTop: 1 }} />
              {narrLoading ? (
                <View style={styles.narrLoadingRow}>
                  <ActivityIndicator size="small" color={theme.fill} />
                  <Text style={[styles.narrLoadingT, { color: theme.text }]}>Thinking through your reports…</Text>
                </View>
              ) : (
                <Text style={[styles.narrativeText, { color: theme.text }]}>
                  {narrative || "Couldn't generate an insight for this value right now — please try again later."}
                </Text>
              )}
            </View>
          )}
        </>
      )}

      <CategoryFilterSheet
        visible={showCatSheet}
        options={catOptions}
        selected={[...catFilter]}
        accent={theme.fill}
        onClose={() => setShowCatSheet(false)}
        onApply={(next) => setCatFilter(new Set(next))}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  overviewCard: { flexDirection: "row", gap: 10, borderRadius: 14, padding: 14, marginBottom: 14 },
  overviewIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  overviewText: { flex: 1, fontSize: 12.5, lineHeight: 19, color: "#fff" },
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: NEUTRAL.surface,
    borderWidth: 0.5, borderColor: NEUTRAL.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 13, color: NEUTRAL.textPrimary, padding: 0 },
  catTrigger: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6,
    borderWidth: 0.5, borderColor: NEUTRAL.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 9, marginBottom: 10, backgroundColor: NEUTRAL.surface,
  },
  catTriggerText: { fontSize: 12.5, color: NEUTRAL.textSecondary, flex: 1 },
  noResults: { fontSize: 12.5, color: NEUTRAL.textMuted, textAlign: "center", paddingVertical: 14 },
  browseHint: { fontSize: 12, color: NEUTRAL.textSecondary, lineHeight: 18, marginBottom: 14 },
  rangeRow: { flexDirection: "row", gap: 6, marginBottom: 14 },
  rangeChip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 8, backgroundColor: NEUTRAL.surface, borderWidth: 0.5, borderColor: NEUTRAL.border },
  rangeChipT: { fontSize: 10.5, fontWeight: "700", color: NEUTRAL.textSecondary },
  chartCard: { backgroundColor: NEUTRAL.surface, borderWidth: 0.5, borderColor: NEUTRAL.border, borderRadius: 14, padding: 15, marginBottom: 14 },
  chartHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  chartTitle: { fontSize: 13.5, fontWeight: "800", color: NEUTRAL.textPrimary },
  chartSub: { fontSize: 11, color: NEUTRAL.textMuted, marginTop: 1 },
  deltaPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  deltaText: { fontSize: 12, fontWeight: "800" },
  viewToggle: { flexDirection: "row", gap: 4, backgroundColor: NEUTRAL.surfaceAlt, borderRadius: 9, padding: 3, marginBottom: 10 },
  viewBtn: { flex: 1, paddingVertical: 7, borderRadius: 7, alignItems: "center" },
  viewBtnT: { fontSize: 12, fontWeight: "700", color: NEUTRAL.textSecondary },
  chartCaption: { fontSize: 10, color: NEUTRAL.textMuted, textAlign: "center", marginTop: 4 },
  needsMoreBox: { alignItems: "center", paddingVertical: 18 },
  needsMoreValue: { fontSize: 20, fontWeight: "800", color: NEUTRAL.textPrimary },
  needsMoreDate: { fontSize: 11, color: NEUTRAL.textMuted, marginTop: 2 },
  needsMoreText: { fontSize: 12, color: NEUTRAL.textSecondary, textAlign: "center", marginTop: 12, lineHeight: 18, paddingHorizontal: 8 },
  narrativeCard: { flexDirection: "row", gap: 9, borderRadius: 12, padding: 13, marginBottom: 16 },
  narrativeText: { flex: 1, fontSize: 12, lineHeight: 19 },
  narrLoadingRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  narrLoadingT: { fontSize: 12 },
});
