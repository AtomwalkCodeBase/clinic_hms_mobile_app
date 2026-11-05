import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Screen, BackHeader, ErrorBanner, SectionTitle } from "@/components/Layout";
import { FooterAction } from "@/components/FooterAction";
import { SlotHeader, SlotGrid } from "@/components/SlotPicker";
import { SlidingTabs } from "@/components/SlidingTabs";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { getDoctorDetail, getSlots } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { AppStackParamList } from "@/navigation/types";
import { istDateIso, shortDayLabel } from "@/utils/indianTime";

function dateOffsetLabel(daysFromToday: number): { key: string; label: string } {
  const iso = istDateIso(daysFromToday);
  const label = daysFromToday === 0 ? "Today" : daysFromToday === 1 ? "Tomorrow" : shortDayLabel(iso);
  return { key: iso, label };
}

export function DoctorDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "DoctorDetail">>();
  const { hospitalId, doctorId, initialComplaint, patientAwpid, patientName } = route.params;
  const { theme } = useAppTheme();

  const dateOptions = [0, 1, 2, 3, 4, 5, 6].map(dateOffsetLabel);
  const [selectedDate, setSelectedDate] = useState(dateOptions[0].key);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableOnly, setAvailableOnly] = useState(false);

  const { data: doctor, error, refetch: loadDoctor, isPending: loading } = useQuery({
    queryKey: ["doctorDetail", hospitalId, doctorId],
    queryFn: () => getDoctorDetail(hospitalId, doctorId),
  });

  const { data: slots = [], isFetching: slotsLoading } = useQuery({
    queryKey: ["slots", hospitalId, doctorId, selectedDate],
    queryFn: () => getSlots(hospitalId, doctorId, selectedDate),
  });

  const onBook = () => {
    if (!doctor || !selectedTime) return;
    // Who this booking is for was already decided one screen back
    // (BookingForScreen, reached before this screen for a fresh
    // booking) — patientAwpid/patientName just ride along from
    // there, same as they already did for "Book follow-up".
    navigation.navigate("ConfirmBooking", {
      hospitalId,
      doctorId,
      doctorName: doctor.name,
      hospitalName: typeof doctor.hospital === "object" ? doctor.hospital.name : String(doctor.hospital || ""),
      date: selectedDate,
      time: selectedTime,
      chiefComplaint: initialComplaint,
      patientAwpid,
      patientName: patientName || "You",
      consultationFee: doctor.consultation_fee,
    });
  };

  // Everything above the slots stays put; only the slot grid scrolls, and the button stays at the bottom.
  return (
    <Screen
      header={
        <>
          <BackHeader title="Doctor profile" onBack={() => navigation.goBack()} />
          {!!error && <ErrorBanner message={apiErrorMessage(error)} onRetry={loadDoctor} />}
          {loading ? (
            <Text style={styles.loading}>Loading…</Text>
          ) : !doctor ? null : (
            <View style={styles.body}>
              <View style={[styles.avatar, { backgroundColor: theme.bg }]}>
                <Text style={[styles.avatarText, { color: theme.text }]}>{doctor.name.replace("Dr. ", "")[0]}</Text>
              </View>
              <Text style={styles.name}>{doctor.name}</Text>
              <Text style={styles.spec}>
                {doctor.specialisation || "General physician"}
                {doctor.experience_years ? ` · ${doctor.experience_years} yrs experience` : ""}
              </Text>
              {!!doctor.bio && <Text style={styles.bio}>{doctor.bio}</Text>}
              {!!doctor.known_for && <Text style={styles.knownFor}>Known for: {doctor.known_for}</Text>}
              {!!doctor.consultation_fee && (
                <View style={[styles.feeBox, { backgroundColor: theme.bg }]}>
                  <Text style={[styles.feeLabel, { color: theme.text }]}>CONSULTATION FEE</Text>
                  <Text style={[styles.feeValue, { color: theme.text }]}>₹{doctor.consultation_fee}</Text>
                </View>
              )}

              <View style={{ alignSelf: "stretch" }}>
                <SectionTitle>Choose a date</SectionTitle>
                <SlidingTabs
                  label="Date"
                  look="chips"
                  options={dateOptions}
                  value={selectedDate}
                  onChange={(d) => { setSelectedDate(d); setSelectedTime(null); }}
                  style={{ marginBottom: 12 }}
                />
              </View>

              <View style={{ alignSelf: "stretch" }}>
                <SlotHeader showFilter={slots.length > 0} availableOnly={availableOnly} onChange={setAvailableOnly} />
              </View>
            </View>
          )}
        </>
      }
      footer={doctor ? <FooterAction label={selectedTime ? "Book appointment" : "Pick a slot to continue"} disabled={!selectedTime} onPress={onBook} /> : undefined}
    >
      {!!doctor && (
        <SlotGrid slots={slots} loading={slotsLoading} selectedTime={selectedTime} availableOnly={availableOnly} onSelect={setSelectedTime} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { textAlign: "center", color: NEUTRAL.textMuted, marginTop: 40 },
  body: { alignItems: "center" },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  avatarText: { fontSize: 22, fontWeight: "700" },
  name: { fontSize: 16, fontWeight: "600", color: NEUTRAL.textPrimary },
  spec: { fontSize: 12.5, color: NEUTRAL.textSecondary, marginTop: 3, marginBottom: 14, textAlign: "center" },
  bio: { fontSize: 12.5, color: NEUTRAL.textSecondary, textAlign: "left", alignSelf: "stretch", marginBottom: 10 },
  knownFor: { fontSize: 12, color: NEUTRAL.textSecondary, alignSelf: "stretch", marginBottom: 6 },
  feeBox: {
    alignSelf: "stretch",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  feeLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  feeValue: { fontSize: 17, fontWeight: "800" },
});
