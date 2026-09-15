import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Modal, ActivityIndicator, Linking } from "react-native";
import { useFocusEffect, useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft, Plus, Search, Pill as PillIcon, FlaskConical, FileText, ShieldCheck,
  ChevronDown, ChevronRight, AlertCircle, Lock, Unlock, Clock, Check, Sparkles,
  Eye, Download, Trash2,
} from "lucide-react-native";
import { Screen, EmptyState, ErrorBanner } from "@/components/Layout";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { DetailSheet, DetailRow } from "@/components/DetailSheet";
import { ChoiceSheet, ChoiceAction } from "@/components/ChoiceSheet";
import { DateField } from "@/components/DateField";
import { SelectField } from "@/components/SelectField";
import { CategoryFilterSheet } from "@/components/CategoryFilterSheet";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import type { LucideIcon } from "@/theme/icons";
import { useReconnectRefetch } from "@/hooks/useReconnectRefetch";
import { apiErrorMessage } from "@/api/client";
import {
  getMyDocuments, getDocumentDetail, uploadDocument, deleteDocument, fileReviewDocument,
  getPrescriptions, getLabOrders, choosePrescription, chooseLabOrder,
  getRecordsPrivacy, toggleRecordPrivacy, revealForShare,
} from "@/api/portal";

// Mirrors core/report_types.py's panel catalogue — the review form's category
// picker when a lab report's panel couldn't be determined.
const REVIEW_CATEGORY_LABELS: Record<string, string> = {
  cbc: "Complete Blood Count", lipid: "Lipid Profile", lft: "Liver Function Test",
  kft: "Kidney Function Test", thyroid: "Thyroid Profile", diabetes: "Blood Sugar & HbA1c",
  urine: "Urine Routine", electrolytes: "Serum Electrolytes", vitamin: "Vitamin & Mineral",
  inflammation: "Inflammatory Markers", cardiac: "Cardiac Markers", coagulation: "Coagulation Profile",
  hormone: "Hormone Panel", infection: "Infection Serology", culture: "Culture & Sensitivity",
};
// A row uploaded before `review_needs` existed has none stored — fall back to
// the old assumption (type unknown) so it still renders something sensible.
const needsOf = (d: PatientDocument): string[] =>
  d.review_needs && d.review_needs.length ? d.review_needs : ["kind"];
import { pickDocuments, fileToDataUri, downloadDataUri } from "@/utils/fileHelpers";
import { PatientDocument, PrescriptionOrder, LabOrder, RecordsPrivacyDoc, RecordsPrivacyPayload } from "@/api/types";
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
    .filter((d) => d.review_state !== "unsorted")
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

type TypeKey = "prescription" | "lab_report" | "scan" | "discharge_summary" | "consult_note" | "other";
const TYPE_META: Record<string, { tag: string; label: string; Icon: any; tint: string; ink: string }> = {
  prescription:      { tag: "RX",   label: "Prescription",      Icon: PillIcon,      tint: "#EAE7FB", ink: "#4A3FB0" },
  lab_report:        { tag: "LAB",  label: "Lab report",        Icon: FlaskConical, tint: "#F8EAC8", ink: "#8A5A12" },
  scan:              { tag: "SCAN", label: "Scan / imaging",    Icon: FileText,     tint: "#E4EAF1", ink: "#3B4A5A" },
  discharge_summary: { tag: "DISCH",label: "Discharge summary", Icon: FileText,     tint: "#E4EAF1", ink: "#3B4A5A" },
  other:             { tag: "DOC",  label: "Document",          Icon: FileText,     tint: "#E4EAF1", ink: "#3B4A5A" },
};
const metaFor = (t: string) => TYPE_META[t] || TYPE_META.other;

// ── one row ────────────────────────────────────────────────────────────────
function RecRow({
  d, review, onPress, priv, onLock,
}: {
  d: PatientDocument;
  review?: boolean;
  onPress: () => void;
  priv?: RecordsPrivacyDoc;
  onLock?: () => void;
}) {
  const meta = metaFor(d.doc_type);
  const Icon = meta.Icon;
  const title = d.doc_type === "prescription" && d.doctor_label ? `Prescription · ${d.doctor_label}` : d.title;
  const sub = d.hospital_label || (d.uploaded_by === "staff" ? "Issued by your hospital" : "Uploaded by you");
  const verified = d.verification_status === "verified";
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
        {review ? (
          <Text style={styles.reviewTag}>REVIEW</Text>
        ) : verified ? (
          <View style={styles.vf}>
            <ShieldCheck size={11} color={NEUTRAL.success} strokeWidth={2.4} />
            <Text style={styles.vfT}>Verified</Text>
          </View>
        ) : (
          <Text style={styles.tag}>{meta.tag}</Text>
        )}
        <Text style={styles.recDt}>{fmtShort(d.document_date || d.created_at)}</Text>
        {!review && priv && onLock && (
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
export function RxReportsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "RxReports">>();
  const patientAwpid = route.params?.patientAwpid;
  const patientName = route.params?.patientName;
  const { theme } = useAppTheme();

  const [docs, setDocs] = useState<PatientDocument[]>([]);
  const [pendingRx, setPendingRx] = useState<PrescriptionOrder[]>([]);
  const [pendingLab, setPendingLab] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Mirrors `error` for failures that happen while the detail sheet is open —
  // the main ErrorBanner renders behind that modal, so a failed view/download
  // there looked like "nothing happens" with no feedback at all.
  const [sheetError, setSheetError] = useState("");
  const [sheetMessage, setSheetMessage] = useState("");

  const [tab, setTab] = useState<"all" | "prescription" | "lab_report" | "other">("all");
  const [q, setQ] = useState("");
  const [month, setMonth] = useState<string>(""); // "" until resolved, "ALL", or "YYYY-MM"
  const [catF, setCatF] = useState<Set<string>>(new Set()); // lab panel filter — only meaningful in catMode
  const [showCatSheet, setShowCatSheet] = useState(false);
  const [visible, setVisible] = useState(PAGE);
  const [showPending, setShowPending] = useState(false);

  const [detail, setDetail] = useState<PatientDocument | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  // View and Download are two different actions on the same doc id — busyId
  // alone can't tell them apart, so both buttons lit up together no matter
  // which one was actually running.
  const [busyAction, setBusyAction] = useState<"view" | "download" | "">("");
  const [choosing, setChoosing] = useState<string | null>(null);

  // ── review form (unsorted rows) — ask only for what review_needs lists ───
  const [reviewType, setReviewType] = useState<string>("");
  const [reviewCat, setReviewCat] = useState<string>("");
  const [reviewDate, setReviewDate] = useState<string>("");
  useEffect(() => {
    if (!detail) return;
    setReviewType(needsOf(detail).includes("kind") ? "" : detail.doc_type);
    setReviewCat((detail.report_categories || [])[0] || "");
    setReviewDate((detail.document_date || "").slice(0, 10));
  }, [detail?.id]);

  // ── shared-records privacy: the per-report lock (self only) ─────────────
  const privEnabled = !patientAwpid;
  const [privMap, setPrivMap] = useState<Map<number, RecordsPrivacyDoc>>(new Map());
  const [privSession, setPrivSession] = useState<RecordsPrivacyPayload["active_session"]>(null);
  const [lockSheet, setLockSheet] = useState<{ title: string; message?: string; actions: ChoiceAction[] } | null>(null);

  const loadPrivacy = useCallback(async () => {
    if (patientAwpid) return;
    try {
      const p = await getRecordsPrivacy();
      setPrivMap(new Map(p.documents.map((x) => [x.id, x])));
      setPrivSession(p.active_session);
    } catch {
      /* privacy is non-blocking on this screen */
    }
  }, [patientAwpid]);

  async function privToggle(docId: number, makePrivate: boolean) {
    try {
      await toggleRecordPrivacy(docId, makePrivate);
      loadPrivacy();
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't update."));
    }
  }
  async function privReveal(docId: number, scope: "visit" | "always" | "conceal") {
    if (!privSession) return;
    try {
      await revealForShare(privSession.token, [docId], scope);
      loadPrivacy();
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't update."));
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
          { label: "Make private", primary: true, onPress: () => privToggle(d.id, true) },
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
  const [uploading, setUploading] = useState(false);
  const [uploadReport, setUploadReport] = useState<
    { filed: number; review: number; notMedical: number; unreadable: number; failed: number; lines: string[] } | null
  >(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let page = 1;
      const all: PatientDocument[] = [];
      for (let i = 0; i < 40; i++) {
        const { results, pagination } = await getMyDocuments(page, patientAwpid);
        all.push(...results);
        if (!pagination?.has_next) break;
        page += 1;
      }
      setDocs(all);
      try {
        const [rx, lab] = await Promise.all([
          getPrescriptions(patientAwpid).catch(() => [] as PrescriptionOrder[]),
          getLabOrders(patientAwpid).catch(() => [] as LabOrder[]),
        ]);
        setPendingRx(rx.filter((r) => r.patient_choice === "pending"));
        setPendingLab(lab.filter((l) => l.patient_choice === "pending"));
      } catch { /* non-fatal */ }
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [patientAwpid]);

  useFocusEffect(useCallback(() => { load(); loadPrivacy(); }, [load, loadPrivacy]));
  useReconnectRefetch(load);

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

  useEffect(() => { setVisible(PAGE); }, [tab, q, month, catF]);

  const counts = useMemo(() => {
    const c = { all: 0, prescription: 0, lab_report: 0, other: 0 };
    docs.forEach((d) => {
      if (d.review_state === "unsorted") return;
      c.all++;
      if (d.doc_type === "prescription") c.prescription++;
      else if (d.doc_type === "lab_report") c.lab_report++;
      else c.other++;
    });
    return c;
  }, [docs]);

  // Panel filter only makes sense while looking at lab reports (or "all",
  // which includes them) — prescriptions/documents have no panel.
  const catMode = tab === "all" || tab === "lab_report";
  const catOptions = useMemo(() => {
    const c = new Map<string, number>();
    docs.forEach((d) => {
      if (d.review_state === "unsorted" || d.doc_type !== "lab_report") return;
      (d.report_categories || []).forEach((slug) => c.set(slug, (c.get(slug) || 0) + 1));
    });
    return Object.keys(REVIEW_CATEGORY_LABELS)
      .filter((slug) => c.has(slug))
      .map((slug) => ({ value: slug, label: REVIEW_CATEGORY_LABELS[slug], count: c.get(slug)! }));
  }, [docs]);

  const unsorted = useMemo(() => docs.filter((d) => d.review_state === "unsorted"), [docs]);

  // Full transparency: group the "needs review" pile by the EXACT combination
  // of missing fields, instead of one flat count — could-not-classify and
  // just-needs-a-date read as different problems because they are.
  const reviewSummary = useMemo(() => {
    const REASON_LABEL: Record<string, string> = {
      "file": "too blurry to read",
      "kind": "couldn't be classified",
      "kind,date": "couldn't be classified, and the date's unclear too",
      "category": "are lab reports missing their panel",
      "category,date": "are lab reports missing their panel and date",
      "date": "just need a date confirmed",
    };
    const ORDER = ["kind", "category", "date"];
    const groups = new Map<string, number>();
    unsorted.forEach((d) => {
      const needs = needsOf(d);
      const key = needs.includes("file") ? "file"
        : ORDER.filter((n) => needs.includes(n)).join(",");
      groups.set(key, (groups.get(key) || 0) + 1);
    });
    return [...groups.entries()].map(([key, n]) => `${n} ${REASON_LABEL[key] || "need a quick check"}`);
  }, [unsorted]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return docs
      .filter((d) => d.review_state !== "unsorted")
      .filter((d) =>
        tab === "all" ? true
        : tab === "other" ? d.doc_type !== "prescription" && d.doc_type !== "lab_report"
        : d.doc_type === tab)
      .filter((d) =>
        !needle ||
        [d.title, d.hospital_label, d.doctor_label, d.public_document_id]
          .filter(Boolean).join(" ").toLowerCase().includes(needle))
      .filter((d) => (!month || month === "ALL" ? true : ymKey(d.document_date || d.created_at) === month))
      .filter((d) => !catMode || !catF.size || (d.report_categories || []).some((c) => catF.has(c)))
      .sort((a, b) => (b.document_date || b.created_at).localeCompare(a.document_date || a.created_at));
  }, [docs, tab, q, month, catF, catMode]);

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
  // Just look at it — no save/share dialog. `getDocumentDetail` without
  // `download` gets a signed URL with no attachment override, so the S3
  // object serves inline; opening that URL shows it directly (browser for a
  // PDF, image viewer for a photo) instead of routing through the download
  // flow at all.
  async function viewFile(id: number) {
    setBusyId(id);
    setBusyAction("view");
    setSheetError("");
    setSheetMessage("");
    try {
      const full = await getDocumentDetail(id);
      const src = (full as any).file_data as string;
      if (src.startsWith("data:")) {
        // legacy inline rows have no viewable URL — fall back to save/share
        await downloadDataUri(full.file_name || full.title || "document", src);
      } else {
        await Linking.openURL(src);
      }
    } catch (err) {
      const msg = apiErrorMessage(err, "Couldn't open the file.");
      setError(msg);
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
      const outcome = await downloadDataUri(full.file_name || full.title || "document", (full as any).file_data);
      setSheetMessage(outcome === "saved" ? "Downloaded to your device." : "Shared.");
    } catch (err) {
      const msg = apiErrorMessage(err, "Couldn't open the file.");
      setError(msg);
      setSheetError(msg);
    } finally {
      setBusyId(null);
      setBusyAction("");
    }
  }

  async function removeDoc(d: PatientDocument) {
    setBusyId(d.id);
    try {
      await deleteDocument(d.id);
      setDetail(null);
      setDocs((prev) => prev.filter((x) => x.id !== d.id));
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't remove this."));
    } finally {
      setBusyId(null);
    }
  }

  async function fileAs(d: PatientDocument, type: string) {
    setBusyId(d.id);
    try {
      if (type === "__remove__") await deleteDocument(d.id);
      else await fileReviewDocument(d.id, { doc_type: type });
      setDetail(null);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't update."));
    } finally {
      setBusyId(null);
    }
  }

  // Submit exactly what the review form is asking for — only the field(s)
  // review_needs listed. The server tells us back what (if anything) is
  // still open, so a lab report that only had its type fixed correctly
  // re-opens asking for the panel next, rather than the row vanishing half-done.
  async function submitReview(d: PatientDocument) {
    const needs = needsOf(d);
    const patch: { doc_type?: string; report_categories?: string[]; document_date?: string } = {};
    if (needs.includes("kind") || needs.includes("file")) patch.doc_type = reviewType;
    const effectiveType = reviewType || d.doc_type;
    if (effectiveType === "lab_report" && reviewCat) patch.report_categories = [reviewCat];
    if (needs.includes("date") || reviewDate) patch.document_date = reviewDate;
    setBusyId(d.id);
    try {
      const res = await fileReviewDocument(d.id, patch);
      if (!res.review_needs || res.review_needs.length === 0) {
        setDetail(null);
      } else {
        // still missing something (e.g. picked "lab report" but no panel yet)
        // — keep the sheet open, now asking for what's left.
        setDetail({ ...d, doc_type: res.doc_type as PatientDocument["doc_type"], report_categories: res.report_categories,
                    document_date: res.document_date, review_needs: res.review_needs });
      }
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't update."));
    } finally {
      setBusyId(null);
    }
  }

  // One "Upload" — a single pick of one file or many PDFs/images; the server
  // reads the QR / page text on each and files it.
  async function pickAndUpload() {
    try {
      const files = await pickDocuments();
      if (!files.length) return;
      setUploading(true);
      setUploadReport(null);
      const rep = { filed: 0, review: 0, notMedical: 0, unreadable: 0, failed: 0, lines: [] as string[] };
      for (const f of files) {
        const nm = f.name || "file";
        try {
          const d: any = await uploadDocument({
            title: (f.name || "Document").replace(/\.[a-z0-9]+$/i, ""),
            doc_type: "other",
            file_name: f.name || "upload",
            mime_type: f.mimeType || "application/octet-stream",
            file_data: await fileToDataUri(f),
            ...(patientAwpid ? { patient_awpid: patientAwpid } : {}),
          });
          if (d?.skipped) {
            rep.notMedical += 1;
            rep.lines.push(`${nm} — not a medical document, not saved`);
          } else if (d?.unreadable) {
            rep.unreadable += 1;
            rep.lines.push(`${nm} — ${(d.quality_message || "couldn't read it clearly").replace(/\s+/g, " ").trim()}`);
          } else if (d?.review_state === "unsorted") {
            rep.review += 1;
            rep.lines.push(`${nm} — in the Review list, needs a quick check`);
          } else {
            rep.filed += 1;
          }
        } catch (err) {
          rep.failed += 1;
          rep.lines.push(`${nm} — ${apiErrorMessage(err, "upload failed, try again")}`);
        }
      }
      setAddOpen(false);
      setUploadReport(rep);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't upload those files."));
    } finally {
      setUploading(false);
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
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't save your choice."));
    } finally {
      setChoosing(null);
    }
  }

  const pendingCount = pendingRx.length + pendingLab.length;
  const monthFiltered = !!month && month !== "ALL";

  return (
    <Screen onRefresh={load} refreshing={loading}>
      {/* header */}
      <View style={styles.hdr}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.back}>
          <ArrowLeft size={19} color={NEUTRAL.textPrimary} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.hdrTitle}>
          {patientName ? `Rx & Reports — ${patientName}` : "Rx & Reports"}
        </Text>
        <Pressable onPress={() => setAddOpen(true)} hitSlop={10} style={[styles.addBtn, { backgroundColor: theme.fill }]}>
          <Plus size={15} color={theme.on} strokeWidth={2.8} />
        </Pressable>
      </View>
      <Text style={styles.subline}>
        {counts.all} record{counts.all === 1 ? "" : "s"}
        {docs.length ? ` · newest ${fmtShort(docs[0]?.document_date || docs[0]?.created_at)}` : ""}
      </Text>

      {counts.lab_report > 0 && (
        <Pressable
          onPress={() => navigation.navigate("AITrends", patientAwpid ? { patientAwpid } : undefined)}
          style={({ pressed }) => [pressed && { opacity: 0.9 }]}
        >
          <LinearGradient
            colors={[theme.text, theme.fill]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.aiBanner}
          >
            <View style={styles.aiBannerIcon}>
              <Sparkles size={20} color="#fff" strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.aiBannerTitle}>AI Trends</Text>
                <View style={styles.aiBannerBadge}><Text style={styles.aiBannerBadgeT}>NEW</Text></View>
              </View>
              <Text style={styles.aiBannerSub}>Spot patterns across your lab reports</Text>
            </View>
            <ChevronRight size={18} color="#fff" strokeWidth={2.4} />
          </LinearGradient>
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

      {uploadReport && (
        <View style={styles.upRep}>
          <View style={styles.upRepHead}>
            <Text style={styles.upRepTitle}>Upload complete</Text>
            <Pressable onPress={() => setUploadReport(null)} hitSlop={10}>
              <Text style={styles.upRepDismiss}>Got it</Text>
            </Pressable>
          </View>
          <Text style={styles.upRepSummary}>
            {[
              uploadReport.filed && `${uploadReport.filed} filed`,
              uploadReport.review && `${uploadReport.review} to review`,
              uploadReport.notMedical && `${uploadReport.notMedical} not medical — not saved`,
              uploadReport.unreadable && `${uploadReport.unreadable} couldn't read`,
              uploadReport.failed && `${uploadReport.failed} failed`,
            ].filter(Boolean).join(" · ") || "Nothing to file."}
          </Text>
          {uploadReport.lines.length > 0 && (
            <View style={styles.upRepList}>
              {uploadReport.lines.slice(0, 12).map((ln, i) => (
                <Text key={i} style={styles.upRepLine} numberOfLines={2}>• {ln}</Text>
              ))}
              {uploadReport.lines.length > 12 && (
                <Text style={styles.upRepLine}>…and {uploadReport.lines.length - 12} more</Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* type chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {([
          ["all", "All", counts.all],
          ["prescription", "Prescriptions", counts.prescription],
          ["lab_report", "Lab reports", counts.lab_report],
          ["other", "Docs", counts.other],
        ] as const).map(([k, l, n]) => {
          const on = tab === k;
          return (
            <Pressable key={k} onPress={() => setTab(k)} style={[styles.chip, on && { backgroundColor: theme.fill, borderColor: theme.fill }]}>
              <Text style={[styles.chipT, on && { color: theme.on }]}>
                {l}<Text style={[styles.chipN, on && { color: theme.on }]}> {n}</Text>
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

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

      {/* lab panel filter — only while looking at lab reports */}
      {catMode && catOptions.length > 0 && (
        <Pressable
          onPress={() => setShowCatSheet(true)}
          style={[styles.catTrigger, catF.size > 0 && { borderColor: theme.fill }]}
        >
          <Text style={[styles.catTriggerText, catF.size > 0 && { color: theme.text, fontWeight: "700" }]} numberOfLines={1}>
            {catF.size === 0 ? "All categories" : catF.size === 1 ? REVIEW_CATEGORY_LABELS[[...catF][0]] : `${catF.size} categories`}
          </Text>
          <ChevronDown size={13} color={catF.size > 0 ? theme.text : NEUTRAL.textMuted} />
        </Pressable>
      )}

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
      {loading && docs.length === 0 ? (
        <View style={{ paddingVertical: 44, alignItems: "center" }}>
          <ActivityIndicator color={theme.fill} />
        </View>
      ) : (
        <>
          {unsorted.length > 0 && (
            <>
              <Text style={styles.grpLabel}>
                {unsorted.length} need{unsorted.length > 1 ? "" : "s"} your review
              </Text>
              {reviewSummary.length > 0 && (
                <Text style={styles.reviewSummary}>{reviewSummary.join(" · ")}</Text>
              )}
              {unsorted.slice(0, 6).map((d) => (
                <RecRow key={d.id} d={d} review onPress={() => { setSheetError(""); setSheetMessage(""); setDetail(d); }} />
              ))}
            </>
          )}

          {filtered.length === 0 ? (
            <EmptyState
              text={
                q ? `Nothing matches "${q}".`
                : monthFiltered ? `No records in ${ymLabel(month)}.`
                : tab !== "all" ? "Nothing here yet."
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
        title={
          detail
            ? detail.doc_type === "prescription" && detail.doctor_label
              ? `Prescription · ${detail.doctor_label}`
              : detail.title
            : ""
        }
      >
        {detail && (detail.review_state === "unsorted" ? (() => {
          const needs = needsOf(detail);
          const needsKind = needs.includes("kind") || needs.includes("file");
          const effectiveType = reviewType || (needsKind ? "" : detail.doc_type);
          const showCatPicker = effectiveType === "lab_report";
          const showDateField = needs.includes("date");
          const canSubmit = (!needsKind || !!effectiveType) && (!showCatPicker || !!reviewCat) && (!showDateField || !!reviewDate);
          return (
            <>
              <Text style={styles.sheetHint}>
                {needs.includes("file") ? "This photo was too blurry to read — file it anyway, or retake it:"
                  : needsKind ? "We couldn't tell what this is — file it:"
                  : showCatPicker && showDateField ? "This is a lab report — which panel, and when was it done?"
                  : showCatPicker ? "This is a lab report — which panel is it?"
                  : "Just needs a date to file it:"}
              </Text>

              <SecondaryButton
                label="View the file"
                loading={busyId === detail.id && busyAction === "view"}
                onPress={() => viewFile(detail.id)}
                style={{ marginTop: 10 }}
              />
              {!!sheetError && <Text style={styles.sheetErrorText}>{sheetError}</Text>}
              {!!sheetMessage && <Text style={styles.sheetSuccessText}>{sheetMessage}</Text>}

              {needsKind && !reviewType && (
                <View style={{ gap: 8, marginTop: 12 }}>
                  <PrimaryButton label="It's a prescription" onPress={() => setReviewType("prescription")} />
                  <SecondaryButton label="It's a lab report" onPress={() => setReviewType("lab_report")} />
                  <SecondaryButton label="It's a scan / imaging" onPress={() => setReviewType("scan")} />
                  <SecondaryButton label="It's a discharge summary" onPress={() => setReviewType("discharge_summary")} />
                  <SecondaryButton label="Something else" onPress={() => setReviewType("other")} />
                  <SecondaryButton label="Not a medical record — remove" danger loading={busyId === detail.id} onPress={() => fileAs(detail, "__remove__")} />
                </View>
              )}

              {(!needsKind || !!reviewType) && (showCatPicker || showDateField) && (
                <View style={{ marginTop: 14 }}>
                  {needsKind && (
                    <Pressable onPress={() => setReviewType("")} hitSlop={8} style={{ marginBottom: 10 }}>
                      <Text style={styles.reviewChange}>{metaFor(effectiveType).label} · change</Text>
                    </Pressable>
                  )}
                  {showCatPicker && (
                    <>
                      <Text style={styles.reviewFieldLabel}>PANEL</Text>
                      <View style={styles.reviewCatWrap}>
                        {Object.entries(REVIEW_CATEGORY_LABELS).map(([slug, label]) => {
                          const on = reviewCat === slug;
                          return (
                            <Pressable
                              key={slug}
                              onPress={() => setReviewCat(slug)}
                              style={[styles.reviewChip, on && { borderColor: theme.fill, backgroundColor: NEUTRAL.successBg }]}
                            >
                              {on && <Check size={11} color={theme.fill} strokeWidth={3} />}
                              <Text style={[styles.reviewChipText, on && { color: theme.text, fontWeight: "700" }]}>{label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </>
                  )}
                  {showDateField && (
                    <DateField label="Document date" value={reviewDate} onChange={setReviewDate} maximumDate={new Date()} />
                  )}
                  <View style={{ gap: 8, marginTop: 6 }}>
                    <PrimaryButton label="Save" disabled={!canSubmit} loading={busyId === detail.id} onPress={() => submitReview(detail)} />
                    <SecondaryButton label="Not a medical record — remove" danger onPress={() => fileAs(detail, "__remove__")} />
                  </View>
                </View>
              )}
            </>
          );
        })() : (
          <>
            <DetailRow label="Type" value={metaFor(detail.doc_type).label} />
            <DetailRow label="Date" value={fmtLong(detail.document_date || detail.created_at)} />
            {!!detail.doctor_label && <DetailRow label="Doctor" value={detail.doctor_label} />}
            <DetailRow
              label="Hospital"
              value={detail.hospital_label || (detail.uploaded_by === "staff" ? "Your hospital" : "Uploaded by you")}
            />
            {!!detail.public_document_id && <DetailRow label="Document ID" value={detail.public_document_id} />}
            <DetailRow
              label="Status"
              value={detail.verification_status === "verified" ? "Verified · QR authenticated" : "Not verified"}
              valueColor={detail.verification_status === "verified" ? NEUTRAL.success : undefined}
            />
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
              <Pressable
                onPress={() => removeDoc(detail)}
                style={({ pressed }) => [styles.deleteLink, pressed && { opacity: 0.6 }]}
              >
                <Trash2 size={13} color={NEUTRAL.danger} strokeWidth={2.2} />
                <Text style={styles.deleteLinkText}>Delete from my records</Text>
              </Pressable>
            </View>
            {detail.uploaded_by === "staff" && (
              <Text style={styles.sheetNote}>
                Your hospital keeps its own copy. This removes it from your records and from other hospitals.
              </Text>
            )}
          </>
        ))}
      </DetailSheet>

      {/* add sheet */}
      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => !uploading && setAddOpen(false)}>
        <Pressable style={styles.mBackdrop} onPress={() => !uploading && setAddOpen(false)}>
          <View style={styles.mSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.handle} />
            <Text style={styles.mTitle}>Add a record</Text>
            <Text style={styles.mSub}>We read the QR or the page text and file each one for you.</Text>
            {uploading ? (
              <View style={{ paddingVertical: 22, alignItems: "center" }}>
                <ActivityIndicator color={theme.fill} />
                <Text style={styles.mUp}>Uploading…</Text>
              </View>
            ) : (
              <View style={{ gap: 8, marginTop: 6 }}>
                <PrimaryButton label="Upload files" onPress={pickAndUpload} />
                <Text style={styles.mHint}>Select the files you want to upload — one, or several PDFs and photos.</Text>
                <SecondaryButton
                  label="Take photo / Scan QR"
                  onPress={() => { setAddOpen(false); navigation.navigate("RxCapture", patientAwpid ? { patientAwpid } : undefined); }}
                />
                <Pressable onPress={() => setAddOpen(false)} style={{ alignItems: "center", paddingVertical: 8 }}>
                  <Text style={styles.mCancel}>Cancel</Text>
                </Pressable>
              </View>
            )}
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

      <CategoryFilterSheet
        visible={showCatSheet}
        options={catOptions}
        selected={[...catF]}
        accent={theme.fill}
        onClose={() => setShowCatSheet(false)}
        onApply={(next) => setCatF(new Set(next))}
      />

    </Screen>
  );
}

const styles = StyleSheet.create({
  catTrigger: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6,
    borderWidth: 1, borderColor: NEUTRAL.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12, backgroundColor: NEUTRAL.surface,
  },
  catTriggerText: { fontSize: 13, color: NEUTRAL.textPrimary, flex: 1 },
  aiBanner: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, padding: 14, marginBottom: 12 },
  aiBannerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  aiBannerTitle: { fontSize: 14.5, fontWeight: "800", color: "#fff" },
  aiBannerBadge: { backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1 },
  aiBannerBadgeT: { fontSize: 9.5, fontWeight: "700", color: "#fff" },
  aiBannerSub: { fontSize: 12, color: "rgba(255,255,255,0.82)", marginTop: 2 },

  upRep: { backgroundColor: NEUTRAL.surfaceAlt, borderRadius: 12, padding: 12, marginBottom: 12 },
  upRepHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  upRepTitle: { fontSize: 13.5, fontWeight: "800", color: NEUTRAL.textPrimary },
  upRepDismiss: { fontSize: 12, fontWeight: "700", color: NEUTRAL.textSecondary },
  upRepSummary: { fontSize: 12, color: NEUTRAL.textSecondary, marginTop: 4 },
  upRepList: { marginTop: 8, gap: 4 },
  upRepLine: { fontSize: 11.5, color: NEUTRAL.textMuted, lineHeight: 16 },

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

  chipRow: { gap: 6, paddingRight: 8, marginBottom: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 0.5, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface },
  chipT: { fontSize: 11.5, fontWeight: "600", color: NEUTRAL.textPrimary },
  chipN: { fontSize: 10, color: NEUTRAL.textMuted, fontWeight: "600" },

  srch: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: NEUTRAL.surface, borderWidth: 0.5, borderColor: NEUTRAL.border, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 8, marginBottom: 10 },
  srchIn: { flex: 1, fontSize: 12.5, color: NEUTRAL.textPrimary, padding: 0 },


  pend: { backgroundColor: NEUTRAL.warningBg, borderRadius: 12, padding: 10, marginBottom: 12 },
  pendHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  pendTxt: { flex: 1, fontSize: 11.5, fontWeight: "700", color: NEUTRAL.warning },
  pendItem: { backgroundColor: NEUTRAL.surface, borderRadius: 10, padding: 10 },
  pendItemT: { fontSize: 11.5, fontWeight: "600", color: NEUTRAL.textPrimary, marginBottom: 8 },
  pendBtns: { flexDirection: "row", gap: 6 },

  grpLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", color: NEUTRAL.textMuted, marginTop: 6, marginBottom: 8 },
  reviewSummary: { fontSize: 11.5, color: NEUTRAL.textSecondary, marginTop: -4, marginBottom: 8, lineHeight: 16 },
  reviewChange: { fontSize: 12, fontWeight: "600", color: NEUTRAL.textSecondary, textDecorationLine: "underline" },
  reviewFieldLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", color: NEUTRAL.textMuted, marginBottom: 8 },
  reviewCatWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  reviewChip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: NEUTRAL.border, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 13, backgroundColor: NEUTRAL.surface },
  reviewChipText: { fontSize: 11.5, color: NEUTRAL.textSecondary },

  rec: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: NEUTRAL.surface, borderWidth: 0.5, borderColor: NEUTRAL.border, borderRadius: 13, padding: 11, marginBottom: 8 },
  bdg: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  recT: { fontSize: 12.5, fontWeight: "600", color: NEUTRAL.textPrimary },
  recS: { fontSize: 10.5, color: NEUTRAL.textMuted, marginTop: 2 },
  recDt: { fontSize: 10, color: NEUTRAL.textMuted },
  tag: { fontSize: 8.5, fontWeight: "700", letterSpacing: 0.4, color: NEUTRAL.textSecondary, borderWidth: 0.5, borderColor: NEUTRAL.border, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  reviewTag: { fontSize: 8.5, fontWeight: "700", letterSpacing: 0.4, color: NEUTRAL.warning, borderWidth: 0.5, borderColor: NEUTRAL.warning, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  vf: { flexDirection: "row", alignItems: "center", gap: 2 },
  vfT: { fontSize: 9, fontWeight: "700", color: NEUTRAL.success },

  count: { textAlign: "center", fontSize: 10, color: NEUTRAL.textMuted, marginTop: 10, marginBottom: 4 },

  sheetHint: { fontSize: 12, color: NEUTRAL.textSecondary, lineHeight: 17 },
  sheetNote: { fontSize: 10, color: NEUTRAL.textMuted, marginTop: 10, lineHeight: 14 },
  sheetErrorText: { fontSize: 12, color: NEUTRAL.danger, marginTop: 8, lineHeight: 16 },
  sheetSuccessText: { fontSize: 12, color: NEUTRAL.success, marginTop: 8, lineHeight: 16 },

  actionRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  fileAction: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderWidth: 1, borderColor: NEUTRAL.border, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 8,
    backgroundColor: NEUTRAL.surface,
  },
  fileActionText: { fontSize: 12, fontWeight: "600", color: NEUTRAL.textSecondary },
  deleteLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, marginTop: 6 },
  deleteLinkText: { fontSize: 12.5, fontWeight: "600", color: NEUTRAL.danger },

  mBackdrop: { flex: 1, backgroundColor: "rgba(12,35,64,0.4)", justifyContent: "flex-end" },
  mSheet: { backgroundColor: NEUTRAL.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 22 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: NEUTRAL.border, alignSelf: "center", marginBottom: 12 },
  mTitle: { fontSize: 14.5, fontWeight: "700", color: NEUTRAL.textPrimary },
  mSub: { fontSize: 11.5, color: NEUTRAL.textMuted, marginTop: 4, marginBottom: 8 },
  mUp: { fontSize: 12, color: NEUTRAL.textSecondary, marginTop: 8 },
  mHint: { fontSize: 10.5, color: NEUTRAL.textMuted, textAlign: "center", marginTop: -2, marginBottom: 2, paddingHorizontal: 8 },
  mCancel: { fontSize: 12.5, fontWeight: "600", color: NEUTRAL.textSecondary },
});
