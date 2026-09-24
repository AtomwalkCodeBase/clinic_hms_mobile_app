import React, { useMemo, useState } from "react";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { Screen, BackHeader, EmptyState, ErrorBanner } from "@/components/Layout";
import { ListRow } from "@/components/ListRow";
import { DetailSheet, DetailRow } from "@/components/DetailSheet";
import { SelectField } from "@/components/SelectField";
import { familyAccentFor, familyGadgetPaletteFor } from "@/theme/familyColors";
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
  const { patientAwpid, patientName, patientGender, patientDob } = route.params;
  const palette = patientGender ? familyGadgetPaletteFor({ gender: patientGender, date_of_birth: patientDob ?? null }) : null;
  const accent = patientGender ? familyAccentFor({ gender: patientGender, date_of_birth: patientDob ?? null }) : null;

  const [month, setMonth] = useState("");
  const [detail, setDetail] = useState<TimelineEntry | null>(null);

  // A dedicated full-page timeline (not a cramped tab anymore) — pull
  // enough history for the month picker below to have real data to browse,
  // not just the last handful of entries.
  const { data: timeline = [], error, refetch, isFetching, isStale } = useQuery({
    queryKey: ["timeline", patientAwpid],
    queryFn: () => getTimeline(patientAwpid, 200),
  });
  useRefreshOnFocus({ isStale, refetch });

  // One deliberate dropdown pick — "All" plus every plain month that
  // actually has entries, most recent first. No auto-scrolling chip strip
  // and no special-cased "This month" label.
  const monthOptions = useMemo(() => {
    const keys = Array.from(new Set(timeline.map((e) => monthKey(e.date)))).sort((a, b) => (a < b ? 1 : -1));
    return keys.map((k) => ({ value: k, label: monthLabel(k) }));
  }, [timeline]);

  const shown = month ? timeline.filter((e) => monthKey(e.date) === month) : timeline;

  return (
    <Screen onRefresh={refetch} refreshing={isFetching}>
      <BackHeader title={`Health timeline — ${patientName}`} onBack={() => navigation.goBack()} tint={accent ? { bg: accent.bg, text: accent.text } : undefined} />
      {!!error && <ErrorBanner message={apiErrorMessage(error)} onRetry={refetch} />}

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
            iconColors={palette?.timeline.icon}
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
