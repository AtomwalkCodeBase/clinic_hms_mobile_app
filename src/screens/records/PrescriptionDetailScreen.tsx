import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen, BackHeader, SectionTitle } from "@/components/Layout";
import { Card } from "@/components/Card";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { AppStackParamList } from "@/navigation/types";

export function PrescriptionDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "PrescriptionDetail">>();
  const { record } = route.params;
  const { theme } = useAppTheme();

  return (
    <Screen>
      <BackHeader title="Prescription" onBack={() => navigation.goBack()} />

      <Card tint={theme.bg}>
        <Text style={[styles.hospital, { color: theme.text }]}>{record.hospital}</Text>
        <Text style={[styles.doctorDate, { color: theme.text }]}>
          {record.doctor} · {record.date}
        </Text>
      </Card>

      {record.diagnoses.length > 0 && (
        <>
          <SectionTitle>Diagnosis</SectionTitle>
          <View style={styles.diagWrap}>
            {record.diagnoses.map((d, i) => (
              <View key={i} style={styles.diagPill}>
                <Text style={styles.diagText}>{d.description}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {record.prescription.length > 0 && (
        <>
          <SectionTitle>Prescribed medicines</SectionTitle>
          {record.prescription.map((m, i) => (
            <Card key={i}>
              <View style={styles.rowBetween}>
                <Text style={styles.drugName}>{m.drug_name}</Text>
                <Text style={styles.duration}>{m.duration_days} days</Text>
              </View>
              <Text style={styles.dosage}>
                {m.dosage} · {m.frequency}
                {m.instructions ? ` (${m.instructions})` : ""}
              </Text>
            </Card>
          ))}
        </>
      )}

      {!!record.investigations && (
        <Card tint={NEUTRAL.warningBg}>
          <Text style={styles.warnTitle}>Tests to be done</Text>
          <Text style={styles.warnBody}>{record.investigations}</Text>
        </Card>
      )}

      {!!record.advice && (
        <Card>
          <Text style={styles.adviceTitle}>Doctor's advice</Text>
          <Text style={styles.adviceBody}>{record.advice}</Text>
          {record.follow_up_in_days != null && (
            <Text style={styles.followUp}>Follow up in {record.follow_up_in_days} days</Text>
          )}
        </Card>
      )}

      {record.vitals && (
        <>
          <SectionTitle>Vitals recorded</SectionTitle>
          <Card>
            {record.vitals.bp && <Text style={styles.vital}>BP: {record.vitals.bp}</Text>}
            {record.vitals.pulse != null && <Text style={styles.vital}>Pulse: {record.vitals.pulse}</Text>}
            {record.vitals.spo2 != null && <Text style={styles.vital}>SpO2: {record.vitals.spo2}%</Text>}
            {record.vitals.temperature && <Text style={styles.vital}>Temp: {record.vitals.temperature}°F</Text>}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hospital: { fontSize: 13.5, fontWeight: "600" },
  doctorDate: { fontSize: 11.5, marginTop: 3 },
  diagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  diagPill: { backgroundColor: NEUTRAL.warningBg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  diagText: { fontSize: 11.5, color: NEUTRAL.warning, fontWeight: "600" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between" },
  drugName: { fontSize: 13, fontWeight: "600", color: NEUTRAL.textPrimary },
  duration: { fontSize: 11, color: NEUTRAL.textMuted },
  dosage: { fontSize: 11.5, color: NEUTRAL.textSecondary, marginTop: 4 },
  warnTitle: { fontSize: 11.5, fontWeight: "600", color: NEUTRAL.warning },
  warnBody: { fontSize: 11.5, color: NEUTRAL.warning, marginTop: 3 },
  adviceTitle: { fontSize: 11.5, fontWeight: "600", color: NEUTRAL.textPrimary },
  adviceBody: { fontSize: 11.5, color: NEUTRAL.textSecondary, marginTop: 3 },
  followUp: { fontSize: 11, color: NEUTRAL.textMuted, marginTop: 6 },
  vital: { fontSize: 12, color: NEUTRAL.textSecondary, marginBottom: 3 },
});
