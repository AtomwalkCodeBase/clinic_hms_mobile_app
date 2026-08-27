import React, { useCallback, useState } from "react";
import { Text, StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen, BackHeader, ErrorBanner } from "@/components/Layout";
import { Card } from "@/components/Card";
import { TextField } from "@/components/TextField";
import { DateField } from "@/components/DateField";
import { SelectField } from "@/components/SelectField";
import { SecondaryButton, PrimaryButton } from "@/components/Buttons";
import { NEUTRAL } from "@/theme/themes";
import { GENDER_OPTIONS, RELATIONSHIP_OPTIONS } from "@/constants/options";
import { getProfile, updateProfile, requestMobileChangeOtp } from "@/api/portal";
import { verifyContactChangeOtp } from "@/api/auth";
import { apiErrorMessage } from "@/api/client";
import { Profile } from "@/api/types";
import { AppStackParamList } from "@/navigation/types";

export function PersonalDetailsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setProfile(await getProfile());
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
      <View style={styles.headerRow}>
        <BackHeader title="Personal details" onBack={() => navigation.goBack()} />
        {profile && !editing && (
          <Text style={styles.editLink} onPress={() => setEditing(true)}>
            Edit
          </Text>
        )}
      </View>

      {!!error && <ErrorBanner message={error} onRetry={load} />}

      {profile && !editing && (
        <>
          <Card>
            <Row label="Mobile" value={profile.mobile} />
            <Row label="Email" value={profile.email || "Not set"} />
            <Row label="Gender" value={genderLabel(profile.gender) || "Not set"} />
            <Row label="Date of birth" value={profile.date_of_birth || "Not set"} last />
          </Card>

          {(profile.emergency_contact_name || profile.emergency_contact_phone) ? (
            <>
              <Text style={styles.sectionLabel}>EMERGENCY CONTACT</Text>
              <Card>
                <Text style={styles.emName}>{profile.emergency_contact_name}</Text>
                <Text style={styles.emMeta}>
                  {relationshipLabel(profile.emergency_contact_relation)} · {profile.emergency_contact_phone}
                </Text>
              </Card>
            </>
          ) : null}
        </>
      )}

      {profile && editing && (
        <EditProfileForm
          profile={profile}
          onSaved={(updated) => {
            setProfile(updated);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </Screen>
  );
}

function EditProfileForm({ profile, onSaved, onCancel }: { profile: Profile; onSaved: (p: Profile) => void; onCancel: () => void }) {
  const [fullName, setFullName] = useState(profile.full_name);
  const [mobile, setMobile] = useState(profile.mobile);
  const [gender, setGender] = useState(profile.gender);
  const [dob, setDob] = useState(profile.date_of_birth || "");
  const [emName, setEmName] = useState(profile.emergency_contact_name);
  const [emPhone, setEmPhone] = useState(profile.emergency_contact_phone);
  const [emRelation, setEmRelation] = useState(profile.emergency_contact_relation);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Changing the number to a NEW value has to be verified with a code sent
  // to the email on file before the backend PATCH will accept it (see
  // PortalMobileChangeRequestOTPView / PortalProfileView.patch). Re-saving
  // the same number is a no-op that needs no verification.
  const mobileChanged = mobile.trim().length > 0 && mobile.trim() !== profile.mobile;
  const [otpStage, setOtpStage] = useState<"idle" | "sent">("idle");
  const [otpCode, setOtpCode] = useState("");
  const [actionToken, setActionToken] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);

  const sendMobileCode = async () => {
    setError("");
    if (!profile.email) {
      setError("Add an email address to your profile first — we send the verification code there.");
      return;
    }
    setOtpBusy(true);
    try {
      await requestMobileChangeOtp();
      setOtpStage("sent");
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't send a verification code."));
    } finally {
      setOtpBusy(false);
    }
  };

  const verifyMobileCode = async () => {
    setError("");
    setOtpBusy(true);
    try {
      const token = await verifyContactChangeOtp(profile.email, otpCode.trim());
      setActionToken(token);
    } catch (err) {
      setError(apiErrorMessage(err, "That code didn't work."));
    } finally {
      setOtpBusy(false);
    }
  };

  const onSave = async () => {
    if (!fullName.trim()) {
      setError("Name cannot be blank.");
      return;
    }
    if (mobileChanged && !actionToken) {
      setError("Verify your new mobile number first.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const updated = await updateProfile({
        full_name: fullName.trim(),
        mobile: mobile.trim(),
        gender: gender.trim(),
        date_of_birth: dob.trim() || undefined,
        emergency_contact_name: emName.trim(),
        emergency_contact_phone: emPhone.trim(),
        emergency_contact_relation: emRelation.trim(),
        ...(mobileChanged ? { action_token: actionToken } : {}),
      });
      onSaved(updated);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      {!!error && <ErrorBanner message={error} />}
      <TextField label="Full name" value={fullName} onChangeText={setFullName} />
      <TextField
        label="Mobile number"
        value={mobile}
        onChangeText={(t) => {
          setMobile(t);
          // Any edit invalidates a code that was sent/verified for a
          // previous value.
          setOtpStage("idle");
          setOtpCode("");
          setActionToken("");
        }}
        keyboardType="number-pad"
        maxLength={10}
      />

      {mobileChanged && !actionToken && (
        <View style={styles.otpBox}>
          <Text style={styles.otpHint}>
            {profile.email
              ? `Changing your number needs a quick check. We'll send a 6-digit code to ${profile.email}.`
              : "Add an email to your profile first — the verification code for a number change is sent there."}
          </Text>
          {otpStage === "idle" ? (
            <SecondaryButton label="Send code" compact loading={otpBusy} onPress={sendMobileCode} disabled={!profile.email} />
          ) : (
            <>
              <TextField label="Verification code" value={otpCode} onChangeText={setOtpCode} keyboardType="number-pad" maxLength={6} />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <SecondaryButton label="Resend" compact onPress={sendMobileCode} disabled={otpBusy} />
                <SecondaryButton label="Verify" compact loading={otpBusy} onPress={verifyMobileCode} />
              </View>
            </>
          )}
        </View>
      )}
      {mobileChanged && !!actionToken && <Text style={styles.otpOk}>New number verified — save to apply.</Text>}

      <SelectField label="Gender" value={gender} options={GENDER_OPTIONS} onChange={setGender} />
      <DateField label="Date of birth" value={dob} onChange={setDob} maximumDate={new Date()} />
      <TextField label="Emergency contact name" value={emName} onChangeText={setEmName} />
      <TextField label="Emergency contact phone" value={emPhone} onChangeText={setEmPhone} keyboardType="number-pad" maxLength={10} />
      <SelectField label="Emergency contact relation" value={emRelation} options={RELATIONSHIP_OPTIONS} onChange={setEmRelation} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <SecondaryButton label="Cancel" onPress={onCancel} style={{ flex: 1 }} />
        <PrimaryButton label="Save changes" onPress={onSave} loading={saving} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

function genderLabel(value: string): string {
  return GENDER_OPTIONS.find((o) => o.value === value)?.label || value;
}

function relationshipLabel(value: string): string {
  return RELATIONSHIP_OPTIONS.find((o) => o.value === value)?.label || value;
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.rowBetween, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  editLink: { fontSize: 13, fontWeight: "600", color: NEUTRAL.textPrimary, marginRight: 16 },
  sectionLabel: { fontSize: 10.5, fontWeight: "600", color: NEUTRAL.textMuted, letterSpacing: 0.4, marginTop: 6, marginBottom: 8 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 9 },
  rowBorder: { borderBottomWidth: 0.5, borderBottomColor: NEUTRAL.border },
  rowLabel: { fontSize: 12, color: NEUTRAL.textMuted },
  rowValue: { fontSize: 13, color: NEUTRAL.textPrimary, fontWeight: "500" },
  emName: { fontSize: 13, fontWeight: "600", color: NEUTRAL.textPrimary },
  emMeta: { fontSize: 11.5, color: NEUTRAL.textSecondary, marginTop: 3 },
  otpBox: {
    backgroundColor: NEUTRAL.surfaceAlt,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    gap: 8,
  },
  otpHint: { fontSize: 11.5, color: NEUTRAL.textSecondary, lineHeight: 16 },
  otpOk: { fontSize: 11.5, color: NEUTRAL.success, fontWeight: "600", marginBottom: 10 },
});
