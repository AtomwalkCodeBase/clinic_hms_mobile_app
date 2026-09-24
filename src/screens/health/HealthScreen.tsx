import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useNavigation, CompositeNavigationProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { Screen, ErrorBanner } from "@/components/Layout";
import { SegmentedControl } from "@/components/SegmentedControl";
import { MetalHero } from "@/components/MetalHero";
import { GadgetCard, GADGET_TINTS } from "@/components/GadgetCard";
import { SkeletonBlock, SkeletonGadgetCard } from "@/components/Skeleton";
import { Syringe, Clock, Stethoscope, FileText } from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";
import { familyAccentFor, familyGadgetPaletteFor } from "@/theme/familyColors";
import { getFamily, getProfile, getHealthSummary, getVaccinations } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { FamilyMember } from "@/api/types";
import { AppStackParamList, AppTabsParamList } from "@/navigation/types";

type Nav = CompositeNavigationProp<BottomTabNavigationProp<AppTabsParamList, "Health">, NativeStackNavigationProp<AppStackParamList>>;

interface Person {
  awpid: string;
  full_name: string;
  gender: string;
  date_of_birth: string | null;
  isSelf: boolean;
}

function ageFromDob(dob: string | null): string {
  if (!dob) return "";
  const years = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
  return `${years} yrs`;
}

export function HealthScreen() {
  const navigation = useNavigation<Nav>();
  const { theme } = useAppTheme();

  const [selectedAwpid, setSelectedAwpid] = useState<string>("");

  // ["profile"]/["family"] — the same shared keys HomeScreen, ProfileScreen,
  // PersonalDetailsScreen, FamilyMembersScreen and BookingForScreen use, so
  // an edit or a family-member removal made anywhere invalidates the same
  // cache entry this switcher reads.
  const profileQ = useQuery({ queryKey: ["profile"], queryFn: getProfile });
  const familyQ = useQuery({ queryKey: ["family"], queryFn: getFamily });

  const people: Person[] = profileQ.data
    ? [
        { awpid: profileQ.data.awpid, full_name: profileQ.data.full_name, gender: profileQ.data.gender, date_of_birth: profileQ.data.date_of_birth, isSelf: true },
        ...(familyQ.data ?? []).map((f: FamilyMember) => ({ ...f, isSelf: false })),
      ]
    : [];

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
  const gadgetPalette = selected && !selected.isSelf ? familyGadgetPaletteFor(selected) : null;

  // Self (target undefined) uses the same 1-element key HealthSummaryScreen/
  // LinkedHospitalsScreen use for the identical self-only call — shares
  // that cache entry; a selected dependent gets its own keyed entry.
  const summaryQ = useQuery({
    queryKey: target ? ["healthSummary", target] : ["healthSummary"],
    queryFn: () => getHealthSummary(target),
    enabled: !!selectedAwpid,
  });
  // Same key shape VaccinationsScreen uses (`["vaccinations", patientAwpid]`,
  // patientAwpid possibly undefined for self) — shares that cache entry.
  const vaxQ = useQuery({
    queryKey: ["vaccinations", target],
    queryFn: () => getVaccinations(target),
    enabled: !!selectedAwpid,
  });
  const summary = summaryQ.data ?? null;
  const vax = vaxQ.data ?? null;
  const error = profileQ.error || familyQ.error || summaryQ.error || vaxQ.error;
  // Nothing meaningful can render before the profile itself has ever
  // loaded once — everything else (hero, switcher, gadgets) hangs off
  // `selected`, which needs `profileQ.data`. That first-ever wait gets the
  // skeleton; every refetch after it (stale refocus or pull-to-refresh)
  // keeps showing the last-known content instead.
  const isInitialLoading = !profileQ.data;
  const isFetchingAny = profileQ.isFetching || familyQ.isFetching || summaryQ.isFetching || vaxQ.isFetching;

  const refetchAll = useCallback(async () => {
    await Promise.all([profileQ.refetch(), familyQ.refetch(), summaryQ.refetch(), vaxQ.refetch()]);
  }, [profileQ.refetch, familyQ.refetch, summaryQ.refetch, vaxQ.refetch]);
  useRefreshOnFocus([profileQ, familyQ, summaryQ, vaxQ]);
  const { refreshing: pulling, onRefresh: pullRefresh } = usePullToRefresh(refetchAll);

  const openGadget = (screen: "Vaccinations" | "HealthTimeline" | "HealthVisits" | "Growth") => {
    if (!selected) return;
    navigation.navigate(screen, {
      patientAwpid: target, patientName: selected.full_name,
      patientGender: selected.gender, patientDob: selected.date_of_birth,
    });
  };

  const openRecords = () => {
    if (!selected) return;
    navigation.navigate("RxReports", {
      patientAwpid: target, patientName: selected.full_name,
      patientGender: selected.gender, patientDob: selected.date_of_birth,
    });
  };

  if (isInitialLoading) {
    return (
      <Screen topColor="#249c57" bottomInset={false}>
        <View style={[styles.hero, { padding: 20, height: 128, backgroundColor: "#1f7a4d", borderRadius: 24 }]}>
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
      topColor={accent?.fill ?? "#249c57"}
      bottomInset={false}
    >
      {selected && (
        <MetalHero style={styles.hero} curved underStatusBar overrideColor={accent?.fill}>
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

      <SegmentedControl
        options={people.map((p) => ({
          key: p.awpid,
          label: p.isSelf ? `${p.full_name} (Self)` : p.full_name,
          color: p.isSelf ? undefined : familyAccentFor(p) ?? undefined,
        }))}
        value={selectedAwpid}
        onChange={setSelectedAwpid}
      />
      <Pressable onPress={() => navigation.navigate("AddFamilyMember")} style={styles.addFamilyLink}>
        <Text style={[styles.addFamilyText, { color: theme.text }]}>+ Add family member</Text>
      </Pressable>

      {!!error && <ErrorBanner message={apiErrorMessage(error)} onRetry={refetchAll} />}

      <View style={styles.grid}>
        <GadgetCard
          tint={gadgetPalette?.vaccinations ?? GADGET_TINTS.green}
          icon={Syringe}
          title="Vaccinations"
          subtitle={vax ? `${vax.completed_count} of ${vax.total_count} completed` : "—"}
          onPress={() => openGadget("Vaccinations")}
          style={styles.gadgetSize}
          iconSize={34}
          radius={22}
          cardPadding={16}
        />
        <GadgetCard
          tint={gadgetPalette?.timeline ?? GADGET_TINTS.blue}
          icon={Clock}
          title="Health timeline"
          subtitle="Visits, vaccinations, growth, and more"
          onPress={() => openGadget("HealthTimeline")}
          style={styles.gadgetSize}
          iconSize={34}
          radius={22}
          cardPadding={16}
        />
        <GadgetCard
          tint={gadgetPalette?.visits ?? GADGET_TINTS.coral}
          icon={Stethoscope}
          title="Visits"
          subtitle={summary?.last_hospital ? `Last: ${summary.last_hospital}` : "No visits yet"}
          onPress={() => openGadget("HealthVisits")}
          style={styles.gadgetSize}
          iconSize={34}
          radius={22}
          cardPadding={16}
        />
        <GadgetCard
          tint={gadgetPalette?.rx ?? GADGET_TINTS.purple}
          icon={FileText}
          title="Rx & Reports"
          subtitle="Prescriptions, lab reports & docs"
          onPress={openRecords}
          style={styles.gadgetSize}
          iconSize={34}
          radius={22}
          cardPadding={16}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: 16 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  accentBadge: { paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 10 },
  accentBadgeText: { fontSize: 10, fontWeight: "700" },
  meta: { fontSize: 11.5, color: "#EAF3DE", marginTop: 3 },
  lastVisit: { fontSize: 11, color: "#EAF3DE", marginTop: 6 },
  addFamilyLink: { alignSelf: "flex-end", marginTop: -6, marginBottom: 14 },
  addFamilyText: { fontSize: 12, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 11, marginTop: 8 },
  gadgetSize: { width: "47%" },
});
