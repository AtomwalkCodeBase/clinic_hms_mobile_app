import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen, BackHeader, ErrorBanner } from "@/components/Layout";
import { TextField } from "@/components/TextField";
import { PrimaryButton } from "@/components/Buttons";
import { LogoPill } from "@/components/Logo";
import { MetalHero } from "@/components/MetalHero";
import { NEUTRAL } from "@/theme/themes";
import { useAuth } from "@/context/AuthContext";
import { otpLoginRequestOtp, otpLoginVerifyOtp, otpLogin } from "@/api/auth";
import { apiErrorMessage } from "@/api/client";
import { AuthStackParamList } from "@/navigation/types";

// Passwordless day-to-day sign-in — email-only, same channel constraint as
// ForgotPasswordScreen (SMS isn't actually configured on the backend yet).
type Step = "identify" | "code";

export function OTPLoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { loginWithTokens } = useAuth();
  const [step, setStep] = useState<Step>("identify");

  const [email, setEmail] = useState("");
  const [maskedIdentifier, setMaskedIdentifier] = useState("");
  const [code, setCode] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn > 0]);

  const requestCode = async () => {
    if (!email.trim() || !email.includes("@")) {
      setError("Enter your email address.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await otpLoginRequestOtp(email.trim());
      setMaskedIdentifier(res.data?.masked_identifier || "");
      setStep("code");
      setResendIn(60);
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't send a verification code."));
    } finally {
      setLoading(false);
    }
  };

  const verifyAndSignIn = async () => {
    if (code.trim().length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const actionToken = await otpLoginVerifyOtp(email.trim(), code.trim());
      const tokens = await otpLogin(actionToken);
      await loginWithTokens(tokens.access, tokens.refresh);
      // No navigation call needed — RootNavigator swaps to AppStack the
      // moment AuthContext's isAuthenticated flips true (same as password login).
    } catch (err) {
      setError(apiErrorMessage(err, "That code didn't work."));
    } finally {
      setLoading(false);
    }
  };

  const onBack = () => {
    if (step === "code") setStep("identify");
    else navigation.goBack();
  };

  return (
    <Screen>
      <BackHeader title="Sign in with a code" onBack={onBack} />
      <MetalHero compact style={styles.hero} decorative curved>
        <View style={styles.heroInner}>
          <LogoPill size={44} />
        </View>
      </MetalHero>
      <View style={styles.header}>
        <Text style={styles.title}>{step === "identify" ? "Sign in with email" : "Enter your code"}</Text>
        <Text style={styles.subtitle}>
          {step === "identify"
            ? "We'll email you a one-time code — no password needed."
            : maskedIdentifier
              ? `Enter the code sent to ${maskedIdentifier}.`
              : "Enter the code we sent you."}
        </Text>
      </View>

      {!!error && <ErrorBanner message={error} />}

      {step === "identify" && (
        <>
          <TextField label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <PrimaryButton label="Send code" onPress={requestCode} loading={loading} />
        </>
      )}

      {step === "code" && (
        <>
          <TextField label="6-digit code" placeholder="000000" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
          <PrimaryButton label="Sign in" onPress={verifyAndSignIn} loading={loading} />
          <Pressable onPress={requestCode} disabled={resendIn > 0 || loading} style={styles.resendWrap}>
            <Text style={styles.resend}>{resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}</Text>
          </Pressable>
        </>
      )}

      <Pressable onPress={() => navigation.navigate("Login")} style={styles.backToLoginWrap}>
        <Text style={styles.backToLogin}>Sign in with password instead</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: 18 },
  heroInner: { alignItems: "center", paddingVertical: 4 },
  header: { alignItems: "center", marginBottom: 20 },
  title: { fontSize: 17, fontWeight: "600", color: NEUTRAL.textPrimary, marginTop: 10 },
  subtitle: { fontSize: 12, color: NEUTRAL.textSecondary, marginTop: 4, textAlign: "center", paddingHorizontal: 12 },
  resendWrap: { alignSelf: "center", marginTop: 14 },
  resend: { fontSize: 12.5, color: NEUTRAL.textSecondary, fontWeight: "600" },
  backToLoginWrap: { alignSelf: "center", marginTop: 16 },
  backToLogin: { fontSize: 12.5, color: NEUTRAL.textSecondary, fontWeight: "600" },
});
