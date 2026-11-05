import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Keyboard, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Screen } from "@/components/Layout";
import { BackButton } from "@/components/IconButtons";
import { HealthNetLogo } from "@/components/Logo";
import { BRAND, NEUTRAL } from "@/theme/themes";

/** True while the on-screen keyboard is open. */
function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", () => setOpen(true));
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

/**
 * The page every sign-in and sign-up screen sits on. The logo, the heading and the line under it are fixed: they never
 * move, whatever the keyboard does. Only the fields below them make room for the keyboard (the page shrinks and the field
 * being typed in is kept in view), so the patient never scrolls the page itself. `children` is told whether the keyboard is
 * open so it can tighten its own spacing. `footer` sits right under the fields, not pinned to the bottom of the screen.
 */
export function AuthLayout({
  title,
  subtitle,
  onBack,
  topRight,
  step,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Shows a back arrow at the top left when given. */
  onBack?: () => void;
  /** Small text at the top right (the app version). */
  topRight?: string;
  /** Draws the step bars ("2 of 3") above the heading. */
  step?: { current: number; total: number };
  footer?: () => React.ReactNode;
  children: (keyboardOpen: boolean) => React.ReactNode;
}) {
  const keyboardOpen = useKeyboardOpen();
  return (
    <Screen scroll={false} topColor={NEUTRAL.bg}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
        <View style={styles.page}>
          <View style={styles.top}>
            {onBack ? <BackButton onPress={onBack} color={NEUTRAL.textPrimary} /> : <View />}
            {!!topRight && <Text style={styles.topRight}>{topRight}</Text>}
          </View>

          <View style={styles.logo}>
            <HealthNetLogo size={64} />
          </View>

          {!!step && (
            <View style={styles.steps} accessibilityLabel={`Step ${step.current} of ${step.total}`}>
              {Array.from({ length: step.total }, (_, i) => (
                <View key={i} style={[styles.stepBar, i < step.current && styles.stepOn]} />
              ))}
            </View>
          )}

          <Text style={styles.title}>{title}</Text>
          {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
            overScrollMode="never"
          >
            {children(keyboardOpen)}
            {!!footer && <View style={styles.footer}>{footer()}</View>}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // runs to the screen edges (the page's 24 side padding is given back inside) so a shaking form isn't clipped
  scroll: { flex: 1, marginHorizontal: -24 },
  page: { flex: 1, paddingHorizontal: 24, paddingBottom: 14 },
  top: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topRight: { fontSize: 12, color: NEUTRAL.textMuted },
  logo: { alignItems: "flex-start", marginTop: 2, marginBottom: 26 },
  steps: { flexDirection: "row", gap: 6, marginBottom: 14 },
  stepBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: NEUTRAL.border },
  stepOn: { backgroundColor: BRAND },
  title: { fontSize: 28, fontWeight: "600", color: NEUTRAL.textPrimary, letterSpacing: -0.6, lineHeight: 32 },
  subtitle: { fontSize: 14, color: NEUTRAL.textSecondary, lineHeight: 20, marginTop: 6 },
  body: { paddingTop: 28, paddingBottom: 8, paddingHorizontal: 24 },
  footer: { alignItems: "center", marginTop: 22 },
});
