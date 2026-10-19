import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useNavigation, CompositeNavigationProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { Screen, ErrorBanner } from "@/components/Layout";
import { MetalHero } from "@/components/MetalHero";
import { GadgetCard } from "@/components/GadgetCard";
import { SkeletonBlock, SkeletonGadgetCard } from "@/components/Skeleton";
import { Syringe, Clock, Stethoscope, Users, ChevronDown, Plus } from "lucide-react-native";
import { familyAccentFor } from "@/theme/familyColors";
import { usePeople, usePersonSwitcher, paramsFor } from "@/hooks/usePeople";
import { getHealthSummary, getImmunization } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { AppStackParamList, AppTabsParamList } from "@/navigation/types";
import { ON_BRAND, BRAND, BRAND_TEXT, NEUTRAL } from "@/theme/themes";

type Nav = CompositeNavigationProp<BottomTabNavigationProp<AppTabsParamList, "Health">, NativeStackNavigationProp<AppStackParamList>>;

/** The vaccination schedule is a child's: it says nothing useful about an adult. */
function isChild(dob: string | null): boolean {
  return !!dob && (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000) < 18;
}

function ageFromDob(dob: string | null): string {
  if (!dob) return "";
  const years = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
  return `${years} yrs`;
}

export function HealthScreen() {
  const navigation = useNavigation<Nav>();

  const [selectedAwpid, setSelectedAwpid] = useState<string>("");
  const { people, profileQ, familyQ } = usePeople();
  const switcher = usePersonSwitcher(people, selectedAwpid, (p) => setSelectedAwpid(p.awpid));

  // Default to Self once the profile first loads — same as the old
  // loadPeople() side effect, just expressed as syncing local UI state to
  // the query result instead of setting it inline during a fetch.
  useEffect(() => {
    if (!selectedAwpid && profileQ.data) setSelectedAwpid(profileQ.data.awpid);
  }, [profileQ.data, selectedAwpid]);

  const selected = people.find((p) => p.awpid === selectedAwpid);
  const target = selected && !selected.isSelf ? selected.awpid : undefined;
  // Self keeps the personal accent theme — only dependents get an
  // age/gender-derived color, and only when one applies (see familyColors.ts).
  const accent = selected && !selected.isSelf ? familyAccentFor(selected) : null;

  // Self (target undefined) uses the same 1-element key HealthSummaryScreen/
  // LinkedHospitalsScreen use for the identical self-only call — shares
  // that cache entry; a selected dependent gets its own keyed entry.
  const summaryQ = useQuery({
    queryKey: target ? ["healthSummary", target] : ["healthSummary"],
    queryFn: () => getHealthSummary(target),
    enabled: !!selectedAwpid,
  });
  const summary = summaryQ.data ?? null;
  // The overdue count on the Vaccinations card. Same key as the Vaccinations screen, so opening it afterwards is instant.
  const showDue = !!selectedAwpid && isChild(selected?.date_of_birth ?? null);
  const immunizationQ = useQuery({
    queryKey: ["immunization", selectedAwpid],
    queryFn: () => getImmunization(selectedAwpid),
    enabled: showDue,
  });
  const dueCount = showDue && immunizationQ.data ? immunizationQ.data.summary.overdue + immunizationQ.data.summary.due : 0;
  const error = profileQ.error || familyQ.error || summaryQ.error;
  // Nothing meaningful can render before the profile itself has ever
  // loaded once — everything else (hero, switcher, gadgets) hangs off
  // `selected`, which needs `profileQ.data`. That first-ever wait gets the
  // skeleton; every refetch after it (stale refocus or pull-to-refresh)
  // keeps showing the last-known content instead.
  const isInitialLoading = !profileQ.data;
  const isFetchingAny = profileQ.isFetching || familyQ.isFetching || summaryQ.isFetching || (showDue && immunizationQ.isFetching);

  const refetchAll = useCallback(async () => {
    await Promise.all([profileQ.refetch(), familyQ.refetch(), summaryQ.refetch(), showDue && immunizationQ.refetch()]);
  }, [profileQ.refetch, familyQ.refetch, summaryQ.refetch, immunizationQ.refetch, showDue]);
  useRefreshOnFocus(showDue ? [profileQ, familyQ, summaryQ, immunizationQ] : [profileQ, familyQ, summaryQ]);
  const { refreshing: pulling, onRefresh: pullRefresh } = usePullToRefresh(refetchAll);

  const openGadget = (screen: "Vaccinations" | "HealthTimeline" | "HealthVisits") => {
    if (!selected) return;
    navigation.navigate(screen, paramsFor(selected));
  };

  if (isInitialLoading) {
    return (
      <Screen bottomInset={false}>
        <View style={[styles.hero, { padding: 16, height: 128, backgroundColor: BRAND, borderRadius: 24 }]}>
          <SkeletonBlock width={150} height={18} style={{ backgroundColor: "rgba(255,255,255,0.25)" }} />
          <SkeletonBlock width={210} height={12} style={{ marginTop: 10, backgroundColor: "rgba(255,255,255,0.25)" }} />
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
          <SkeletonBlock width={110} height={30} radius={16} />
          <SkeletonBlock width={80} height={30} radius={16} />
          <SkeletonBlock width={80} height={30} radius={16} />
        </View>
        <View style={styles.grid}>
          <SkeletonGadgetCard style={styles.gadgetSize} />
          <SkeletonGadgetCard style={styles.gadgetSize} />
          <SkeletonGadgetCard style={styles.gadgetSize} />
          <SkeletonGadgetCard style={styles.gadgetSize} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      onRefresh={pullRefresh}
      refreshing={pulling}
      backgroundLoading={isFetchingAny && !pulling}
      accentColor={accent?.fill}
      topColor={accent?.fill}
      bottomInset={false}
    >
      {selected && (
        <MetalHero style={styles.hero} curved overrideColor={accent?.fill} onBack={() => navigation.navigate("Home")}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, accent && { color: accent.on }]}>{selected.full_name}</Text>
            {!!accent && (
              <View style={[styles.accentBadge, { backgroundColor: "rgba(255,255,255,0.22)" }]}>
                <Text style={[styles.accentBadgeText, { color: accent.on }]}>{accent.label}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.meta, accent && { color: accent.on, opacity: 0.85 }]}>
            {ageFromDob(selected.date_of_birth)} · {selected.gender === "M" ? "Male" : selected.gender === "F" ? "Female" : "—"} · AWPID: {selected.awpid}
          </Text>
          {summary?.last_hospital && (
            <Text style={[styles.lastVisit, accent && { color: accent.on, opacity: 0.85 }]}>
              {summary.last_hospital} · Last visit: {summary.last_visit}
            </Text>
          )}
        </MetalHero>
      )}

      {/* Whose records: the member count, Switch (opens the list) and Add. The name is already in the header above. */}
      <View style={styles.switchCard}>
        <View style={styles.switchCell}>
          <Users size={20} color={BRAND_TEXT} strokeWidth={2.2} />
          <Text style={styles.countText}>{people.length - 1} members</Text>
        </View>
        <View style={styles.switchDivider} />
        <Pressable onPress={switcher.open} accessibilityRole="button" accessibilityLabel="Switch family member" style={styles.switchCell}>
          <Text style={styles.switchText}>Switch</Text>
          <ChevronDown size={18} color={BRAND_TEXT} strokeWidth={2.6} />
        </Pressable>
        <View style={styles.switchDivider} />
        <Pressable onPress={() => navigation.navigate("AddFamilyMember")} accessibilityRole="button" accessibilityLabel="Add family member" style={styles.switchCell}>
          <Plus size={18} color={BRAND_TEXT} strokeWidth={2.8} />
          <Text style={styles.switchText}>Add</Text>
        </Pressable>
      </View>
      {switcher.sheet}

      {!!error && <ErrorBanner message={apiErrorMessage(error)} onRetry={refetchAll} />}

      <View style={styles.grid}>
        <GadgetCard
          icon={Clock}
          title="Health timeline"
          onPress={() => openGadget("HealthTimeline")}
          style={styles.gadgetSize}
          radius={22}
          cardPadding={20}
        />
        <GadgetCard
          icon={Syringe}
          title="Vaccinations"
          onPress={() => openGadget("Vaccinations")}
          badge={dueCount > 0 ? `${dueCount} due` : undefined}
          style={styles.gadgetSize}
          radius={22}
          cardPadding={20}
        />
        <GadgetCard
          icon={Stethoscope}
          title="Visits"
          onPress={() => openGadget("HealthVisits")}
          style={styles.gadgetSize}
          radius={22}
          cardPadding={20}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: 16 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontSize: 16, fontWeight: "700", color: ON_BRAND },
  accentBadge: { paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 10 },
  accentBadgeText: { fontSize: 10, fontWeight: "700" },
  meta: { fontSize: 11.5, color: "rgba(4,38,28,0.78)", marginTop: 3 },
  lastVisit: { fontSize: 11, color: "rgba(4,38,28,0.78)", marginTop: 6 },
  switchCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: NEUTRAL.surface, borderRadius: 18,
    marginTop: 14, marginBottom: 16, paddingVertical: 4,
  },
  switchCell: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 14 },
  switchDivider: { width: 1, height: 26, backgroundColor: NEUTRAL.border },
  countText: { fontSize: 14.5, fontWeight: "800", color: NEUTRAL.textPrimary },
  switchText: { fontSize: 14.5, fontWeight: "800", color: BRAND_TEXT },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 11, marginTop: 8 },
  gadgetSize: { width: "48.5%" },
});
