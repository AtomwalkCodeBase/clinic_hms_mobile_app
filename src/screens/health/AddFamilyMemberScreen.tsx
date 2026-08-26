import React, { useState } from "react";
import { Text, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen, BackHeader, ErrorBanner } from "@/components/Layout";
import { TextField } from "@/components/TextField";
import { DateField } from "@/components/DateField";
import { SelectField } from "@/components/SelectField";
import { PrimaryButton } from "@/components/Buttons";
import { NEUTRAL } from "@/theme/themes";
import { GENDER_OPTIONS, RELATIONSHIP_OPTIONS } from "@/constants/options";
import { addFamilyMember } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { AppStackParamList } from "@/navigation/types";

export function AddFamilyMemberScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [relationship, setRelationship] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!fullName.trim()) {
      setError("Name is required.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await addFamilyMember({
        full_name: fullName.trim(),
        date_of_birth: dob || undefined,
        gender: gender || undefined,
        relationship: relationship || undefined,
      });
      // Both HealthScreen and ProfileScreen reload their people/family list
      // on useFocusEffect, so returning here is enough to refresh them —
      // no callback prop needs to cross the navigation boundary.
      navigation.goBack();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <BackHeader title="Add family member" onBack={() => navigation.goBack()} />
      <Text style={styles.hint}>
        Add a spouse, child, or parent to your account to book appointments and view their health records alongside your own.
      </Text>
      {!!error && <ErrorBanner message={error} />}
      <TextField label="Full name" placeholder="e.g. Aarav Krishnan" value={fullName} onChangeText={setFullName} />
      <DateField label="Date of birth" value={dob} onChange={setDob} maximumDate={new Date()} />
      <SelectField label="Gender" value={gender} options={GENDER_OPTIONS} onChange={setGender} />
      <SelectField label="Relationship" value={relationship} options={RELATIONSHIP_OPTIONS} onChange={setRelationship} />
      <PrimaryButton label="Save family member" onPress={onSave} loading={saving} style={{ marginTop: 8 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: NEUTRAL.textSecondary, marginBottom: 18, lineHeight: 17 },
});
