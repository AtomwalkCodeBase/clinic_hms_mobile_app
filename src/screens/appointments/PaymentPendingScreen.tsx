import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Clock, XCircle, CircleCheck } from "lucide-react-native";
import { Screen, ErrorBanner } from "@/components/Layout";
import { Card } from "@/components/Card";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { DownloadButton } from "@/components/DownloadButton";
import { GatewayCheckoutWebView } from "@/components/GatewayCheckoutWebView";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { book, getMyBookings, cancelBooking, getBookingReceipt } from "@/api/portal";
import { downloadDataUri } from "@/utils/fileHelpers";
import { pollUntilTrue, CheckoutResult } from "@/utils/paymentGateway";
import { apiErrorMessage } from "@/api/client";
import { AppStackParamList } from "@/navigation/types";

// Four states, deliberately distinct from each other rather than shades of
// one "Booked" message — mirrors the confirmation-card logic in the web
// app's DoctorProfilePage.jsx:
//   opening/confirming — a pay_online attempt is in flight. The slot is
//     held server-side, but the patient has NOT been told they're booked.
//   paid — payment_status genuinely reads "paid" from the backend poll —
//     the ONLY thing that ever shows a green "Booked" state here.
//   cancelled — checkout closed without paying, auto-cancelled server-side.
type Phase = "opening" | "confirming" | "paid" | "pending" | "cancelling" | "cancelled";

export function PaymentPendingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "PaymentPending">>();
  const params = route.params;
  const { theme } = useAppTheme();

  const [phase, setPhase] = useState<Phase>("opening");
  const [paidAmount, setPaidAmount] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");
  // Starts open — GatewayCheckoutWebView renders the checkout page the
  // instant this screen mounts, same as the old imperative startCheckout()
  // did. A retry lands on a fresh route (navigation.replace below), which
  // remounts this screen with this back to true, reopening the checkout
  // for the new order.
  const [checkoutVisible, setCheckoutVisible] = useState(true);

  const confirmOnlinePayment = useCallback(async (bookingId: number) => {
    setPhase("confirming");
    const paid = await pollUntilTrue(
      async () => {
        const list = await getMyBookings();
        const match = list.find((b) => b.id === bookingId);
        if (match?.payment_status === "paid") {
          setPaidAmount(match.payment_amount);
          return true;
        }
        return false;
      },
      { attempts: 5, intervalMs: 2000 }
    );
    setPhase(paid ? "paid" : "pending");
  }, []);

  const autoCancelAbandoned = useCallback(async (bookingId: number) => {
    setPhase("cancelling");
    try {
      await cancelBooking(bookingId);
    } catch {
      // Already gone, or some other transient issue — either way the
      // patient sees "not completed" below, which is true regardless.
    }
    setPhase("cancelled");
  }, []);

  const handleCheckoutClose = useCallback(
    (result: CheckoutResult) => {
      setCheckoutVisible(false);
      if (result.completed) {
        confirmOnlinePayment(params.bookingId);
      } else {
        autoCancelAbandoned(params.bookingId);
      }
    },
    [params.bookingId, confirmOnlinePayment, autoCancelAbandoned]
  );

  // Both retry paths are a genuinely fresh book() call, not a resume of the
  // cancelled one — the earlier appointment/invoice/gateway order are dead
  // once cancelled, so reusing them isn't an option, only re-submitting is.
  const retry = async (paymentPreference: "pay_online" | "pay_at_desk") => {
    setRetryError("");
    setRetrying(true);
    try {
      const result = await book({
        tenant_id: params.rebook.tenantId,
        doctor_id: params.rebook.doctorId,
        scheduled_date: params.rebook.scheduledDate,
        scheduled_time: params.rebook.scheduledTime,
        chief_complaint: params.rebook.chiefComplaint,
        payment_preference: paymentPreference,
        patient_awpid: params.rebook.patientAwpid,
      });
      if ("consent_required" in result) {
        setRetryError("This hospital needs your consent to share medical history before booking — please book again from the doctor's page.");
        return;
      }
      if (result.payment_preference === "pay_online" && result.gateway_order) {
        navigation.replace("PaymentPending", {
          bookingId: result.booking_id,
          gatewayOrder: result.gateway_order,
          hospitalName: result.hospital,
          doctorName: result.doctor,
          date: result.date,
          time: result.time || undefined,
          tokenNumber: result.token_number,
          rebook: params.rebook,
        });
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
      setRetryError(apiErrorMessage(err, "Couldn't book this appointment. Please try again."));
    } finally {
      setRetrying(false);
    }
  };

  const goToAppointments = () => navigation.navigate("Tabs" as any, { screen: "Appointments" } as any);

  const isAwaiting = phase === "opening" || phase === "confirming";
  const isCancelled = phase === "cancelled" || phase === "cancelling";
  const isPaid = phase === "paid";

  return (
    <Screen scroll={false}>
      <View style={styles.center}>
        <View
          style={[
            styles.circle,
            { backgroundColor: isCancelled ? NEUTRAL.dangerBg : isPaid ? theme.bg : NEUTRAL.warningBg },
          ]}
        >
          {isCancelled ? (
            <XCircle size={30} color={NEUTRAL.danger} strokeWidth={2.2} />
          ) : isPaid ? (
            <CircleCheck size={30} color={theme.text} strokeWidth={2.2} />
          ) : (
            <Clock size={30} color={NEUTRAL.warning} strokeWidth={2.2} />
          )}
        </View>

        <Text style={styles.title}>
          {isCancelled
            ? "Booking not completed"
            : isPaid
            ? `Booked — token #${params.tokenNumber}`
            : `Confirm payment to secure ${params.time || "your slot"}`}
        </Text>

        <Text style={styles.subtitle}>
          {params.doctorName} · {params.hospitalName}
        </Text>
        <Text style={styles.subtitle}>
          {params.date}
          {params.time ? `, ${params.time}` : ""}
        </Text>

        {isAwaiting && (
          <Card style={styles.statusCard} tint={NEUTRAL.warningBg}>
            <Text style={styles.statusText}>
              {phase === "opening" ? "Opening secure payment window…" : "Payment submitted — confirming with the hospital…"}
            </Text>
          </Card>
        )}

        {phase === "pending" && (
          <Card style={styles.statusCard} tint={NEUTRAL.warningBg}>
            <Text style={styles.statusText}>
              Still confirming your payment — this can take a moment. Check "My Appointments" shortly, or pay at the front desk when you arrive.
            </Text>
          </Card>
        )}

        {isCancelled && (
          <Card style={styles.statusCard} tint={NEUTRAL.dangerBg}>
            <Text style={[styles.statusText, { color: NEUTRAL.danger }]}>
              Payment wasn't completed, so the slot was released — nothing was booked.
            </Text>
          </Card>
        )}

        {isPaid && (
          <Card style={styles.statusCard} tint={theme.bg}>
            <Text style={[styles.statusText, { color: theme.text, fontWeight: "700" }]}>
              Confirmed ✓ · PAID{paidAmount ? ` · ₹${paidAmount}` : ""}
            </Text>
          </Card>
        )}

        {!!retryError && <ErrorBanner message={retryError} />}

        {isCancelled && phase !== "cancelling" && (
          <View style={styles.actions}>
            <PrimaryButton label="Try payment again" onPress={() => retry("pay_online")} loading={retrying} style={{ marginBottom: 8 }} />
            <SecondaryButton
              label="Book & pay at front desk instead"
              onPress={() => retry("pay_at_desk")}
              loading={retrying}
              style={{ marginBottom: 8 }}
            />
            <SecondaryButton label="Cancel" onPress={goToAppointments} disabled={retrying} />
          </View>
        )}

        {isPaid && (
          <View style={styles.actions}>
            <DownloadButton
              label="Download bill"
              fileLabel={`Receipt for ${params.hospitalName}`}
              onDownload={async () => {
                const receipt = await getBookingReceipt(params.bookingId);
                await downloadDataUri(receipt.file_name, receipt.file_data);
              }}
              style={{ marginBottom: 8, alignSelf: "stretch" }}
            />
            <PrimaryButton label="View my appointments" onPress={goToAppointments} />
          </View>
        )}
      </View>

      <GatewayCheckoutWebView
        visible={checkoutVisible}
        order={params.gatewayOrder}
        name={params.hospitalName}
        description={`Booking fee — Dr. ${params.doctorName.replace(/^dr\.?\s*/i, "")}`}
        onClose={handleCheckoutClose}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  circle: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  title: { fontSize: 17, fontWeight: "600", color: NEUTRAL.textPrimary, marginBottom: 4, textAlign: "center" },
  subtitle: { fontSize: 12.5, color: NEUTRAL.textSecondary, marginBottom: 2, textAlign: "center" },
  statusCard: { marginTop: 20, alignSelf: "stretch" },
  statusText: { fontSize: 12.5, color: NEUTRAL.textSecondary, textAlign: "center" },
  actions: { alignSelf: "stretch", marginTop: 20 },
});
