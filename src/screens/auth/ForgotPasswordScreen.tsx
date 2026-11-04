import { useEffect, useState } from "react";
import { Text, StyleSheet, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ErrorBanner } from "@/components/Layout";
import { AuthLayout } from "@/components/AuthLayout";
import { TextField } from "@/components/TextField";
import { PrimaryButton } from "@/components/Buttons";
import { NEUTRAL } from "@/theme/themes";
import { forgotPasswordRequestOtp, forgotPasswordVerifyOtp, resetPassword } from "@/api/auth";
import { apiErrorMessage } from "@/api/client";
import { AuthStackParamList } from "@/navigation/types";

// Mirrors the web app's ForgotPasswordFlow.jsx: identify -> code -> new
// password -> done, all driven by the generic OTP endpoints
// (core/auth/otp_views.py) with purpose="password_reset_patient".
type Step = "identify" | "code" | "password" | "done";

export function ForgotPasswordScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const [step, setStep] = useState<Step>("identify");

  const [identifier, setIdentifier] = useState("");
  const [maskedIdentifier, setMaskedIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [actionToken, setActionToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn > 0]);

  const requestCode = async () => {
    if (!identifier.trim() || !identifier.includes("@")) {
      setError("Enter your email address.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await forgotPasswordRequestOtp(identifier.trim());
      setMaskedIdentifier(res.data?.masked_identifier || "");
      setStep("code");
      setResendIn(60);
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't send a verification code."));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (code.trim().length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const token = await forgotPasswordVerifyOtp(identifier.trim(), code.trim());
      setActionToken(token);
      setStep("password");
    } catch (err) {
      setError(apiErrorMessage(err, "That code didn't work."));
    } finally {
      setLoading(false);
    }
  };

  const onResetPassword = async () => {
    if (newPassword.trim().length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword.trim() !== confirmPassword.trim()) {
      setError("Passwords don't match.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await resetPassword(actionToken, newPassword.trim(), confirmPassword.trim());
      setStep("done");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const onBack = () => {
    if (step === "code") setStep("identify");
    else if (step === "password") setStep("code");
    else navigation.goBack();
  };

  const stepTitle = {
    identify: "Reset your password",
    code: "Verify your identity",
    password: "Set a new password",
    done: "Password reset",
  }[step];
  const stepSubtitle = {
    identify: "Enter your email address to receive a code.",
    code: maskedIdentifier ? `Enter the code sent to ${maskedIdentifier}.` : "Enter the code we sent you.",
    password: "Choose a new password for your account.",
    done: "You can now sign in with your new password.",
  }[step];

  return (
    <AuthLayout
      title={stepTitle}
      subtitle={stepSubtitle}
      onBack={onBack}
      footer={() =>
        step !== "done" ? (
          <Pressable onPress={() => navigation.navigate("Login")} style={styles.backToLoginWrap}>
            <Text style={styles.backToLogin}>Back to login</Text>
          </Pressable>
        ) : null
      }
    >
      {(compact) => (
        <>
          {!!error && <ErrorBanner message={error} />}

          {step === "identify" && (
            <>
              <TextField
                auth
                dense={compact}
                label="Email"
                placeholder="you@example.com"
                value={identifier}
                onChangeText={setIdentifier}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <PrimaryButton label="Send verification code" onPress={requestCode} loading={loading} />
            </>
          )}

          {step === "code" && (
            <>
              <TextField auth dense={compact} label="6-digit code" placeholder="000000" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
              <PrimaryButton label="Verify code" onPress={verifyCode} loading={loading} />
              <Pressable onPress={requestCode} disabled={resendIn > 0 || loading} style={styles.resendWrap}>
                <Text style={styles.resend}>{resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}</Text>
              </Pressable>
            </>
          )}

          {step === "password" && (
            <>
              <TextField auth dense={compact} label="New password" placeholder="Minimum 8 characters" value={newPassword} onChangeText={setNewPassword} isPassword />
              <TextField auth dense={compact} label="Confirm new password" placeholder="Re-enter your new password" value={confirmPassword} onChangeText={setConfirmPassword} isPassword />
              <PrimaryButton label="Reset password" onPress={onResetPassword} loading={loading} />
            </>
          )}

          {step === "done" && <PrimaryButton label="Go to sign in" onPress={() => navigation.navigate("Login")} />}
        </>
      )}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  resendWrap: { alignSelf: "center", marginTop: 12, padding: 6 },
  resend: { fontSize: 13.5, color: NEUTRAL.textSecondary, fontWeight: "700" },
  backToLoginWrap: { padding: 8 },
  backToLogin: { fontSize: 16, color: NEUTRAL.textSecondary, fontWeight: "700" },
});
