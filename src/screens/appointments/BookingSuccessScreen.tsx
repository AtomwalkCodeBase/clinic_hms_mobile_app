import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CheckCircle2 } from "lucide-react-native";
import { Screen } from "@/components/Layout";
import { PrimaryButton } from "@/components/Buttons";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { AppStackParamList } from "@/navigation/types";

export function BookingSuccessScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "BookingSuccess">>();
  const { hospital, doctor, date, time, tokenNumber } = route.params;
  const { theme } = useAppTheme();

  return (
    <Screen scroll={false}>
      <View style={styles.center}>
        <View style={[styles.circle, { backgroundColor: theme.bg }]}>
          <CheckCircle2 size={30} color={theme.text} strokeWidth={2.2} />
        </View>
        <Text style={styles.title}>Appointment booked</Text>
        <Text style={styles.subtitle}>
          {doctor} · {hospital}
        </Text>
        <Text style={styles.subtitle}>
          {date}
          {time ? `, ${time}` : ""}
        </Text>

        <View style={styles.tokenBox}>
          <Text style={styles.tokenLabel}>TOKEN NUMBER</Text>
          <Text style={styles.tokenValue}>#{tokenNumber}</Text>
        </View>

        <PrimaryButton
          label="View my appointments"
          onPress={() => navigation.navigate("Tabs" as any, { screen: "Appointments" } as any)}
          style={{ alignSelf: "stretch" }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  circle: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  title: { fontSize: 17, fontWeight: "600", color: NEUTRAL.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: 12.5, color: NEUTRAL.textSecondary, marginBottom: 2 },
  tokenBox: { alignItems: "center", backgroundColor: NEUTRAL.surfaceAlt, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28, marginVertical: 20 },
  tokenLabel: { fontSize: 10, color: NEUTRAL.textMuted },
  tokenValue: { fontSize: 22, fontWeight: "700", color: NEUTRAL.textPrimary, marginTop: 2 },
});
