import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen, BackHeader, ErrorBanner } from "@/components/Layout";
import { Card } from "@/components/Card";
import { NEUTRAL } from "@/theme/themes";
import { getHealthSummary } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { HealthSummary } from "@/api/types";
import { AppStackParamList } from "@/navigation/types";

export function LinkedHospitalsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setSummary(await getHealthSummary());
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const hospitals = summary?.linked_hospitals || [];

  return (
    <Screen onRefresh={load} refreshing={loading}>
      <BackHeader title="Linked hospitals" onBack={() => navigation.goBack()} />
      {!!error && <ErrorBanner message={error} onRetry={load} />}

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
