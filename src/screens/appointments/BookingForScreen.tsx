import { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { Plus, User, Users } from "lucide-react-native";
import { Screen, BackHeader, ErrorBanner, EmptyState } from "@/components/Layout";
import { TapCard } from "@/components/TapCard";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { getFamily } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { RELATIONSHIP_OPTIONS } from "@/constants/options";
import { AppStackParamList } from "@/navigation/types";
import { CARD_TEXT } from "@/theme/cardSizes";

function relationshipLabel(value: string): string {
  const found = RELATIONSHIP_OPTIONS.find((o) => o.value === value)?.label;
  return found || (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);
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

  // Shared ["family"] key — refreshes via cache invalidation the moment
  // AddFamilyMemberScreen's save succeeds, including on the way back from
  // "+ Add a family member" mid-flow, without a manual reload here.
  const { data: family = [], error, refetch, isFetching: loading, isStale } = useQuery({ queryKey: ["family"], queryFn: getFamily });
  useRefreshOnFocus({ isStale, refetch });

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

      {!!error && <ErrorBanner message={apiErrorMessage(error)} onRetry={refetch} />}

      <TapCard icon={User} title="You" subtitle="Book under your own account" onPress={() => proceed(undefined, "You")} />

      <TapCard
        icon={Users}
        title="Family member"
        subtitle="Book for someone you've added"
        selected={showFamily}
        open={showFamily}
        onPress={() => setShowFamily((s) => !s)}
      />

      {showFamily && (
        <View>
          {loading ? (
            <Text style={styles.loading}>Loading…</Text>
          ) : family.length === 0 ? (
            <EmptyState text="No family members added yet." />
          ) : (
            family.map((f) => (
              <TapCard
                key={f.awpid}
                small
                initial={(f.full_name || "?")[0].toUpperCase()}
                title={f.full_name}
                subtitle={relationshipLabel(f.relationship) || "Family member"}
                onPress={() => proceed(f.awpid, f.full_name)}
              />
            ))
          )}
          <Pressable
            onPress={() => navigation.navigate("AddFamilyMember")}
            accessibilityRole="button"
            accessibilityLabel="Add a family member"
            style={[styles.addBtn, { borderColor: theme.fill }]}
          >
            <Plus size={16} color={theme.text} strokeWidth={2.4} />
            <Text style={[styles.addLink, { color: theme.text }]}>Add a family member</Text>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 12, color: NEUTRAL.textSecondary, marginBottom: 16 },
  loading: { fontSize: 12, color: NEUTRAL.textMuted, textAlign: "center", marginVertical: 8 },
  addBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginLeft: 12, marginBottom: 12,
    borderWidth: 1.5, borderStyle: "dashed", borderRadius: 14, paddingVertical: 12,
  },
  addLink: { fontSize: CARD_TEXT.body, fontWeight: "600" },
});
