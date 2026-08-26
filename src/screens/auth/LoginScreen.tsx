import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen, ErrorBanner } from "@/components/Layout";
import { TextField } from "@/components/TextField";
import { PrimaryButton } from "@/components/Buttons";
import { LogoPill } from "@/components/Logo";
import { MetalHero } from "@/components/MetalHero";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { apiErrorMessage } from "@/api/client";
import { AuthStackParamList } from "@/navigation/types";

export function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { theme } = useAppTheme();
  const { login } = useAuth();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ mobile?: string; password?: string }>({});
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);

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

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <Screen>
        <MetalHero style={styles.hero} decorative curved>
          <View style={styles.heroInner}>
            <LogoPill size={58} />
          </View>
        </MetalHero>
        <View style={styles.header}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to view your appointments and records</Text>
        </View>

        {!!submitError && <ErrorBanner message={submitError} />}

        <TextField
          label="Mobile number or patient ID"
          placeholder="9000030000"
          value={mobile}
          onChangeText={setMobile}
          keyboardType="default"
          autoCapitalize="none"
          error={errors.mobile}
        />
        <TextField
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

        <PrimaryButton label="Sign in" onPress={onSubmit} loading={loading} style={{ marginTop: 6 }} />

        <Pressable onPress={() => navigation.navigate("OTPLogin")} style={styles.otpLoginWrap}>
          <Text style={[styles.otpLoginText, { color: theme.text }]}>Sign in with a code instead</Text>
        </Pressable>

        <Pressable onPress={() => navigation.navigate("Register")} style={styles.footerWrap}>
          <Text style={styles.footer}>
            New patient? <Text style={[styles.footerLink, { color: theme.text }]}>Create an account</Text>
          </Text>
        </Pressable>

        <Text style={styles.supportFooter}>Trouble signing in? Contact support@atomwalk.com</Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: 20 },
  heroInner: { alignItems: "center", paddingVertical: 10 },
  header: { alignItems: "center", marginBottom: 24 },
  title: { fontSize: 18, fontWeight: "600", color: NEUTRAL.textPrimary, marginTop: 14 },
  subtitle: { fontSize: 12.5, color: NEUTRAL.textSecondary, marginTop: 4, textAlign: "center" },
  forgotWrap: { alignSelf: "flex-end", marginBottom: 18, marginTop: -6 },
  forgot: { fontSize: 12.5, color: NEUTRAL.textSecondary, fontWeight: "600" },
  otpLoginWrap: { alignSelf: "center", marginTop: 14 },
  otpLoginText: { fontSize: 12.5, fontWeight: "600" },
  footerWrap: { alignSelf: "center", marginTop: 18 },
  footer: { fontSize: 12.5, color: NEUTRAL.textSecondary },
  footerLink: { fontWeight: "600" },
  supportFooter: { fontSize: 11, color: NEUTRAL.textMuted, textAlign: "center", marginTop: 20 },
});
