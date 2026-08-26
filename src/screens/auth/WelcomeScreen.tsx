import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "@/components/Layout";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { LogoPill } from "@/components/Logo";
import { MetalHero } from "@/components/MetalHero";
import { NEUTRAL } from "@/theme/themes";
import { setWelcomeSeen } from "@/utils/storage";
import { AuthStackParamList } from "@/navigation/types";

// First screen a brand-new install ever sees — states what the app is for
// in one screen before asking for anything, then never appears again on
// this device (see getWelcomeSeen/setWelcomeSeen): a later sign-out drops
// straight back on Login, not here, since "welcome" only applies once.
export function WelcomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();

  const proceed = async (screen: "Register" | "Login") => {
    await setWelcomeSeen();
    navigation.replace(screen);
  };

  return (
    <Screen>
      <MetalHero style={styles.hero} decorative curved>
        <View style={styles.heroInner}>
          <LogoPill size={64} />
        </View>
      </MetalHero>

      <View style={styles.body}>
        <Text style={styles.title}>Your health record, always in your pocket</Text>
        <Text style={styles.subtitle}>
          Book appointments, see prescriptions, and track your family's care — across one hospital or twenty.
        </Text>
      </View>

      <PrimaryButton label="Create account" onPress={() => proceed("Register")} style={{ marginTop: 8 }} />
      <SecondaryButton label="I already have an account" onPress={() => proceed("Login")} style={{ marginTop: 10 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: 28 },
  heroInner: { alignItems: "center", paddingVertical: 16 },
  body: { alignItems: "center", marginBottom: 32, paddingHorizontal: 4 },
  title: { fontSize: 19, fontWeight: "600", color: NEUTRAL.textPrimary, textAlign: "center", lineHeight: 26 },
  subtitle: { fontSize: 13, color: NEUTRAL.textSecondary, textAlign: "center", marginTop: 10, lineHeight: 19 },
});
