import React, { useCallback, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen, BackHeader, EmptyState, ErrorBanner } from "@/components/Layout";
import { Card } from "@/components/Card";
import { SecondaryButton } from "@/components/Buttons";
import { NEUTRAL } from "@/theme/themes";
import { Text, View, StyleSheet } from "react-native";
import { getMyRecords } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { MedicalRecord } from "@/api/types";
import { AppStackParamList } from "@/navigation/types";

export function PrescriptionsListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const all = await getMyRecords();
      setRecords(all.filter((r) => r.signed && r.prescription.length > 0));
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
      <BackHeader title="Prescriptions" onBack={() => navigation.goBack()} />
      {!!error && <ErrorBanner message={error} onRetry={load} />}
      {records.length === 0 && !loading ? (
        <EmptyState text="No prescriptions yet." />
      ) : (
        records.map((r, i) => (
          <Card key={i}>
            <View style={styles.rowBetween}>
              <Text style={styles.hospital}>{r.hospital}</Text>
              <Text style={styles.date}>{r.date}</Text>
            </View>
            <Text style={styles.doctor}>{r.doctor}</Text>
            <Text style={styles.drugSummary}>
              {r.prescription.map((m) => m.drug_name).join(", ")}
            </Text>
            <SecondaryButton
              label="View prescription"
              onPress={() => navigation.navigate("PrescriptionDetail", { record: r })}
              style={{ marginTop: 10, paddingVertical: 9 }}
            />
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hospital: { fontSize: 13, fontWeight: "600", color: NEUTRAL.textPrimary },
  date: { fontSize: 10.5, color: NEUTRAL.textMuted },
  doctor: { fontSize: 11.5, color: NEUTRAL.textSecondary, marginTop: 3 },
  drugSummary: { fontSize: 11.5, color: NEUTRAL.textPrimary, marginTop: 6 },
});
