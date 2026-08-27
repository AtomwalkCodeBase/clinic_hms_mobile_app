import React, { useCallback, useState } from "react";
import { useFocusEffect, useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen, BackHeader, EmptyState, ErrorBanner, SectionTitle } from "@/components/Layout";
import { Card } from "@/components/Card";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { DownloadButton } from "@/components/DownloadButton";
import { Pill } from "@/components/Pill";
import { NEUTRAL } from "@/theme/themes";
import { Text, View, StyleSheet } from "react-native";
import { getMyRecords, getPrescriptions, choosePrescription, getPrescriptionReceipt } from "@/api/portal";
import { downloadDataUri } from "@/utils/fileHelpers";
import { apiErrorMessage } from "@/api/client";
import { MedicalRecord, PrescriptionOrder } from "@/api/types";
import { AppStackParamList } from "@/navigation/types";

const RX_STATUS_TONE: Record<PrescriptionOrder["status"], "success" | "warning" | "danger" | "neutral"> = {
  active: "neutral",
  dispensed: "success",
  expired: "danger",
};
const RX_STATUS_LABEL: Record<PrescriptionOrder["status"], string> = {
  active: "Active",
  dispensed: "Dispensed",
  expired: "Expired",
};

/**
 * One prescription with its in-house/outside choice — mirrors the web app's
 * PrescriptionOrderCard exactly (same PortalPrescriptionListView data, same
 * "buy here or take it elsewhere" pattern LabOrdersList already has for lab
 * tests). Kept local rather than extracted like LabOrdersList since it's
 * only ever used on this one screen.
 */
function PrescriptionOrderCard({ rx, onChanged }: { rx: PrescriptionOrder; onChanged: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const choose = async (choice: "in_house" | "outside") => {
    setSaving(true);
    setError("");
    try {
      await choosePrescription({
        tenant_db: rx.tenant_db,
        prescription_id: rx.id,
        patient_choice: choice,
        payment_preference: choice === "in_house" ? "pay_at_pharmacy" : undefined,
      });
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not save your choice."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={styles.orderCard}>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hospital}>{rx.doctor_name ? `Dr. ${rx.doctor_name}` : "Prescription"}</Text>
          <Text style={styles.doctor}>
            {rx.hospital}
            {rx.created_at ? ` · ${new Date(rx.created_at).toLocaleDateString()}` : ""}
          </Text>
        </View>
        <Pill label={RX_STATUS_LABEL[rx.status]} tone={RX_STATUS_TONE[rx.status]} />
      </View>

      <Text style={styles.drugSummary}>{rx.items.map((it) => `${it.drug_name} ${it.dosage}`).join(", ")}</Text>

      {!!error && <ErrorBanner message={error} />}

      {rx.patient_choice === "pending" ? (
        <View style={styles.choiceRow}>
          <PrimaryButton label={`Buy at ${rx.hospital}`} onPress={() => choose("in_house")} loading={saving} style={{ flex: 1, paddingVertical: 9 }} />
          <SecondaryButton label="I'll get it elsewhere" onPress={() => choose("outside")} loading={saving} style={{ flex: 1, paddingVertical: 9 }} />
        </View>
      ) : rx.patient_choice === "in_house" ? (
        <View style={styles.rxBox}>
          <Text style={styles.rxBoxLabel}>Quote this number at the pharmacy counter:</Text>
          <Text style={styles.rxNumber}>{rx.rx_number || "—"}</Text>
        </View>
      ) : (
        <Text style={styles.elsewhereNote}>You chose to get this elsewhere.</Text>
      )}

      <DownloadButton
        label="Download PDF"
        fileLabel={rx.rx_number ? `Prescription ${rx.rx_number}` : "This prescription"}
        onDownload={async () => {
          const receipt = await getPrescriptionReceipt(rx.tenant_db, rx.id);
          await downloadDataUri(receipt.file_name, receipt.file_data);
        }}
        style={{ marginTop: 10, paddingVertical: 9 }}
      />
    </Card>
  );
}

export function PrescriptionsListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "Prescriptions">>();
  const patientAwpid = route.params?.patientAwpid;
  const patientName = route.params?.patientName;

  const [orders, setOrders] = useState<PrescriptionOrder[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // patientAwpid undefined = self, same convention as getLabOrders/
      // getVaccinations — without this, a family member's prescriptions
      // (reachable from the Health hub's person switcher) were unreachable
      // here no matter what, since this always asked the backend for the
      // logged-in account's own records only.
      //
      // Two separate backend sources, same as the web app's
      // PatientPrescriptionsPage: getPrescriptions() (PortalPrescriptionListView)
      // is "every prescription any doctor has written", resolved via the
      // full Appointment -> OPDEncounter -> Prescription chain — this is
      // what actually renders as the primary prescription cards on web.
      // getMyRecords() below only ever surfaced the *first* encounter's
      // *first* prescription per appointment, so a prescription living on
      // a second encounter (a follow-up visit, an edited consult) was
      // invisible here even though it always showed on web. That gap —
      // not just the earlier signed-only filter — is why prescriptions
      // that genuinely exist could still show nothing on mobile.
      const [rx, all] = await Promise.all([getPrescriptions(patientAwpid), getMyRecords(patientAwpid)]);
      setOrders(rx);
      setRecords(all.filter((r) => r.prescription.length > 0));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [patientAwpid]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const empty = orders.length === 0 && records.length === 0;

  return (
    <Screen onRefresh={load} refreshing={loading}>
      <BackHeader title={patientName ? `Prescriptions — ${patientName}` : "Prescriptions"} onBack={() => navigation.goBack()} />
      {!!error && <ErrorBanner message={error} onRetry={load} />}

      {empty && !loading ? (
        <EmptyState text="No prescriptions yet." />
      ) : (
        <>
          {orders.map((rx) => (
            <PrescriptionOrderCard key={`${rx.tenant_db}-${rx.id}`} rx={rx} onChanged={load} />
          ))}

          {records.length > 0 && (
            <>
              <SectionTitle>Visit history</SectionTitle>
              {records.map((r, i) => (
                <Card key={i}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.hospital}>{r.hospital}</Text>
                    <View style={styles.rightCol}>
                      <Text style={styles.date}>{r.date}</Text>
                      <Pill label={r.signed ? "Completed" : "In progress"} tone={r.signed ? "success" : "warning"} />
                    </View>
                  </View>
                  <Text style={styles.doctor}>{r.doctor}</Text>
                  <Text style={styles.drugSummary}>{r.prescription.map((m) => m.drug_name).join(", ")}</Text>
                  <SecondaryButton
                    label="View prescription"
                    onPress={() => navigation.navigate("PrescriptionDetail", { record: r })}
                    style={{ marginTop: 10, paddingVertical: 9 }}
                  />
                </Card>
              ))}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rightCol: { alignItems: "flex-end", gap: 4 },
  hospital: { fontSize: 13, fontWeight: "600", color: NEUTRAL.textPrimary },
  date: { fontSize: 10.5, color: NEUTRAL.textMuted },
  doctor: { fontSize: 11.5, color: NEUTRAL.textSecondary, marginTop: 3 },
  drugSummary: { fontSize: 11.5, color: NEUTRAL.textPrimary, marginTop: 6 },
  orderCard: { marginBottom: 12 },
  choiceRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  rxBox: { backgroundColor: NEUTRAL.warningBg, borderRadius: 10, padding: 12, marginTop: 12 },
  rxBoxLabel: { fontSize: 11.5, color: NEUTRAL.textSecondary, marginBottom: 4 },
  rxNumber: { fontSize: 18, fontWeight: "800", color: NEUTRAL.warning },
  elsewhereNote: { fontSize: 11.5, color: NEUTRAL.textMuted, marginTop: 10 },
});
