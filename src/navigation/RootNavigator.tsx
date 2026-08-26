import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import * as LocalAuthentication from "expo-local-authentication";
import { useAuth } from "@/context/AuthContext";
import { AuthStack } from "./AuthStack";
import { AppStack } from "./AppStack";
import { BiometricGate } from "@/components/BiometricGate";
import { BiometricPrimingScreen } from "@/components/BiometricPrimingScreen";
import { getBiometricPromptSeen } from "@/utils/storage";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";

export function RootNavigator() {
  const { isLoading, isAuthenticated } = useAuth();
  const { theme } = useAppTheme();
  // null = still checking; true = show BiometricPrimingScreen once;
  // false = skip straight to the app (already asked, or no biometric
  // hardware on this device to even offer).
  const [needsBiometricPrompt, setNeedsBiometricPrompt] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setNeedsBiometricPrompt(null);
      return;
    }
    (async () => {
      const seen = await getBiometricPromptSeen();
      if (seen) {
        setNeedsBiometricPrompt(false);
        return;
      }
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = hasHardware && (await LocalAuthentication.isEnrolledAsync());
      setNeedsBiometricPrompt(hasHardware && isEnrolled);
    })();
  }, [isAuthenticated]);

  // This is the one moment a saved session actually shows a spinner —
  // just long enough to check for a stored token before deciding whether
  // to resume straight into the app or show the login screen.
  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: NEUTRAL.bg }}>
        <ActivityIndicator size="large" color={theme.fill} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? (
        needsBiometricPrompt === null ? null : needsBiometricPrompt ? (
          <BiometricPrimingScreen onDone={() => setNeedsBiometricPrompt(false)} />
        ) : (
          <BiometricGate>
            <AppStack />
          </BiometricGate>
        )
      ) : (
        <AuthStack />
      )}
    </NavigationContainer>
  );
}
