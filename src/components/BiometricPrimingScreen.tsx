import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { Lock } from "lucide-react-native";
import { PrimaryButton, SecondaryButton } from "./Buttons";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { getBiometricLockEnabled, setBiometricLockEnabled, setBiometricPromptSeen } from "@/utils/storage";

/**
 * Shown exactly once, right after a patient's first successful login or
 * registration on this device — RootNavigator decides whether to mount
 * this at all (device has biometric hardware enrolled, and
 * getBiometricPromptSeen() hasn't fired yet); this component just handles
 * the two outcomes once it's already on screen.
 *
 * Framed as a convenience ("skip typing your password"), never as a
 * security requirement — both buttons lead into the app the same way,
 * and declining marks the prompt seen just like accepting does, so it
 * never asks again on this device.
 */
export function BiometricPrimingScreen({ onDone }: { onDone: () => void }) {
  const { theme } = useAppTheme();
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    await setBiometricPromptSeen();
    onDone();
  };

  const onEnable = async () => {
    setBusy(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = hasHardware && (await LocalAuthentication.isEnrolledAsync());
      if (hasHardware && isEnrolled) {
        await setBiometricLockEnabled(true);
      }
    } finally {
      setBusy(false);
      await finish();
    }
  };

  return (
    <View style={[styles.wrap, { backgroundColor: NEUTRAL.bg }]}>
      <View style={[styles.iconWrap, { backgroundColor: theme.bg }]}>
        <Lock size={30} color={theme.text} strokeWidth={2.2} />
      </View>
      <Text style={styles.title}>Skip typing your password?</Text>
      <Text style={styles.sub}>Use your phone's fingerprint or face unlock to open HealthNet next time.</Text>

      <PrimaryButton label="Enable" onPress={onEnable} loading={busy} style={styles.primaryBtn} />
      <SecondaryButton label="Not now" onPress={finish} disabled={busy} style={styles.secondaryBtn} />

      <Text style={styles.footer}>Your password still works — this is just a shortcut. Change it anytime in Profile.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  iconWrap: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  title: { fontSize: 16, fontWeight: "600", color: NEUTRAL.textPrimary, textAlign: "center" },
  sub: { fontSize: 12.5, color: NEUTRAL.textSecondary, marginTop: 6, marginBottom: 24, textAlign: "center", lineHeight: 18, paddingHorizontal: 12 },
  primaryBtn: { alignSelf: "stretch", marginBottom: 10 },
  secondaryBtn: { alignSelf: "stretch" },
  footer: { fontSize: 11, color: NEUTRAL.textMuted, textAlign: "center", marginTop: 22, lineHeight: 16, paddingHorizontal: 16 },
});
