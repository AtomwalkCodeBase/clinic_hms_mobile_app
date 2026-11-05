import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "@/components/Layout";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { AnimatedCheck, Confetti, CountUp, Rise } from "@/components/Motion";
import { BRAND_TEXT, BRAND_TINT, NEUTRAL } from "@/theme/themes";
import { AppStackParamList } from "@/navigation/types";
import { formatTime12, istDateIso, shortDayLabel } from "@/utils/indianTime";

/** "Today", "Tomorrow", or the weekday, under the date. */
function dateCaption(iso: string): string {
  if (iso === istDateIso(0)) return "Today";
  if (iso === istDateIso(1)) return "Tomorrow";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { weekday: "long" });
}

function timeCaption(time?: string): string {
  const hour = Number((time || "").split(":")[0]);
  if (!Number.isFinite(hour)) return "";
  return hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
}

export function BookingSuccessScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "BookingSuccess">>();
  const { hospital, doctor, date, time, tokenNumber } = route.params;
  const isIso = /^\d{4}-\d{2}-\d{2}$/.test(date);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  return (
    <Screen scroll={false} topColor={NEUTRAL.bg}>
      <Confetti />
      <View style={styles.center}>
        <AnimatedCheck />
        <Rise index={2}>
          <Text style={styles.title}>Appointment booked</Text>
          <Text style={styles.subtitle}>You're all set. See you soon.</Text>
        </Rise>

        <Rise index={4} style={styles.ticketWrap}>
          <View style={styles.ticket}>
            <View style={styles.who}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{doctor.replace("Dr. ", "")[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.doctor} numberOfLines={1}>{doctor}</Text>
                <Text style={styles.hospital} numberOfLines={1}>{hospital}</Text>
              </View>
            </View>

            <View style={styles.tear}>
              <View style={[styles.notch, { left: -24 }]} />
              <View style={styles.dash} />
              <View style={[styles.notch, { right: -24 }]} />
            </View>

            {/* Date, time and token weigh the same: three equal columns, same label, same size. */}
            <View style={styles.row3}>
              <View style={styles.cell}>
                <Text style={styles.cellLabel}>DATE</Text>
                <Text style={styles.cellValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{isIso ? shortDayLabel(date) : date}</Text>
                {isIso && <Text style={styles.cellNote}>{dateCaption(date)}</Text>}
              </View>
              <View style={[styles.cell, styles.cellDivider]}>
                <Text style={styles.cellLabel}>TIME</Text>
                <Text style={styles.cellValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{time ? formatTime12(time) : "-"}</Text>
                {!!time && <Text style={styles.cellNote}>{timeCaption(time)}</Text>}
              </View>
              <View style={[styles.cell, styles.cellDivider]}>
                <Text style={styles.cellLabel}>TOKEN</Text>
                {tokenNumber != null ? (
                  <CountUp value={tokenNumber} prefix="#" style={styles.cellValue} />
                ) : (
                  <Text style={styles.cellValue}>-</Text>
                )}
                <Text style={styles.cellNote}>Queue no.</Text>
              </View>
            </View>

            <Text style={styles.hint}>Show your token at the hospital's front desk. Payment is collected there.</Text>
          </View>
        </Rise>

        <Rise index={6} style={styles.buttons}>
          <PrimaryButton label="View my appointments" onPress={() => navigation.navigate("Tabs" as any, { screen: "Appointments" } as any)} />
          <SecondaryButton label="Back to home" onPress={() => navigation.navigate("Tabs" as any, { screen: "Home" } as any)} />
        </Rise>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, gap: 18 },
  title: { fontSize: 24, fontWeight: "700", color: NEUTRAL.textPrimary, textAlign: "center", letterSpacing: -0.4 },
  subtitle: { fontSize: 14, color: NEUTRAL.textSecondary, textAlign: "center", marginTop: 5 },
  ticketWrap: { alignSelf: "stretch" },
  ticket: { backgroundColor: "#FFFFFF", borderRadius: 22, padding: 16, borderWidth: 1, borderColor: NEUTRAL.border, shadowColor: "#0E3C2E", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 18, elevation: 4 },
  who: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: BRAND_TINT, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontWeight: "700", color: BRAND_TEXT },
  doctor: { fontSize: 16, fontWeight: "700", color: NEUTRAL.textPrimary },
  hospital: { fontSize: 12.5, color: NEUTRAL.textMuted, marginTop: 2 },
  tear: { height: 14, marginVertical: 14, justifyContent: "center" },
  dash: { borderTopWidth: 1.5, borderTopColor: NEUTRAL.border, borderStyle: "dashed" },
  notch: { position: "absolute", width: 14, height: 14, borderRadius: 7, backgroundColor: NEUTRAL.bg },
  row3: { flexDirection: "row" },
  cell: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
  cellDivider: { borderLeftWidth: 1, borderLeftColor: NEUTRAL.border },
  cellLabel: { fontSize: 10.5, letterSpacing: 0.9, fontWeight: "700", color: NEUTRAL.textMuted },
  cellValue: { fontSize: 18, fontWeight: "700", color: BRAND_TEXT, marginTop: 6 },
  cellNote: { fontSize: 11.5, color: NEUTRAL.textMuted, marginTop: 2 },
  hint: { fontSize: 12, color: NEUTRAL.textMuted, textAlign: "center", marginTop: 14 },
  buttons: { alignSelf: "stretch", gap: 10 },
});
