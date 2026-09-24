import React from "react";
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

export function LinkedHospitalsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  // Same query key HealthSummaryScreen uses for the identical call — they
  // now share one cache entry instead of each fetching it independently.
  const { data: summary, error, refetch, isFetching, isStale } = useQuery({ queryKey: ["healthSummary"], queryFn: () => getHealthSummary() });
  useRefreshOnFocus({ isStale, refetch });

  const hospitals = summary?.linked_hospitals || [];

  return (
    <Screen onRefresh={refetch} refreshing={isFetching}>
      <BackHeader title="Linked hospitals" onBack={() => navigation.goBack()} />
      {!!error && <ErrorBanner message={apiErrorMessage(error)} onRetry={refetch} />}

      {hospitals.length === 0 ? (
        <Card>
          <Text style={styles.empty}>No hospitals linked yet — this fills in once you've had a visit somewhere.</Text>
        </Card>
      ) : (
        hospitals.map((h, i) => (
          <Card key={i}>
            <View style={styles.rowBetween}>
              <Text style={styles.name}>{h.hospital_name}</Text>
              <Text style={styles.date}>{h.last_visit}</Text>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  empty: { fontSize: 12, color: NEUTRAL.textMuted },
  name: { fontSize: 12.5, fontWeight: "600", color: NEUTRAL.textPrimary },
  date: { fontSize: 11, color: NEUTRAL.textMuted },
});
