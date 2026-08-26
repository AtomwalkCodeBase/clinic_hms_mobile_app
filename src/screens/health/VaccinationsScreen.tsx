import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useFocusEffect, useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen, BackHeader, EmptyState, ErrorBanner, SectionTitle } from "@/components/Layout";
import { ListRow } from "@/components/ListRow";
import { DetailSheet, DetailRow } from "@/components/DetailSheet";
import { SegmentedControl } from "@/components/SegmentedControl";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { DownloadButton } from "@/components/DownloadButton";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { getVaccinations, getVaccinationFile } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { downloadDataUri } from "@/utils/fileHelpers";
import { VaccinationSummary, VaccinationRoadmapItem } from "@/api/types";
import { AppStackParamList } from "@/navigation/types";
import { Syringe } from "lucide-react-native";

type FilterKey = "all" | "completed" | "not_completed";

// Real due-date grouping for a parent asking "what's left this month / this
// year" — not just a sort order. Completed/pending items always land in
// "given" (their real administered_date already tells that story). Unrecorded
// items are bucketed by an *estimated* due date (date_of_birth + min_age_days)
// once the backend says the window has genuinely opened — see `timing` on
// VaccinationRoadmapItem, which stays the source of truth for due_now/
// past_window so this never re-derives that judgment call, only groups
// genuinely-future items by month.
type BucketKey = "due_now" | "this_month" | "next_3_months" | "this_year" | "next_year" | "given" | "other";
const BUCKET_ORDER: BucketKey[] = ["due_now", "this_month", "next_3_months", "this_year", "next_year", "given", "other"];
const BUCKET_LABEL: Record<BucketKey, string> = {
  due_now: "Due now",
  this_month: "Due this month",
  next_3_months: "Coming up in the next 3 months",
  this_year: "Later this year",
  next_year: "Next year and beyond",
  given: "Already given",
  other: "Not yet scheduled",
};

function estimatedDueDate(dob: string | null, minAgeDays?: number | null): Date | null {
  if (!dob || minAgeDays == null) return null;
  const d = new Date(dob);
  d.setDate(d.getDate() + minAgeDays);
  return d;
}

function bucketFor(item: VaccinationRoadmapItem, dob: string | null): BucketKey {
  if (item.status !== "unknown") return "given";
  if (item.timing === "due_now" || item.timing === "past_window") return "due_now";
  const due = estimatedDueDate(dob, item.min_age_days);
  if (!due) return "other";
  const today = new Date();
  const startOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const startOfMonthIn3 = new Date(today.getFullYear(), today.getMonth() + 3, 1);
  const startOfNextYear = new Date(today.getFullYear() + 1, 0, 1);
  if (due < startOfNextMonth) return "this_month";
  if (due < startOfMonthIn3) return "next_3_months";
  if (due < startOfNextYear) return "this_year";
  return "next_year";
}

function groupByBucket(items: VaccinationRoadmapItem[], dob: string | null): { bucket: BucketKey; items: VaccinationRoadmapItem[] }[] {
  const map = new Map<BucketKey, VaccinationRoadmapItem[]>();
  for (const item of items) {
    const b = bucketFor(item, dob);
    if (!map.has(b)) map.set(b, []);
    map.get(b)!.push(item);
  }
  if (map.has("given")) {
    map.set("given", [...map.get("given")!].sort((a, b) => (b.administered_date || "0000-00-00").localeCompare(a.administered_date || "0000-00-00")));
  }
  return BUCKET_ORDER.filter((b) => map.has(b)).map((b) => ({ bucket: b, items: map.get(b)! }));
}

// The backend's real vaccination status values are "completed",
// "pending_review", "rejected", or "unknown" (meaning: no record for this
// scheduled slot yet — see vaccine_schedule.py's docstring, it's never
// called "overdue"). Showing the raw word "unknown" in the UI reads like
// something is broken; this is just copy, not a data problem.
function vaxStatusLabel(status: string): string {
  if (status === "unknown") return "Not recorded yet";
  if (status === "pending_review") return "Pending review";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
function vaxStatusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "completed") return "success";
  if (status === "pending_review") return "warning";
  if (status === "rejected") return "danger";
  return "neutral";
}
function vaxStatusColor(status: string): string | undefined {
  if (status === "completed") return NEUTRAL.success;
  if (status === "pending_review") return NEUTRAL.warning;
  if (status === "rejected") return NEUTRAL.danger;
  return undefined;
}

export function VaccinationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "Vaccinations">>();
  const { patientAwpid, patientName } = route.params;
  const { theme } = useAppTheme();

  const [vax, setVax] = useState<VaccinationSummary | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [viewMode, setViewMode] = useState<"age" | "date">("age");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<VaccinationRoadmapItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setVax(await getVaccinations(patientAwpid));
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

  const roadmap = vax?.roadmap || [];

  let shown = roadmap;
  if (filter === "completed") shown = shown.filter((r) => r.status === "completed");
  else if (filter === "not_completed") shown = shown.filter((r) => r.status !== "completed");

  // "By age" — schedule order, matches the web app's default. "By due date"
  // groups into the buckets a parent actually asks about ("what's left this
  // month / this year") instead of a flat list — see groupByBucket() above.
  const dob = vax?.date_of_birth ?? null;
  const groups = viewMode === "date" ? groupByBucket(shown, dob) : null;

  const downloadCertificate = async (item: VaccinationRoadmapItem) => {
    if (!item.record_id) return;
    const file = await getVaccinationFile(item.record_id);
    await downloadDataUri(file.file_name || `${item.vaccine_name}.pdf`, file.file_data);
  };

  return (
    <Screen onRefresh={load} refreshing={loading}>
      <BackHeader title={`Vaccinations — ${patientName}`} onBack={() => navigation.goBack()} />

      {!!error && <ErrorBanner message={error} onRetry={load} />}

      {vax && (
        <View style={styles.statsRow}>
          <StatTile value={String(vax.completed_count)} label="Completed" color={theme.text} />
          <StatTile value={vax.next_recommended?.vaccine_name || "—"} label="Next due" color={NEUTRAL.warning} />
          <StatTile value={String(roadmap.filter((r) => r.status === "pending_review").length)} label="Pending review" color={NEUTRAL.textPrimary} />
        </View>
      )}

      <SegmentedControl
        options={[
          { key: "all", label: "All" },
          { key: "completed", label: "Completed" },
          { key: "not_completed", label: "Not completed" },
        ]}
        value={filter}
        onChange={setFilter}
      />

      <View style={styles.viewModeRow}>
        <Text style={styles.viewModeLabel}>Show</Text>
        <SegmentedControl
          options={[
            { key: "age", label: "By age" },
            { key: "date", label: "By due date" },
          ]}
          value={viewMode}
          onChange={setViewMode}
        />
      </View>

      <SecondaryButton
        label="+ Report a vaccination from outside"
        onPress={() => navigation.navigate("ReportVaccination", { patientAwpid, patientName })}
        style={{ marginBottom: 12 }}
      />

      {shown.length === 0 ? (
        <EmptyState text={roadmap.length === 0 ? "No vaccination roadmap available yet." : "Nothing in this filter."} />
      ) : groups ? (
        groups.map(({ bucket, items }) => (
          <View key={bucket} style={{ marginBottom: 6 }}>
            <SectionTitle>{BUCKET_LABEL[bucket]}</SectionTitle>
            {items.map((r, i) => (
              <ListRow
                key={i}
                icon={Syringe}
                title={r.vaccine_name}
                subtitle={r.administered_date ? `Given ${r.administered_date}` : r.scheduled_label}
                pillLabel={vaxStatusLabel(r.status)}
                pillTone={vaxStatusTone(r.status)}
                onPress={() => setDetail(r)}
              />
            ))}
          </View>
        ))
      ) : (
        shown.map((r, i) => (
          <ListRow
            key={i}
            icon={Syringe}
            title={r.vaccine_name}
            subtitle={r.administered_date ? `Given ${r.administered_date}` : r.scheduled_label}
            pillLabel={vaxStatusLabel(r.status)}
            pillTone={vaxStatusTone(r.status)}
            onPress={() => setDetail(r)}
          />
        ))
      )}

      <DetailSheet visible={!!detail} onClose={() => setDetail(null)} title={detail?.vaccine_name || ""}>
        {detail && (
          <>
            <DetailRow label="Status" value={vaxStatusLabel(detail.status)} valueColor={vaxStatusColor(detail.status)} />
            {!!detail.scheduled_label && <DetailRow label="Scheduled" value={detail.scheduled_label} />}
            {!!detail.administered_date && <DetailRow label="Given on" value={detail.administered_date} />}
            {detail.has_certificate && (
              <DownloadButton
                label="Download certificate"
                fileLabel={`${detail.vaccine_name} certificate`}
                onDownload={() => downloadCertificate(detail)}
                style={{ marginTop: 14 }}
              />
            )}
            {["unknown", "pending_review", "ordered"].includes(detail.status) && (
              <PrimaryButton
                label="Book this vaccine"
                style={{ marginTop: 10 }}
                onPress={() => {
                  const v = detail;
                  setDetail(null);
                  navigation.navigate("FindDoctors", {
                    initialComplaint: `Vaccination: ${v.vaccine_name}`,
                    patientAwpid,
                    patientName,
                  });
                }}
              />
            )}
          </>
        )}
      </DetailSheet>
    </Screen>
  );
}

function StatTile({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={[styles.statValue, { color }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  viewModeRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  viewModeLabel: { fontSize: 11.5, fontWeight: "600", color: NEUTRAL.textSecondary },
  statsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
  statTile: { alignItems: "center", flex: 1, backgroundColor: NEUTRAL.surfaceAlt, borderRadius: 12, paddingVertical: 10, marginHorizontal: 3 },
  statValue: { fontSize: 15, fontWeight: "700" },
  statLabel: { fontSize: 9, color: NEUTRAL.textMuted, marginTop: 2 },
});
