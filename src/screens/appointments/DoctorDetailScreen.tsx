import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Check } from "lucide-react-native";
import { Screen, BackHeader, ErrorBanner, SectionTitle, EmptyState } from "@/components/Layout";
import { PrimaryButton } from "@/components/Buttons";
import { SegmentedControl } from "@/components/SegmentedControl";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { getDoctorDetail, getSlots } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { DoctorDetail, SlotEntry } from "@/api/types";
import { AppStackParamList } from "@/navigation/types";

function dateOffsetLabel(daysFromToday: number): { key: string; label: string } {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  const iso = d.toISOString().slice(0, 10);
  const label = daysFromToday === 0 ? "Today" : daysFromToday === 1 ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return { key: iso, label };
}

export function DoctorDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "DoctorDetail">>();
  const { tenantId, doctorId, initialComplaint, patientAwpid, patientName } = route.params;
  const { theme } = useAppTheme();

  const dateOptions = [0, 1, 2, 3, 4, 5, 6].map(dateOffsetLabel);
  const [selectedDate, setSelectedDate] = useState(dateOptions[0].key);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableOnly, setAvailableOnly] = useState(false);

  const [doctor, setDoctor] = useState<DoctorDetail | null>(null);
  const [slots, setSlots] = useState<SlotEntry[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadDoctor = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDoctor(await getDoctorDetail(tenantId, doctorId));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [tenantId, doctorId]);

  useEffect(() => {
    loadDoctor();
  }, [loadDoctor]);

  useEffect(() => {
    setSelectedTime(null);
    setSlots([]);
    setSlotsLoading(true);
    getSlots(tenantId, doctorId, selectedDate)
      .then(setSlots)
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setSlotsLoading(false));
  }, [tenantId, doctorId, selectedDate]);

  return (
    <Screen>
      <BackHeader title="Doctor profile" onBack={() => navigation.goBack()} />
      {!!error && <ErrorBanner message={error} onRetry={loadDoctor} />}
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <SegmentedControl options={dateOptions} value={selectedDate} onChange={setSelectedDate} />
            </ScrollView>
          </View>

          <View style={{ alignSelf: "stretch" }}>
            <View style={styles.slotHeaderRow}>
              <SectionTitle>Choose a time slot</SectionTitle>
              {slots.length > 0 && (
                <View style={styles.filterRow}>
                  <Pressable
                    onPress={() => setAvailableOnly(false)}
                    style={[styles.filterBtn, !availableOnly && { backgroundColor: theme.fill }]}
                  >
                    <Text style={[styles.filterBtnText, !availableOnly && { color: theme.on }]}>All slots</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setAvailableOnly(true)}
                    style={[styles.filterBtn, styles.filterBtnOutline, availableOnly && { backgroundColor: theme.bg, borderColor: theme.fill }]}
                  >
                    {availableOnly && <Check size={11} color={theme.text} strokeWidth={3} />}
                    <Text style={[styles.filterBtnText, styles.filterBtnTextOutline, availableOnly && { color: theme.text }]}>
                      Available only
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
            {slotsLoading ? (
              <Text style={styles.slotsLoading}>Loading slots…</Text>
            ) : slots.length === 0 ? (
              <EmptyState text="No slots configured for this day — try a different date." />
            ) : (
              <>
                {(() => {
                  const visibleSlots = availableOnly ? slots.filter((s) => s.available) : slots;
                  const hiddenCount = slots.length - visibleSlots.length;
                  return visibleSlots.length === 0 ? (
                    <EmptyState text="All slots are booked for this day — try a different date." />
                  ) : (
                    <>
                      <View style={styles.slotGrid}>
                        {visibleSlots.map((s) => {
                          const active = s.time === selectedTime;
                          return (
                            <Pressable
                              key={s.time}
                              disabled={!s.available}
                              onPress={() => setSelectedTime(s.time)}
                              style={[
                                styles.slot,
                                !s.available && styles.slotBooked,
                                active && { backgroundColor: theme.fill, borderColor: theme.fill },
                                !active && s.available && { borderColor: theme.fill },
                              ]}
                            >
                              <Text style={[styles.slotText, !s.available && styles.slotTextBooked, active && { color: theme.on }]}>
                                {s.time}
                              </Text>
                              {!s.available && <Text style={styles.slotBookedCaption}>BOOKED</Text>}
                            </Pressable>
                          );
                        })}
                      </View>
                      {availableOnly && hiddenCount > 0 && (
                        <Text style={styles.hiddenHint}>
                          {hiddenCount} booked slot{hiddenCount > 1 ? "s" : ""} hidden
                        </Text>
                      )}
                    </>
                  );
                })()}
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendSwatch, { borderColor: theme.fill, backgroundColor: NEUTRAL.surface }]} />
                    <Text style={styles.legendText}>Available</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendSwatch, { backgroundColor: theme.fill, borderColor: theme.fill }]} />
                    <Text style={styles.legendText}>Selected</Text>
                  </View>
                  {!availableOnly && (
                    <View style={styles.legendItem}>
                      <View style={[styles.legendSwatch, styles.slotBooked]} />
                      <Text style={styles.legendText}>Booked</Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </View>

          <PrimaryButton
            label={selectedTime ? "Book appointment" : "Pick a slot to continue"}
            disabled={!selectedTime}
            style={{ alignSelf: "stretch" }}
            onPress={() =>
              // Who this booking is for was already decided one screen back
              // (BookingForScreen, reached before this screen for a fresh
              // booking) — patientAwpid/patientName just ride along from
              // there, same as they already did for "Book follow-up".
              navigation.navigate("ConfirmBooking", {
                tenantId,
                doctorId,
                doctorName: doctor.name,
                hospitalName: typeof doctor.hospital === "object" ? doctor.hospital.name : String(doctor.hospital || ""),
                date: selectedDate,
                time: selectedTime || undefined,
                chiefComplaint: initialComplaint,
                patientAwpid,
                patientName: patientName || "You",
                consultationFee: doctor.consultation_fee,
              })
            }
          />
        </View>
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
  slotHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  filterRow: { flexDirection: "row", gap: 6 },
  filterBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: NEUTRAL.surfaceAlt },
  filterBtnOutline: { backgroundColor: NEUTRAL.surface, borderWidth: 1.5, borderColor: NEUTRAL.border },
  filterBtnText: { fontSize: 10.5, fontWeight: "700", color: NEUTRAL.textSecondary },
  filterBtnTextOutline: { color: NEUTRAL.textSecondary },
  hiddenHint: { fontSize: 10, color: NEUTRAL.textMuted, marginTop: -2, marginBottom: 8 },
  slotsLoading: { fontSize: 12, color: NEUTRAL.textMuted, marginTop: 4, marginBottom: 8 },
  slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  slot: { borderWidth: 1, borderColor: NEUTRAL.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: NEUTRAL.surface, alignItems: "center" },
  slotBooked: { backgroundColor: NEUTRAL.dangerBg, borderColor: "#F3D3D3" },
  slotText: { fontSize: 12, color: NEUTRAL.textPrimary, fontWeight: "600" },
  slotTextBooked: { color: NEUTRAL.danger, fontWeight: "600", textDecorationLine: "line-through" },
  slotBookedCaption: { fontSize: 8, color: NEUTRAL.danger, fontWeight: "700", marginTop: 1, letterSpacing: 0.3 },
  legendRow: { flexDirection: "row", gap: 14, marginBottom: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendSwatch: { width: 9, height: 9, borderRadius: 2, borderWidth: 1 },
  legendText: { fontSize: 9.5, color: NEUTRAL.textSecondary },
});
