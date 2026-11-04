import { useState } from "react";
import { Text, StyleSheet, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ErrorBanner } from "@/components/Layout";
import { AuthLayout } from "@/components/AuthLayout";
import { TextField } from "@/components/TextField";
import { DateField } from "@/components/DateField";
import { PrimaryButton } from "@/components/Buttons";
import { NEUTRAL } from "@/theme/themes";
import { registerRequestOtp, registerVerifyOtp, registerAccount } from "@/api/auth";
import { apiErrorMessage } from "@/api/client";
import { AuthStackParamList } from "@/navigation/types";

// Ordered as a real signup should be: identity first, then prove the email
// is really yours (OTP), then set the password last — not a single page
// with password sitting next to unverified fields. Email is mandatory
// (not just "recommended") because the backend's registration OTP purpose
// only accepts an email identifier — there's no mobile-OTP path (that
// needs a paid SMS gateway that isn't wired up yet, see
// core/auth/otp_views.py) — so there is no account-creation path that
// skips verification.
type Step = "details" | "otp" | "password";

export function RegisterScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const [step, setStep] = useState<Step>("details");

  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState(""); // YYYY-MM-DD
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  // Proof the OTP step actually succeeded — PortalRegisterView requires
  // this and derives the account's email from it directly, not from
  // anything sent in the final register call.
  const [actionToken, setActionToken] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onContinueFromDetails = async () => {
    if (!fullName.trim() || !/^\d{10}$/.test(mobile.trim()) || !email.trim()) {
      setError("Fill in your name, mobile number, and email.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await registerRequestOtp(email.trim());
      setStep("otp");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const onVerifyOtp = async () => {
    if (otp.trim().length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const token = await registerVerifyOtp(email.trim(), otp.trim());
      setActionToken(token);
      setStep("password");
    } catch (err) {
      setError(apiErrorMessage(err, "Incorrect code."));
    } finally {
      setLoading(false);
    }
  };

  const onSetPasswordAndCreate = async () => {
    // Trim defensively — invisible keyboard/autofill-inserted whitespace
    // must never end up baked into the stored password.
    if (password.trim().length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password.trim() !== confirmPassword.trim()) {
      setError("Passwords don't match.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await registerAccount({
        action_token: actionToken,
        full_name: fullName.trim(),
        mobile: mobile.trim(),
        password: password.trim(),
        date_of_birth: dob.trim() || undefined,
      });
      navigation.navigate("Login");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const onBack = () => {
    if (step === "password") setStep("otp");
    else if (step === "otp") setStep("details");
    else navigation.goBack();
  };

  const stepTitle = { details: "Create your account", otp: "Verify your email", password: "Set a password" }[step];
  const stepSubtitle = {
    details: "Register to book appointments and view your records.",
    otp: `Enter the code sent to ${email}.`,
    password: "Last step — choose a password to protect your account.",
  }[step];

  const stepNumber = { details: 1, otp: 2, password: 3 }[step];

  return (
    <AuthLayout
      title={stepTitle}
      subtitle={stepSubtitle}
      onBack={onBack}
      step={{ current: stepNumber, total: 3 }}
      footer={() =>
        step !== "details" ? (
          <Pressable onPress={() => navigation.navigate("Login")} style={styles.backToLoginWrap}>
            <Text style={styles.backToLogin}>Back to login</Text>
          </Pressable>
        ) : null
      }
    >
      {(compact) => (
        <>
          {!!error && <ErrorBanner message={error} />}

          {step === "details" && (
            <>
              <TextField auth dense={compact} label="Full name" placeholder="e.g. Rohan Sharma" value={fullName} onChangeText={setFullName} />
              <TextField auth dense={compact} label="Mobile number" placeholder="98xxxxxxxx" value={mobile} onChangeText={setMobile} keyboardType="number-pad" maxLength={10} />
              <TextField auth dense={compact} label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              {!compact && <Text style={styles.hint}>We'll send a verification code to confirm it's really you.</Text>}
              <DateField auth dense={compact} label="Date of birth" value={dob} onChange={setDob} maximumDate={new Date()} />
              <PrimaryButton label="Continue" onPress={onContinueFromDetails} loading={loading} />
            </>
          )}

          {step === "otp" && (
            <>
              <TextField auth dense={compact} label="6-digit code" placeholder="000000" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} />
              <PrimaryButton label="Verify code" onPress={onVerifyOtp} loading={loading} />
            </>
          )}

          {step === "password" && (
            <>
              <TextField auth dense={compact} label="Password" placeholder="Minimum 8 characters" value={password} onChangeText={setPassword} isPassword />
              <TextField auth dense={compact} label="Confirm password" placeholder="Re-enter your password" value={confirmPassword} onChangeText={setConfirmPassword} isPassword />
              <PrimaryButton label="Create account" onPress={onSetPasswordAndCreate} loading={loading} />
            </>
          )}
        </>
      )}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 11.5, color: NEUTRAL.textMuted, marginTop: -6, marginBottom: 12 },
  backToLoginWrap: { padding: 8 },
  backToLogin: { fontSize: 16, color: NEUTRAL.textSecondary, fontWeight: "700" },
});
