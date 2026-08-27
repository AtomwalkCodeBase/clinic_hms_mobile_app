import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen, BackHeader, ErrorBanner, SectionTitle } from "@/components/Layout";
import { Card } from "@/components/Card";
import { TextField } from "@/components/TextField";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { book } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { ConsentRequired } from "@/api/types";
import { AppStackParamList } from "@/navigation/types";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CheckCircle2 } from "lucide-react-native";

// This screen exists specifically so booking a slot is never one tap —
// the patient reviews doctor/hospital/date here and must explicitly confirm
// before an appointment is actually created (per the earlier product
// decision to remove instant-book-on-tap).
export function ConfirmBookingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "ConfirmBooking">>();
  const params = route.params;
  const { theme } = useAppTheme();

  const [complaint, setComplaint] = useState(params.chiefComplaint || "");
  const [consent, setConsent] = useState<ConsentRequired | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const submit = async (withConsent: boolean) => {
    setError("");
    setConfirmVisible(false);
    setLoading(true);
    try {
      const result = await book({
        tenant_id: params.tenantId,
        doctor_id: params.doctorId,
        scheduled_date: params.date,
        scheduled_time: params.time,
        chief_complaint: complaint.trim() || undefined,
        payment_preference: "pay_at_desk",
        patient_awpid: params.patientAwpid,
        data_sharing_consent: withConsent || undefined,
      });
      if ("consent_required" in result) {
        // Already agreed once and the server is still asking — don't silently
        // re-render the same consent screen (reads as "the button did nothing").
        if (withConsent) {
          setError("Couldn't record your consent. Please try again.");
          return;
        }
        setConsent(result);
      } else {
        navigation.replace("BookingSuccess", {
          hospital: result.hospital,
          doctor: result.doctor,
          date: result.date,
          time: result.time || undefined,
          tokenNumber: result.token_number,
        });
      }
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't book this appointment. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  if (consent) {
    return (
      <Screen>
        <BackHeader title="Share your medical history?" onBack={() => setConsent(null)} />
        {!!error && <ErrorBanner message={error} />}
        <Text style={styles.consentMsg}>{consent.message}</Text>
        <Card>
          {consent.share_categories.map((c) => (
            <Text key={c} style={styles.consentItem}>
              • {c}
            </Text>
          ))}
        </Card>
        <PrimaryButton label="I agree, continue booking" onPress={() => submit(true)} loading={loading} style={{ marginBottom: 8 }} />
        <SecondaryButton label="Cancel" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <BackHeader title="Confirm booking" onBack={() => navigation.goBack()} />
      <View style={styles.iconWrap}>
        <CheckCircle2 size={28} color={theme.text} strokeWidth={2.2} />
      </View>
      <Text style={styles.title}>Confirm your appointment</Text>
      <Text style={styles.subtitle}>Review the details before booking — this won't be confirmed until you tap below.</Text>

      {!!error && <ErrorBanner message={error} />}

      <Card>
        <Text style={styles.doctor}>{params.doctorName}</Text>
        <Text style={styles.hospital}>{params.hospitalName}</Text>
        <Text style={[styles.dateLine, { color: theme.text }]}>
          {params.date}
          {params.time ? ` · ${params.time}` : " · next available token"} · for {params.patientName}
        </Text>
        {!!params.consultationFee && (
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Consultation fee</Text>
            <Text style={[styles.feeValue, { color: theme.text }]}>₹{params.consultationFee}</Text>
          </View>
        )}
      </Card>

      <SectionTitle>Reason for visit (optional)</SectionTitle>
      <TextField
        label="Chief complaint"
        placeholder="e.g. Fever since 2 days"
        value={complaint}
        onChangeText={setComplaint}
      />

      <Text style={styles.payNote}>Payment is collected at the hospital's front desk when you arrive.</Text>

      <PrimaryButton label="Confirm booking" onPress={() => setConfirmVisible(true)} loading={loading} style={{ marginBottom: 8 }} />
      <SecondaryButton label="Cancel" onPress={() => navigation.goBack()} />

      <ConfirmDialog
        visible={confirmVisible}
        title="Confirm this booking?"
        message={`${params.doctorName} · ${params.hospitalName} · ${params.date}${params.time ? ` · ${params.time}` : ""}. You can confirm now, or go back and edit the details first.`}
        confirmLabel="Confirm booking"
        cancelLabel="Edit details"
        loading={loading}
        onConfirm={() => submit(false)}
        onCancel={() => setConfirmVisible(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: "center", marginTop: 4, marginBottom: 8 },
  title: { fontSize: 16, fontWeight: "600", textAlign: "center", color: NEUTRAL.textPrimary },
  subtitle: { fontSize: 12, color: NEUTRAL.textSecondary, textAlign: "center", marginTop: 4, marginBottom: 16, paddingHorizontal: 8 },
  doctor: { fontSize: 13.5, fontWeight: "600", color: NEUTRAL.textPrimary },
  hospital: { fontSize: 12, color: NEUTRAL.textSecondary, marginTop: 3 },
  dateLine: { fontSize: 12.5, fontWeight: "600", marginTop: 8 },
  feeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: NEUTRAL.border,
  },
  feeLabel: { fontSize: 11, fontWeight: "600", color: NEUTRAL.textSecondary },
  feeValue: { fontSize: 17, fontWeight: "800" },
  payNote: { fontSize: 11.5, color: NEUTRAL.textMuted, marginTop: 12, marginBottom: 16, lineHeight: 16 },
  consentMsg: { fontSize: 13, color: NEUTRAL.textPrimary, marginBottom: 14, lineHeight: 19 },
  consentItem: { fontSize: 12.5, color: NEUTRAL.textSecondary, marginBottom: 4 },
});
