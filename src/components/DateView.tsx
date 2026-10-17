import { View, StyleSheet } from "react-native";
import { SkeletonRow } from "@/components/Skeleton";
import { EmptyState } from "@/components/Layout";
import { DayCard } from "@/components/DayCard";
import type { DocumentDay, DocumentDays } from "@/api/portal";

/** How My Documents is shown: one card per upload day, or every file in one list. Changed from the screen's menu. */
export type DocumentsMode = "date" | "all";

/** The scrolling part of the By-date view: the day cards of the chosen year (and month), newest first. */
export function DayList({
  data, days, loading, forName, nameColor, labelOf, onOpenDay,
}: {
  data?: DocumentDays;
  /** the days to show: `data.days`, narrowed to the month chosen */
  days: DocumentDay[];
  loading: boolean;
  forName: string;
  /** the colour of the person's name on every card */
  nameColor?: string;
  labelOf: (code?: string | null) => string;
  onOpenDay: (day: DocumentDay) => void;
}) {
  if (loading || !data) {
    return <View>{[0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)}</View>;
  }
  if (!data.days.length) return <EmptyState text="No records yet. Tap Add record to add one." />;
  if (!days.length) return <EmptyState text="No records in this month." />;
  return (
    <View style={styles.list}>
      {days.map((day) => (
        <DayCard key={day.date} day={day} forName={forName} nameColor={nameColor} labelOf={labelOf} onPress={() => onOpenDay(day)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 2 },
});
