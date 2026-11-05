import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen, BackHeader, ErrorBanner } from "@/components/Layout";
import { Card } from "@/components/Card";
import { TextField } from "@/components/TextField";
import { SecondaryButton } from "@/components/Buttons";
import { FooterAction } from "@/components/FooterAction";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { book, getMyBookings } from "@/api/portal";
import { apiErrorMessage, isLikelyNetworkError } from "@/api/client";
import { useNetwork } from "@/context/NetworkContext";
import { AppStackParamList } from "@/navigation/types";
import { formatTime12, shortDayLabel } from "@/utils/indianTime";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import Svg, { Path } from "react-native-svg";

// The mark at the top: a tick in a ring that is left open, because nothing is booked until the patient confirms. Light lime,
// so it reads as "almost there" and not as the green of a finished booking.
const PENDING_LIME = "#B8CC1C";
function PendingTick({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={PENDING_LIME} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21.205 8.093A10 10 0 1 1 15.907 2.795" />
      <Path d="m9 12 2 2 4-4" />
    </Svg>
  );
}

// This screen exists specifically so booking a slot is never one tap —
// the patient reviews doctor/hospital/date here and must explicitly confirm
// before an appointment is actually created (per the earlier product
// decision to remove instant-book-on-tap).
export function ConfirmBookingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "ConfirmBooking">>();
  const params = route.params;
  const { theme } = useAppTheme();
  const { isOffline } = useNetwork();

  const [complaint, setComplaint] = useState(params.chiefComplaint || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  // Set when a booking POST fails on a network error — the request may have
  // reached the server, so we point the patient at Appointments to check
  // rather than let them blind-retry into a possible duplicate.
  const [maybeBooked, setMaybeBooked] = useState(false);

  const UPCOMING = ["scheduled", "waiting", "vitals_done", "in_progress"];

  // Best-effort "did it actually go through?" check after a dropped
  // connection: look for a booking that matches what we just tried to
  // create. Returns the matching booking or null.
  const findJustBooked = async () => {
    try {
      const page = await getMyBookings(1);
      return (
        page.results.find(
          (b) =>
            UPCOMING.includes(b.status) &&
            b.doctor_id === params.doctorId &&
            b.date === params.date &&
            (params.time ? b.time === params.time : true) &&
            (!params.patientAwpid || b.patient_awpid === params.patientAwpid)
        ) || null
      );
    } catch {
      return null;
    }
  };

  const submit = async () => {
    setError("");
    setMaybeBooked(false);
    setConfirmVisible(false);
    if (isOffline) {
      setError("You're offline. Connect to the internet to book this appointment.");
      return;
    }
    setLoading(true);
    try {
      const result = await book({
        hospital_id: params.hospitalId,
        doctor_id: params.doctorId,
        scheduled_date: params.date,
        scheduled_time: params.time,
        chief_complaint: complaint.trim() || undefined,
        payment_preference: "pay_at_desk",
        patient_awpid: params.patientAwpid,
      });
      navigation.replace("BookingSuccess", {
        hospital: result.hospital,
        doctor: result.doctor,
        date: result.date,
        time: result.time || undefined,
        tokenNumber: result.token_number,
      });
    } catch (err) {
      if (isLikelyNetworkError(err)) {
        // The connection dropped — the booking may still have been created
        // server-side. Check before showing a plain error so the patient
        // doesn't retry into a duplicate.
        const existing = await findJustBooked();
        if (existing) {
          navigation.replace("BookingSuccess", {
            hospital: existing.hospital,
            doctor: existing.doctor,
            date: existing.date,
            time: existing.time || undefined,
            tokenNumber: existing.token_number ?? undefined,
          });
          return;
        }
        setMaybeBooked(true);
        setError("Your connection dropped before we could confirm. Check your appointments before trying again.");
      } else {
        setError(apiErrorMessage(err, "Couldn't book this appointment. Please try again."));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen
      footer={
        <FooterAction
          label="Confirm booking"
          onPress={() => setConfirmVisible(true)}
          loading={loading}
          above={
            maybeBooked ? (
              <SecondaryButton
                label="Check my appointments"
                onPress={() => navigation.navigate("Tabs" as any, { screen: "Appointments" } as any)}
                style={{ marginBottom: 8 }}
              />
            ) : undefined
          }
        />
      }
    >
      <BackHeader title="Confirm booking" onBack={() => navigation.goBack()} />
      <View style={styles.iconWrap}>
        <PendingTick size={40} />
      </View>
      <Text style={styles.title}>Confirm your appointment</Text>
      <Text style={styles.subtitle}>Review the details before booking — this won't be confirmed until you tap below.</Text>

      {!!error && <ErrorBanner message={error} />}

      <Card>
        <Text style={styles.doctor}>{params.doctorName}</Text>
        <Text style={styles.hospital}>{params.hospitalName}</Text>

        <View style={styles.details}>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>DATE</Text>
            <Text style={[styles.cellValue, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {/^\d{4}-\d{2}-\d{2}$/.test(params.date) ? shortDayLabel(params.date) : params.date}
            </Text>
          </View>
          <View style={[styles.cell, styles.cellDivider]}>
            <Text style={styles.cellLabel}>TIME</Text>
            <Text style={[styles.cellValue, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {params.time ? formatTime12(params.time) : "Next token"}
            </Text>
          </View>
          <View style={[styles.cell, styles.cellDivider]}>
            <Text style={styles.cellLabel}>FOR</Text>
            <Text style={[styles.cellValue, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {params.patientName}
            </Text>
          </View>
        </View>

        {!!params.consultationFee && (
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Consultation fee</Text>
            <Text style={[styles.feeValue, { color: theme.text }]}>₹{params.consultationFee}</Text>
          </View>
        )}
      </Card>

      <Text style={styles.sectionTitle}>Reason for visit (optional)</Text>
      <TextField
        auth
        label="Chief complaint"
        placeholder="e.g. Fever since 2 days"
        value={complaint}
        onChangeText={setComplaint}
      />

      <Text style={styles.payNote}>Payment is collected at the hospital's front desk when you arrive.</Text>


      <ConfirmDialog
        visible={confirmVisible}
        title="Confirm this booking?"
        message={`${params.doctorName} · ${params.hospitalName} · ${params.date}${params.time ? ` · ${formatTime12(params.time)}` : ""}. You can confirm now, or go back and edit the details first.`}
        confirmLabel="Confirm booking"
        cancelLabel="Edit details"
        loading={loading}
        onConfirm={submit}
        onCancel={() => setConfirmVisible(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: "center", marginTop: 4, marginBottom: 6 },
  title: { fontSize: 22, fontWeight: "700", textAlign: "center", color: NEUTRAL.textPrimary, letterSpacing: -0.3 },
  subtitle: { fontSize: 14.5, lineHeight: 20, color: NEUTRAL.textSecondary, textAlign: "center", marginTop: 4, marginBottom: 14, paddingHorizontal: 10 },
  doctor: { fontSize: 20, fontWeight: "700", color: NEUTRAL.textPrimary, letterSpacing: -0.2 },
  hospital: { fontSize: 15, color: NEUTRAL.textSecondary, marginTop: 3 },
  details: { flexDirection: "row", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: NEUTRAL.border },
  cell: { flex: 1, paddingRight: 6 },
  cellDivider: { borderLeftWidth: 1, borderLeftColor: NEUTRAL.border, paddingLeft: 12 },
  cellLabel: { fontSize: 11.5, fontWeight: "700", letterSpacing: 0.8, color: NEUTRAL.textMuted },
  cellValue: { fontSize: 17, fontWeight: "700", marginTop: 5 },
  feeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: NEUTRAL.border,
  },
  feeLabel: { fontSize: 15, fontWeight: "600", color: NEUTRAL.textSecondary },
  feeValue: { fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: NEUTRAL.textPrimary, marginTop: 14, marginBottom: 8 },
  payNote: { fontSize: 13.5, color: NEUTRAL.textMuted, marginTop: 10, marginBottom: 10, lineHeight: 19 },
});
