import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useFocusEffect, useNavigation, CompositeNavigationProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { Screen, ErrorBanner } from "@/components/Layout";
import { SegmentedControl } from "@/components/SegmentedControl";
import { MetalHero } from "@/components/MetalHero";
import { GadgetCard, GADGET_TINTS } from "@/components/GadgetCard";
import { Syringe, Clock, Stethoscope, FlaskConical } from "lucide-react-native";
import { useAppTheme } from "@/context/ThemeContext";
import { getFamily, getProfile, getHealthSummary, getVaccinations } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { FamilyMember, HealthSummary, VaccinationSummary } from "@/api/types";
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

  const [people, setPeople] = useState<Person[]>([]);
  const [selectedAwpid, setSelectedAwpid] = useState<string>("");
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [vax, setVax] = useState<VaccinationSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadPeople = useCallback(async () => {
    try {
      const [profile, family] = await Promise.all([getProfile(), getFamily()]);
      const self: Person = { awpid: profile.awpid, full_name: profile.full_name, gender: profile.gender, date_of_birth: profile.date_of_birth, isSelf: true };
      const dependents: Person[] = family.map((f: FamilyMember) => ({ ...f, isSelf: false }));
      setPeople([self, ...dependents]);
      if (!selectedAwpid) setSelectedAwpid(self.awpid);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }, [selectedAwpid]);

  useFocusEffect(
    useCallback(() => {
      loadPeople();
    }, [loadPeople])
  );

  const selected = people.find((p) => p.awpid === selectedAwpid);
  const target = selected && !selected.isSelf ? selected.awpid : undefined;

  const loadSummary = useCallback(async () => {
    if (!selectedAwpid) return;
    setLoading(true);
    setError("");
    try {
      const [hs, v] = await Promise.all([getHealthSummary(target), getVaccinations(target)]);
      setSummary(hs);
      setVax(v);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [selectedAwpid, target]);

  useFocusEffect(
    useCallback(() => {
      loadSummary();
    }, [loadSummary])
  );

  const openGadget = (screen: "Vaccinations" | "HealthTimeline" | "HealthVisits" | "Growth") => {
    if (!selected) return;
    navigation.navigate(screen, { patientAwpid: target, patientName: selected.full_name });
  };

  const openLabReports = () => {
    if (!selected) return;
    navigation.navigate("LabReports", { patientAwpid: target, patientName: selected.full_name });
  };

  return (
    <Screen onRefresh={loadSummary} refreshing={loading}>
      {selected && (
        <MetalHero style={styles.hero} curved>
          <Text style={styles.name}>{selected.full_name}</Text>
          <Text style={styles.meta}>
            {ageFromDob(selected.date_of_birth)} · {selected.gender === "M" ? "Male" : selected.gender === "F" ? "Female" : "—"} · AWPID: {selected.awpid}
          </Text>
          {summary?.last_hospital && (
            <Text style={styles.lastVisit}>
              {summary.last_hospital} · Last visit: {summary.last_visit}
            </Text>
          )}
        </MetalHero>
      )}

      <SegmentedControl
        options={people.map((p) => ({ key: p.awpid, label: p.isSelf ? `${p.full_name} (Self)` : p.full_name }))}
        value={selectedAwpid}
        onChange={setSelectedAwpid}
      />
      <Pressable onPress={() => navigation.navigate("AddFamilyMember")} style={styles.addFamilyLink}>
        <Text style={[styles.addFamilyText, { color: theme.text }]}>+ Add family member</Text>
      </Pressable>

      {!!error && <ErrorBanner message={error} onRetry={loadSummary} />}

      <View style={styles.grid}>
        <GadgetCard
          tint={GADGET_TINTS.green}
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
          tint={GADGET_TINTS.blue}
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
          tint={GADGET_TINTS.coral}
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
          tint={GADGET_TINTS.amber}
          icon={FlaskConical}
          title="Lab reports"
          subtitle="Tests, results, and reports"
          onPress={openLabReports}
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
  name: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  meta: { fontSize: 11.5, color: "#EAF3DE", marginTop: 3 },
  lastVisit: { fontSize: 11, color: "#EAF3DE", marginTop: 6 },
  addFamilyLink: { alignSelf: "flex-end", marginTop: -6, marginBottom: 14 },
  addFamilyText: { fontSize: 12, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 11, marginTop: 8 },
  gadgetSize: { width: "47%" },
});
