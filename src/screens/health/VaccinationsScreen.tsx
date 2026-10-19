import { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { usePeople, usePersonSwitcher, paramsFor } from "@/hooks/usePeople";
import { Screen, BackHeader, EmptyState, ErrorBanner } from "@/components/Layout";
import { HelpButton, MoreButton } from "@/components/IconButtons";
import { HelpSheet, HelpItem } from "@/components/HelpSheet";
import { FilterPill, FilterSheet } from "@/components/TypeFilter";
import { IconBadge } from "@/components/IconBadge";
import { Pill } from "@/components/Pill";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { FooterAction } from "@/components/FooterAction";
import { SkeletonBlock, SkeletonRow } from "@/components/Skeleton";
import { formatDate } from "@/components/health/chartTheme";
import { getImmunization } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import type { ImmunizationRow } from "@/api/types";
import { AppStackParamList } from "@/navigation/types";
import { CARD, CARD_TEXT } from "@/theme/cardSizes";
import { NEUTRAL, BRAND_TEXT } from "@/theme/themes";
import type { LucideIcon } from "@/theme/icons";
import { CalendarPlus, Check, ChevronDown, ChevronUp, Clock, ListFilter, Plus, Syringe, Users, X } from "lucide-react-native";

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Status = "overdue" | "due" | "given" | "upcoming";
type Tone = "success" | "warning" | "danger" | "neutral";

const LOOK: Record<Status, { label: string; tone: Tone; color: string; Icon: LucideIcon }> = {
  overdue: { label: "Overdue", tone: "danger", color: NEUTRAL.danger, Icon: X },
  due: { label: "Due now", tone: "warning", color: NEUTRAL.warning, Icon: Clock },
  given: { label: "Given", tone: "success", color: NEUTRAL.success, Icon: Check },
  upcoming: { label: "Upcoming", tone: "neutral", color: NEUTRAL.textMuted, Icon: Clock },
};

const statusOf = (r: ImmunizationRow): Status => (r.status === "GIVEN" ? "given" : r.status === "OVERDUE" ? "overdue" : r.status === "DUE" ? "due" : "upcoming");
const bookable = (s: Status) => s === "overdue" || s === "due";

const HELP: HelpItem[] = [
  { icon: Syringe, title: "What the labels mean", text: "Given: recorded. Overdue: past its due date and not recorded. Due now: can be given now. Upcoming: not due yet." },
  { icon: Check, title: "The numbers at the top", text: "How many vaccines are given, due now or overdue, and coming up. They always count all vaccines, whatever the filter below shows." },
  { icon: ListFilter, title: "Filter", text: "Shows only the vaccines with the status you pick: all, overdue, due now, upcoming or given." },
  { icon: CalendarPlus, title: "Book", text: "Next to a vaccine or an age group: starts a booking for it. At the top: books every vaccine that is overdue or due." },
  { icon: Plus, title: "Add a vaccine", text: "The button at the bottom: add a vaccine from the card with its name and date. A clinic confirms it later, and it shows in the list straight away." },
  { icon: Check, title: "View card", text: "Opens the vaccination card a given vaccine was read from." },
  { icon: Users, title: "Another person", text: "The three dots at the top right, next to this ?, switch to another family member's records." },
];

/** The reason shown at the booking: the vaccines' names, the first few when there are many. */
function complaintFor(rows: ImmunizationRow[]): string {
  const names = Array.from(new Set(rows.map((r) => `${r.vaccine} ${r.dose}`)));
  return `Vaccination: ${names.slice(0, 6).join(", ")}${names.length > 6 ? ` +${names.length - 6} more` : ""}`;
}

export function VaccinationsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<AppStackParamList, "Vaccinations">>();
  const { patientAwpid, patientName, headerColor, headerOn } = route.params;

  const [filter, setFilter] = useState<"" | Status>("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  const { people } = usePeople();
  const awpid = patientAwpid ?? people.find((p) => p.isSelf)?.awpid;
  const switcher = usePersonSwitcher(people, awpid, (p) => navigation.setParams(paramsFor(p)));

  const immunizationQ = useQuery({ queryKey: ["immunization", awpid], queryFn: () => getImmunization(awpid!), enabled: !!awpid });
  useRefreshOnFocus(immunizationQ);
  const { refreshing: pulling, onRefresh: pullRefresh } = usePullToRefresh(immunizationQ.refetch);
  const data = immunizationQ.data;

  const book = (rows: ImmunizationRow[]) => navigation.navigate("FindDoctors", { initialComplaint: complaintFor(rows), patientAwpid, patientName });

  // One group per age ("6 weeks"), in schedule order, with the rows the filter lets through
  const { groups, counts, toBook } = useMemo(() => {
    const rows = data?.rows ?? [];
    const counts: Record<Status, number> = { overdue: 0, due: 0, given: 0, upcoming: 0 };
    const byAge = new Map<string, { age: string; dueOn: string; rows: ImmunizationRow[] }>();
    rows.forEach((r) => {
      counts[statusOf(r)] += 1;
      if (filter && statusOf(r) !== filter) return;
      if (!byAge.has(r.due_age)) byAge.set(r.due_age, { age: r.due_age, dueOn: r.due_on, rows: [] });
      byAge.get(r.due_age)!.rows.push(r);
    });
    const groups = Array.from(byAge.values()).sort((a, b) => a.dueOn.localeCompare(b.dueOn));
    return { groups, counts, toBook: rows.filter((r) => bookable(statusOf(r))) };
  }, [data, filter]);

  const filterText = filter ? LOOK[filter].label : "All vaccines";

  return (
    <Screen
      topColor={headerColor}
      onRefresh={pullRefresh}
      refreshing={pulling}
      backgroundLoading={immunizationQ.isFetching && !pulling}
      footer={
        <FooterAction label="Add a vaccine" icon={Plus} onPress={() => navigation.navigate("AddVaccine", { patientAwpid, patientName })} />
      }
      header={
        <>
          <BackHeader
            title={`Vaccinations — ${patientName}`}
            onBack={() => navigation.goBack()}
            color={headerColor}
            onColor={headerOn}
            right={<><HelpButton onPress={() => setHelpOpen(true)} onDark color={headerOn} /><MoreButton onPress={switcher.open} onDark color={headerOn} /></>}
          />
          {!!immunizationQ.error && <ErrorBanner message={apiErrorMessage(immunizationQ.error)} onRetry={immunizationQ.refetch} />}
          {data ? (
            <>
              <View style={styles.statsRow}>
                <StatTile value={String(data.summary.given)} label="Given" color={NEUTRAL.success} tint={NEUTRAL.successBg} edge="#B7DEC4" />
                <StatTile value={String(data.summary.overdue + data.summary.due)} label="Overdue or due" color={NEUTRAL.danger} tint={NEUTRAL.dangerBg} edge="#EBBDBD" />
                <StatTile value={data.summary.coverage_pct != null ? `${Math.round(data.summary.coverage_pct)}%` : "—"} label="Recorded so far" color={NEUTRAL.textPrimary} tint={NEUTRAL.surface} edge={NEUTRAL.border} />
              </View>
              {toBook.length > 0 ? (
                <View style={styles.bookCard}>
                  <IconBadge icon={Syringe} size={38} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bookTitle}>Book a vaccine</Text>
                    <Text style={styles.bookMeta}>{toBook.length} overdue or due</Text>
                  </View>
                  <PrimaryButton label="Book" icon={CalendarPlus} compact onPress={() => book(toBook)} />
                </View>
              ) : (
                <Text style={styles.upToDate}>All recorded vaccines are up to date.</Text>
              )}
              <View style={styles.filterRow}>
                <FilterPill label={filterText} count={filter ? counts[filter] : data.rows.length} active={!!filter} onPress={() => setFilterOpen(true)} />
              </View>
            </>
          ) : (
            <>
              <View style={styles.statsRow}>
                <SkeletonBlock width="30%" height={44} radius={12} />
                <SkeletonBlock width="30%" height={44} radius={12} />
                <SkeletonBlock width="30%" height={44} radius={12} />
              </View>
              <SkeletonBlock height={64} radius={CARD.radius} style={{ marginBottom: CARD.gap }} />
            </>
          )}
        </>
      }
    >
      {!data ? (
        [0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)
      ) : groups.length === 0 ? (
        <EmptyState text={data.rows.length === 0 ? "No vaccination schedule available yet." : "Nothing in this filter."} />
      ) : (
        groups.map((g) => {
          const states = g.rows.map(statusOf);
          const status: Status = states.includes("overdue") ? "overdue" : states.includes("due") ? "due" : states.every((s) => s === "given") ? "given" : "upcoming";
          const look = LOOK[status];
          // groups that need action start open, the rest closed
          const open = closed[g.age] === undefined ? bookable(status) : !closed[g.age];
          const toBookHere = g.rows.filter((r) => bookable(statusOf(r)));
          return (
            <View key={g.age} style={[styles.group, { borderLeftColor: look.color }]}>
              <Pressable onPress={() => setClosed({ ...closed, [g.age]: open })} style={[styles.groupHead, { backgroundColor: status === "overdue" ? NEUTRAL.dangerBg : status === "due" ? NEUTRAL.warningBg : status === "given" ? NEUTRAL.successBg : NEUTRAL.surfaceAlt }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.groupTitle}>{g.age}</Text>
                  <View style={styles.groupMeta}>
                    <Pill label={look.label} tone={look.tone} />
                    <Text style={styles.meta}>{g.rows.length} vaccine{g.rows.length === 1 ? "" : "s"}</Text>
                  </View>
                </View>
                {toBookHere.length > 0 && <PrimaryButton label="Book" icon={CalendarPlus} compact onPress={() => book(toBookHere)} />}
                {open ? <ChevronUp size={20} color={NEUTRAL.textSecondary} /> : <ChevronDown size={20} color={NEUTRAL.textSecondary} />}
              </Pressable>
              {open && g.rows.map((r) => <VaccineRow key={r.code} row={r} onBook={() => book([r])} onCard={() => navigation.navigate("DocumentViewer", { ids: [r.document_id!], index: 0, patientAwpid })} />)}
            </View>
          );
        })
      )}
      {!!data && <Text style={styles.source}>Schedule: {data.source}. Your doctor may advise a different timing.</Text>}

      <FilterSheet
        visible={filterOpen}
        items={(["overdue", "due", "given", "upcoming"] as Status[]).filter((s) => counts[s] > 0).map((s) => ({ code: s, count: counts[s] }))}
        total={data?.rows.length}
        selected={filter}
        onSelect={(c) => setFilter(c as "" | Status)}
        onClose={() => setFilterOpen(false)}
        labelOf={(c) => LOOK[c as Status]?.label ?? ""}
        allLabel="All vaccines"
        title="Show vaccines"
        subtitle="Filter the list by status."
        iconOf={(c) => ({ Icon: c ? LOOK[c as Status].Icon : Syringe, ink: c ? LOOK[c as Status].color : BRAND_TEXT })}
      />
      <HelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} items={HELP} title="How to read vaccinations" />
      {switcher.sheet}
    </Screen>
  );
}

function VaccineRow({ row, onBook, onCard }: { row: ImmunizationRow; onBook: () => void; onCard: () => void }) {
  const status = statusOf(row);
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{row.vaccine}</Text>
        <Text style={styles.meta}>
          Dose {row.dose}
          {status === "given" ? ` · ${formatDate(row.given_on!)}${row.late ? " · late" : ""}` : status === "upcoming" ? ` · due ${formatDate(row.due_on)}` : ""}
        </Text>
      </View>
      {bookable(status) && <SecondaryButton label="Book" icon={CalendarPlus} compact onPress={onBook} />}
      {status === "given" && !!row.document_id && (
        <Pressable onPress={onCard} hitSlop={8}><Text style={styles.link}>View card</Text></Pressable>
      )}
    </View>
  );
}

function StatTile({ value, label, color, tint, edge }: { value: string; label: string; color: string; tint: string; edge: string }) {
  return (
    <View style={[styles.statTile, { backgroundColor: tint, borderColor: edge }]}>
      <Text style={[styles.statValue, { color }]} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // three closed, bordered tiles on one background card
  statsRow: {
    flexDirection: "row", gap: 8, padding: 8, marginBottom: 12, backgroundColor: NEUTRAL.surface, borderRadius: CARD.radius,
    borderWidth: 0.5, borderColor: NEUTRAL.border,
  },
  statTile: { alignItems: "center", flex: 1, borderRadius: 12, borderWidth: 1.5, paddingVertical: 12, paddingHorizontal: 4 },
  statValue: { fontSize: 24, fontWeight: "800", lineHeight: 28 },
  statLabel: { fontSize: 12, color: NEUTRAL.textSecondary, marginTop: 2, fontWeight: "600", textAlign: "center" },
  bookCard: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: NEUTRAL.surface, borderRadius: CARD.radius,
    borderWidth: 0.5, borderColor: NEUTRAL.border, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 12,
  },
  bookTitle: { fontSize: CARD_TEXT.title, fontWeight: "700", color: NEUTRAL.textPrimary },
  bookMeta: { fontSize: CARD_TEXT.meta, color: NEUTRAL.textSecondary, marginTop: 1 },
  upToDate: { fontSize: CARD_TEXT.body, fontWeight: "600", color: NEUTRAL.success, marginBottom: 12 },
  filterRow: { flexDirection: "row", marginBottom: 4 },
  group: { backgroundColor: NEUTRAL.surface, borderRadius: CARD.radius, borderWidth: 0.5, borderColor: NEUTRAL.border, borderLeftWidth: 6, marginBottom: CARD.gap, overflow: "hidden" },
  groupHead: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  groupTitle: { fontSize: CARD_TEXT.title + 1, fontWeight: "800", color: NEUTRAL.textPrimary },
  groupMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, paddingHorizontal: 14, borderTopWidth: 0.5, borderTopColor: NEUTRAL.border },
  rowTitle: { fontSize: CARD_TEXT.title, fontWeight: "600", color: NEUTRAL.textPrimary },
  meta: { fontSize: CARD_TEXT.meta, color: NEUTRAL.textSecondary },
  link: { fontSize: CARD_TEXT.body, fontWeight: "700", color: BRAND_TEXT },
  source: { fontSize: CARD_TEXT.tiny, color: NEUTRAL.textSecondary, marginTop: 4, marginBottom: 8 },
});
