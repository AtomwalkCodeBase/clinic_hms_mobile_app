import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Modal, ActivityIndicator } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { SkeletonRow } from "@/components/Skeleton";
import {
  ArrowLeft, Plus, Search, Pill as PillIcon, FlaskConical, FileText, Receipt, ScanLine, BedDouble, Syringe, Stethoscope, Send,
  BadgeCheck, ChevronDown, AlertCircle, Lock, Unlock, Clock, Eye, Download,
} from "lucide-react-native";
import { Screen, EmptyState, ErrorBanner } from "@/components/Layout";
import { MessageDialog } from "@/components/MessageDialog";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { DetailSheet, DetailRow } from "@/components/DetailSheet";
import { ChoiceSheet, ChoiceAction } from "@/components/ChoiceSheet";
import { SelectField } from "@/components/SelectField";
import { InstantReviewSheet } from "@/components/InstantReviewSheet";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { familyAccentFor } from "@/theme/familyColors";
import type { LucideIcon } from "@/theme/icons";
import { apiErrorMessage } from "@/api/client";
import {
  getMyDocuments, getDocumentDetail, getDocumentCounts,
  getPrescriptions, getLabOrders, choosePrescription, chooseLabOrder,
  getRecordsPrivacy, toggleRecordPrivacy, revealForShare,
} from "@/api/portal";
import { useDocumentUpload } from "@/context/DocumentUploadContext";
import { useDocumentTypes } from "@/hooks/useDocumentTypes";
import { pickDocuments, downloadDataUri, openInExternalApp } from "@/utils/fileHelpers";
import { PatientDocument, PrescriptionOrder, LabOrder, RecordsPrivacyDoc } from "@/api/types";
import { AppStackParamList } from "@/navigation/types";

const PAGE = 15;

// ── date helpers ───────────────────────────────────────────────────────────
const ymKey = (iso?: string | null) => {
  const d = new Date(iso || "");
  return isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const ymLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};
const ymShort = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
};
const lastCompletedMonthKey = () => {
  const n = new Date();
  return ymKey(new Date(n.getFullYear(), n.getMonth() - 1, 1).toISOString());
};
const fmtShort = (iso?: string | null) => {
  const d = new Date(iso || "");
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};
const fmtLong = (iso?: string | null) => {
  const d = new Date(iso || "");
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
};

// Continuous list of months from the newest record (or now) back to the oldest.
function monthOptions(docs: PatientDocument[]) {
  const keys = docs
    .map((d) => ymKey(d.document_date || d.created_at))
    .filter(Boolean);
  const nowK = ymKey(new Date().toISOString());
  const newest = keys.reduce((a, b) => (a > b ? a : b), nowK);
  const oldest = keys.reduce((a, b) => (a < b ? a : b), nowK);
  const has = new Set(keys);
  let [y, m] = newest.split("-").map(Number);
  const [oy, om] = oldest.split("-").map(Number);
  const out: { key: string; has: boolean }[] = [];
  for (let i = 0; i < 48; i++) {
    const k = `${y}-${String(m).padStart(2, "0")}`;
    out.push({ key: k, has: has.has(k) });
    if (y < oy || (y === oy && m <= om)) break;
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return out;
}

// The category names come from the server (useDocumentTypes); this is only how each one looks in a list row.
const TYPE_META: Record<string, { tag: string; Icon: any; tint: string; ink: string }> = {
  prescription:        { tag: "RX",    Icon: PillIcon,     tint: "#EAE7FB", ink: "#4A3FB0" },
  lab_report:          { tag: "LAB",   Icon: FlaskConical, tint: "#F8EAC8", ink: "#8A5A12" },
  imaging_report:      { tag: "IMG",   Icon: ScanLine,     tint: "#E4EAF1", ink: "#3B4A5A" },
  discharge_summary:   { tag: "DISCH", Icon: BedDouble,    tint: "#E6EEF8", ink: "#27507A" },
  consultation_note:   { tag: "NOTE",  Icon: Stethoscope,  tint: "#E3F3EF", ink: "#1F6F63" },
  medical_bill:        { tag: "BILL",  Icon: Receipt,      tint: "#FBEFD9", ink: "#8A5A12" },
  vaccination_record:  { tag: "VAX",   Icon: Syringe,      tint: "#E8F5EC", ink: "#166534" },
  referral_letter:     { tag: "REF",   Icon: Send,         tint: "#EEE9F8", ink: "#4A3489" },
  medical_certificate: { tag: "CERT",  Icon: BadgeCheck,   tint: "#F8E7EC", ink: "#8A2B4A" },
  other:               { tag: "DOC",   Icon: FileText,     tint: "#E4EAF1", ink: "#3B4A5A" },
};
const metaFor = (t: string) => TYPE_META[t] || TYPE_META.other;

const IN_PROGRESS = new Set(["queued", "extracting", "classifying"]);
/** What to show instead of a type tag while a document is still being read, or if it could not be. */
const statusLabel = (s: string) => (s === "queued" ? "Waiting" : s === "extracting" ? "Reading…" : s === "classifying" ? "Classifying…" : "Couldn't be read");

// ── one row ────────────────────────────────────────────────────────────────
function RecRow({
  d, onPress, priv, onLock,
}: {
  d: PatientDocument;
  onPress: () => void;
  priv?: RecordsPrivacyDoc;
  onLock?: () => void;
}) {
  const meta = metaFor(d.doc_type);
  const Icon = meta.Icon;
  const title = d.title;
  const sub = d.uploaded_by === "staff" ? "Issued by your hospital" : d.confirmed ? "Verified by you" : "Uploaded by you";
  const inProgress = IN_PROGRESS.has(d.processing_status);
  const failed = d.processing_status === "failed";
  const pState = priv ? (priv.revealed_for_visit ? "visit" : priv.private ? "private" : "shared") : null;
  const LockIcon = pState === "shared" ? Unlock : Lock;
  return (
    <Pressable onPress={onPress} style={styles.rec}>
      <View style={[styles.bdg, { backgroundColor: meta.tint }]}>
        <Icon size={16} color={meta.ink} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.recT} numberOfLines={1}>{title}</Text>
        <Text style={styles.recS} numberOfLines={1}>{sub}</Text>
        {pState === "private" && <Text style={styles.privTag}>PRIVATE{priv?.private_by_rule ? " · BY RULE" : ""}</Text>}
        {pState === "visit" && (
          <View style={styles.visTag}>
            <Clock size={9} color={NEUTRAL.success} strokeWidth={2.6} />
            <Text style={styles.visTagT}>SHOWN THIS VISIT</Text>
          </View>
        )}
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        {inProgress || failed ? (
          <Text style={[styles.tag, failed && { color: NEUTRAL.warning, borderColor: NEUTRAL.warning }]}>{statusLabel(d.processing_status)}</Text>
        ) : (
          <Text style={styles.tag}>{meta.tag}</Text>
        )}
        <Text style={styles.recDt}>{fmtShort(d.document_date || d.created_at)}</Text>
        {!inProgress && !failed && priv && onLock && (
          <Pressable
            onPress={onLock}
            hitSlop={8}
            style={[styles.lockBtn, pState !== "shared" && styles.lockBtnOn]}
          >
            <LockIcon size={14} color={pState === "shared" ? NEUTRAL.textMuted : NEUTRAL.success} strokeWidth={2} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

// A small outlined action for the detail sheet's View/Download row — the
// previous version reused PrimaryButton/SecondaryButton (full-width pill
// CTAs meant for one-decision screens like Sign in), which stacked into an
// oversized, heavy block for what's really a compact "here's what you can
// do with this file" row. View and Download are equal-weight actions on
// the same file, so both get the same neutral styling — no reason one
// should read as more important than the other.
function FileAction({
  icon: Icon, label, loading, onPress,
}: {
  icon: LucideIcon;
  label: string;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [styles.fileAction, pressed && { opacity: 0.7 }]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={NEUTRAL.textSecondary} />
      ) : (
        <>
          <Icon size={14} color={NEUTRAL.textSecondary} strokeWidth={2.2} />
          <Text style={styles.fileActionText} numberOfLines={1}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}


// ── screen ─────────────────────────────────────────────────────────────────
export function MyDocumentsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "MyDocuments">>();
  const patientAwpid = route.params?.patientAwpid;
  const patientName = route.params?.patientName;
  const patientGender = route.params?.patientGender;
  const patientDob = route.params?.patientDob;
  // Same identity accent HealthScreen's family switcher and the other
  // detail screens reached from it (Vaccinations, Growth, Timeline,
  // Visits) use — this screen just never read the two params for it
  // before, so its header stayed plain neutral gray regardless of who
  // Rx & Reports was actually showing.
  const accent = patientGender ? familyAccentFor({ gender: patientGender, date_of_birth: patientDob ?? null }) : null;
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();

  const queryClient = useQueryClient();
  // Mutation/action failures (privacy toggle, review submit, upload, choosing
  // a pharmacy/lab option...) — separate from the documents query's own
  // load error below, same two-banner split this screen already had.
  const [actionError, setActionError] = useState("");
  // What happened to the files the patient just picked (some skipped / none could be uploaded). Shown as a
  // dialog: the error banner's Retry re-loads the reports list, which can never fix an upload.
  const [uploadNotice, setUploadNotice] = useState<{ title: string; message: string; tone: "success" | "error" } | null>(null);
  // Mirrors `error` for failures that happen while the detail sheet is open —
  // the main ErrorBanner renders behind that modal, so a failed view/download
  // there looked like "nothing happens" with no feedback at all.
  const [sheetError, setSheetError] = useState("");
  const [sheetMessage, setSheetMessage] = useState("");

  const [category, setCategory] = useState("");        // "" = every category, else a type code
  useEffect(() => {
    if (route.params?.instantDocId) {
      setInstantDocId(route.params.instantDocId);
      navigation.setParams({ instantDocId: undefined });
    }
  }, [route.params?.instantDocId, navigation]);
  const [q, setQ] = useState("");
  const [month, setMonth] = useState<string>(""); // "" until resolved, "ALL", or "YYYY-MM"
  const [visible, setVisible] = useState(PAGE);
  const [showPending, setShowPending] = useState(false);

  const [detail, setDetail] = useState<PatientDocument | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  // View and Download are two different actions on the same doc id — busyId
  // alone can't tell them apart, so both buttons lit up together no matter
  // which one was actually running.
  const [busyAction, setBusyAction] = useState<"view" | "download" | "save" | "remove" | "">("");
  const [choosing, setChoosing] = useState<string | null>(null);

  // ── shared-records privacy: the per-report lock (self only) ─────────────
  const privEnabled = !patientAwpid;
  // Distinct key from SharedRecordsPrivacyScreen's ["recordsPrivacy", page,
  // ...] — same endpoint, but called here with no pagination/filter params
  // for a different shape (the full unfiltered map), so it stays its own
  // cache entry rather than colliding with that screen's paginated one.
  const privacyQ = useQuery({
    queryKey: ["recordsPrivacyDocs"],
    queryFn: () => getRecordsPrivacy().catch(() => null),
    enabled: !patientAwpid,
  });
  const privMap = useMemo(
    () => new Map((privacyQ.data?.documents ?? []).map((x) => [x.id, x])),
    [privacyQ.data]
  );
  const privSession = privacyQ.data?.active_session ?? null;
  const [lockSheet, setLockSheet] = useState<{ title: string; message?: string; actions: ChoiceAction[] } | null>(null);

  async function privToggle(docId: number, makePrivate: boolean) {
    try {
      await toggleRecordPrivacy(docId, makePrivate);
      privacyQ.refetch();
    } catch (err) {
      setActionError(apiErrorMessage(err, "Couldn't update."));
    }
  }
  async function privReveal(docId: number, scope: "visit" | "always" | "conceal") {
    if (!privSession) return;
    try {
      await revealForShare(privSession.token, [docId], scope);
      privacyQ.refetch();
    } catch (err) {
      setActionError(apiErrorMessage(err, "Couldn't update."));
    }
  }
  function onLock(d: PatientDocument) {
    const p = privMap.get(d.id);
    const name = d.title;
    if (!p) return;
    if (p.revealed_for_visit) {
      setLockSheet({
        title: "Hide this again now?",
        message: `${name} would hide by itself when the visit ends.`,
        actions: [
          { label: "Cancel", cancel: true },
          { label: "Hide now", primary: true, onPress: () => privReveal(d.id, "conceal") },
        ],
      });
    } else if (p.private_by_rule) {
      setLockSheet({
        title: "Hidden by a rule",
        message: `${name} is hidden by a category, kind or "hide everything" rule. Change those in Shared records privacy.`,
        actions: [
          ...(privSession
            ? [{ label: "Just this visit", sub: "Reveal only for the doctor viewing now", primary: true, onPress: () => privReveal(d.id, "visit") } as ChoiceAction]
            : []),
          { label: "Close", cancel: true },
        ],
      });
    } else if (!p.private) {
      setLockSheet({
        title: "Make this private?",
        message: `${name} won't be shown to doctors when you share your records. You'll still see it here.`,
        actions: [
          { label: "Cancel", cancel: true },
          { label: "Make private", cancel: true, onPress: () => privToggle(d.id, true) },
        ],
      });
    } else if (privSession) {
      setLockSheet({
        title: "A doctor is viewing now",
        message: `Show ${name} to ${privSession.requester_label || "the doctor"} —`,
        actions: [
          { label: "Just this visit", sub: "Hides again when the visit ends", primary: true, onPress: () => privReveal(d.id, "visit") },
          { label: "Always", sub: "Stays visible for future visits too", onPress: () => privToggle(d.id, false) },
          { label: "Cancel", cancel: true },
        ],
      });
    } else {
      setLockSheet({
        title: "Show this to doctors again?",
        message: `Doctors you share with will be able to see ${name}.`,
        actions: [
          { label: "Cancel", cancel: true },
          { label: "Show", primary: true, onPress: () => privToggle(d.id, false) },
        ],
      });
    }
  }
  const privateCount = useMemo(
    () => [...privMap.values()].filter((x) => x.private && !x.revealed_for_visit).length,
    [privMap],
  );
  const [addOpen, setAddOpen] = useState(false);
  const { startUpload } = useDocumentUpload();
  const { types, labelOf } = useDocumentTypes();
  // The one document just added with "+": followed until it is read, then confirmed (or changed) in a sheet.
  const [instantDocId, setInstantDocId] = useState<number | null>(route.params?.instantDocId ?? null);

  // Search, the month picker, and the category-panel counts below all work
  // over the FULL document set — they're client-side, not server-driven —
  // so this still needs every document eventually, unlike a screen that
  // can get away with only ever showing what's been explicitly paged in.
  // What was actually broken wasn't "loads everything," it was "does it
  // sequentially, one page at a time, and shows nothing until the last one
  // lands" — with 100 files at 25/page that's 4 blocking round-trips in a
  // row. The fix keeps "eventually everything" but makes the first page
  // its own fast query (instant paint, matches what PAGE=15's own "Load
  // more" button in the list below shows anyway) and fetches whatever
  // pages remain in PARALLEL, in the background, merging in once they
  // land — nothing here waits on that second query to render.
  const docsFirstQ = useQuery({
    queryKey: ["documents", patientAwpid, "page1"],
    queryFn: () => getMyDocuments(1, patientAwpid),
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
    enabled: !!firstPage && totalPages > 1,
  });
  const docs = useMemo(() => {
    // Offset pagination (page 1, then pages 2..N fetched afterward) isn't stable against
    // concurrent inserts: a new upload shifts everything after it by one position, so a
    // document already in firstPage.results can reappear in docsRestQ.data at the shifted
    // offset. De-dupe by id (keep the first occurrence) rather than rendering it twice.
    const combined = [...(firstPage?.results ?? []), ...(totalPages > 1 ? docsRestQ.data ?? [] : [])];
    const seen = new Set<number>();
    return combined.filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true)));
  }, [firstPage, docsRestQ.data, totalPages]);
  // "Ready to actually use" — the first page has landed, so there's real
  // content and search/filter/months already work over what's loaded so
  // far. Any remaining pages fill in silently afterward (backgroundLoading
  // below), same as any other query going stale and refreshing quietly.
  const isInitialLoading = !firstPage;
  const loadError = (docsFirstQ.error && apiErrorMessage(docsFirstQ.error)) || (docsRestQ.error && apiErrorMessage(docsRestQ.error)) || "";
  const error = loadError || actionError;

  // Two independent, soft-failing queries — a failure in either never blocks
  // the documents list, same as the old try/catch(() => [])-per-call.
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

  // Per-category numbers for the dropdown (every category, zeros included) and how many uploads still wait for review.
  const countsQ = useQuery({ queryKey: ["documentCounts", patientAwpid], queryFn: () => getDocumentCounts(patientAwpid) });
  const counts = countsQ.data;

  const load = useCallback(async () => {
    await Promise.all([
      docsFirstQ.refetch(),
      totalPages > 1 ? docsRestQ.refetch() : Promise.resolve(),
      pendingRxQ.refetch(),
      pendingLabQ.refetch(),
      countsQ.refetch(),
    ]);
  }, [docsFirstQ.refetch, docsRestQ.refetch, totalPages, pendingRxQ.refetch, pendingLabQ.refetch, countsQ.refetch]);
  const refetchAll = useCallback(async () => {
    await Promise.all([load(), privacyQ.refetch()]);
  }, [load, privacyQ.refetch]);
  useRefreshOnFocus([docsFirstQ, docsRestQ, pendingRxQ, pendingLabQ, privacyQ, countsQ]);
  const { refreshing: pulling, onRefresh: pullRefresh } = usePullToRefresh(refetchAll);
  const isFetchingAny = docsFirstQ.isFetching || docsRestQ.isFetching || pendingRxQ.isFetching || pendingLabQ.isFetching;

  const monthOpts = useMemo(() => monthOptions(docs), [docs]);

  // Land on the last completed month that has records (else newest with data,
  // else "All"). Runs once when records first arrive.
  useEffect(() => {
    if (month || !monthOpts.length) return;
    const lc = lastCompletedMonthKey();
    const pick =
      monthOpts.find((o) => o.key === lc && o.has) ||
      monthOpts.find((o) => o.key <= lc && o.has) ||
      monthOpts.find((o) => o.has);
    setMonth(pick ? pick.key : "ALL");
  }, [monthOpts, month]);

  useEffect(() => { setVisible(PAGE); }, [category, q, month]);

  const categoryOptions = useMemo(
    () => types.map((t) => ({ value: t.code, label: t.label, meta: String(counts?.by_type?.[t.code] ?? 0) })),
    [types, counts],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return docs
      .filter((d) => !category || d.doc_type === category)
      .filter((d) =>
        !needle ||
        [d.title, d.file_name, d.public_document_id]
          .filter(Boolean).join(" ").toLowerCase().includes(needle))
      .filter((d) => (!month || month === "ALL" ? true : ymKey(d.document_date || d.created_at) === month))
      .sort((a, b) => (b.document_date || b.created_at).localeCompare(a.document_date || a.created_at));
  }, [docs, category, q, month]);

  const shown = filtered.slice(0, visible);

  const groups = useMemo(() => {
    if (month !== "ALL") return [{ key: "flat", label: "", list: shown }];
    const map = new Map<string, PatientDocument[]>();
    shown.forEach((d) => {
      const k = ymKey(d.document_date || d.created_at) || "0000-00";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(d);
    });
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([k, list]) => ({ key: k, label: ymLabel(k), list }));
  }, [shown, month]);

  // ── actions ──────────────────────────────────────────────────────────────
  // Hands off to the OS's own "open with" chooser (openInExternalApp) —
  // same as tapping a PDF attachment in Gmail or a Files app. This used to
  // render read-only inside our own WebView so a patient couldn't export a
  // copy from "View" (Download was the one sanctioned export path); that
  // restriction has been dropped on purpose, so View and Download now both
  // let the file leave the app — they just differ in whether it lands in
  // whatever app the user picks (View, cache-only) or a persisted save
  // (Download, see openFile below).
  async function viewFile(id: number) {
    setBusyId(id);
    setBusyAction("view");
    setSheetError("");
    setSheetMessage("");
    try {
      const full = await getDocumentDetail(id);
      const src = (full as any).file_data as string;
      if (!src) {
        // A handful of demo/seed rows carry no actual file (they only exist
        // to back ExtractedLabValue test data) — signed_url() and the data:
        // fallback both quietly return "" for a blank key rather than
        // raising, so this is the one place that has to catch it before
        // handing off to a chooser with nothing to open.
        setSheetError("This document doesn't have a file to view.");
        return;
      }
      await openInExternalApp(full.file_name || full.title || "document", src, full.mime_type);
    } catch (err) {
      const msg = apiErrorMessage(err, "Couldn't open the file.");
      setActionError(msg);
      setSheetError(msg);
    } finally {
      setBusyId(null);
      setBusyAction("");
    }
  }

  async function openFile(id: number) {
    setBusyId(id);
    setBusyAction("download");
    setSheetError("");
    setSheetMessage("");
    try {
      const full = await getDocumentDetail(id, { download: true });
      const src = (full as any).file_data as string;
      if (!src) {
        setSheetError("This document doesn't have a file to download.");
        return;
      }
      const outcome = await downloadDataUri(full.file_name || full.title || "document", src);
      setSheetMessage(outcome === "saved" ? "Downloaded to your device." : "Shared.");
    } catch (err) {
      const msg = apiErrorMessage(err, "Couldn't open the file.");
      setActionError(msg);
      setSheetError(msg);
    } finally {
      setBusyId(null);
      setBusyAction("");
    }
  }

  // Add Document: one file, uploaded on the fast lane. It is then followed in a sheet until it has been read, where the
  // patient confirms the type or changes it. (For many files at once there is the Bulk Upload screen.)
  async function pickAndUpload() {
    try {
      const files = await pickDocuments(false);
      if (!files.length) return;
      const f = files[0];
      const outcome = await startUpload(
        [{ name: f.name || "upload", mimeType: f.mimeType || "application/octet-stream", size: f.size || 0, uri: f.uri }],
        "instant",
        patientAwpid,
      );
      setAddOpen(false);
      if (outcome.status !== "started") {
        setUploadNotice({ title: outcome.status === "busy" ? "Upload in progress" : "Can't upload", message: outcome.reason, tone: "error" });
        return;
      }
      setInstantDocId(outcome.documentIds[0] ?? null);
    } catch (err) {
      setAddOpen(false);
      setUploadNotice({ title: "Can't upload", message: apiErrorMessage(err, "Couldn't upload that file."), tone: "error" });
    }
  }

  async function choose(kind: "rx" | "lab", item: PrescriptionOrder | LabOrder, ch: "in_house" | "outside") {
    setChoosing(`${kind}${item.id}`);
    try {
      if (kind === "rx") {
        const r = item as PrescriptionOrder;
        await choosePrescription({
          tenant_db: r.tenant_db, prescription_id: r.id, patient_choice: ch,
          payment_preference: ch === "in_house" ? "pay_at_pharmacy" : undefined,
        });
      } else {
        const l = item as LabOrder;
        await chooseLabOrder({ tenant_db: l.tenant_db, request_id: l.id, patient_choice: ch });
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
  const monthFiltered = !!month && month !== "ALL";

  return (
    <Screen onRefresh={pullRefresh} refreshing={pulling} backgroundLoading={isFetchingAny && !pulling}>
      {/* header */}
      <View style={styles.hdr}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={[styles.back, accent && { backgroundColor: accent.bg }]}>
          <ArrowLeft size={19} color={accent?.text ?? NEUTRAL.textPrimary} strokeWidth={2.2} />
        </Pressable>
        <Text style={[styles.hdrTitle, accent && { color: accent.text }]}>
          {patientName ? `My Documents — ${patientName}` : "My Documents"}
        </Text>
        <Pressable onPress={() => setAddOpen(true)} hitSlop={10} style={[styles.addBtn, { backgroundColor: accent?.fill ?? theme.fill }]}>
          <Plus size={15} color={accent?.on ?? theme.on} strokeWidth={2.8} />
        </Pressable>
      </View>
      <Text style={styles.subline}>
        {counts?.total ?? docs.length} document{(counts?.total ?? docs.length) === 1 ? "" : "s"}
        {docs.length ? ` · newest ${fmtShort(docs[0]?.document_date || docs[0]?.created_at)}` : ""}
      </Text>

      {/* uploads still waiting for the patient to confirm their type */}
      {(counts?.awaiting_review ?? 0) > 0 && (
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
      {privEnabled && privMap.size > 0 && (
        <Pressable style={styles.privLine} onPress={() => navigation.navigate("SharedRecordsPrivacy")}>
          <Lock size={11} color={NEUTRAL.textMuted} strokeWidth={2} />
          <Text style={styles.privLineT}>
            <Text style={styles.privLineB}>{privateCount}</Text> of {privMap.size} report{privMap.size === 1 ? "" : "s"} private
          </Text>
          <Text style={[styles.privLineGo, { color: theme.text }]}>Shared records privacy ›</Text>
        </Pressable>
      )}

      {!!error && <ErrorBanner message={error} onRetry={load} />}

      {/* category */}
      <SelectField
        label="Category"
        value={category}
        onChange={(v) => setCategory(v)}
        options={categoryOptions}
        placeholder={`All categories${counts ? ` (${counts.total})` : ""}`}
        clearLabel="All categories"
      />

      {/* search */}
      <View style={styles.srch}>
        <Search size={14} color={NEUTRAL.textMuted} strokeWidth={2.2} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search name, hospital, ID"
          placeholderTextColor={NEUTRAL.textMuted}
          style={styles.srchIn}
        />
      </View>

      {/* month filter */}
      <SelectField
        label="Filter by month"
        value={month === "ALL" ? "" : month}
        onChange={(v) => setMonth(v || "ALL")}
        options={monthOpts.map((o) => ({ value: o.key, label: ymLabel(o.key), meta: o.has ? undefined : "No reports" }))}
        placeholder="All months"
        clearLabel="All months"
      />

      {/* pending pharmacy / lab choices */}
      {pendingCount > 0 && (
        <View style={styles.pend}>
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
      )}

      {/* list */}
      {isInitialLoading ? (
        <View>
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </View>
      ) : (
        <>
          {filtered.length === 0 ? (
            <EmptyState
              text={
                q ? `Nothing matches "${q}".`
                : monthFiltered ? `No records in ${ymLabel(month)}.`
                : category ? "Nothing in this category yet."
                : "No records yet. Tap + to add one."
              }
            />
          ) : (
            groups.map((g) => (
              <View key={g.key}>
                {!!g.label && <Text style={styles.grpLabel}>{g.label}</Text>}
                {g.list.map((d) => (
                  <RecRow
                    key={d.id}
                    d={d}
                    onPress={() => { setSheetError(""); setSheetMessage(""); setDetail(d); }}
                    priv={privEnabled ? privMap.get(d.id) : undefined}
                    onLock={privEnabled ? () => onLock(d) : undefined}
                  />
                ))}
              </View>
            ))
          )}

          {filtered.length > visible && (
            <SecondaryButton
              label={`Load ${Math.min(PAGE, filtered.length - visible)} more`}
              onPress={() => setVisible((v) => v + PAGE)}
              style={{ marginTop: 4 }}
            />
          )}
          {filtered.length > 0 && (
            <Text style={styles.count}>
              Showing {Math.min(visible, filtered.length)} of {filtered.length}
              {monthFiltered ? ` in ${ymShort(month)}` : ""}
            </Text>
          )}
        </>
      )}

      {/* detail sheet */}
      <DetailSheet
        visible={!!detail}
        onClose={() => { setDetail(null); setSheetError(""); setSheetMessage(""); }}
        title={detail ? detail.title : ""}
      >
        {detail && (
          <>
            <DetailRow label="Type" value={labelOf(detail.doc_type)} />
            {detail.confirmed && <DetailRow label="Verified" value="You confirmed this type" />}
            <DetailRow label="Date" value={fmtLong(detail.document_date || detail.created_at)} />
            <DetailRow label="Source" value={detail.uploaded_by === "staff" ? "Issued by your hospital" : "Uploaded by you"} />
            {!!detail.public_document_id && <DetailRow label="Document ID" value={detail.public_document_id} />}
            {detail.processing_status !== "completed" && detail.processing_status !== "review_required" && (
              <DetailRow
                label="Status"
                value={detail.processing_status === "failed" ? (detail.error || "Couldn't be processed") : statusLabel(detail.processing_status)}
                valueColor={detail.processing_status === "failed" ? NEUTRAL.warning : undefined}
              />
            )}
            <View style={{ marginTop: 14 }}>
              <View style={styles.actionRow}>
                <FileAction
                  icon={Eye}
                  label={detail.handwritten_doc_id ? "View prescription" : "View"}
                  loading={busyId === detail.id && busyAction === "view"}
                  onPress={() => viewFile(detail.id)}
                />
                <FileAction
                  icon={Download}
                  label={detail.handwritten_doc_id ? "Download prescription" : "Download"}
                  loading={busyId === detail.id && busyAction === "download"}
                  onPress={() => openFile(detail.id)}
                />
              </View>
              {!!detail.handwritten_doc_id && (
                <View style={styles.actionRow}>
                  <FileAction
                    icon={Eye}
                    label="View handwritten"
                    loading={busyId === detail.handwritten_doc_id && busyAction === "view"}
                    onPress={() => viewFile(detail.handwritten_doc_id!)}
                  />
                  <FileAction
                    icon={Download}
                    label="Download handwritten"
                    loading={busyId === detail.handwritten_doc_id && busyAction === "download"}
                    onPress={() => openFile(detail.handwritten_doc_id!)}
                  />
                </View>
              )}
              {!!sheetError && <Text style={styles.sheetErrorText}>{sheetError}</Text>}
              {!!sheetMessage && <Text style={styles.sheetSuccessText}>{sheetMessage}</Text>}
            </View>
          </>
        )}
      </DetailSheet>

      {/* add sheet */}
      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <Pressable style={styles.mBackdrop} onPress={() => setAddOpen(false)}>
          <View style={[styles.mSheet, { paddingBottom: Math.max(22, insets.bottom + 12) }]} onStartShouldSetResponder={() => true}>
            <View style={styles.handle} />
            <Text style={styles.mTitle}>Add Document</Text>
            <Text style={styles.mSub}>We'll read it, suggest a type, and you confirm it.</Text>
            <View style={{ gap: 8, marginTop: 6 }}>
              <PrimaryButton label="Choose a file" onPress={pickAndUpload} />
              <Text style={styles.mHint}>One PDF or photo. To add several at once, use Bulk Upload on the Home screen.</Text>
              <SecondaryButton
                label="Take photo / Scan QR"
                onPress={() => { setAddOpen(false); navigation.navigate("DocumentCapture", { mode: "instant", ...(patientAwpid ? { patientAwpid } : {}) }); }}
              />
              <Pressable onPress={() => setAddOpen(false)} style={{ alignItems: "center", paddingVertical: 8 }}>
                <Text style={styles.mCancel}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      <ChoiceSheet
        visible={!!lockSheet}
        title={lockSheet?.title || ""}
        message={lockSheet?.message}
        actions={lockSheet?.actions || []}
        onClose={() => setLockSheet(null)}
      />

      <InstantReviewSheet
        documentId={instantDocId}
        patientAwpid={patientAwpid}
        onClose={() => { setInstantDocId(null); load(); }}
        onSubmitted={(type) => {
          setInstantDocId(null);
          queryClient.invalidateQueries({ queryKey: ["documents"] });
          queryClient.invalidateQueries({ queryKey: ["documentCounts"] });
          setUploadNotice({ title: "Added to My Documents", message: `Saved as ${labelOf(type)}.`, tone: "success" });
        }}
      />

      <MessageDialog
        visible={!!uploadNotice}
        title={uploadNotice?.title ?? ""}
        message={uploadNotice?.message}
        buttonLabel="OK"
        tone={uploadNotice?.tone ?? "error"}
        onDismiss={() => setUploadNotice(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hdr: { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 4 },
  back: { width: 30, height: 30, borderRadius: 15, backgroundColor: NEUTRAL.surfaceAlt, alignItems: "center", justifyContent: "center" },
  hdrTitle: { flex: 1, fontSize: 17, fontWeight: "800", color: NEUTRAL.textPrimary },
  addBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  subline: { fontSize: 10.5, color: NEUTRAL.textMuted, marginBottom: 12, marginTop: 2 },

  privBanner: { flexDirection: "row", gap: 8, backgroundColor: NEUTRAL.warningBg, borderRadius: 12, padding: 10, marginBottom: 10 },
  privBannerT: { flex: 1, fontSize: 11, lineHeight: 16, color: "#5C3A08" },
  privBannerB: { fontWeight: "700", color: "#3E2A08" },
  privLine: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  privLineT: { flex: 1, fontSize: 11, color: NEUTRAL.textMuted },
  privLineB: { fontWeight: "700", color: NEUTRAL.textPrimary },
  privLineGo: { fontSize: 11, fontWeight: "600" },
  privTag: { fontSize: 8, fontWeight: "700", letterSpacing: 0.4, color: "#4A3489", backgroundColor: "#ECE7F7", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginTop: 4, alignSelf: "flex-start" },
  visTag: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4, alignSelf: "flex-start" },
  visTagT: { fontSize: 8, fontWeight: "700", letterSpacing: 0.4, color: NEUTRAL.success },
  lockBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: NEUTRAL.border, alignItems: "center", justifyContent: "center", backgroundColor: NEUTRAL.surface },
  lockBtnOn: { borderColor: NEUTRAL.success, backgroundColor: NEUTRAL.successBg },

  reviewBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: NEUTRAL.warningBg, borderRadius: 12, padding: 11, marginBottom: 12 },
  reviewBannerT: { flex: 1, fontSize: 11.5, lineHeight: 16, color: "#5C3A08" },
  reviewBannerB: { fontWeight: "700", color: "#3E2A08" },
  reviewBannerGo: { fontSize: 11.5, fontWeight: "700" },

  srch: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: NEUTRAL.surface, borderWidth: 0.5, borderColor: NEUTRAL.border, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 8, marginBottom: 10 },
  srchIn: { flex: 1, fontSize: 12.5, color: NEUTRAL.textPrimary, padding: 0 },


  pend: { backgroundColor: NEUTRAL.warningBg, borderRadius: 12, padding: 10, marginBottom: 12 },
  pendHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  pendTxt: { flex: 1, fontSize: 11.5, fontWeight: "700", color: NEUTRAL.warning },
  pendItem: { backgroundColor: NEUTRAL.surface, borderRadius: 10, padding: 10 },
  pendItemT: { fontSize: 11.5, fontWeight: "600", color: NEUTRAL.textPrimary, marginBottom: 8 },
  pendBtns: { flexDirection: "row", gap: 6 },

  grpLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", color: NEUTRAL.textMuted, marginTop: 6, marginBottom: 8 },

  rec: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: NEUTRAL.surface, borderWidth: 0.5, borderColor: NEUTRAL.border, borderRadius: 13, padding: 11, marginBottom: 8 },
  bdg: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  recT: { fontSize: 12.5, fontWeight: "600", color: NEUTRAL.textPrimary },
  recS: { fontSize: 10.5, color: NEUTRAL.textMuted, marginTop: 2 },
  recDt: { fontSize: 10, color: NEUTRAL.textMuted },
  tag: { fontSize: 8.5, fontWeight: "700", letterSpacing: 0.4, color: NEUTRAL.textSecondary, borderWidth: 0.5, borderColor: NEUTRAL.border, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },

  count: { textAlign: "center", fontSize: 10, color: NEUTRAL.textMuted, marginTop: 10, marginBottom: 4 },

  sheetErrorText: { fontSize: 12, color: NEUTRAL.danger, marginTop: 8, lineHeight: 16 },
  sheetSuccessText: { fontSize: 12, color: NEUTRAL.success, marginTop: 8, lineHeight: 16 },

  actionRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  fileAction: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderWidth: 1, borderColor: NEUTRAL.border, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 8,
    backgroundColor: NEUTRAL.surface,
  },
  fileActionText: { fontSize: 12, fontWeight: "600", color: NEUTRAL.textSecondary },

  mBackdrop: { flex: 1, backgroundColor: "rgba(12,35,64,0.4)", justifyContent: "flex-end" },
  mSheet: { backgroundColor: NEUTRAL.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 22 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: NEUTRAL.border, alignSelf: "center", marginBottom: 12 },
  mTitle: { fontSize: 14.5, fontWeight: "700", color: NEUTRAL.textPrimary },
  mSub: { fontSize: 11.5, color: NEUTRAL.textMuted, marginTop: 4, marginBottom: 8 },
  mHint: { fontSize: 10.5, color: NEUTRAL.textMuted, textAlign: "center", marginTop: -2, marginBottom: 2, paddingHorizontal: 8 },
  mCancel: { fontSize: 12.5, fontWeight: "600", color: NEUTRAL.textSecondary },
});
