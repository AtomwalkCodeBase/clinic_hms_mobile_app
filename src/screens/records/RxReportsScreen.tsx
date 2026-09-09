import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Modal, ActivityIndicator } from "react-native";
import { useFocusEffect, useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ArrowLeft, Plus, Search, Pill as PillIcon, FlaskConical, FileText, ShieldCheck,
  ChevronDown, ChevronRight, AlertCircle,
} from "lucide-react-native";
import { Screen, EmptyState, ErrorBanner } from "@/components/Layout";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { DetailSheet, DetailRow } from "@/components/DetailSheet";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { useReconnectRefetch } from "@/hooks/useReconnectRefetch";
import { apiErrorMessage } from "@/api/client";
import {
  getMyDocuments, getDocumentDetail, uploadDocument, deleteDocument, recategoriseDocument,
  getPrescriptions, getLabOrders, choosePrescription, chooseLabOrder,
} from "@/api/portal";
import { pickDocuments, fileToDataUri, downloadDataUri } from "@/utils/fileHelpers";
import { PatientDocument, PrescriptionOrder, LabOrder } from "@/api/types";
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
function RecRow({ d, review, onPress }: { d: PatientDocument; review?: boolean; onPress: () => void }) {
  const meta = metaFor(d.doc_type);
  const Icon = meta.Icon;
  const title = d.doc_type === "prescription" && d.doctor_label ? `Prescription · ${d.doctor_label}` : d.title;
  const sub = d.hospital_label || (d.uploaded_by === "staff" ? "Issued by your hospital" : "Uploaded by you");
  const verified = d.verification_status === "verified";
  return (
    <Pressable onPress={onPress} style={styles.rec}>
      <View style={[styles.bdg, { backgroundColor: meta.tint }]}>
        <Icon size={16} color={meta.ink} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.recT} numberOfLines={1}>{title}</Text>
        <Text style={styles.recS} numberOfLines={1}>{sub}</Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 3 }}>
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
      </View>
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

  const [tab, setTab] = useState<"all" | "prescription" | "lab_report" | "other">("all");
  const [q, setQ] = useState("");
  const [month, setMonth] = useState<string>(""); // "" until resolved, "ALL", or "YYYY-MM"
  const [visible, setVisible] = useState(PAGE);
  const [showPending, setShowPending] = useState(false);

  const [detail, setDetail] = useState<PatientDocument | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

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

  useFocusEffect(useCallback(() => { load(); }, [load]));
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

  useEffect(() => { setVisible(PAGE); }, [tab, q, month]);

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

  const unsorted = useMemo(() => docs.filter((d) => d.review_state === "unsorted"), [docs]);

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
      .sort((a, b) => (b.document_date || b.created_at).localeCompare(a.document_date || a.created_at));
  }, [docs, tab, q, month]);

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
  async function openFile(id: number) {
    setBusyId(id);
    try {
      const full = await getDocumentDetail(id, { download: true });
      await downloadDataUri(full.file_name || full.title || "document", (full as any).file_data);
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't open the file."));
    } finally {
      setBusyId(null);
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
      else await recategoriseDocument(d.id, type);
      setDetail(null);
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
      let failed = 0;
      for (const f of files) {
        try {
          await uploadDocument({
            title: (f.name || "Document").replace(/\.[a-z0-9]+$/i, ""),
            doc_type: "other",
            file_name: f.name || "upload",
            mime_type: f.mimeType || "application/octet-stream",
            file_data: await fileToDataUri(f),
            ...(patientAwpid ? { patient_awpid: patientAwpid } : {}),
          });
        } catch {
          failed += 1;
        }
      }
      setAddOpen(false);
      if (failed) setError(`${failed} of ${files.length} file${files.length === 1 ? "" : "s"} didn't upload.`);
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

      {!!error && <ErrorBanner message={error} onRetry={load} />}

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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthRow}>
        <Pressable onPress={() => setMonth("ALL")} style={[styles.mchip, month === "ALL" && styles.mchipOn]}>
          <Text style={[styles.mchipT, month === "ALL" && styles.mchipTOn]}>All months</Text>
        </Pressable>
        {monthOpts.map((o) => {
          const on = month === o.key;
          return (
            <Pressable key={o.key} onPress={() => setMonth(o.key)} style={[styles.mchip, on && styles.mchipOn, !o.has && styles.mchipEmpty]}>
              <Text style={[styles.mchipT, on && styles.mchipTOn]}>{ymShort(o.key)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

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
              <Text style={styles.grpLabel}>Needs a type</Text>
              {unsorted.slice(0, 6).map((d) => (
                <RecRow key={d.id} d={d} review onPress={() => setDetail(d)} />
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
                  <RecRow key={d.id} d={d} onPress={() => setDetail(d)} />
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
        onClose={() => setDetail(null)}
        title={
          detail
            ? detail.doc_type === "prescription" && detail.doctor_label
              ? `Prescription · ${detail.doctor_label}`
              : detail.title
            : ""
        }
      >
        {detail && (detail.review_state === "unsorted" ? (
          <>
            <Text style={styles.sheetHint}>We couldn't tell what this is — file it:</Text>
            <View style={{ gap: 8, marginTop: 12 }}>
              <PrimaryButton label="It's a prescription" loading={busyId === detail.id} onPress={() => fileAs(detail, "prescription")} />
              <SecondaryButton label="It's a lab report" onPress={() => fileAs(detail, "lab_report")} />
              <SecondaryButton label="Not a medical record — remove" danger onPress={() => fileAs(detail, "__remove__")} />
            </View>
          </>
        ) : (
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
            <View style={{ gap: 8, marginTop: 14 }}>
              <PrimaryButton
                label={detail.handwritten_doc_id ? "View / Download prescription" : "View / Download"}
                loading={busyId === detail.id}
                onPress={() => openFile(detail.id)}
              />
              {!!detail.handwritten_doc_id && (
                <SecondaryButton label="View / Download handwritten" onPress={() => openFile(detail.handwritten_doc_id!)} />
              )}
              <SecondaryButton label="Delete from my records" danger onPress={() => removeDoc(detail)} />
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  hdr: { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 4 },
  back: { width: 30, height: 30, borderRadius: 15, backgroundColor: NEUTRAL.surfaceAlt, alignItems: "center", justifyContent: "center" },
  hdrTitle: { flex: 1, fontSize: 17, fontWeight: "800", color: NEUTRAL.textPrimary },
  addBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  subline: { fontSize: 10.5, color: NEUTRAL.textMuted, marginBottom: 12, marginTop: 2 },

  chipRow: { gap: 6, paddingRight: 8, marginBottom: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 0.5, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface },
  chipT: { fontSize: 11.5, fontWeight: "600", color: NEUTRAL.textPrimary },
  chipN: { fontSize: 10, color: NEUTRAL.textMuted, fontWeight: "600" },

  srch: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: NEUTRAL.surface, borderWidth: 0.5, borderColor: NEUTRAL.border, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 8, marginBottom: 10 },
  srchIn: { flex: 1, fontSize: 12.5, color: NEUTRAL.textPrimary, padding: 0 },

  monthRow: { gap: 6, paddingRight: 8, marginBottom: 12 },
  mchip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 16, borderWidth: 0.5, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface },
  mchipOn: { backgroundColor: NEUTRAL.successBg, borderColor: NEUTRAL.success },
  mchipEmpty: { opacity: 0.5 },
  mchipT: { fontSize: 11, fontWeight: "600", color: NEUTRAL.textSecondary },
  mchipTOn: { color: NEUTRAL.success },

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
  reviewTag: { fontSize: 8.5, fontWeight: "700", letterSpacing: 0.4, color: NEUTRAL.warning, borderWidth: 0.5, borderColor: NEUTRAL.warning, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  vf: { flexDirection: "row", alignItems: "center", gap: 2 },
  vfT: { fontSize: 9, fontWeight: "700", color: NEUTRAL.success },

  count: { textAlign: "center", fontSize: 10, color: NEUTRAL.textMuted, marginTop: 10, marginBottom: 4 },

  sheetHint: { fontSize: 12, color: NEUTRAL.textSecondary, lineHeight: 17 },
  sheetNote: { fontSize: 10, color: NEUTRAL.textMuted, marginTop: 10, lineHeight: 14 },

  mBackdrop: { flex: 1, backgroundColor: "rgba(12,35,64,0.4)", justifyContent: "flex-end" },
  mSheet: { backgroundColor: NEUTRAL.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 22 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: NEUTRAL.border, alignSelf: "center", marginBottom: 12 },
  mTitle: { fontSize: 14.5, fontWeight: "700", color: NEUTRAL.textPrimary },
  mSub: { fontSize: 11.5, color: NEUTRAL.textMuted, marginTop: 4, marginBottom: 8 },
  mUp: { fontSize: 12, color: NEUTRAL.textSecondary, marginTop: 8 },
  mHint: { fontSize: 10.5, color: NEUTRAL.textMuted, textAlign: "center", marginTop: -2, marginBottom: 2, paddingHorizontal: 8 },
  mCancel: { fontSize: 12.5, fontWeight: "600", color: NEUTRAL.textSecondary },
});
