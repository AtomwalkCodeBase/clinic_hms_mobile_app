import React, { useState } from "react";
import { Text, StyleSheet } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen, BackHeader, ErrorBanner } from "@/components/Layout";
import { TextField } from "@/components/TextField";
import { DateField } from "@/components/DateField";
import { SelectField } from "@/components/SelectField";
import { PrimaryButton } from "@/components/Buttons";
import { NEUTRAL } from "@/theme/themes";
import { GENDER_OPTIONS, RELATIONSHIP_OPTIONS } from "@/constants/options";
import { addFamilyMember, updateFamilyMember } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { AppStackParamList } from "@/navigation/types";

export function AddFamilyMemberScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "AddFamilyMember">>();
  const member = route.params?.member;
  const isEdit = !!member;

  const [fullName, setFullName] = useState(member?.full_name || "");
  const [dob, setDob] = useState(member?.date_of_birth || "");
  const [gender, setGender] = useState(member?.gender || "");
  const [relationship, setRelationship] = useState(member?.relationship || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!fullName.trim()) {
      setError("Name is required.");
      return;
    }
    // The backend (PatientService) requires date_of_birth for both add and
    // edit — it's the cross-hospital identity key, not an optional field.
    if (!dob) {
      setError("Date of birth is required — it's how a family member is matched across hospitals.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      if (isEdit) {
        await updateFamilyMember(member!.awpid, {
          full_name: fullName.trim(),
          date_of_birth: dob,
          gender: gender || undefined,
          relationship: relationship || undefined,
        });
      } else {
        await addFamilyMember({
          full_name: fullName.trim(),
          date_of_birth: dob,
          gender: gender || undefined,
          relationship: relationship || undefined,
        });
      }
      // HealthScreen, ProfileScreen and FamilyMembersScreen all reload their
      // family list on useFocusEffect, so returning here refreshes them —
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
      <BackHeader title={isEdit ? "Edit family member" : "Add family member"} onBack={() => navigation.goBack()} />
      {!isEdit && (
        <Text style={styles.hint}>
          Add a spouse, child, or parent to your account to book appointments and view their health records alongside your own.
        </Text>
      )}
      {!!error && <ErrorBanner message={error} />}
      <TextField label="Full name" placeholder="e.g. Aarav Krishnan" value={fullName} onChangeText={setFullName} />
      <DateField label="Date of birth" value={dob} onChange={setDob} maximumDate={new Date()} />
      <SelectField label="Gender" value={gender} options={GENDER_OPTIONS} onChange={setGender} />
      <SelectField label="Relationship" value={relationship} options={RELATIONSHIP_OPTIONS} onChange={setRelationship} />
      <PrimaryButton
        label={isEdit ? "Save changes" : "Save family member"}
        onPress={onSave}
        loading={saving}
        style={{ marginTop: 8 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: NEUTRAL.textSecondary, marginBottom: 18, lineHeight: 17 },
});
