import React, { useState } from "react";
import { Text, View, StyleSheet } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen, BackHeader, ErrorBanner } from "@/components/Layout";
import { TextField } from "@/components/TextField";
import { DateField } from "@/components/DateField";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { NEUTRAL } from "@/theme/themes";
import { uploadVaccinationRecord } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { pickImage, pickPdf, fileToDataUri, PickedFile } from "@/utils/fileHelpers";
import { AppStackParamList } from "@/navigation/types";

/**
 * Its own page, reached via navigation — was previously an inline form that
 * popped open below VaccinationsScreen's stats/filters/toggle (all of which
 * stayed visible above it), and because it was inline rather than a real
 * route, pressing back from it exited the whole Vaccinations screen instead
 * of just closing the form. Same pattern as AddFamilyMemberScreen.
 */
export function ReportVaccinationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "ReportVaccination">>();
  const { patientAwpid, patientName } = route.params;

  const [vaccineName, setVaccineName] = useState("");
  const [date, setDate] = useState("");
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!vaccineName.trim()) {
      setError("Enter the vaccine name.");
      return;
    }
    if (!date) {
      setError("Enter the date it was given.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const fileFields = picked ? { file_data: await fileToDataUri(picked), file_name: picked.name, mime_type: picked.mimeType } : {};
      await uploadVaccinationRecord({
        vaccine_name: vaccineName.trim(),
        administered_date: date,
        patient_awpid: patientAwpid,
        ...fileFields,
      });
      // VaccinationsScreen reloads on useFocusEffect, so returning here is
      // enough to refresh its list — same contract as AddFamilyMemberScreen.
      navigation.goBack();
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't submit this record."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <BackHeader title="Report a vaccination" onBack={() => navigation.goBack()} />
      <Text style={styles.hint}>
        Record a vaccination {patientName} received outside this network — a clinic will review it before it shows as
        completed.
      </Text>

      {!!error && <ErrorBanner message={error} />}

      <TextField label="Vaccine name" placeholder="e.g. Yellow fever" value={vaccineName} onChangeText={setVaccineName} />
      <DateField label="Date given" value={date} onChange={setDate} maximumDate={new Date()} />

      <Text style={styles.pickLabel}>Certificate (optional)</Text>
      {picked ? <Text style={styles.pickedName}>{picked.name}</Text> : <Text style={styles.pickedNone}>No file chosen.</Text>}
      <View style={styles.pickRow}>
        <SecondaryButton
          label="Choose photo"
          onPress={async () => {
            const f = await pickImage();
            if (f) setPicked(f);
          }}
          style={{ flex: 1, paddingVertical: 9 }}
        />
        <SecondaryButton
          label="Choose PDF"
          onPress={async () => {
            const f = await pickPdf();
            if (f) setPicked(f);
          }}
          style={{ flex: 1, paddingVertical: 9 }}
        />
      </View>

      <Text style={styles.pendingNote}>This will show as "Pending review" until a clinic confirms it.</Text>

      <PrimaryButton label="Submit" onPress={onSave} loading={saving} style={{ marginTop: 16 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: NEUTRAL.textSecondary, marginBottom: 18, lineHeight: 17 },
  pickLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: NEUTRAL.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  pickedName: { fontSize: 12.5, color: NEUTRAL.textPrimary, marginBottom: 8 },
  pickedNone: { fontSize: 12, color: NEUTRAL.textMuted, marginBottom: 8 },
  pickRow: { flexDirection: "row", gap: 8 },
  pendingNote: { fontSize: 11, color: NEUTRAL.textMuted, marginTop: 10 },
});
