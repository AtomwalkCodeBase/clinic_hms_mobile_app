import { useEffect, useState } from "react";
import { Text, StyleSheet, Pressable, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as LocalAuthentication from "expo-local-authentication";
import { ErrorBanner } from "@/components/Layout";
import { AuthLayout } from "@/components/AuthLayout";
import { TextField } from "@/components/TextField";
import { Fingerprint, Mail } from "lucide-react-native";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { apiErrorMessage } from "@/api/client";
import { getRefreshToken, getBiometricLockEnabled } from "@/utils/storage";
import { APP_VERSION_LABEL } from "@/utils/appVersion";
import { AuthStackParamList } from "@/navigation/types";

export function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { theme } = useAppTheme();
  const { login, unlock } = useAuth();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ mobile?: string; password?: string }>({});
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);
  // Only true when there's genuinely a stored session to unlock — a fresh
  // install or a full sign-out has no tokens, so fingerprint can't produce a
  // login here and the button stays hidden. Present when a patient with
  // Biometric unlock on reopens the app (or taps "Use password instead" on
  // the lock screen and then changes their mind).
  const [biometricReady, setBiometricReady] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (!(await getRefreshToken())) return;
        if (!(await getBiometricLockEnabled())) return;
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = hasHardware && (await LocalAuthentication.isEnrolledAsync());
        setBiometricReady(isEnrolled);
      } catch {
        setBiometricReady(false);      // no fingerprint option; the password form is always there
      }
    })();
  }, []);

  const onSubmit = async () => {
    const nextErrors: typeof errors = {};
    if (!mobile.trim()) nextErrors.mobile = "Enter your mobile number or patient ID.";
    if (!password) nextErrors.password = "Enter your password.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitError("");
    setLoading(true);
    try {
      await login(mobile.trim(), password.trim());
      // No navigation call needed — RootNavigator swaps to AppStack the
      // moment AuthContext's isAuthenticated flips true.
    } catch (err) {
      setSubmitError(apiErrorMessage(err, "Invalid credentials."));
    } finally {
      setLoading(false);
    }
  };

  const onBiometric = async () => {
    setSubmitError("");
    setBiometricBusy(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Sign in to HealthNet",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });
      // The stored JWT is still valid — a successful check just clears the
      // local gate and RootNavigator swaps to AppStack.
      if (result.success) unlock();
    } finally {
      setBiometricBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Let’s get you signed in"
      subtitle="Sign in to your profile"
      topRight={APP_VERSION_LABEL || undefined}
      footer={() => (
        <>
          <Pressable onPress={() => navigation.navigate("Register")} style={styles.newPatientWrap} accessibilityRole="button">
            <Text style={styles.newPatient}>
              New patient? <Text style={[styles.newPatientLink, { color: theme.text }]}>Create an account</Text>
            </Text>
          </Pressable>
          <Text style={styles.supportFooter}>Trouble signing in? Contact support@atomwalk.com</Text>
        </>
      )}
    >
      {(compact) => (
        <>
          {!!submitError && <ErrorBanner message={submitError} />}

          <TextField
            auth
            dense={compact}
            label="Mobile number or patient ID"
            placeholder="9000030000"
            value={mobile}
            onChangeText={setMobile}
            keyboardType="default"
            autoCapitalize="none"
            error={errors.mobile}
          />
          <TextField
            auth
            dense={compact}
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            isPassword
            error={errors.password}
          />

          <Pressable onPress={() => navigation.navigate("ForgotPassword")} style={styles.forgotWrap}>
            <Text style={[styles.forgot, { color: theme.text }]}>Forgot password?</Text>
          </Pressable>

          <PrimaryButton label="Sign in" onPress={onSubmit} loading={loading} />

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>or</Text>
            <View style={styles.orLine} />
          </View>
          {biometricReady && (
            <SecondaryButton label="Sign in with fingerprint" icon={Fingerprint} onPress={onBiometric} loading={biometricBusy} style={styles.altBtn} />
          )}
          <SecondaryButton label="Sign in with a code instead" icon={Mail} onPress={() => navigation.navigate("OTPLogin")} style={styles.altBtn} />
        </>
      )}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  forgotWrap: { alignSelf: "flex-end", marginBottom: 18, marginTop: -2, padding: 4 },
  forgot: { fontSize: 13.5, fontWeight: "600" },
  orRow: { flexDirection: "row", alignItems: "center", marginTop: 18, marginBottom: 14 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: NEUTRAL.border },
  orText: { fontSize: 12.5, color: NEUTRAL.textMuted, marginHorizontal: 12 },
  altBtn: { alignSelf: "stretch", marginBottom: 10 },
  newPatientWrap: { padding: 8 },
  newPatient: { fontSize: 16, color: NEUTRAL.textSecondary },
  newPatientLink: { fontWeight: "700" },
  supportFooter: { fontSize: 12.5, color: NEUTRAL.textMuted, textAlign: "center", marginTop: 10 },
});
