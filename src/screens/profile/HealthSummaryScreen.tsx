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

export function HealthSummaryScreen() {
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

  return (
    <Screen onRefresh={load} refreshing={loading}>
      <BackHeader title="Health summary" onBack={() => navigation.goBack()} />
      {!!error && <ErrorBanner message={error} onRetry={load} />}

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
  tileLabel: { fontSize: 9.5, color: NEUTRAL.textMuted, marginBottom: 4 },
  tileValue: { fontSize: 12.5, fontWeight: "600", color: NEUTRAL.textPrimary },
  sectionLabel: { fontSize: 10.5, fontWeight: "600", color: NEUTRAL.textMuted, letterSpacing: 0.4, marginTop: 14, marginBottom: 8 },
  diagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  diagPill: { backgroundColor: NEUTRAL.surfaceAlt, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  diagText: { fontSize: 11, color: NEUTRAL.textPrimary },
  empty: { fontSize: 12, color: NEUTRAL.textMuted },
});
