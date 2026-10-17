import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { SkeletonRow } from "@/components/Skeleton";
import { Search, ChevronDown, AlertCircle, Lock, Clock, Eye, Download, MoreVertical, Stethoscope, RefreshCw, CalendarDays, Files, LayoutList, Users, Plus } from "lucide-react-native";
import { Screen, EmptyState, ErrorBanner, HeaderBand } from "@/components/Layout";
import { BackButton } from "@/components/IconButtons";
import { SecondaryButton } from "@/components/Buttons";
import { SelectField } from "@/components/SelectField";
import { FilterPill, FilterSheet } from "@/components/TypeFilter";
import { CardMenu, MenuItem } from "@/components/CardMenu";
import { ChoiceSheet, ChoiceAction } from "@/components/ChoiceSheet";
import { HelpItem, HelpSheet } from "@/components/HelpSheet";
import { HelpButton } from "@/components/IconButtons";
import { UploadSheet } from "@/components/UploadSheet";
import { InstantReviewSheet } from "@/components/InstantReviewSheet";
import { UploadStatusBar } from "@/components/UploadStatusBar";
import { DayList, DocumentsMode } from "@/components/DateView";
import { filesLabel } from "@/components/DayCard";
import { useWhoIsThisFor } from "@/components/WhoIsThisFor";
import { LinearGradient } from "expo-linear-gradient";
import { NEUTRAL, ON_BRAND, HEADER_GRADIENT } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { apiErrorMessage } from "@/api/client";
import {
  getMyDocuments, getDocumentCounts, getDocumentDays,
  getPrescriptions, getLabOrders, choosePrescription, chooseLabOrder,
} from "@/api/portal";
import { useDocumentUpload } from "@/context/DocumentUploadContext";
import { useDocumentActions } from "@/hooks/useDocumentActions";
import { pickDocuments } from "@/utils/fileHelpers";
import { setViewingPerson, useViewingPerson } from "@/utils/viewingPerson";
import { PatientDocument, PrescriptionOrder, LabOrder } from "@/api/types";
import type { DocumentDay } from "@/api/portal";
import { AppStackParamList } from "@/navigation/types";

const PAGE = 15;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// What the patient last chose here, kept while the app is open so leaving this screen and coming back does not reset
// it: the view (By date is the default), the year and month of each view, and the type filter of All files.
// Year and month are "" for "All years" / "All months" (By date has no "all years": it opens on the latest year).
let lastMode: DocumentsMode = "date";
let lastYear: number | undefined;
let lastDayMonth = "";
let lastAllYear = "";
let lastAllMonth = "";
let lastCategory = "";

// ── date helpers ───────────────────────────────────────────────────────────
/** "2026-10" of a document's date (the date printed on it, else the day it was uploaded). */
const ymKey = (iso?: string | null) => {
  const d = new Date(iso || "");
  return isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
/** "October 2026" - the heading above one month's files in All files. */
const ymLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};
const monthOf = (key: string) => Number(key.slice(5, 7)) - 1;

const HELP: HelpItem[] = [
  { icon: Plus, title: "Add record", text: "The button at the bottom: upload a file or take a photo of a record." },
  { icon: CalendarDays, title: "By date", text: "One card for each day you uploaded files, with how many there are. Pick a year and a month at the top, tap a day to open its files." },
  { icon: Files, title: "All files", text: "Every file in one list, newest first. Narrow it by year and month, by type, or search." },
  { icon: LayoutList, title: "Change view", text: "In the three dots at the top: switch between By date and All files." },
  { icon: MoreVertical, title: "Three dots on a file", text: "Download a file to your phone, add or correct the doctor's name, hide it from doctors, or delete one you uploaded." },
  { icon: Stethoscope, title: "Doctor's name", text: "Read from the document. Tap the Edit or Add doctor button on the card to correct it." },
  { icon: Eye, title: "Whose documents", text: "Tap the name at the top, or choose Change family member in the three dots: yours or a family member's." },
  { icon: Lock, title: "Privacy", text: "In the menu: choose whether doctors can see a document when you share your records." },
  { icon: Download, title: "Download", text: "Saves a copy of the original file to your phone." },
  { icon: RefreshCw, title: "Pull the top part down", text: "Refreshes the screen. The list itself does not refresh." },
];

// ── screen ─────────────────────────────────────────────────────────────────
export function MyDocumentsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { theme } = useAppTheme();
  const queryClient = useQueryClient();

  // Whose documents are showing: the patient themself, or one family member. Kept in memory only (utils/viewingPerson.ts).
  const patientAwpid = useViewingPerson();
  const {
    cardFor, dialogs, actionError, setActionError, setNotice, privacyQ, privSession, privEnabled,
    familyQ, members, member, personName, personTag, nameColor, labelOf,
  } = useDocumentActions(patientAwpid);
  // A family member who is no longer linked: fall back to the patient themself.
  useEffect(() => {
    if (patientAwpid && familyQ.data && !member) setViewingPerson(undefined);
  }, [patientAwpid, familyQ.data, member]);

  const [mode, setMode] = useState<DocumentsMode>(lastMode);
  useEffect(() => { lastMode = mode; }, [mode]);
  // The year of the By-date view; undefined until the patient picks one (the server then answers with the newest).
  const [year, setYear] = useState<number | undefined>(lastYear);
  useEffect(() => { lastYear = year; }, [year]);
  // The month inside that year: "" = every month, else "0".."11".
  const [dayMonth, setDayMonth] = useState(lastDayMonth);
  useEffect(() => { lastDayMonth = dayMonth; }, [dayMonth]);
  // The two choices of the three-dots menu open as sheets.
  const [viewOpen, setViewOpen] = useState(false);
  const [personOpen, setPersonOpen] = useState(false);
  // All files: the year and month it is narrowed to ("" = all), then the type and the search.
  const [allYear, setAllYear] = useState(lastAllYear);
  useEffect(() => { lastAllYear = allYear; }, [allYear]);
  const [allMonth, setAllMonth] = useState(lastAllMonth);
  useEffect(() => { lastAllMonth = allMonth; }, [allMonth]);
  // "" = every category, else a type code. Remembered while the app is open.
  const [category, setCategory] = useState(lastCategory);
  useEffect(() => { lastCategory = category; }, [category]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [q, setQ] = useState("");
  const [visible, setVisible] = useState(PAGE);
  const [showPending, setShowPending] = useState(false);
  const [choosing, setChoosing] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const { queueUpload, ready } = useDocumentUpload();
  const who = useWhoIsThisFor(patientAwpid);
  // The one document just added with "+", opened to confirm (or change) its type once the bar says it has been read.
  const [instant, setInstant] = useState<{ id: number; awpid?: string } | null>(null);

  // ── By date: one entry per upload day, grouped by the server ──────────────
  const daysQ = useQuery({
    queryKey: ["documentDays", patientAwpid, year ?? "latest"],
    queryFn: () => getDocumentDays({ year, patientAwpid }),
    enabled: mode === "date",
    placeholderData: (previous) => previous,
  });
  const days = daysQ.data;
  // A year that has no files any more (the last one was deleted) is not offered: go back to the newest that has some.
  useEffect(() => {
    if (days && year && days.years.length && !days.years.some((y) => y.year === year)) setYear(undefined);
  }, [days, year]);

  // The months of the chosen year that have files, newest first, each with its file count - and the days of the month
  // picked (all of them when none is).
  const monthChoices = useMemo(() => {
    const perMonth: Record<number, number> = {};
    (days?.days ?? []).forEach((d) => {
      const m = Number(d.date.slice(5, 7)) - 1;
      perMonth[m] = (perMonth[m] || 0) + d.total;
    });
    return Object.keys(perMonth).map(Number).sort((a, b) => b - a)
      .map((m) => ({ value: String(m), label: MONTHS[m], meta: filesLabel(perMonth[m]) }));
  }, [days]);
  const visibleDays = useMemo(
    () => (days?.days ?? []).filter((d) => dayMonth === "" || Number(d.date.slice(5, 7)) - 1 === Number(dayMonth)),
    [days, dayMonth],
  );
  // A month whose last file was deleted is not offered any more.
  useEffect(() => {
    if (dayMonth && days && !monthChoices.some((c) => c.value === dayMonth)) setDayMonth("");
  }, [dayMonth, days, monthChoices]);

  // ── All files: search, the year/month filter and the category counts work over the FULL document set - client-side,
  // not server-driven. The first page is its own fast query (instant paint) and whatever pages remain are fetched in
  // PARALLEL in the background and merged in once they land; nothing here waits on that to render.
  const docsFirstQ = useQuery({
    queryKey: ["documents", patientAwpid, "page1"],
    queryFn: () => getMyDocuments(1, patientAwpid),
    enabled: mode === "all",
  });
  const firstPage = docsFirstQ.data;
  const totalPages = firstPage?.pagination.total_pages ?? 1;
  const docsRestQ = useQuery({
    queryKey: ["documents", patientAwpid, "rest"],
    queryFn: async () => {
      const pageNums = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
      const pages = await Promise.all(pageNums.map((p) => getMyDocuments(p, patientAwpid)));
      return pages.flatMap((p) => p.results);
    },
    enabled: mode === "all" && !!firstPage && totalPages > 1,
  });
  const docs = useMemo(() => {
    // Offset pagination (page 1, then pages 2..N fetched afterward) isn't stable against concurrent inserts: a new
    // upload shifts everything after it by one position, so a document already in firstPage.results can reappear in
    // docsRestQ.data at the shifted offset. De-dupe by id (keep the first occurrence) rather than rendering it twice.
    const combined = [...(firstPage?.results ?? []), ...(totalPages > 1 ? docsRestQ.data ?? [] : [])];
    const seen = new Set<number>();
    return combined.filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true)));
  }, [firstPage, docsRestQ.data, totalPages]);
  const isInitialLoading = !firstPage;
  const loadError =
    (mode === "all" && ((docsFirstQ.error && apiErrorMessage(docsFirstQ.error)) || (docsRestQ.error && apiErrorMessage(docsRestQ.error)))) ||
    (mode === "date" && daysQ.error && apiErrorMessage(daysQ.error)) || "";
  const error = loadError || actionError;

  // Two independent, soft-failing queries — a failure in either never blocks the documents list.
  const pendingRxQ = useQuery({
    queryKey: ["prescriptionOrders", patientAwpid],
    queryFn: () => getPrescriptions(patientAwpid).catch(() => [] as PrescriptionOrder[]),
  });
  const pendingLabQ = useQuery({
    queryKey: ["labOrders", patientAwpid],
    queryFn: () => getLabOrders(patientAwpid).catch(() => [] as LabOrder[]),
  });
  const pendingRx = (pendingRxQ.data ?? []).filter((r) => r.patient_choice === "pending");
  const pendingLab = (pendingLabQ.data ?? []).filter((l) => l.patient_choice === "pending");

  // Per-category numbers for the type filter and how many uploads still wait for review.
  const countsQ = useQuery({ queryKey: ["documentCounts", patientAwpid], queryFn: () => getDocumentCounts(patientAwpid) });
  const counts = countsQ.data;

  const load = useCallback(async () => {
    await Promise.all([
      mode === "date" ? daysQ.refetch() : docsFirstQ.refetch(),
      mode === "all" && totalPages > 1 ? docsRestQ.refetch() : Promise.resolve(),
      pendingRxQ.refetch(),
      pendingLabQ.refetch(),
      countsQ.refetch(),
    ]);
  }, [mode, daysQ.refetch, docsFirstQ.refetch, docsRestQ.refetch, totalPages, pendingRxQ.refetch, pendingLabQ.refetch, countsQ.refetch]);
  const refetchAll = useCallback(async () => {
    await Promise.all([load(), privacyQ.refetch(), familyQ.refetch()]);
  }, [load, privacyQ.refetch, familyQ.refetch]);
  useRefreshOnFocus(
    mode === "date"
      ? [daysQ, pendingRxQ, pendingLabQ, privacyQ, countsQ]
      : [docsFirstQ, docsRestQ, pendingRxQ, pendingLabQ, privacyQ, countsQ],
  );
  const { refreshing: pulling, onRefresh: pullRefresh } = usePullToRefresh(refetchAll);
  const isFetchingAny =
    (mode === "date" ? daysQ.isFetching : docsFirstQ.isFetching || docsRestQ.isFetching) ||
    pendingRxQ.isFetching || pendingLabQ.isFetching;

  // The years that have files and, for the year picked (or every year), the months that have files - each with its
  // file count, newest first.
  const allYearChoices = useMemo(() => {
    const perYear: Record<string, number> = {};
    docs.forEach((d) => { const k = ymKey(d.document_date || d.created_at); if (k) perYear[k.slice(0, 4)] = (perYear[k.slice(0, 4)] || 0) + 1; });
    return Object.keys(perYear).sort((a, b) => Number(b) - Number(a))
      .map((y) => ({ value: y, label: y, meta: filesLabel(perYear[y]) }));
  }, [docs]);
  const allMonthChoices = useMemo(() => {
    const perMonth: Record<number, number> = {};
    docs.forEach((d) => {
      const k = ymKey(d.document_date || d.created_at);
      if (k && (!allYear || k.slice(0, 4) === allYear)) perMonth[monthOf(k)] = (perMonth[monthOf(k)] || 0) + 1;
    });
    return Object.keys(perMonth).map(Number).sort((a, b) => b - a)
      .map((m) => ({ value: String(m), label: MONTHS[m], meta: filesLabel(perMonth[m]) }));
  }, [docs, allYear]);

  // Choosing another person starts the list afresh: no half-applied filters from the previous person.
  useEffect(() => { setVisible(PAGE); }, [category, q, allYear, allMonth, patientAwpid]);
  const shownPerson = useRef(patientAwpid);
  useEffect(() => {
    if (shownPerson.current === patientAwpid) return;        // not on the first render: keep the remembered filter
    shownPerson.current = patientAwpid;
    setCategory("");
    setQ("");
    setYear(undefined);
    setDayMonth("");
    setAllYear("");
    setAllMonth("");
  }, [patientAwpid]);

  // One entry per type the patient actually has (from the server's counts), biggest first.
  const typeChips = useMemo(
    () => Object.entries(counts?.by_type ?? {})
      .filter(([, n]) => n > 0)
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)),
    [counts],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return docs
      .filter((d) => !category || d.doc_type === category)
      .filter((d) =>
        !needle ||
        [d.doctor_name, labelOf(d.doc_type), d.file_name, d.public_document_id]
          .filter(Boolean).join(" ").toLowerCase().includes(needle))
      .filter((d) => {
        const k = ymKey(d.document_date || d.created_at);
        return (!allYear || k.slice(0, 4) === allYear) && (!allMonth || monthOf(k) === Number(allMonth));
      })
      .sort((a, b) => (b.document_date || b.created_at).localeCompare(a.document_date || a.created_at));
  }, [docs, category, q, allYear, allMonth, labelOf]);

  const shown = filtered.slice(0, visible);
  const filteredIds = useMemo(() => filtered.map((d) => d.id), [filtered]);

  // One month of one year is a single group: no heading needed above it.
  const singleMonth = !!allYear && !!allMonth;
  const groups = useMemo(() => {
    if (singleMonth) return [{ key: "flat", label: "", list: shown }];
    const map = new Map<string, PatientDocument[]>();
    shown.forEach((d) => {
      const k = ymKey(d.document_date || d.created_at) || "0000-00";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(d);
    });
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([k, list]) => ({ key: k, label: ymLabel(k), list }));
  }, [shown, singleMonth]);

  // ── actions ──────────────────────────────────────────────────────────────
  // A day card opens that day's files (a screen of its own, which has no Add button). The day's per-type counts go
  // along, for the type filter inside it.
  function openDay(day: DocumentDay) {
    navigation.navigate("DocumentDay", { date: day.date, byType: day.by_type, ...(patientAwpid ? { patientAwpid } : {}) });
  }

  // The three dots in the header: change the view, and (when the account has family members) whose documents show.
  const headerMenu: MenuItem[] = [
    { key: "view", label: "Change view", icon: LayoutList, onPress: () => setViewOpen(true) },
    ...(members.length ? [{ key: "person", label: "Change family member", icon: Users, onPress: () => setPersonOpen(true) } as MenuItem] : []),
  ];
  const viewActions: ChoiceAction[] = [
    { label: "By date", primary: mode === "date", onPress: () => setMode("date") },
    { label: "All files", primary: mode === "all", onPress: () => setMode("all") },
    
  ];
  const personActions: ChoiceAction[] = [
    { label: "Myself", sub: "Your own documents", primary: !patientAwpid, onPress: () => setViewingPerson(undefined) },
    ...members.map((m) => ({
      label: m.full_name, sub: m.relationship, primary: m.awpid === patientAwpid, onPress: () => setViewingPerson(m.awpid),
    })),
    { label: "Cancel", cancel: true, onPress: () => undefined },
  ];

  // Add Document: one file, uploaded on the fast lane after asking whose it is. A bar at the top follows it until it has
  // been read, then offers to confirm the type. (For many files at once there is the Bulk Upload screen.)
  async function pickAndUpload() {
    try {
      const target = await who.ask();
      if (!target) return;
      const files = await pickDocuments(false);
      if (!files.length) return;
      const f = files[0];
      const outcome = queueUpload(
        [{ name: f.name || "upload", mimeType: f.mimeType || "application/octet-stream", size: f.size || 0, uri: f.uri }],
        "instant",
        target.awpid,
      );
      if (outcome.status !== "queued") {
        setNotice({ title: outcome.status === "busy" ? "Upload in progress" : "Can't upload", message: outcome.reason, tone: "error" });
      }
    } catch (err) {
      setNotice({ title: "Can't upload", message: apiErrorMessage(err, "Couldn't upload that file."), tone: "error" });
    }
  }

  async function takePhoto() {
    const target = await who.ask();
    if (target) navigation.navigate("DocumentCapture", { mode: "instant", ...(target.awpid ? { patientAwpid: target.awpid } : {}) });
  }

  /** The Add sheet closes first, then the chosen action starts (a sheet and a dialog cannot both be on screen). */
  function chooseUpload(action: () => void) {
    setAddOpen(false);
    setTimeout(action, 320);
  }

  async function choose(kind: "rx" | "lab", item: PrescriptionOrder | LabOrder, ch: "in_house" | "outside") {
    setChoosing(`${kind}${item.id}`);
    try {
      if (kind === "rx") {
        const r = item as PrescriptionOrder;
        await choosePrescription({
          hospital_db: r.hospital_db, prescription_id: r.id, patient_choice: ch,
          payment_preference: ch === "in_house" ? "pay_at_pharmacy" : undefined,
        });
      } else {
        const l = item as LabOrder;
        await chooseLabOrder({ hospital_db: l.hospital_db, request_id: l.id, patient_choice: ch });
      }
      queryClient.invalidateQueries({ queryKey: ["prescriptionOrders", patientAwpid] });
      queryClient.invalidateQueries({ queryKey: ["labOrders", patientAwpid] });
    } catch (err) {
      setActionError(apiErrorMessage(err, "Couldn't save your choice."));
    } finally {
      setChoosing(null);
    }
  }

  const pendingCount = pendingRx.length + pendingLab.length;

  // The scrolling body as a flat list of children, so each month label can be a sticky header: it stays at the top of
  // the list while that month's documents scroll under it, until the next month's label takes over.
  const bodyNodes: React.ReactNode[] = [];
  const stickyIdx: number[] = [];
  if (pendingCount > 0) {
    bodyNodes.push(
      <View key="pend" style={styles.pend}>
        <Pressable onPress={() => setShowPending((v) => !v)} style={styles.pendHead}>
          <AlertCircle size={14} color={NEUTRAL.warning} strokeWidth={2.2} />
          <Text style={styles.pendTxt}>
            {pendingCount} item{pendingCount === 1 ? "" : "s"} need a pharmacy / lab choice
          </Text>
          <ChevronDown
            size={14}
            color={NEUTRAL.warning}
            strokeWidth={2.4}
            style={{ transform: [{ rotate: showPending ? "180deg" : "0deg" }] }}
          />
        </Pressable>
        {showPending && (
          <View style={{ marginTop: 8, gap: 8 }}>
            {pendingRx.map((r) => (
              <View key={`rx${r.id}`} style={styles.pendItem}>
                <Text style={styles.pendItemT} numberOfLines={1}>
                  {r.doctor_name ? `Dr. ${r.doctor_name}` : "Prescription"} · {r.hospital}
                </Text>
                <View style={styles.pendBtns}>
                  <SecondaryButton label="Buy here" compact loading={choosing === `rx${r.id}`} onPress={() => choose("rx", r, "in_house")} />
                  <SecondaryButton label="Elsewhere" compact onPress={() => choose("rx", r, "outside")} />
                </View>
              </View>
            ))}
            {pendingLab.map((l) => (
              <View key={`lab${l.id}`} style={styles.pendItem}>
                <Text style={styles.pendItemT} numberOfLines={1}>{l.test_name} · {l.hospital}</Text>
                <View style={styles.pendBtns}>
                  <SecondaryButton label="In-house" compact loading={choosing === `lab${l.id}`} onPress={() => choose("lab", l, "in_house")} />
                  <SecondaryButton label="Outside" compact onPress={() => choose("lab", l, "outside")} />
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }
  if (mode === "date") {
    bodyNodes.push(
      <DayList
        key="days"
        data={days}
        days={visibleDays}
        loading={!days && daysQ.isLoading}
        forName={personName}
        nameColor={nameColor}
        labelOf={labelOf}
        onOpenDay={openDay}
      />,
    );
  } else if (isInitialLoading) {
    bodyNodes.push(
      <View key="skeleton">
        {[0, 1, 2, 3, 4].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </View>,
    );
  } else {
    if (filtered.length === 0) {
      bodyNodes.push(
        <EmptyState
          key="empty"
          text={
            q ? `Nothing matches "${q}".`
            : allYear || allMonth ? "No records in this period."
            : category ? "Nothing in this category yet."
            : "No records yet. Tap Add record to add one."
          }
        />,
      );
    } else {
      groups.forEach((g) => {
        if (g.label) {
          stickyIdx.push(bodyNodes.length);
          bodyNodes.push(
            <View key={`h${g.key}`} style={styles.grpHead}>
              <Text style={styles.grpLabel}>{g.label}</Text>
            </View>,
          );
        }
        g.list.forEach((d) => bodyNodes.push(cardFor(d, filteredIds)));
      });
    }
    if (filtered.length > visible) {
      bodyNodes.push(
        <SecondaryButton
          key="more"
          label={`Load ${Math.min(PAGE, filtered.length - visible)} more`}
          onPress={() => setVisible((v) => v + PAGE)}
          style={{ marginTop: 4 }}
        />,
      );
    }
    if (filtered.length > 0) {
      bodyNodes.push(
        <Text key="count" style={styles.count}>
          Showing {Math.min(visible, filtered.length)} of {filtered.length}
        </Text>,
      );
    }
  }

  return (
    <Screen
      onRefresh={pullRefresh}
      refreshing={pulling}
      backgroundLoading={isFetchingAny && !pulling}
      stickyHeaderIndices={stickyIdx}
      footer={
        // The one way to add a record: a full-width button on a white strip at the bottom, under the list.
        <View style={styles.addBar}>
          <Pressable
            onPress={() => setAddOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Add record"
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
          >
            <LinearGradient colors={HEADER_GRADIENT} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
            <Text style={[styles.addBtnText, { color: theme.on }]}>Add record</Text>
          </Pressable>
        </View>
      }
      header={
        <>
          {/* header band: solid green, one piece with the status bar above it. Back, the screen name over whose
              documents these are (tap it to change the person), help, menu */}
          <HeaderBand>
            <BackButton onPress={() => navigation.goBack()} />
            <Pressable
              disabled={!members.length}
              onPress={() => setPersonOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Showing documents of ${personName}. Change`}
              style={styles.titleBlock}
            >
              <Text style={styles.kicker}>My Documents</Text>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>{personName}</Text>
                {!!members.length && <ChevronDown size={18} color={ON_BRAND} strokeWidth={2.6} />}
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{personTag}</Text>
                </View>
              </View>
            </Pressable>
            <HelpButton onPress={() => setHelpOpen(true)} onDark />
            <CardMenu items={headerMenu} round label="More options" />
          </HeaderBand>

          {/* the year and the month: the same plain dropdowns in both views. By date opens on the latest year with
              files; All files opens on "All years" and "All months". */}
          {mode === "date" ? (
            !!days && days.years.length > 0 && (
              <View style={styles.ymRow}>
                <SelectField
                  variant="text"
                  label="Year"
                  value={String(days.year ?? "")}
                  onChange={(v) => { if (v) { setYear(Number(v)); setDayMonth(""); } }}
                  options={days.years.map((y) => ({ value: String(y.year), label: String(y.year), meta: filesLabel(y.count) }))}
                />
                <SelectField
                  variant="text"
                  label="Month"
                  value={dayMonth}
                  onChange={setDayMonth}
                  options={monthChoices}
                  placeholder="All months"
                  clearLabel="All months"
                />
              </View>
            )
          ) : (
            <View style={styles.ymRow}>
              <SelectField
                variant="text"
                label="Year"
                value={allYear}
                onChange={(v) => { setAllYear(v); setAllMonth(""); }}
                options={allYearChoices}
                placeholder="All years"
                clearLabel="All years"
              />
              <SelectField
                variant="text"
                label="Month"
                value={allMonth}
                onChange={setAllMonth}
                options={allMonthChoices}
                placeholder="All months"
                clearLabel="All months"
              />
            </View>
          )}

          {/* files just uploaded: a progress bar while they are read, then a Review button */}
          <UploadStatusBar
            onReview={(r) =>
              r.ids.length === 1
                ? setInstant({ id: r.ids[0], awpid: r.patientAwpid })
                : navigation.navigate("DocumentUpload", r.patientAwpid ? { patientAwpid: r.patientAwpid } : undefined)
            }
          />

          {/* uploads still waiting for the patient to confirm their type */}
          {!ready && (counts?.awaiting_review ?? 0) > 0 && (
            <Pressable
              style={styles.reviewBanner}
              onPress={() => navigation.navigate("DocumentUpload", patientAwpid ? { patientAwpid } : undefined)}
            >
              <AlertCircle size={15} color={NEUTRAL.warning} strokeWidth={2.2} />
              <Text style={styles.reviewBannerT}>
                <Text style={styles.reviewBannerB}>{counts!.awaiting_review} document{counts!.awaiting_review === 1 ? " needs" : "s need"} review.</Text>
                {" "}Confirm their types to add them here.
              </Text>
              <Text style={[styles.reviewBannerGo, { color: theme.text }]}>Review ›</Text>
            </Pressable>
          )}

          {privEnabled && !!privSession && (
            <View style={styles.privBanner}>
              <Clock size={12} color={NEUTRAL.warning} strokeWidth={2.2} style={{ marginTop: 1 }} />
              <Text style={styles.privBannerT}>
                <Text style={styles.privBannerB}>{privSession.requester_label || "A doctor"} is viewing your records now.</Text>{" "}
                Making a report visible asks just this visit or always. Locking one takes effect right away.
              </Text>
            </View>
          )}
          {!!error && <ErrorBanner message={error} onRetry={load} />}

          {/* category (All files only): one pill showing the active type (or "All"); tap to change it */}
          {mode === "all" && !!counts && typeChips.length > 0 && (
            <View style={styles.filterRow}>
              <FilterPill
                active={!!category}
                label={category ? labelOf(category) : "All"}
                count={category ? typeChips.find((c) => c.code === category)?.count : counts.total}
                onPress={() => setFilterOpen(true)}
              />
            </View>
          )}

          {/* search (All files only) */}
          {mode === "all" && (
            <View style={styles.srch}>
              <Search size={14} color={NEUTRAL.textMuted} strokeWidth={2.2} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search by type or doctor"
                placeholderTextColor={NEUTRAL.textMuted}
                style={styles.srchIn}
              />
            </View>
          )}
        </>
      }
    >
      {bodyNodes}

      <UploadSheet
        visible={addOpen}
        many={false}
        onClose={() => setAddOpen(false)}
        onFiles={() => chooseUpload(pickAndUpload)}
        onCamera={() => chooseUpload(takePhoto)}
      />
      <HelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} items={HELP} />

      <ChoiceSheet visible={viewOpen} title="Change view" actions={viewActions} large onClose={() => setViewOpen(false)} />
      <ChoiceSheet visible={personOpen} title="Whose documents?" message="Choose whose documents to show." actions={personActions} onClose={() => setPersonOpen(false)} />

      <FilterSheet
        visible={filterOpen}
        items={typeChips}
        total={counts?.total ?? 0}
        selected={category}
        onSelect={setCategory}
        onClose={() => setFilterOpen(false)}
        labelOf={labelOf}
        allLabel="All documents"
      />

      {dialogs}

      {who.sheet}

      <InstantReviewSheet
        documentId={instant?.id ?? null}
        patientAwpid={instant ? instant.awpid : patientAwpid}
        onClose={() => { setInstant(null); load(); }}
        onSubmitted={(type) => {
          setInstant(null);
          queryClient.invalidateQueries({ queryKey: ["documents"] });
          queryClient.invalidateQueries({ queryKey: ["documentDays"] });
          queryClient.invalidateQueries({ queryKey: ["documentCounts"] });
          setNotice({ title: "Added to My Documents", message: `Saved as ${labelOf(type)}.`, tone: "success" });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleBlock: { flex: 1, minWidth: 0 },
  kicker: { fontSize: 19, color: ON_BRAND, fontWeight: "700" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  name: { fontSize: 16, fontWeight: "800", color: ON_BRAND, flexShrink: 1, letterSpacing: -0.2 },
  tag: { borderRadius: 11, paddingHorizontal: 9, paddingVertical: 1, borderWidth: 1.5, borderColor: ON_BRAND },
  tagText: { fontSize: 12, fontWeight: "800", color: ON_BRAND },

  ymRow: { flexDirection: "row", alignItems: "flex-end", gap: 20, marginBottom: 12 },

  addBar: {
    paddingTop: 12, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: NEUTRAL.surface, borderTopWidth: 0.5, borderTopColor: NEUTRAL.border,
  },
  addBtn: { height: 52, borderRadius: 8, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  addBtnText: { fontSize: 17, fontWeight: "800" },

  privBanner: { flexDirection: "row", gap: 8, backgroundColor: NEUTRAL.warningBg, borderRadius: 12, padding: 10, marginBottom: 10 },
  privBannerT: { flex: 1, fontSize: 11, lineHeight: 16, color: "#5C3A08" },
  privBannerB: { fontWeight: "700", color: "#3E2A08" },

  reviewBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: NEUTRAL.warningBg, borderRadius: 12, padding: 11, marginBottom: 12 },
  reviewBannerT: { flex: 1, fontSize: 11.5, lineHeight: 16, color: "#5C3A08" },
  reviewBannerB: { fontWeight: "700", color: "#3E2A08" },
  reviewBannerGo: { fontSize: 11.5, fontWeight: "700" },

  filterRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },

  srch: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: NEUTRAL.surface, borderWidth: 0.5, borderColor: NEUTRAL.border, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 8, marginBottom: 10 },
  srchIn: { flex: 1, fontSize: 12.5, color: NEUTRAL.textPrimary, padding: 0 },

  pend: { backgroundColor: NEUTRAL.warningBg, borderRadius: 12, padding: 10, marginBottom: 12 },
  pendHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  pendTxt: { flex: 1, fontSize: 11.5, fontWeight: "700", color: NEUTRAL.warning },
  pendItem: { backgroundColor: NEUTRAL.surface, borderRadius: 10, padding: 10 },
  pendItemT: { fontSize: 11.5, fontWeight: "600", color: NEUTRAL.textPrimary, marginBottom: 8 },
  pendBtns: { flexDirection: "row", gap: 6 },

  grpHead: { backgroundColor: NEUTRAL.bg, marginHorizontal: -16, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 },
  grpLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", color: NEUTRAL.textMuted },

  count: { textAlign: "center", fontSize: 10, color: NEUTRAL.textMuted, marginTop: 10, marginBottom: 4 },
});
