import { useState } from "react";
import { View, TextInput, Text, StyleSheet, TextInputProps, Pressable } from "react-native";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";

interface Props extends TextInputProps {
  label: string;
  error?: string;
  isPassword?: boolean;
  /** The sign-in and onboarding look: sentence-case label, taller rounded field. */
  auth?: boolean;
  /** Tighter spacing, for when the keyboard leaves little room. */
  dense?: boolean;
}

export function TextField({ label, error, isPassword, auth, dense, style, ...rest }: Props) {
  const { theme } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!isPassword);

  return (
    <View style={[styles.wrap, auth && (dense ? styles.authWrapDense : styles.authWrap)]}>
      <Text style={[styles.label, auth && styles.authLabel]}>{label}</Text>
      <View
        style={[
          styles.inputRow,
          auth && styles.authRow,
          { borderColor: error ? NEUTRAL.danger : focused ? theme.fill : NEUTRAL.border },
        ]}
      >
        <TextInput
          {...rest}
          secureTextEntry={hidden}
          // Password fields must never auto-capitalize/auto-correct, and
          // must opt fully out of the OS's autofill/password-manager —
          // Android's autofill service can silently substitute a
          // previously-saved password into one of the two fields (or pad
          // it), which is invisible behind the masked dots and shows up as
          // "passwords don't match" even when the user typed the exact
          // same thing in both fields.
          {...(isPassword
            ? {
                autoCapitalize: "none",
                autoCorrect: false,
                textContentType: "newPassword",
                autoComplete: "off",
                importantForAutofill: "no",
              }
            : null)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, auth && (dense ? styles.authInputDense : styles.authInput), style]}
          placeholderTextColor={NEUTRAL.textMuted}
        />
        {isPassword && (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={8}>
            <Text style={{ color: NEUTRAL.textMuted, fontSize: 12 }}>{hidden ? "Show" : "Hide"}</Text>
          </Pressable>
        )}
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: NEUTRAL.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: NEUTRAL.surface,
  },
  input: { flex: 1, paddingVertical: 11, fontSize: 14, color: NEUTRAL.textPrimary },
  authWrap: { marginBottom: 12 },
  authWrapDense: { marginBottom: 6 },
  authLabel: { fontSize: 12.5, textTransform: "none", letterSpacing: 0 },
  authRow: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14 },
  authInput: { paddingVertical: 14, fontSize: 15 },
  authInputDense: { paddingVertical: 8, fontSize: 15 },
  error: { fontSize: 11, color: NEUTRAL.danger, marginTop: 4 },
});
