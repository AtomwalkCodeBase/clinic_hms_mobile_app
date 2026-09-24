import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import {
  Clock, Lock, Search, FlaskConical, Pill as PillIcon, FileText,
  ChevronDown, ChevronLeft, ChevronRight,
} from "lucide-react-native";
import { Screen, BackHeader, ErrorBanner } from "@/components/Layout";
import { SegmentedControl } from "@/components/SegmentedControl";
import { ChoiceSheet, ChoiceAction } from "@/components/ChoiceSheet";
import { CategoryFilterSheet } from "@/components/CategoryFilterSheet";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { apiErrorMessage } from "@/api/client";
import { getRecordsPrivacy, toggleRecordPrivacy, updateRecordsPrivacy, revealForShare, RecordsPrivacyQuery } from "@/api/portal";
import { RecordsPrivacyDoc, RecordsPrivacyPayload } from "@/api/types";
import { AppStackParamList } from "@/navigation/types";

const CATEGORY_LABELS: Record<string, string> = {
  cbc: "Complete Blood Count", lipid: "Lipid Profile", lft: "Liver Function Test",
  kft: "Kidney Function Test", thyroid: "Thyroid Profile", diabetes: "Blood Sugar & HbA1c",
  urine: "Urine Routine", electrolytes: "Serum Electrolytes", vitamin: "Vitamin & Mineral",
  inflammation: "Inflammatory Markers", cardiac: "Cardiac Markers", coagulation: "Coagulation Profile",
  hormone: "Hormone Panel", infection: "Infection Serology", culture: "Culture & Sensitivity",
};
const catLabel = (s: string) => CATEGORY_LABELS[s] || s;
const KIND_LABEL: Record<string, string> = {
  lab_report: "Lab reports", prescription: "Prescriptions", scan: "Imaging",
  discharge_summary: "Discharge summaries", other: "Documents",
};
const KIND_ORDER = ["lab_report", "prescription", "scan", "discharge_summary", "other"];
const KIND_TILE: Record<string, { bg: string; fg: string; Icon: any }> = {
  lab_report: { bg: "#F8EAC8", fg: "#8A5A12", Icon: FlaskConical },
  prescription: { bg: "#EAE7FB", fg: "#4A3FB0", Icon: PillIcon },
  scan: { bg: "#E4EAF1", fg: "#3B4A5A", Icon: FileText },
  discharge_summary: { bg: "#E4EAF1", fg: "#3B4A5A", Icon: FileText },
  other: { bg: "#E4EAF1", fg: "#3B4A5A", Icon: FileText },
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dOf = (d: RecordsPrivacyDoc) => d.document_date || d.created_at || "";
const fmtDate = (iso: string) => {
  const dt = new Date(iso);
  return isNaN(dt.getTime()) ? "" : `${String(dt.getDate()).padStart(2, "0")} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
};

// "documents" filter → the backend's ?kind= (exact doc_type slugs)
type TypeF = "all" | "lab_report" | "prescription" | "doc";
const KIND_PARAM: Record<TypeF, string | undefined> = {
  all: undefined,
  lab_report: "lab_report",
  prescription: "prescription",
  doc: "scan,discharge_summary,other",
};

// debounce a fast value (the search box) so it drives one request on pause
function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

type Sheet = { title: string; message?: string; actions: ChoiceAction[] } | null;
type State = "on" | "off" | "visit";
const stateOf = (d: RecordsPrivacyDoc): State =>
  d.revealed_for_visit ? "visit" : d.private ? "off" : "on";
const seen = (d: RecordsPrivacyDoc) => !d.private || d.revealed_for_visit;

export function SharedRecordsPrivacyScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { theme } = useAppTheme();

  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [catSheet, setCatSheet] = useState(false);

  const [typeF, setTypeF] = useState<TypeF>("all");
  const [catF, setCatF] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const qDebounced = useDebounced(q, 300);

  // any filter change → back to page 1
  const setTypeFilter = (t: TypeF) => { setTypeF(t); setPage(1); };
  const applyCats = (next: string[]) => { setCatF(new Set(next)); setPage(1); };
  const firstQ = useRef(true);
  useEffect(() => {
    if (firstQ.current) { firstQ.current = false; return; }
    setPage(1);
  }, [qDebounced]);

  const catKey = useMemo(() => [...catF].sort().join(","), [catF]);
  const { data, error: queryError, refetch, isPending: loading, isStale } = useQuery({
    queryKey: ["recordsPrivacy", page, typeF, catKey, qDebounced],
    queryFn: () => {
      const query: RecordsPrivacyQuery = { page };
      const kind = KIND_PARAM[typeF];
      if (kind) query.kind = kind;
      if (catF.size) query.category = [...catF].join(",");
      if (qDebounced.trim()) query.q = qDebounced.trim();
      return getRecordsPrivacy(query);
    },
    // Changing a filter/page keeps showing the previous page's data instead
    // of flashing empty while the new one loads.
    placeholderData: keepPreviousData,
  });
  useRefreshOnFocus({ isStale, refetch });
  const error = queryError ? apiErrorMessage(queryError, "Couldn't load your privacy settings.") : "";
  const load = refetch;

  const docs = data?.documents ?? [];               // one page
  const summary = data?.summary;
  const pagination = data?.pagination ?? null;
  const session = data?.active_session ?? null;

  const vaultTotal = summary?.vault_total ?? 0;
  const shownCount = summary?.shown ?? 0;
  const visitCount = summary?.visit ?? 0;
  const privateCount = summary?.private ?? 0;
  const filteredTotal = summary?.filtered_total ?? docs.length;

  const catOptions = useMemo(() => {
    const counts = summary?.category_counts ?? {};
    const labels = summary?.category_labels ?? {};
    return Object.keys(counts)
      .sort()
      .map((value) => ({ value, label: labels[value] || catLabel(value), count: counts[value] }));
  }, [summary]);

  // `docs` is already this page's rows in category order — just re-bucket for
  // the section headers. The server never splits a group across pages.
  const groups = useMemo(() => {
    const m = new Map<string, { key: string; label: string; list: RecordsPrivacyDoc[] }>();
    docs.forEach((d) => {
      const cats = d.report_categories.filter((c) => CATEGORY_LABELS[c]);
      const key = cats.length ? `c:${cats[0]}` : `k:${d.doc_type}`;
      const label = cats.length ? catLabel(cats[0]) : KIND_LABEL[d.doc_type] || "Documents";
      if (!m.has(key)) m.set(key, { key, label, list: [] });
      m.get(key)!.list.push(d);
    });
    return [...m.values()];
  }, [docs]);

  // ── mutations ────────────────────────────────────────────────────────────
  const [mutationError, setMutationError] = useState("");
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setMutationError("");
    try {
      await fn();
      await load();
    } catch (err) {
      setMutationError(apiErrorMessage(err, "Couldn't update."));
    } finally {
      setBusy(false);
    }
  }
  const setPrivate = (ids: number[], makePrivate: boolean) => {
    if (!ids.length) return Promise.resolve();
    return run(() =>
      ids.length === 1
        ? toggleRecordPrivacy(ids[0], makePrivate)
        : updateRecordsPrivacy(
            makePrivate ? { add_hidden_doc_ids: ids } : { remove_hidden_doc_ids: ids },
          ),
    );
  };
  const reveal = (ids: number[], scope: "visit" | "always" | "conceal") =>
    session ? run(() => revealForShare(session.token, ids, scope)) : Promise.resolve();

  function askHide(ids: number[], name: string) {
    if (!ids.length) return;
    setSheet({
      title: ids.length > 1 ? `Hide ${ids.length} records from doctors?` : "Hide this from doctors?",
      message: `A doctor you share with won't see ${name}. You can show ${ids.length > 1 ? "them" : "it"} again anytime.`,
      actions: [
        { label: "Cancel", cancel: true },
        { label: "Hide", primary: true, onPress: () => setPrivate(ids, true) },
      ],
    });
  }
  function askShow(ids: number[], name: string) {
    if (!ids.length) return;
    if (session) {
      setSheet({
        title: "A doctor is viewing now",
        message: `Show ${name} to ${session.requester_label || "the doctor"} —`,
        actions: [
          { label: "Just this visit", sub: "Hides again when the visit ends", primary: true, onPress: () => reveal(ids, "visit") },
          { label: "Always", sub: "Stays visible for future visits too", onPress: () => setPrivate(ids, false) },
          { label: "Cancel", cancel: true },
        ],
      });
    } else {
      setSheet({
        title: ids.length > 1 ? `Show ${ids.length} records to doctors?` : "Show this to doctors again?",
        message: `Doctors you share with will be able to see ${name}.`,
        actions: [
          { label: "Cancel", cancel: true },
          { label: "Show", primary: true, onPress: () => setPrivate(ids, false) },
        ],
      });
    }
  }
  function onPill(d: RecordsPrivacyDoc) {
    const st = stateOf(d);
    if (st === "on") {
      askHide([d.id], d.title);
    } else if (st === "visit") {
      setSheet({
        title: "Hide this again now?",
        message: `${d.title} would hide by itself when the visit ends.`,
        actions: [
          { label: "Cancel", cancel: true },
          { label: "Hide now", primary: true, onPress: () => reveal([d.id], "conceal") },
        ],
      });
    } else if (d.private_by_rule) {
      setSheet({
        title: "Hidden by a rule",
        message: `${d.title} is hidden by a category or section rule you set on the web. Reveal it just for this visit?`,
        actions: [
          ...(session ? [{ label: "Just this visit", sub: "Reveal only for the doctor viewing now", primary: true, onPress: () => reveal([d.id], "visit") } as ChoiceAction] : []),
          { label: "Close", cancel: true },
        ],
      });
    } else {
      askShow([d.id], d.title);
    }
  }
  function onGroupPill(list: RecordsPrivacyDoc[], label: string) {
    if (list.every(seen)) {
      askHide(list.map((d) => d.id), `every report in ${label}`);
    } else {
      askShow(list.filter((d) => !seen(d)).map((d) => d.id), `every report in ${label}`);
    }
  }

  const onBack = () => navigation.goBack();
  const catTriggerLabel = catF.size === 0 ? "All categories" : `${catF.size} categor${catF.size > 1 ? "ies" : "y"}`;

  return (
    <Screen>
      <BackHeader title="Shared records privacy" onBack={onBack} />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.fill} /></View>
      ) : error && !data ? (
        <ErrorBanner message={error} onRetry={load} />
      ) : data ? (
        <View style={styles.pad}>
          {!!mutationError && <ErrorBanner message={mutationError} />}
          <Text style={styles.intro}>
            Choose what a doctor sees when you share your records. Nothing here is hidden from you, and nothing is deleted.
          </Text>

          {!!session && (
            <View style={styles.banner}>
              <Clock size={13} color={NEUTRAL.warning} strokeWidth={2.2} style={{ marginTop: 1 }} />
              <Text style={styles.bannerText}>
                <Text style={styles.bannerStrong}>{session.requester_label || "A doctor"} is viewing your records now.</Text>{" "}
                Showing a private record asks whether it&rsquo;s just this visit or always.
              </Text>
            </View>
          )}

          {/* readout */}
          <View style={styles.readout}>
            <Text style={styles.roLabel}>VISIBLE TO A DOCTOR</Text>
            <View style={styles.roRow}>
              <Text style={[styles.roNum, { color: theme.text }]}>{shownCount} / {vaultTotal}</Text>
              <Text style={styles.roUnit}>records</Text>
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => askShow(summary?.showable_ids ?? [], "every hidden record")} hitSlop={6}>
                <Text style={[styles.roAct, { color: theme.text }]}>Show all</Text>
              </Pressable>
              <Pressable onPress={() => askHide(summary?.hideable_ids ?? [], "every record")} hitSlop={6}>
                <Text style={[styles.roAct, styles.roActMut]}>Hide all</Text>
              </Pressable>
            </View>
            <View style={styles.track}>
              <View style={[styles.trackFill, { width: `${vaultTotal ? ((shownCount - visitCount) / vaultTotal) * 100 : 0}%`, backgroundColor: theme.fill }]} />
              <View style={[styles.trackFill, { width: `${vaultTotal ? (visitCount / vaultTotal) * 100 : 0}%`, backgroundColor: "#7C5CD6" }]} />
            </View>
            {summary?.truncated && (
              <Text style={styles.truncNote}>Showing your {vaultTotal} most recent records.</Text>
            )}
          </View>

          {/* filters — navigate the list; broad rules (hide-all, sections, live
              category rules) live on the web privacy screen */}
          <View style={{ marginTop: 4 }}>
            <SegmentedControl
              options={[
                { key: "all", label: "All" },
                { key: "lab_report", label: "Reports" },
                { key: "prescription", label: "Prescriptions" },
                { key: "doc", label: "Documents" },
              ]}
              value={typeF}
              onChange={(k) => setTypeFilter(k as TypeF)}
            />
          </View>

          <View style={styles.filterRow}>
            {catOptions.length > 0 && (
              <Pressable
                onPress={() => setCatSheet(true)}
                style={[styles.catTrigger, catF.size > 0 && { borderColor: theme.fill }]}
              >
                <Text style={[styles.catTriggerText, catF.size > 0 && { color: theme.text, fontWeight: "600" }]} numberOfLines={1}>
                  {catTriggerLabel}
                </Text>
                <ChevronDown size={13} color={catF.size > 0 ? theme.text : NEUTRAL.textMuted} />
              </Pressable>
            )}
            <View style={styles.search}>
              <Search size={14} color={NEUTRAL.textMuted} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search"
                placeholderTextColor={NEUTRAL.textMuted}
                style={styles.searchInput}
              />
            </View>
          </View>

          <Text style={styles.count}>
            {filteredTotal} of {vaultTotal} records
            {privateCount ? ` · ${privateCount} private` : ""}
          </Text>

          {groups.length === 0 ? (
            <Text style={styles.empty}>No records match these filters.</Text>
          ) : (
            groups.map((g) => {
              const sc = g.list.filter(seen).length;
              const allShown = sc === g.list.length;
              const none = sc === 0;
              return (
                <View key={g.key} style={{ marginTop: 6 }}>
                  <View style={styles.grpHead}>
                    <Text style={styles.grpName}>{g.label}</Text>
                    <Text style={styles.grpCount}>{g.list.length}</Text>
                    <View style={{ flex: 1 }} />
                    <Pressable
                      onPress={() => onGroupPill(g.list, g.label)}
                      style={[styles.grpPill, allShown && { borderColor: theme.fill, backgroundColor: NEUTRAL.successBg }]}
                    >
                      <Text style={[styles.grpPillText, allShown && { color: theme.text }]}>
                        {allShown ? "All shared" : none ? "All hidden" : `${sc} / ${g.list.length} shared`}
                      </Text>
                    </Pressable>
                  </View>
                  {g.list.map((d) => {
                    const st = stateOf(d);
                    const tile = KIND_TILE[d.doc_type] || KIND_TILE.other;
                    const on = st !== "off";
                    return (
                      <View key={d.id} style={styles.rec}>
                        <View style={[styles.tile, { backgroundColor: tile.bg }]}>
                          <tile.Icon size={15} color={tile.fg} strokeWidth={2} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[styles.recTitle, st === "off" && { color: NEUTRAL.textSecondary }]} numberOfLines={1}>
                            {d.doc_type === "prescription" && d.doctor_label ? `Prescription · ${d.doctor_label}` : d.title}
                          </Text>
                          <Text style={styles.recSub} numberOfLines={1}>
                            {[fmtDate(dOf(d)), d.hospital_label].filter(Boolean).join(" · ")}
                            {d.private_by_rule ? " · by rule" : ""}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => onPill(d)}
                          disabled={busy}
                          style={[styles.pill, on && { borderColor: theme.fill, backgroundColor: NEUTRAL.successBg }]}
                        >
                          {st === "visit" ? (
                            <Clock size={10} color={theme.text} strokeWidth={2.4} />
                          ) : (
                            <View style={[styles.pillDot, { backgroundColor: on ? theme.fill : NEUTRAL.textMuted, opacity: on ? 1 : 0.5 }]} />
                          )}
                          <Text style={[styles.pillText, { color: on ? theme.text : NEUTRAL.textMuted }]}>
                            {st === "visit" ? "This visit" : st === "on" ? "Shared" : "Hidden"}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              );
            })
          )}

          {pagination && pagination.total_pages > 1 && (
            <View style={styles.pager}>
              <Pressable
                disabled={!pagination.has_previous}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                style={[styles.pagerBtn, !pagination.has_previous && styles.pagerBtnOff]}
              >
                <ChevronLeft size={15} color={NEUTRAL.textPrimary} />
                <Text style={styles.pagerBtnText}>Prev</Text>
              </Pressable>
              <Text style={styles.pagerLabel}>Page {pagination.page} of {pagination.total_pages}</Text>
              <Pressable
                disabled={!pagination.has_next}
                onPress={() => setPage((p) => p + 1)}
                style={[styles.pagerBtn, !pagination.has_next && styles.pagerBtnOff]}
              >
                <Text style={styles.pagerBtnText}>Next</Text>
                <ChevronRight size={15} color={NEUTRAL.textPrimary} />
              </Pressable>
            </View>
          )}

          <View style={styles.footRow}>
            <Lock size={11} color={NEUTRAL.textMuted} strokeWidth={2} />
            <Text style={styles.foot}>
              Locking a record only changes what a doctor sees when you share — it never removes it from your own view and never deletes it.
            </Text>
          </View>
        </View>
      ) : null}

      <ChoiceSheet
        visible={!!sheet}
        title={sheet?.title || ""}
        message={sheet?.message}
        actions={sheet?.actions || []}
        onClose={() => setSheet(null)}
      />

      <CategoryFilterSheet
        visible={catSheet}
        options={catOptions}
        selected={[...catF]}
        accent={theme.fill}
        onClose={() => setCatSheet(false)}
        onApply={applyCats}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: 60, alignItems: "center" },
  pad: { paddingHorizontal: 16, paddingBottom: 28 },
  intro: { fontSize: 12.5, lineHeight: 18, color: NEUTRAL.textSecondary, marginBottom: 12 },

  banner: { flexDirection: "row", gap: 8, backgroundColor: NEUTRAL.warningBg, borderRadius: 12, padding: 11, marginBottom: 12 },
  bannerText: { flex: 1, fontSize: 11.5, lineHeight: 17, color: "#5C3A08" },
  bannerStrong: { fontWeight: "700", color: "#3E2A08" },

  readout: {
    backgroundColor: NEUTRAL.surface, borderRadius: 14, padding: 14, marginBottom: 12,
    shadowColor: NEUTRAL.textPrimary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 1,
  },
  roLabel: { fontSize: 9.5, letterSpacing: 1.1, color: NEUTRAL.textMuted, fontWeight: "700" },
  roRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 5 },
  roNum: { fontSize: 19, fontWeight: "700", fontVariant: ["tabular-nums"] },
  roUnit: { fontSize: 12, color: NEUTRAL.textSecondary },
  roAct: { fontSize: 12, fontWeight: "600", marginLeft: 12 },
  roActMut: { color: NEUTRAL.textMuted },
  track: { flexDirection: "row", height: 6, borderRadius: 999, backgroundColor: NEUTRAL.surfaceAlt, overflow: "hidden", marginTop: 9 },
  trackFill: { height: "100%" },
  truncNote: { fontSize: 10.5, color: NEUTRAL.textMuted, marginTop: 8 },

  filterRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  catTrigger: {
    flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 0.5, borderColor: NEUTRAL.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: NEUTRAL.surface, maxWidth: "52%",
  },
  catTriggerText: { fontSize: 12, color: NEUTRAL.textSecondary },

  search: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 0.5, borderColor: NEUTRAL.border, borderRadius: 10, paddingHorizontal: 10, backgroundColor: NEUTRAL.surface },
  searchInput: { flex: 1, paddingVertical: 8, fontSize: 12.5, color: NEUTRAL.textPrimary },

  count: { fontSize: 11, color: NEUTRAL.textMuted, marginTop: 12 },
  empty: { fontSize: 12.5, color: NEUTRAL.textMuted, textAlign: "center", paddingVertical: 32 },

  grpHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 2 },
  grpName: { fontSize: 12, fontWeight: "700", color: NEUTRAL.textPrimary },
  grpCount: { fontSize: 10, color: NEUTRAL.textMuted, fontVariant: ["tabular-nums"] },
  grpPill: { borderWidth: 1, borderColor: NEUTRAL.border, borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10, backgroundColor: NEUTRAL.surface },
  grpPillText: { fontSize: 9.5, fontWeight: "600", color: NEUTRAL.textMuted },

  rec: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: NEUTRAL.surface, borderWidth: 0.5, borderColor: NEUTRAL.border, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12, marginBottom: 8 },
  tile: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  recTitle: { fontSize: 12.5, fontWeight: "500", color: NEUTRAL.textPrimary },
  recSub: { fontSize: 10.5, color: NEUTRAL.textMuted, marginTop: 2 },
  pill: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, minWidth: 76, borderWidth: 1, borderColor: NEUTRAL.border, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 10, backgroundColor: NEUTRAL.surface },
  pillDot: { width: 5, height: 5, borderRadius: 3 },
  pillText: { fontSize: 9.5, fontWeight: "600" },

  pager: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, marginBottom: 2 },
  pagerBtn: { flexDirection: "row", alignItems: "center", gap: 3, borderWidth: 0.5, borderColor: NEUTRAL.border, borderRadius: 9, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: NEUTRAL.surface },
  pagerBtnOff: { opacity: 0.4 },
  pagerBtnText: { fontSize: 12, fontWeight: "600", color: NEUTRAL.textPrimary },
  pagerLabel: { fontSize: 11.5, color: NEUTRAL.textMuted, fontVariant: ["tabular-nums"] },

  footRow: { flexDirection: "row", gap: 6, marginTop: 20 },
  foot: { flex: 1, fontSize: 10.5, lineHeight: 16, color: NEUTRAL.textMuted },

  // category sheet
});
