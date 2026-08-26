import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, Image, Modal, Switch } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as LocalAuthentication from "expo-local-authentication";
import { Camera, IdCard, HeartPulse, Users, Building2, Palette, Headphones, Droplet, AlertTriangle, Lock } from "lucide-react-native";
import { Screen, ErrorBanner, SectionTitle } from "@/components/Layout";
import { Pill } from "@/components/Pill";
import { SecondaryButton } from "@/components/Buttons";
import { MetalHero } from "@/components/MetalHero";
import { ListRow } from "@/components/ListRow";
import { GADGET_TINTS, DASHBOARD_TINTS } from "@/components/GadgetCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { getProfile, getHealthSummary, getFamily, updateProfile } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { pickImage, pickImageFromCamera, fileToDataUri } from "@/utils/fileHelpers";
import { getBiometricLockEnabled, setBiometricLockEnabled } from "@/utils/storage";
import { Profile, HealthSummary, FamilyMember } from "@/api/types";
import { AppStackParamList } from "@/navigation/types";

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { theme } = useAppTheme();
  const { logout } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [signOutConfirmVisible, setSignOutConfirmVisible] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);

  const onSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
      setSignOutConfirmVisible(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [p, s, f] = await Promise.all([getProfile(), getHealthSummary(), getFamily()]);
      setProfile(p);
      setSummary(s);
      setFamily(f);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      getBiometricLockEnabled().then(setBiometricEnabled);
    }, [load])
  );

  const onToggleBiometric = async (next: boolean) => {
    setError("");
    if (!next) {
      setBiometricBusy(true);
      await setBiometricLockEnabled(false);
      setBiometricEnabled(false);
      setBiometricBusy(false);
      return;
    }
    setBiometricBusy(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = hasHardware && (await LocalAuthentication.isEnrolledAsync());
      if (!hasHardware || !isEnrolled) {
        setError("Your phone doesn't have a fingerprint or face unlock set up yet — add one in your phone's Settings first.");
        return;
      }
      await setBiometricLockEnabled(true);
      setBiometricEnabled(true);
    } finally {
      setBiometricBusy(false);
    }
  };

  const onPickPhoto = async (source: "camera" | "gallery") => {
    setShowPhotoSheet(false);
    try {
      const file = source === "camera" ? await pickImageFromCamera() : await pickImage();
      if (!file) return;
      setUploadingPhoto(true);
      const dataUri = await fileToDataUri(file);
      const updated = await updateProfile({ photo: dataUri });
      setProfile(updated);
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't update your photo."));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const onRemovePhoto = async () => {
    setShowPhotoSheet(false);
    setUploadingPhoto(true);
    try {
      const updated = await updateProfile({ photo: "" });
      setProfile(updated);
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't remove your photo."));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const allergyCount = summary?.active_allergies.length ?? 0;

  return (
    <Screen onRefresh={load} refreshing={loading}>
      {profile && (
        <MetalHero style={styles.hero} curved>
          <View style={styles.heroContent}>
            <View style={styles.avwrap}>
              <View style={styles.avatar}>
                {profile.photo ? (
                  <Image source={{ uri: profile.photo }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarText}>{profile.full_name?.[0] || "?"}</Text>
                )}
              </View>
              <Pressable
                onPress={() => setShowPhotoSheet(true)}
                style={styles.camBtn}
                hitSlop={8}
                disabled={uploadingPhoto}
              >
                {uploadingPhoto ? <Text style={styles.camIcon}>…</Text> : <Camera size={13} color="#146334" strokeWidth={2.4} />}
              </Pressable>
            </View>
            <Pill label="Verified account" tone="neutral" />
            <Text style={styles.name}>{profile.full_name}</Text>
            <Text style={styles.awpid}>AWPID: {profile.awpid}</Text>
          </View>
        </MetalHero>
      )}

      <Modal visible={showPhotoSheet} transparent animationType="fade" onRequestClose={() => setShowPhotoSheet(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowPhotoSheet(false)}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.sheetTitle}>Update profile photo</Text>
            <Pressable style={styles.sheetOpt} onPress={() => onPickPhoto("camera")}>
              <Text style={styles.sheetOptText}>Take photo</Text>
            </Pressable>
            <Pressable style={styles.sheetOpt} onPress={() => onPickPhoto("gallery")}>
              <Text style={styles.sheetOptText}>Choose from gallery</Text>
            </Pressable>
            {!!profile?.photo && (
              <Pressable style={styles.sheetOpt} onPress={onRemovePhoto}>
                <Text style={[styles.sheetOptText, { color: NEUTRAL.danger }]}>Remove photo</Text>
              </Pressable>
            )}
            <Pressable style={styles.sheetCancel} onPress={() => setShowPhotoSheet(false)}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {!!error && <ErrorBanner message={error} onRetry={load} />}

      {summary && (
        <View style={styles.statCard}>
          <View style={styles.statCol}>
            <Droplet size={16} color={NEUTRAL.danger} strokeWidth={2.2} />
            <Text style={styles.statLabel}>Blood group</Text>
            <Text style={[styles.statValue, { color: NEUTRAL.danger }]}>{summary.blood_group || "Not set"}</Text>
          </View>
          <View style={[styles.statCol, styles.statBorder]}>
            <AlertTriangle size={16} color="#993556" strokeWidth={2.2} />
            <Text style={styles.statLabel}>Allergies</Text>
            <Text style={styles.statValue}>{allergyCount ? `${allergyCount} known` : "None"}</Text>
          </View>
          <View style={styles.statCol}>
            <Users size={16} color="#0C447C" strokeWidth={2.2} />
            <Text style={styles.statLabel}>Family</Text>
            <Text style={styles.statValue}>{family.length}</Text>
          </View>
        </View>
      )}

      <SectionTitle>Account</SectionTitle>
      <ListRow
        icon={IdCard}
        title="Personal details"
        subtitle="Mobile, email, gender, DOB"
        onPress={() => navigation.navigate("PersonalDetails")}
        iconColors={GADGET_TINTS.green.icon}
        iconShadowColor={GADGET_TINTS.green.shadow}
      />
      <ListRow
        icon={HeartPulse}
        title="Health summary"
        subtitle="Blood group, allergies, diagnoses"
        onPress={() => navigation.navigate("HealthSummary")}
        iconColors={DASHBOARD_TINTS.rose.icon}
        iconShadowColor={DASHBOARD_TINTS.rose.shadow}
      />
      <ListRow
        icon={Users}
        title="Family members"
        subtitle={family.length ? family.map((f) => f.full_name).join(", ") : "No family members added yet"}
        pillLabel={family.length ? String(family.length) : undefined}
        onPress={() => navigation.navigate("FamilyMembers")}
        iconColors={GADGET_TINTS.blue.icon}
        iconShadowColor={GADGET_TINTS.blue.shadow}
      />
      <ListRow
        icon={Building2}
        title="Linked hospitals"
        subtitle={summary?.linked_hospitals.length ? summary.linked_hospitals.map((h) => h.hospital_name).join(", ") : "No hospitals linked yet"}
        onPress={() => navigation.navigate("LinkedHospitals")}
        iconColors={GADGET_TINTS.amber.icon}
        iconShadowColor={GADGET_TINTS.amber.shadow}
      />

      <SectionTitle>Preferences</SectionTitle>
      <ListRow
        icon={Lock}
        title="Biometric unlock"
        subtitle={biometricEnabled ? "On — using your phone's fingerprint or face unlock" : "Off — sign in with your password each time"}
        iconColors={GADGET_TINTS.green.icon}
        iconShadowColor={GADGET_TINTS.green.shadow}
        trailing={
          <Switch
            value={biometricEnabled}
            onValueChange={onToggleBiometric}
            disabled={biometricBusy}
            trackColor={{ true: theme.fill }}
          />
        }
      />
      <ListRow
        icon={Palette}
        title="Theme"
        subtitle={theme.label}
        onPress={() => navigation.navigate("ThemePicker")}
        iconColors={GADGET_TINTS.purple.icon}
        iconShadowColor={GADGET_TINTS.purple.shadow}
      />
      <ListRow
        icon={Headphones}
        title="Support"
        onPress={() => navigation.navigate("Support")}
        iconColors={GADGET_TINTS.muted.icon}
        iconShadowColor={GADGET_TINTS.muted.shadow}
      />

      <SecondaryButton label="Sign out" onPress={() => setSignOutConfirmVisible(true)} danger style={{ marginTop: 10 }} />

      <ConfirmDialog
        visible={signOutConfirmVisible}
        danger
        title="Sign out?"
        message="You'll need to sign in again to view your appointments and records."
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        loading={signingOut}
        onConfirm={onSignOut}
        onCancel={() => setSignOutConfirmVisible(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: 28 },
  heroContent: { alignItems: "center", paddingVertical: 4 },
  avwrap: { position: "relative", marginBottom: 8 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: "100%", height: "100%" },
  avatarText: { fontSize: 20, fontWeight: "700", color: "#fff" },
  camBtn: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#146334",
    alignItems: "center",
    justifyContent: "center",
  },
  camIcon: { fontSize: 12 },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(12,35,64,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: NEUTRAL.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  sheetTitle: { fontSize: 12.5, fontWeight: "700", color: NEUTRAL.textPrimary, textAlign: "center", marginBottom: 12 },
  sheetOpt: { paddingVertical: 13, borderRadius: 10, backgroundColor: NEUTRAL.surfaceAlt, alignItems: "center", marginBottom: 8 },
  sheetOptText: { fontSize: 13, color: NEUTRAL.textPrimary, fontWeight: "500" },
  sheetCancel: { paddingVertical: 13, alignItems: "center", marginTop: 4 },
  sheetCancelText: { fontSize: 13, color: NEUTRAL.textSecondary, fontWeight: "600" },
  name: { fontWeight: "600", fontSize: 15, marginTop: 8, color: "#FFFFFF" },
  awpid: { fontSize: 11, color: "#EAF3DE", marginTop: 2 },
  statCard: {
    flexDirection: "row",
    backgroundColor: NEUTRAL.surface,
    borderRadius: 16,
    marginTop: -34,
    marginBottom: 18,
    paddingVertical: 12,
    shadowColor: "#0f2819",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 5,
  },
  statCol: { flex: 1, alignItems: "center" },
  statBorder: { borderLeftWidth: 0.5, borderRightWidth: 0.5, borderColor: NEUTRAL.border },
  statLabel: { fontSize: 9, color: NEUTRAL.textMuted, marginTop: 3 },
  statValue: { fontSize: 11.5, fontWeight: "600", color: NEUTRAL.textPrimary, marginTop: 1 },
});
