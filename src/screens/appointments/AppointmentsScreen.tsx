import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useNavigation, CompositeNavigationProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { SkeletonBlock, SkeletonRow } from "@/components/Skeleton";
import { Screen, EmptyState, ErrorBanner, SectionTitle } from "@/components/Layout";
import { Card } from "@/components/Card";
import { Pill, statusTone, toneColor } from "@/components/Pill";
import { SegmentedControl } from "@/components/SegmentedControl";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { DetailSheet, DetailRow } from "@/components/DetailSheet";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { getMyBookings, getMyRecords, cancelBooking } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { useNetwork } from "@/context/NetworkContext";
import { Booking, MedicalRecord } from "@/api/types";
import { AppStackParamList, AppTabsParamList } from "@/navigation/types";
import { MetalHero } from "@/components/MetalHero";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { IconBadge } from "@/components/IconBadge";
import { CheckCircle2, ChevronRight } from "lucide-react-native";

// "3 days ago" reads faster than a raw ISO date in a past-visits list — the
// date is still shown alongside it, this is just a scannable headline.
function timeAgo(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (24 * 3600 * 1000));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) === 1 ? "" : "s"} ago`;
  if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) === 1 ? "" : "s"} ago`;
  return `${Math.floor(days / 365)} year${Math.floor(days / 365) === 1 ? "" : "s"} ago`;
}

// Mirrors the backend's own rules (apps/patients/portal_views.py) so the
// buttons only ever appear when the action would actually succeed.
const CANCELLABLE_STATUSES = ["scheduled", "waiting", "vitals_done"];
const RESCHEDULABLE_STATUSES = ["scheduled", "waiting"];

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<AppTabsParamList, "Appointments">,
  NativeStackNavigationProp<AppStackParamList>
>;

const UPCOMING_STATUSES = ["scheduled", "waiting", "vitals_done", "in_progress"];

export function AppointmentsScreen() {
  const navigation = useNavigation<Nav>();
  const { theme } = useAppTheme();
  const { isOffline } = useNetwork();
  const queryClient = useQueryClient();
  const [segment, setSegment] = useState<"upcoming" | "past">("upcoming");
  const [confirmTarget, setConfirmTarget] = useState<Booking | null>(null);
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);

  // Bookings are ordered newest-first server-side, so with more than a page
  // of history this is really "see older past visits" — upcoming
  // appointments (future dates) sort ahead of any past ones and land on
  // page 1 regardless, same assumption the web patient portal already makes
  // about this same endpoint.
  const bookingsQ = useInfiniteQuery({
    queryKey: ["bookings"],
    queryFn: ({ pageParam }) => getMyBookings(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.has_next ? last.pagination.page + 1 : undefined),
  });
  // Same key shape HealthVisitsScreen uses for `["visits", patientAwpid]`
  // with an undefined patientAwpid (self) — shares that cache entry.
  const recordsQ = useQuery({ queryKey: ["visits", undefined], queryFn: () => getMyRecords() });

  const refetchAll = useCallback(async () => {
    await Promise.all([bookingsQ.refetch(), recordsQ.refetch()]);
  }, [bookingsQ.refetch, recordsQ.refetch]);
  useRefreshOnFocus([bookingsQ, recordsQ]);
  const { refreshing: pulling, onRefresh: pullRefresh } = usePullToRefresh(refetchAll);

  const bookings = bookingsQ.data?.pages.flatMap((p) => p.results) ?? [];
  const records: MedicalRecord[] = recordsQ.data ?? [];
  const error = bookingsQ.error || recordsQ.error;
  const isInitialLoading = !bookingsQ.data && !recordsQ.data;
  const isFetchingAny = (bookingsQ.isFetching && !bookingsQ.isFetchingNextPage) || recordsQ.isFetching;

  const cancelMutation = useMutation({
    mutationFn: cancelBooking,
    onSuccess: () => {
      setConfirmTarget(null);
      // Prefix match — also invalidates HomeScreen's ["bookings", 1] snapshot.
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: () => setConfirmTarget(null),
  });

  const upcoming = bookings.filter((b) => UPCOMING_STATUSES.includes(b.status));
  const past = bookings.filter((b) => !UPCOMING_STATUSES.includes(b.status));
  const shown = segment === "upcoming" ? upcoming : past;

  // A prescription only "exists" for a booking when there's a signed
  // encounter record with at least one drug on it — matched by hospital +
  // date, same criteria PrescriptionsListScreen uses. No fallback to an
  // unrelated record: if nothing matches, the button simply isn't shown.
  const findPrescription = (booking: Booking): MedicalRecord | undefined =>
    records.find((r) => r.signed && r.prescription.length > 0 && r.hospital === booking.hospital && r.date === booking.date);

  const [offlineMsg, setOfflineMsg] = useState("");

  const onCancel = (booking: Booking) => setConfirmTarget(booking);

  const confirmCancel = () => {
    if (!confirmTarget) return;
    if (isOffline) {
      setConfirmTarget(null);
      setOfflineMsg("You're offline. Connect to the internet and try cancelling again.");
      return;
    }
    setOfflineMsg("");
    cancelMutation.mutate(confirmTarget.id);
  };

  if (isInitialLoading) {
    return (
      <Screen topColor="#249c57" bottomInset={false}>
        <View style={[styles.hero, { padding: 20, height: 118, backgroundColor: "#1f7a4d", borderRadius: 24 }]}>
          <SkeletonBlock width={180} height={16} style={{ backgroundColor: "rgba(255,255,255,0.25)" }} />
          <SkeletonBlock width={220} height={11} style={{ marginTop: 8, backgroundColor: "rgba(255,255,255,0.25)" }} />
        </View>
        <SkeletonBlock height={34} radius={18} style={{ marginBottom: 14 }} />
        {[0, 1, 2, 3].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </Screen>
    );
  }

  return (
    <Screen
      onRefresh={pullRefresh}
      refreshing={pulling}
      backgroundLoading={isFetchingAny && !pulling}
      topColor="#249c57"
      bottomInset={false}
    >
      <MetalHero compact curved underStatusBar style={styles.hero}>
        <Text style={styles.bannerTitle}>Find a doctor instantly</Text>
        <Text style={styles.bannerSub}>Book across every hospital on the platform</Text>
        <Pressable onPress={() => navigation.navigate("BookingFor", undefined)} style={styles.bannerBtn}>
          <Text style={[styles.bannerBtnText, { color: theme.text }]}>Book now</Text>
        </Pressable>
      </MetalHero>

      {!!error && <ErrorBanner message={apiErrorMessage(error)} onRetry={refetchAll} />}
      {!!offlineMsg && <ErrorBanner message={offlineMsg} />}
      {!!cancelMutation.error && <ErrorBanner message={apiErrorMessage(cancelMutation.error, "Couldn't cancel this appointment.")} />}

      <SegmentedControl
        options={[
          { key: "upcoming", label: "Upcoming" },
          { key: "past", label: "Past visits" },
        ]}
        value={segment}
        onChange={setSegment}
      />

      {shown.length === 0 ? (
        <EmptyState text={segment === "upcoming" ? "No upcoming appointments." : "No past visits yet."} />
      ) : (
        shown.map((b) => {
          if (segment === "past") {
            const rx = findPrescription(b);
            return (
              <Pressable key={b.id} onPress={() => setDetailBooking(b)}>
                <Card style={styles.pastCard}>
                  <View style={styles.pastRow}>
                    <IconBadge icon={CheckCircle2} size={34} colors={["#2eb166", "#15803D", "#0d4b26"]} shadowColor="#0a4020" />
                    <View style={{ flex: 1 }}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.pastTimeAgo}>{timeAgo(b.date)}</Text>
                        <View style={styles.trailingRow}>
                          <Pill label="Completed" tone="success" />
                          <ChevronRight size={16} color={NEUTRAL.textMuted} strokeWidth={2.2} />
                        </View>
                      </View>
                      <Text style={styles.hospitalName}>{b.doctor}</Text>
                      <Text style={styles.doctorLine}>
                        {b.hospital} · {b.date}
                        {b.patient_name ? ` · ${b.patient_name}` : ""}
                      </Text>
                    </View>
                  </View>
                  {(rx || b.doctor_id != null) && (
                    <View style={styles.compactActionsRow}>
                      {rx && (
                        <SecondaryButton label="View prescription" compact onPress={() => navigation.navigate("PrescriptionDetail", { record: rx })} />
                      )}
                      {b.doctor_id != null && (
                        <SecondaryButton
                          label="Book follow-up"
                          compact
                          onPress={() =>
                            navigation.navigate("DoctorDetail", {
                              tenantId: b.tenant_id,
                              doctorId: b.doctor_id!,
                              patientAwpid: b.patient_awpid || undefined,
                              patientName: b.patient_name || undefined,
                            })
                          }
                        />
                      )}
                    </View>
                  )}
                </Card>
              </Pressable>
            );
          }
          return (
            <Pressable key={b.id} onPress={() => setDetailBooking(b)}>
              <Card>
                <View style={styles.rowBetween}>
                  <Text style={styles.hospitalName}>{b.hospital}</Text>
                  <View style={styles.trailingRow}>
                    <Pill label={b.status.replace("_", " ")} tone={statusTone(b.status)} />
                    <ChevronRight size={16} color={NEUTRAL.textMuted} strokeWidth={2.2} />
                  </View>
                </View>
                <Text style={styles.doctorLine}>
                  {b.doctor}
                  {b.patient_name ? ` · Patient: ${b.patient_name}` : ""}
                </Text>
                <View style={styles.rowBetween}>
                  <Text style={[styles.dateLine, { color: theme.text }]}>
                    {b.date}
                    {b.time ? `, ${b.time}` : ""}
                  </Text>
                  {b.token_number != null && <Text style={styles.tokenLine}>Token #{b.token_number}</Text>}
                </View>
                {((RESCHEDULABLE_STATUSES.includes(b.status) && b.doctor_id != null) ||
                  CANCELLABLE_STATUSES.includes(b.status)) && (
                  <View style={styles.compactActionsRow}>
                    {RESCHEDULABLE_STATUSES.includes(b.status) && b.doctor_id != null && (
                      <SecondaryButton
                        label="Reschedule"
                        compact
                        onPress={() =>
                          navigation.navigate("Reschedule", {
                            bookingId: b.id,
                            tenantId: b.tenant_id,
                            doctorId: b.doctor_id!,
                            doctorName: b.doctor,
                            hospitalName: b.hospital,
                            patientName: b.patient_name || "You",
                          })
                        }
                      />
                    )}
                    {CANCELLABLE_STATUSES.includes(b.status) && (
                      <SecondaryButton label="Cancel" danger compact onPress={() => onCancel(b)} loading={cancelMutation.isPending && cancelMutation.variables === b.id} />
                    )}
                  </View>
                )}
              </Card>
            </Pressable>
          );
        })
      )}

      {bookingsQ.hasNextPage && (
        <SecondaryButton
          label={bookingsQ.isFetchingNextPage ? "Loading…" : "Load more"}
          onPress={() => bookingsQ.fetchNextPage()}
          loading={bookingsQ.isFetchingNextPage}
          style={styles.loadMoreBtn}
        />
      )}

      <ConfirmDialog
        visible={!!confirmTarget}
        danger
        title="Cancel this appointment?"
        message={
          confirmTarget
            ? `${confirmTarget.doctor} · ${confirmTarget.hospital} · ${confirmTarget.date}${confirmTarget.time ? `, ${confirmTarget.time}` : ""}`
            : undefined
        }
        confirmLabel="Cancel appointment"
        cancelLabel="Keep it"
        loading={cancelMutation.isPending}
        onConfirm={confirmCancel}
        onCancel={() => setConfirmTarget(null)}
      />

      <DetailSheet visible={!!detailBooking} onClose={() => setDetailBooking(null)} title={detailBooking?.hospital || ""}>
        {detailBooking && (
          <>
            <DetailRow label="Doctor" value={detailBooking.doctor} />
            {!!detailBooking.patient_name && <DetailRow label="Patient" value={detailBooking.patient_name} />}
            <DetailRow label="Date" value={detailBooking.date + (detailBooking.time ? `, ${detailBooking.time}` : "")} />
            <DetailRow
              label="Status"
              value={detailBooking.status.replace("_", " ")}
              valueColor={toneColor(statusTone(detailBooking.status))}
            />
            {detailBooking.token_number != null && <DetailRow label="Token number" value={`#${detailBooking.token_number}`} />}
            {detailBooking.now_serving_token != null && <DetailRow label="Now serving" value={`#${detailBooking.now_serving_token}`} />}
            {detailBooking.people_ahead != null && <DetailRow label="Patients ahead of you" value={String(detailBooking.people_ahead)} />}
            <DetailRow label="Reason for visit" value={detailBooking.chief_complaint || "Not specified"} />

            {(() => {
              const rx = findPrescription(detailBooking);
              return rx ? (
                <SecondaryButton
                  label="View prescription"
                  onPress={() => {
                    setDetailBooking(null);
                    navigation.navigate("PrescriptionDetail", { record: rx });
                  }}
                  style={{ marginTop: 14 }}
                />
              ) : null;
            })()}
          </>
        )}
      </DetailSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: 18 },
  bannerTitle: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  bannerSub: { fontSize: 11.5, color: "#EAF3DE", marginTop: 2, marginBottom: 10 },
  bannerBtn: { alignSelf: "flex-start", paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: "#FFFFFF" },
  bannerBtnText: { fontSize: 12.5, fontWeight: "700" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  trailingRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  hospitalName: { fontSize: 13.5, fontWeight: "600", color: NEUTRAL.textPrimary },
  doctorLine: { fontSize: 11.5, color: NEUTRAL.textSecondary, marginTop: 4, marginBottom: 8 },
  dateLine: { fontSize: 12, fontWeight: "600" },
  tokenLine: { fontSize: 11, color: NEUTRAL.textMuted },
  compactActionsRow: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 10 },
  pastCard: { paddingVertical: 14 },
  pastRow: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 4 },
  pastTimeAgo: { fontSize: 11, fontWeight: "700", color: NEUTRAL.textMuted, textTransform: "uppercase", letterSpacing: 0.3 },
  loadMoreBtn: { marginTop: 6, marginBottom: 4 },
});
