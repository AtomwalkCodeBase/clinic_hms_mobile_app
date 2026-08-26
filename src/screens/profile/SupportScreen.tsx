import React from "react";
import { Text, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen, BackHeader } from "@/components/Layout";
import { Card } from "@/components/Card";
import { NEUTRAL } from "@/theme/themes";
import { AppStackParamList } from "@/navigation/types";

export function SupportScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  return (
    <Screen>
      <BackHeader title="Support" onBack={() => navigation.goBack()} />
      <Card>
        <Text style={styles.text}>
          For questions about your records, appointments, or anything that doesn't look right in the app, contact{" "}
          <Text style={{ fontWeight: "700" }}>support@atomwalk.com</Text>.
        </Text>
        <Text style={styles.note}>
          In a medical emergency, call your local emergency number or go to the nearest hospital directly — do not
          wait for a reply here.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 12, color: NEUTRAL.textSecondary, lineHeight: 18 },
  note: { fontSize: 11, color: NEUTRAL.textMuted, lineHeight: 16, marginTop: 8 },
});
