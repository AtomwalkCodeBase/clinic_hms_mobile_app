import { View, Text, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { Screen, BackHeader, ErrorBanner } from "@/components/Layout";
import { Card } from "@/components/Card";
import { NEUTRAL } from "@/theme/themes";
import { getHealthSummary } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { AppStackParamList } from "@/navigation/types";
import { CARD_TEXT } from "@/theme/cardSizes";

export function HealthSummaryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  // Same query key LinkedHospitalsScreen uses for the identical call — they
  // now share one cache entry instead of each fetching it independently.
  const { data: summary, error, refetch, isFetching, isStale } = useQuery({ queryKey: ["healthSummary"], queryFn: () => getHealthSummary() });
  useRefreshOnFocus({ isStale, refetch });

  return (
    <Screen onRefresh={refetch} refreshing={isFetching}>
      <BackHeader title="Health summary" onBack={() => navigation.goBack()} />
      {!!error && <ErrorBanner message={apiErrorMessage(error)} onRetry={refetch} />}

      {summary && (
        <>
          <View style={styles.tileRow}>
            <Card style={styles.tile}>
              <Text style={styles.tileLabel}>BLOOD GROUP</Text>
              <Text style={[styles.tileValue, { color: NEUTRAL.danger }]}>{summary.blood_group || "Not recorded"}</Text>
            </Card>
            <Card style={styles.tile}>
              <Text style={styles.tileLabel}>ALLERGIES</Text>
              <Text style={styles.tileValue}>
                {summary.active_allergies.length ? summary.active_allergies.map((a) => a.substance).join(", ") : "None reported"}
              </Text>
            </Card>
          </View>

          <Text style={styles.sectionLabel}>ACTIVE DIAGNOSES</Text>
          {summary.active_diagnoses.length === 0 ? (
            <Card>
              <Text style={styles.empty}>No active diagnoses on record.</Text>
            </Card>
          ) : (
            <Card>
              <View style={styles.diagWrap}>
                {summary.active_diagnoses.map((d, i) => (
                  <View key={i} style={styles.diagPill}>
                    <Text style={styles.diagText}>{d.description}</Text>
                  </View>
                ))}
              </View>
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tileRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  tile: { flex: 1 },
  tileLabel: { fontSize: CARD_TEXT.tiny, color: NEUTRAL.textMuted, marginBottom: 4 },
  tileValue: { fontSize: CARD_TEXT.title, fontWeight: "600", color: NEUTRAL.textPrimary },
  sectionLabel: { fontSize: CARD_TEXT.tiny, fontWeight: "600", color: NEUTRAL.textMuted, letterSpacing: 0.4, marginTop: 14, marginBottom: 8 },
  diagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  diagPill: { backgroundColor: NEUTRAL.surfaceAlt, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  diagText: { fontSize: CARD_TEXT.body, color: NEUTRAL.textPrimary },
  empty: { fontSize: CARD_TEXT.body, color: NEUTRAL.textMuted },
});
