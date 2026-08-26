import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useFocusEffect, useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { User, Users } from "lucide-react-native";
import { Screen, BackHeader, ErrorBanner, EmptyState } from "@/components/Layout";
import { Card } from "@/components/Card";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { getFamily } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { FamilyMember } from "@/api/types";
import { RELATIONSHIP_OPTIONS } from "@/constants/options";
import { AppStackParamList } from "@/navigation/types";

function relationshipLabel(value: string): string {
  return RELATIONSHIP_OPTIONS.find((o) => o.value === value)?.label || value;
}

// First screen of the whole "book an appointment" flow — who this is for
// is independent of which hospital/doctor gets picked afterward, so this
// comes before FindDoctors, not bolted onto a specific doctor's page.
export function BookingForScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "BookingFor">>();
  const params = route.params;
  const { theme } = useAppTheme();

  const [showFamily, setShowFamily] = useState(false);
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadFamily = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setFamily(await getFamily());
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Refreshes every time this screen regains focus — including on the way
  // back from "+ Add a family member", so a member added mid-flow shows up
  // without the patient having to back out and re-enter.
  useFocusEffect(
    useCallback(() => {
      loadFamily();
    }, [loadFamily])
  );

  function proceed(patientAwpid: string | undefined, patientName: string) {
    navigation.navigate("FindDoctors", {
      initialComplaint: params?.initialComplaint,
      patientAwpid,
      patientName,
    });
  }

  return (
    <Screen>
      <BackHeader title="Who is this for?" onBack={() => navigation.goBack()} />
      <Text style={styles.subtitle}>Choose who you're booking this appointment for.</Text>

      {!!error && <ErrorBanner message={error} onRetry={loadFamily} />}

      <Pressable onPress={() => proceed(undefined, "You")}>
        <Card style={styles.optionRow}>
          <View style={[styles.iconWrap, { backgroundColor: theme.bg }]}>
            <User size={18} color={theme.text} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>You</Text>
            <Text style={styles.optionSub}>Book under your own account</Text>
          </View>
        </Card>
      </Pressable>

      <Pressable onPress={() => setShowFamily((s) => !s)}>
        <Card style={{ ...styles.optionRow, ...(showFamily ? { borderWidth: 1, borderColor: theme.fill } : null) }}>
          <View style={[styles.iconWrap, { backgroundColor: theme.bg }]}>
            <Users size={18} color={theme.text} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>Family member</Text>
            <Text style={styles.optionSub}>Book for someone you've added</Text>
          </View>
        </Card>
      </Pressable>

      {showFamily && (
        <View style={styles.familySection}>
          {loading ? (
            <Text style={styles.loading}>Loading…</Text>
          ) : family.length === 0 ? (
            <EmptyState text="No family members added yet." />
          ) : (
            family.map((f) => (
              <Pressable key={f.awpid} onPress={() => proceed(f.awpid, f.full_name)}>
                <Card style={styles.memberRow}>
                  <Text style={styles.memberName}>{f.full_name}</Text>
                  <Text style={styles.memberMeta}>{relationshipLabel(f.relationship) || "Family member"}</Text>
                </Card>
              </Pressable>
            ))
          )}
          <Pressable onPress={() => navigation.navigate("AddFamilyMember")} hitSlop={8} style={styles.addLinkWrap}>
            <Text style={[styles.addLink, { color: theme.text }]}>+ Add a family member</Text>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 12, color: NEUTRAL.textSecondary, marginBottom: 16 },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  optionTitle: { fontSize: 13.5, fontWeight: "600", color: NEUTRAL.textPrimary },
  optionSub: { fontSize: 11.5, color: NEUTRAL.textSecondary, marginTop: 2 },
  familySection: { marginTop: 4 },
  loading: { fontSize: 12, color: NEUTRAL.textMuted, textAlign: "center", marginVertical: 8 },
  memberRow: { paddingVertical: 12 },
  memberName: { fontSize: 13, fontWeight: "600", color: NEUTRAL.textPrimary },
  memberMeta: { fontSize: 11.5, color: NEUTRAL.textSecondary, marginTop: 3 },
  addLinkWrap: { alignSelf: "center", marginTop: 6, marginBottom: 4 },
  addLink: { fontSize: 12.5, fontWeight: "600" },
});
