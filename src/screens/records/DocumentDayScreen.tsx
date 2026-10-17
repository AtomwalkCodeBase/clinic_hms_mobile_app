import { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Screen, EmptyState, ErrorBanner, HeaderBand } from "@/components/Layout";
import { BackButton } from "@/components/IconButtons";
import { SkeletonRow } from "@/components/Skeleton";
import { SecondaryButton } from "@/components/Buttons";
import { FilterPill, FilterSheet } from "@/components/TypeFilter";
import { dayTitle, filesLabel } from "@/components/DayCard";
import { ON_BRAND } from "@/theme/themes";
import { apiErrorMessage } from "@/api/client";
import { getMyDocuments } from "@/api/portal";
import { useDocumentActions } from "@/hooks/useDocumentActions";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { AppStackParamList } from "@/navigation/types";

const PAGE_SIZE = 50;

/**
 * The files uploaded on one day (opened from a day card of My Documents' By-date view). The cards, the three-dots menu
 * and the doctor-name / delete / privacy sheets are the very ones of the All files list (useDocumentActions), and the
 * type filter is the same one too. It has no Add button on purpose: adding a record belongs to the screen outside.
 */
export function DocumentDayScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { params } = useRoute<RouteProp<AppStackParamList, "DocumentDay">>();
  const { date, patientAwpid, byType } = params;
  const { cardFor, dialogs, actionError, privacyQ, personName, labelOf } = useDocumentActions(patientAwpid);

  // "" = every type of the day, else one type code.
  const [category, setCategory] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  // One entry per type this day holds (from the day card), biggest first.
  const typeItems = useMemo(
    () => Object.entries(byType)
      .filter(([, n]) => n > 0)
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)),
    [byType],
  );
  const dayTotal = typeItems.reduce((sum, t) => sum + t.count, 0);

  // This day's files, a page at a time (a day can hold many).
  const filesQ = useInfiniteQuery({
    queryKey: ["documents", patientAwpid, "day", date, category],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      getMyDocuments(pageParam, patientAwpid, { uploadedOn: date, docType: category || undefined, pageSize: PAGE_SIZE }),
    getNextPageParam: (last) => (last.pagination.has_next ? last.pagination.page + 1 : undefined),
  });
  const docs = useMemo(() => {
    const seen = new Set<number>();
    return (filesQ.data?.pages ?? []).flatMap((p) => p.results).filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true)));
  }, [filesQ.data]);
  const ids = useMemo(() => docs.map((d) => d.id), [docs]);

  const total = filesQ.data?.pages[0]?.pagination.total_count;
  const load = useCallback(async () => {
    await Promise.all([filesQ.refetch(), privacyQ.refetch()]);
  }, [filesQ.refetch, privacyQ.refetch]);
  useRefreshOnFocus([filesQ, privacyQ]);
  const { refreshing: pulling, onRefresh: pullRefresh } = usePullToRefresh(load);

  const error = (filesQ.error && apiErrorMessage(filesQ.error)) || actionError;

  return (
    <Screen
      onRefresh={pullRefresh}
      refreshing={pulling}
      backgroundLoading={(filesQ.isFetching && !filesQ.isFetchingNextPage) && !pulling}
      header={
        <>
          <HeaderBand>
            <BackButton onPress={() => navigation.goBack()} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{dayTitle(date)}</Text>
              <Text style={styles.sub} numberOfLines={1}>
                {total == null ? " " : filesLabel(total)}{category ? ` · ${labelOf(category)}` : ""} · {personName}
              </Text>
            </View>
          </HeaderBand>

          {!!error && <ErrorBanner message={error} onRetry={load} />}

          {/* the type filter: one pill showing the active type (or "All"); tap to change it */}
          {typeItems.length > 0 && (
            <View style={styles.filterRow}>
              <FilterPill
                active={!!category}
                label={category ? labelOf(category) : "All"}
                count={total ?? (category ? byType[category] : dayTotal)}
                onPress={() => setFilterOpen(true)}
              />
            </View>
          )}
        </>
      }
    >
      {filesQ.isLoading ? (
        <View>{[0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)}</View>
      ) : docs.length === 0 ? (
        <EmptyState text={category ? "No files of this type on this day." : "No files left on this day."} />
      ) : (
        docs.map((d) => cardFor(d, ids))
      )}

      {filesQ.hasNextPage && (
        <SecondaryButton
          label={`Load ${Math.min(PAGE_SIZE, (total ?? 0) - docs.length)} more`}
          loading={filesQ.isFetchingNextPage}
          onPress={() => filesQ.fetchNextPage()}
          style={{ marginTop: 4 }}
        />
      )}

      <FilterSheet
        visible={filterOpen}
        items={typeItems}
        total={dayTotal}
        selected={category}
        onSelect={setCategory}
        onClose={() => setFilterOpen(false)}
        labelOf={labelOf}
        allLabel="All files of this day"
      />

      {dialogs}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 19, fontWeight: "800", color: ON_BRAND },
  sub: { fontSize: 13.5, color: "rgba(4,38,28,0.75)", marginTop: 1 },
  filterRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
});
