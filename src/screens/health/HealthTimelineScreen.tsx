import React, { useCallback, useMemo, useState } from "react";
import { useFocusEffect, useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen, BackHeader, EmptyState, ErrorBanner } from "@/components/Layout";
import { ListRow } from "@/components/ListRow";
import { DetailSheet, DetailRow } from "@/components/DetailSheet";
import { SelectField } from "@/components/SelectField";
import { getTimeline } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { TimelineEntry } from "@/api/types";
import { AppStackParamList } from "@/navigation/types";
import { Stethoscope, Syringe, TrendingUp, FlaskConical, FileText, Circle } from "lucide-react-native";
import type { LucideIcon } from "@/theme/icons";

const TIMELINE_ICON: Record<TimelineEntry["type"], LucideIcon> = {
  visit: Stethoscope,
  vaccination: Syringe,
  growth: TrendingUp,
  lab: FlaskConical,
  document: FileText,
};

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // "YYYY-MM"
}
function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
}

export function HealthTimelineScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "HealthTimeline">>();
  const { patientAwpid, patientName } = route.params;

  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [month, setMonth] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<TimelineEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // A dedicated full-page timeline (not a cramped tab anymore) — pull
      // enough history for the month picker below to have real data to
      // browse, not just the last handful of entries.
      setTimeline(await getTimeline(patientAwpid, 200));
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

  // One deliberate dropdown pick — "All" plus every plain month that
  // actually has entries, most recent first. No auto-scrolling chip strip
  // and no special-cased "This month" label.
  const monthOptions = useMemo(() => {
    const keys = Array.from(new Set(timeline.map((e) => monthKey(e.date)))).sort((a, b) => (a < b ? 1 : -1));
    return keys.map((k) => ({ value: k, label: monthLabel(k) }));
  }, [timeline]);

  const shown = month ? timeline.filter((e) => monthKey(e.date) === month) : timeline;

  return (
    <Screen onRefresh={load} refreshing={loading}>
      <BackHeader title={`Health timeline — ${patientName}`} onBack={() => navigation.goBack()} />
      {!!error && <ErrorBanner message={error} onRetry={load} />}

      {timeline.length > 0 && (
        <SelectField label="Filter by month" value={month} onChange={setMonth} options={monthOptions} placeholder="All months" clearLabel="All months" />
      )}

      {shown.length === 0 ? (
        <EmptyState text={timeline.length === 0 ? "No health history recorded yet." : "Nothing in this month."} />
      ) : (
        shown.map((entry, i) => (
          <ListRow
            key={i}
            icon={TIMELINE_ICON[entry.type] || Circle}
            title={entry.title}
            subtitle={entry.subtitle || entry.date}
            onPress={() => setDetail(entry)}
          />
        ))
      )}

      <DetailSheet visible={!!detail} onClose={() => setDetail(null)} title={detail?.title || ""}>
        {detail && (
          <>
            <DetailRow label="Date" value={detail.date} />
            {!!detail.subtitle && <DetailRow label="Detail" value={detail.subtitle} />}
            {detail.detail &&
              Object.entries(detail.detail).map(([k, v]) => <DetailRow key={k} label={k.replace(/_/g, " ")} value={String(v)} />)}
          </>
        )}
      </DetailSheet>
    </Screen>
  );
}
