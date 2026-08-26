import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, AppState, AppStateStatus } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { Lock } from "lucide-react-native";
import { PrimaryButton } from "./Buttons";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { getBiometricLockEnabled } from "@/utils/storage";

/**
 * Delegates entirely to the OS's own biometric prompt (Android
 * BiometricPrompt / iOS Face ID) — checked against whatever fingerprint or
 * face the person already enrolled in their phone's own Settings app. This
 * component (and the app) never sees or stores biometric data itself, only
 * a yes/no result back from the OS.
 *
 * Off by default — only engages once the patient turns "Biometric unlock"
 * on from Profile (see ProfileScreen). With it off, this is a no-op and
 * the app behaves exactly like it did before this existed: straight into
 * AppStack on a valid session, same as the plain password/OTP login always
 * worked.
 *
 * When on, mounts fresh every time RootNavigator switches from AuthStack
 * to AppStack (a fresh login, or a resumed session on cold start), and
 * also re-locks on every foreground resume — same expectation as any app
 * that guards sensitive data behind a device lock.
 *
 * Devices with no fingerprint/face hardware, or with none enrolled, are
 * let straight through even with the setting on — this is a bonus layer
 * on top of the existing password/OTP + JWT auth, not a replacement, so it
 * should never become a hard blocker for someone who simply hasn't set up
 * biometrics on their phone.
 */
export function BiometricGate({ children }: { children: React.ReactNode }) {
  const { theme } = useAppTheme();
  const [checking, setChecking] = useState(true);
  const [locked, setLocked] = useState(false);
  const promptInFlight = useRef(false);

  const attempt = useCallback(async () => {
    if (promptInFlight.current) return;
    promptInFlight.current = true;
    try {
      const enabled = await getBiometricLockEnabled();
      if (!enabled) {
        setLocked(false);
        return;
      }
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = hasHardware && (await LocalAuthentication.isEnrolledAsync());
      if (!hasHardware || !isEnrolled) {
        setLocked(false);
        return;
      }
      setLocked(true);
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock HealthNet",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });
      if (result.success) setLocked(false);
    } finally {
      promptInFlight.current = false;
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    attempt();
  }, [attempt]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") attempt();
    });
    return () => sub.remove();
  }, [attempt]);

  if (checking) return null;

  if (locked) {
    return (
      <View style={[styles.wrap, { backgroundColor: NEUTRAL.bg }]}>
        <View style={[styles.iconWrap, { backgroundColor: theme.bg }]}>
          <Lock size={30} color={theme.text} strokeWidth={2.2} />
        </View>
        <Text style={styles.title}>HealthNet is locked</Text>
        <Text style={styles.sub}>Verify it's you to continue.</Text>
        <PrimaryButton label="Unlock" onPress={attempt} style={styles.unlockBtn} />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  iconWrap: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  title: { fontSize: 16, fontWeight: "600", color: NEUTRAL.textPrimary },
  sub: { fontSize: 12.5, color: NEUTRAL.textSecondary, marginTop: 4, marginBottom: 20 },
  unlockBtn: { paddingHorizontal: 32 },
});
