import { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, Image, Modal } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { SkeletonBlock, SkeletonRow } from "@/components/Skeleton";
import * as LocalAuthentication from "expo-local-authentication";
import { Camera, IdCard, HeartPulse, Users, Building2, Headphones, Droplet, Lock, Fingerprint } from "lucide-react-native";
import { Screen, ErrorBanner, SectionTitle } from "@/components/Layout";
import { Pill } from "@/components/Pill";
import { SecondaryButton } from "@/components/Buttons";
import { MetalHero } from "@/components/MetalHero";
import { APP_VERSION_LABEL } from "@/utils/appVersion";
import { ListRow } from "@/components/ListRow";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NEUTRAL, ON_BRAND, BRAND, BRAND_DEEP } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useDocumentUpload } from "@/context/DocumentUploadContext";
import { getProfile, getHealthSummary, getFamily, updateProfile } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { pickImage, pickImageFromCamera, fileToDataUri } from "@/utils/fileHelpers";
import { Toggle } from "@/components/Toggle";
import { getBiometricLockEnabled, setBiometricLockEnabled } from "@/utils/storage";
import { AppStackParamList, AppTabsParamList } from "@/navigation/types";

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  // The back arrow in the hero goes to the Home tab, same as the phone's own back button does from a tab.
  const tabs = useNavigation<BottomTabNavigationProp<AppTabsParamList>>();
  const { theme } = useAppTheme();
  const { logout } = useAuth();
  const { uploading } = useDocumentUpload();
  const queryClient = useQueryClient();
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [signOutConfirmVisible, setSignOutConfirmVisible] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [mutationError, setMutationError] = useState("");

  const onSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
      setSignOutConfirmVisible(false);
    }
  };

  // Shared keys — same cache entries HomeScreen/HealthScreen (profile,
  // family) and HealthSummaryScreen/LinkedHospitalsScreen (healthSummary,
  // self-only) read.
  const profileQ = useQuery({ queryKey: ["profile"], queryFn: getProfile });
  const summaryQ = useQuery({ queryKey: ["healthSummary"], queryFn: () => getHealthSummary() });
  const familyQ = useQuery({ queryKey: ["family"], queryFn: getFamily });
  const profile = profileQ.data ?? null;
  const summary = summaryQ.data ?? null;
  const family = familyQ.data ?? [];
  const error = profileQ.error || summaryQ.error || familyQ.error;
  const isInitialLoading = !profile;
  const isFetchingAny = profileQ.isFetching || summaryQ.isFetching || familyQ.isFetching;

  const refetchAll = useCallback(async () => {
    await Promise.all([profileQ.refetch(), summaryQ.refetch(), familyQ.refetch()]);
  }, [profileQ.refetch, summaryQ.refetch, familyQ.refetch]);
  useRefreshOnFocus([profileQ, summaryQ, familyQ]);
  const { refreshing: pulling, onRefresh: pullRefresh } = usePullToRefresh(refetchAll);

  useFocusEffect(
    useCallback(() => {
      getBiometricLockEnabled().then(setBiometricEnabled);
    }, [])
  );

  // One tap moves the switch once: it flips immediately, then the check runs, and it flips back only if that fails.
  const onToggleBiometric = async () => {
    if (biometricBusy) return;
    const next = !biometricEnabled;
    setMutationError("");
    setBiometricEnabled(next);
    setBiometricBusy(true);
    try {
      if (next) {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = hasHardware && (await LocalAuthentication.isEnrolledAsync());
        if (!isEnrolled) {
          setBiometricEnabled(false);
          setMutationError("Your phone doesn't have a fingerprint or face unlock set up yet — add one in your phone's Settings first.");
          return;
        }
      }
      await setBiometricLockEnabled(next);
    } catch {
      setBiometricEnabled(!next);
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
      queryClient.setQueryData(["profile"], updated);
    } catch (err) {
      setMutationError(apiErrorMessage(err, "Couldn't update your photo."));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const onRemovePhoto = async () => {
    setShowPhotoSheet(false);
    setUploadingPhoto(true);
    try {
      const updated = await updateProfile({ photo: "" });
      queryClient.setQueryData(["profile"], updated);
    } catch (err) {
      setMutationError(apiErrorMessage(err, "Couldn't remove your photo."));
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (isInitialLoading) {
    return (
      <Screen bottomInset={false}>
        <View style={[styles.hero, { padding: 16, alignItems: "center", height: 150, backgroundColor: BRAND, borderRadius: 24 }]}>
          <SkeletonBlock width={72} height={72} radius={36} style={{ backgroundColor: "rgba(255,255,255,0.25)" }} />
          <SkeletonBlock width={130} height={16} style={{ marginTop: 12, backgroundColor: "rgba(255,255,255,0.25)" }} />
        </View>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </Screen>
    );
  }

  return (
    <Screen
      onRefresh={pullRefresh}
      refreshing={pulling}
      backgroundLoading={isFetchingAny && !pulling}
      bottomInset={false}
      header={
        <>
          {profile && (
            <MetalHero style={styles.hero} curved onBack={() => tabs.navigate("Home")}>
              {!!APP_VERSION_LABEL && <Text style={styles.versionCode}>{APP_VERSION_LABEL}</Text>}
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
                    {uploadingPhoto ? <Text style={styles.camIcon}>…</Text> : <Camera size={13} color={BRAND_DEEP} strokeWidth={2.4} />}
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

          {!!error && <ErrorBanner message={apiErrorMessage(error)} onRetry={refetchAll} />}
          {!!mutationError && <ErrorBanner message={mutationError} />}

          {summary && (
            <View style={styles.statCard}>
              <View style={styles.statCol}>
                <Droplet size={16} color={NEUTRAL.danger} strokeWidth={2.2} />
                <Text style={styles.statLabel}>Blood group</Text>
                <Text style={[styles.statValue, { color: NEUTRAL.danger }]}>{summary.blood_group || "Not set"}</Text>
              </View>
              <View style={[styles.statCol, styles.statBorder]}>
                <Users size={16} color="#0C447C" strokeWidth={2.2} />
                <Text style={styles.statLabel}>Family</Text>
                <Text style={styles.statValue}>{family.length}</Text>
              </View>
            </View>
          )}
        </>
      }
    >
      <SectionTitle>Account</SectionTitle>
      <ListRow
        icon={IdCard}
        title="Personal details"
        subtitle="Mobile, email, gender, DOB"
        onPress={() => navigation.navigate("PersonalDetails")}
        tinted
      />
      <ListRow
        icon={HeartPulse}
        title="Health summary"
        subtitle="Blood group, diagnoses"
        onPress={() => navigation.navigate("HealthSummary")}
        tinted
      />
      <ListRow
        icon={Users}
        title="Family members"
        subtitle={family.length ? "Tap to view your family members" : "No family members added yet"}
        pillLabel={family.length ? String(family.length) : undefined}
        onPress={() => navigation.navigate("FamilyMembers")}
        tinted
      />
      <ListRow
        icon={Lock}
        title="Shared records privacy"
        subtitle="Choose what a doctor sees when you share"
        onPress={() => navigation.navigate("SharedRecordsPrivacy")}
        tinted
      />
      <ListRow
        icon={Building2}
        title="Linked hospitals"
        subtitle={summary?.linked_hospitals.length ? summary.linked_hospitals.map((h) => h.hospital_name).join(", ") : "No hospitals linked yet"}
        onPress={() => navigation.navigate("LinkedHospitals")}
        tinted
      />

      <SectionTitle>Preferences</SectionTitle>
      <ListRow
        icon={Fingerprint}
        title="Biometric unlock"
        subtitle={biometricEnabled ? "On — pick fingerprint or password at sign-in" : "Off — sign in with your password"}
        tinted
        trailing={
          <Toggle on={biometricEnabled} color={theme.fill} onPress={onToggleBiometric} disabled={biometricBusy} />
        }
      />
      <ListRow
        icon={Headphones}
        title="Support"
        onPress={() => navigation.navigate("Support")}
        tinted
      />

      <SecondaryButton label="Sign out" onPress={() => setSignOutConfirmVisible(true)} danger style={{ marginTop: 10 }} />

      <ConfirmDialog
        visible={signOutConfirmVisible}
        danger
        title="Sign out?"
        message={
          uploading
            ? "Files are still uploading and will stop if you sign out. Wait for them to finish, or sign out anyway. You'll need to sign in again to view your appointments and records."
            : "You'll need to sign in again to view your appointments and records."
        }
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
  // the same height and top as the 32px back button beside it, with the text centred in that box so the two line up
  versionCode: { position: "absolute", top: 0, right: 6, height: 32, textAlignVertical: "center", includeFontPadding: false, fontSize: 11, fontWeight: "600", color: ON_BRAND, opacity: 0.8 },
  heroContent: { alignItems: "center", paddingVertical: 4 },
  avwrap: { position: "relative", marginBottom: 8 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: "100%", height: "100%" },
  avatarText: { fontSize: 20, fontWeight: "700", color: ON_BRAND },
  camBtn: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: BRAND_DEEP,
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
  name: { fontWeight: "600", fontSize: 15, marginTop: 8, color: ON_BRAND },
  awpid: { fontSize: 11, color: "rgba(4,38,28,0.78)", marginTop: 2 },
  statCard: {
    flexDirection: "row",
    backgroundColor: NEUTRAL.surface,
    borderRadius: 16,
    marginTop: -34,
    marginBottom: 18,
    paddingVertical: 12,
    shadowColor: ON_BRAND,
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
