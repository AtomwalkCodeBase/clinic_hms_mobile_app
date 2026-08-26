import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen, BackHeader, ErrorBanner, SectionTitle, EmptyState } from "@/components/Layout";
import { Card } from "@/components/Card";
import { PrimaryButton } from "@/components/Buttons";
import { SegmentedControl } from "@/components/SegmentedControl";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { getSlots, rescheduleBooking } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { SlotEntry } from "@/api/types";
import { AppStackParamList } from "@/navigation/types";
import { MessageDialog } from "@/components/MessageDialog";

function dateOffsetLabel(daysFromToday: number): { key: string; label: string } {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  const iso = d.toISOString().slice(0, 10);
  const label = daysFromToday === 0 ? "Today" : daysFromToday === 1 ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return { key: iso, label };
}

export function RescheduleScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "Reschedule">>();
  const { bookingId, tenantId, doctorId, doctorName, hospitalName, patientName } = route.params;
  const { theme } = useAppTheme();

  const dateOptions = [0, 1, 2, 3, 4, 5, 6].map(dateOffsetLabel);
  const [selectedDate, setSelectedDate] = useState(dateOptions[0].key);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotEntry[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setSelectedTime(null);
    setSlots([]);
    setSlotsLoading(true);
    // Best-effort only -- a failure here (e.g. doctorId not resolving to a
    // real doctor) just means no suggested slots, not a reschedule failure;
    // the empty state below already says so. A visible error banner here
    // would contradict that and read as broken when it isn't.
    getSlots(tenantId, doctorId, selectedDate)
      .then(setSlots)
      .catch(() => {})
      .finally(() => setSlotsLoading(false));
  }, [tenantId, doctorId, selectedDate]);

  const onConfirm = async () => {
    setError("");
    setSaving(true);
    try {
      await rescheduleBooking(bookingId, { scheduled_date: selectedDate, scheduled_time: selectedTime || undefined });
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't reschedule this appointment. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <BackHeader title="Reschedule" onBack={() => navigation.goBack()} />

      <Card>
        <Text style={styles.doctor}>{doctorName}</Text>
        <Text style={styles.hospital}>
          {hospitalName} · for {patientName}
        </Text>
      </Card>

      {!!error && <ErrorBanner message={error} />}

      <SectionTitle>Choose a new date</SectionTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <SegmentedControl options={dateOptions} value={selectedDate} onChange={setSelectedDate} />
      </ScrollView>

      <SectionTitle>Choose a time slot</SectionTitle>
      {slotsLoading ? (
        <Text style={styles.slotsLoading}>Loading slots…</Text>
      ) : slots.length === 0 ? (
        <EmptyState text="No slots configured for this day — try a different date." />
      ) : (
        <View style={styles.slotGrid}>
          {slots.map((s) => {
            const active = s.time === selectedTime;
            return (
              <Pressable
                key={s.time}
                disabled={!s.available}
                onPress={() => setSelectedTime(s.time)}
                style={[
                  styles.slot,
                  !s.available && styles.slotDisabled,
                  active && { backgroundColor: theme.fill, borderColor: theme.fill },
                ]}
              >
                <Text style={[styles.slotText, !s.available && styles.slotTextDisabled, active && { color: theme.on }]}>
                  {s.time}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <PrimaryButton
        label={selectedTime ? "Confirm new time" : "Pick a slot to continue"}
        disabled={!selectedTime}
        onPress={onConfirm}
        loading={saving}
        style={{ marginTop: 16 }}
      />

      <MessageDialog
        visible={done}
        title="Appointment rescheduled"
        message={`Your visit with ${doctorName} is now set for ${dateOptions.find((d) => d.key === selectedDate)?.label || selectedDate}${selectedTime ? ` at ${selectedTime}` : ""}.`}
        buttonLabel="Done"
        onDismiss={() => {
          setDone(false);
          navigation.goBack();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  doctor: { fontSize: 13.5, fontWeight: "600", color: NEUTRAL.textPrimary },
  hospital: { fontSize: 12, color: NEUTRAL.textSecondary, marginTop: 3 },
  slotsLoading: { fontSize: 12, color: NEUTRAL.textMuted, marginTop: 4, marginBottom: 8 },
  slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  slot: { borderWidth: 1, borderColor: NEUTRAL.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: NEUTRAL.surface },
  slotDisabled: { backgroundColor: NEUTRAL.surfaceAlt, borderColor: NEUTRAL.surfaceAlt },
  slotText: { fontSize: 12, color: NEUTRAL.textPrimary, fontWeight: "600" },
  slotTextDisabled: { color: NEUTRAL.textMuted, fontWeight: "400" },
});
