import { useEffect, useState } from "react";
import { Text, StyleSheet } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen, BackHeader, ErrorBanner, SectionTitle } from "@/components/Layout";
import { Card } from "@/components/Card";
import { FooterAction } from "@/components/FooterAction";
import { SlotHeader, SlotGrid } from "@/components/SlotPicker";
import { SlidingTabs } from "@/components/SlidingTabs";
import { NEUTRAL } from "@/theme/themes";
import { getSlots, rescheduleBooking } from "@/api/portal";
import { apiErrorMessage, isLikelyNetworkError } from "@/api/client";
import { useNetwork } from "@/context/NetworkContext";
import { SlotEntry } from "@/api/types";
import { AppStackParamList } from "@/navigation/types";
import { MessageDialog } from "@/components/MessageDialog";
import { CARD_TEXT } from "@/theme/cardSizes";
import { istDateIso, shortDayLabel } from "@/utils/indianTime";

function dateOffsetLabel(daysFromToday: number): { key: string; label: string } {
  const iso = istDateIso(daysFromToday);
  const label = daysFromToday === 0 ? "Today" : daysFromToday === 1 ? "Tomorrow" : shortDayLabel(iso);
  return { key: iso, label };
}

export function RescheduleScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "Reschedule">>();
  const { bookingId, hospitalId, doctorId, doctorName, hospitalName, patientName } = route.params;
  const { isOffline } = useNetwork();

  const dateOptions = [0, 1, 2, 3, 4, 5, 6].map(dateOffsetLabel);
  const [selectedDate, setSelectedDate] = useState(dateOptions[0].key);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotEntry[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(false);

  useEffect(() => {
    setSelectedTime(null);
    setSlots([]);
    setSlotsLoading(true);
    // Best-effort only -- a failure here (e.g. doctorId not resolving to a
    // real doctor) just means no suggested slots, not a reschedule failure;
    // the empty state below already says so. A visible error banner here
    // would contradict that and read as broken when it isn't.
    getSlots(hospitalId, doctorId, selectedDate)
      .then(setSlots)
      .catch(() => {})
      .finally(() => setSlotsLoading(false));
  }, [hospitalId, doctorId, selectedDate]);

  const onConfirm = async () => {
    setError("");
    if (isOffline) {
      setError("You're offline. Connect to the internet and try rescheduling again.");
      return;
    }
    setSaving(true);
    try {
      await rescheduleBooking(bookingId, { scheduled_date: selectedDate, scheduled_time: selectedTime || undefined });
      setDone(true);
    } catch (err) {
      if (isLikelyNetworkError(err)) {
        setError("Your connection dropped before we could confirm. Check the appointment in your list before trying again.");
      } else {
        setError(apiErrorMessage(err, "Couldn't reschedule this appointment. Please try again."));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      header={
        <>
          <BackHeader title="Reschedule" onBack={() => navigation.goBack()} />

          <Card>
            <Text style={styles.doctor}>{doctorName}</Text>
            <Text style={styles.hospital}>
              {hospitalName} · for {patientName}
            </Text>
          </Card>

          {!!error && <ErrorBanner message={error} />}

          <SectionTitle>Choose a new date</SectionTitle>
          <SlidingTabs label="Date" look="chips" options={dateOptions} value={selectedDate} onChange={setSelectedDate} style={{ marginBottom: 12 }} />

          <SlotHeader showFilter={slots.length > 0} availableOnly={availableOnly} onChange={setAvailableOnly} />
        </>
      }
      footer={<FooterAction label={selectedTime ? "Confirm new time" : "Pick a slot to continue"} disabled={!selectedTime} loading={saving} onPress={onConfirm} />}
    >
      <SlotGrid slots={slots} loading={slotsLoading} selectedTime={selectedTime} availableOnly={availableOnly} onSelect={setSelectedTime} />

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
  doctor: { fontSize: CARD_TEXT.title, fontWeight: "600", color: NEUTRAL.textPrimary },
  hospital: { fontSize: CARD_TEXT.meta, color: NEUTRAL.textSecondary, marginTop: 3 },
});
