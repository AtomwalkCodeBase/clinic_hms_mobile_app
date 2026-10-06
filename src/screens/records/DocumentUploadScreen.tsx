import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Animated } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { BackHeader, EmptyState, ErrorBanner, Screen } from "@/components/Layout";
import { SegmentedControl } from "@/components/SegmentedControl";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MessageDialog } from "@/components/MessageDialog";
import { ReviewRow } from "@/components/ReviewRow";
import { UploadStages } from "@/components/UploadStages";
import { TypePickerSheet } from "@/components/TypePickerSheet";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { useDocumentUpload } from "@/context/DocumentUploadContext";
import { useDocumentTypes } from "@/hooks/useDocumentTypes";
import { useReviewDraft } from "@/hooks/useReviewDraft";
import { apiErrorMessage } from "@/api/client";
import { getDocumentDetail, getMyDocuments, retryDocument, submitDecisions } from "@/api/portal";
import type { PatientDocument } from "@/api/types";
import { buildDecisions, currentType, isReviewable, stageOf } from "@/utils/reviewDraft";
import { openInExternalApp, pickDocuments } from "@/utils/fileHelpers";
import { AppStackParamList } from "@/navigation/types";

const IN_PROGRESS = new Set(["queued", "extracting", "classifying"]);
const NOT_EXTRACTED = new Set(["queued", "extracting"]);
const REVEAL_GAP_MS = 220;
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

/** Every upload still waiting for the patient's decision, oldest first (so a batch reads in the order it was sent). */
async function fetchPending(patientAwpid?: string): Promise<PatientDocument[]> {
  const first = await getMyDocuments(1, patientAwpid, { review: "pending", pageSize: PAGE_SIZE });
  const all = [...first.results];
  for (let page = 2; page <= Math.min(first.pagination.total_pages, MAX_PAGES); page++) {
    all.push(...(await getMyDocuments(page, patientAwpid, { review: "pending", pageSize: PAGE_SIZE })).results);
  }
  return all.sort((a, b) => a.id - b.id);
}

/** A file slides in when it first appears, so the list builds up one by one instead of jumping. */
function FadeIn({ children }: { children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [v]);
  return (
    <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

type Tab = "review" | "ready";
type PickerState = { doc: PatientDocument; thenConfirm: boolean } | null;
type Notice = { title: string; message: string; tone: "success" | "error" } | null;

/**
 * Bulk Upload: send several files at once, then review them here. Each file lands in "Needs Review" with the
 * system's suggested type; the patient confirms it or changes it, which moves it to "Ready to Submit". Nothing is saved
 * until they submit — the server then files each document under the chosen type and locks it, and it appears in My
 * Documents.
 */
export function DocumentUploadScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "DocumentUpload">>();
  const patientAwpid = route.params?.patientAwpid;
  const { theme } = useAppTheme();
  const queryClient = useQueryClient();
  const { uploading, uploadPct, fileCount, startUpload } = useDocumentUpload();
  const { labelOf } = useDocumentTypes();
  const { draft, loaded, setType, confirm, moveBack, keepOnly } = useReviewDraft(patientAwpid ?? "self");

  const [tab, setTab] = useState<Tab>("review");
  const [picker, setPicker] = useState<PickerState>(null);
  const [askSubmit, setAskSubmit] = useState<{ scope: "ready" | "all"; count: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [actionError, setActionError] = useState("");

  const pendingQ = useQuery({
    queryKey: ["documents", patientAwpid, "pending"],
    queryFn: () => fetchPending(patientAwpid),
    refetchInterval: (query) => (query.state.data?.some((d) => IN_PROGRESS.has(d.processing_status)) ? 2500 : false),
  });
  const docs = useMemo(() => pendingQ.data ?? [], [pendingQ.data]);
  useRefreshOnFocus(pendingQ);
  const { refreshing, onRefresh } = usePullToRefresh(() => pendingQ.refetch());

  // Forget what the patient did for files that are no longer waiting (submitted from another screen, or gone).
  useEffect(() => {
    if (loaded && pendingQ.data) keepOnly(pendingQ.data.map((d) => d.id));
  }, [loaded, pendingQ.data, keepOnly]);

  // The files just sent: followed through Extracting and Reading, and kept out of the list until they have been read.
  const [tracked, setTracked] = useState<Set<number>>(new Set());
  const group = docs.filter((d) => tracked.has(d.id) || IN_PROGRESS.has(d.processing_status));
  const groupWorking = group.some((d) => IN_PROGRESS.has(d.processing_status));
  const extracted = group.filter((d) => !NOT_EXTRACTED.has(d.processing_status)).length;
  const read = group.filter((d) => !IN_PROGRESS.has(d.processing_status)).length;
  useEffect(() => {
    if (!uploading && tracked.size && pendingQ.data && !groupWorking) setTracked(new Set());
  }, [uploading, tracked, pendingQ.data, groupWorking]);

  // Files already read when the screen opens show at once; files that finish while you watch appear one at a time.
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const seeded = useRef(false);
  useEffect(() => {
    if (!pendingQ.data) return;
    const settled = docs.filter((d) => !IN_PROGRESS.has(d.processing_status));
    if (!seeded.current) {
      seeded.current = true;
      setRevealed(new Set(settled.map((d) => d.id)));
      return;
    }
    const next = settled.find((d) => !revealed.has(d.id));
    if (!next) return;
    const t = setTimeout(() => setRevealed((prev) => new Set(prev).add(next.id)), REVEAL_GAP_MS);
    return () => clearTimeout(t);
  }, [pendingQ.data, docs, revealed]);
  const visible = docs.filter((d) => revealed.has(d.id));
  const waitingToShow = docs.length - visible.length;

  const inReview = visible.filter((d) => stageOf(draft[d.id]) === "review");
  const ready = visible.filter((d) => stageOf(draft[d.id]) === "ready" && isReviewable(d));
  const shown = tab === "review" ? inReview : ready;
  const submittable = visible.filter(isReviewable).length;

  // ── actions ────────────────────────────────────────────────────────────────
  async function addFiles() {
    try {
      const picked = await pickDocuments();
      if (!picked.length) return;
      const outcome = await startUpload(
        picked.map((f) => ({ name: f.name || "upload", mimeType: f.mimeType || "application/octet-stream", size: f.size || 0, uri: f.uri })),
        "bulk",
        patientAwpid,
      );
      if (outcome.status !== "started") {
        setNotice({ title: outcome.status === "busy" ? "Upload in progress" : "Can't upload", message: outcome.reason, tone: "error" });
      } else {
        setTracked(new Set(outcome.documentIds));
      }
      if (outcome.status === "started" && outcome.skipped.length) {
        setNotice({
          title: `${outcome.skipped.length} file${outcome.skipped.length === 1 ? "" : "s"} skipped`,
          message: outcome.skipped.map((s) => `${s.name} — ${s.reason}`).join("\n"),
          tone: "error",
        });
      }
    } catch (err) {
      setNotice({ title: "Can't upload", message: apiErrorMessage(err, "Couldn't upload those files."), tone: "error" });
    }
  }

  async function viewFile(doc: PatientDocument) {
    setActionError("");
    try {
      const full = await getDocumentDetail(doc.id);
      const src = (full as any).file_data as string;
      if (!src) throw new Error("This document doesn't have a file to view.");
      await openInExternalApp(full.file_name || full.title || "document", src, full.mime_type);
    } catch (err) {
      setActionError(apiErrorMessage(err, "Couldn't open the file."));
    }
  }

  async function retry(doc: PatientDocument) {
    setActionError("");
    try {
      await retryDocument(doc.id, patientAwpid);
      pendingQ.refetch();
    } catch (err) {
      setActionError(apiErrorMessage(err, "Couldn't try again."));
    }
  }

  function onConfirm(doc: PatientDocument) {
    if (!currentType(doc, draft[doc.id])) setPicker({ doc, thenConfirm: true });     // nothing to confirm until a type is chosen
    else confirm(doc.id);
  }

  function onPick(code: string) {
    if (!picker) return;
    setType(picker.doc, code);
    if (picker.thenConfirm) confirm(picker.doc.id);
    setPicker(null);
  }

  function requestSubmit(scope: "ready" | "all") {
    const { decisions, missing } = buildDecisions(visible, draft, scope);
    if (missing.length) {
      setTab("review");
      setNotice({
        title: "Choose a type first",
        message: `${missing.length} document${missing.length === 1 ? " needs" : "s need"} a type before ${missing.length === 1 ? "it" : "they"} can be submitted. Tap Change on ${missing.length === 1 ? "it" : "each one"}.`,
        tone: "error",
      });
      return;
    }
    if (!decisions.length) {
      setNotice({ title: "Nothing to submit", message: scope === "ready" ? "Confirm a document first." : "No documents are ready yet.", tone: "error" });
      return;
    }
    setAskSubmit({ scope, count: decisions.length });
  }

  async function doSubmit() {
    if (!askSubmit) return;
    const { decisions } = buildDecisions(visible, draft, askSubmit.scope);
    setSubmitting(true);
    try {
      const result = await submitDecisions(decisions, patientAwpid);
      setAskSubmit(null);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["documentCounts"] });
      const n = result.submitted.length;
      setNotice(
        result.rejected.length
          ? {
              title: n ? `${n} submitted, ${result.rejected.length} not` : "Nothing was submitted",
              message: "Some documents couldn't be submitted. They are still in Needs Review; check them and try again.",
              tone: "error",
            }
          : { title: "Submitted", message: `${n} document${n === 1 ? " was" : "s were"} added to My Documents.`, tone: "success" },
      );
    } catch (err) {
      setAskSubmit(null);
      setNotice({ title: "Couldn't submit", message: apiErrorMessage(err, "Nothing was saved. Please try again."), tone: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  const error = (pendingQ.error && apiErrorMessage(pendingQ.error)) || actionError;
  const pickerEntry = picker ? draft[picker.doc.id] : undefined;

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing}>
      <BackHeader title="Bulk Upload" onBack={() => navigation.goBack()} />
      <Text style={styles.lead}>Add several files at once. Review the type we found for each, then submit.</Text>

      <View style={styles.addRow}>
        <SecondaryButton label="Upload files" onPress={addFiles} loading={uploading} style={{ flex: 1 }} />
        <SecondaryButton
          label="Take photos"
          onPress={() => navigation.navigate("DocumentCapture", { mode: "bulk", ...(patientAwpid ? { patientAwpid } : {}) })}
          disabled={uploading}
          style={{ flex: 1 }}
        />
      </View>

      {(uploading || groupWorking) && (
        <UploadStages
          uploading={uploading}
          uploadPct={uploadPct}
          total={uploading ? fileCount : group.length}
          extracted={extracted}
          read={read}
        />
      )}

      {!!error && <ErrorBanner message={error} onRetry={() => pendingQ.refetch()} />}

      <SegmentedControl<Tab>
        options={[
          { key: "review", label: `Needs Review (${inReview.length})` },
          { key: "ready", label: `Ready to Submit (${ready.length})` },
        ]}
        value={tab}
        onChange={setTab}
      />

      {visible.length > 0 && (
        <PrimaryButton
          label={tab === "review" ? `Submit All (${submittable})` : `Submit Confirmed (${ready.length})`}
          onPress={() => requestSubmit(tab === "review" ? "all" : "ready")}
          disabled={tab === "review" ? submittable === 0 : ready.length === 0}
          style={{ marginBottom: 12 }}
        />
      )}

      {pendingQ.isLoading || !loaded ? (
        <ActivityIndicator color={theme.fill} style={{ marginTop: 30 }} />
      ) : shown.length === 0 ? (
        <EmptyState
          text={
            docs.length === 0 ? "No documents waiting. Choose files to add some."
            : waitingToShow > 0 && visible.length === 0 ? "Your documents will appear here as soon as they have been read."
            : tab === "review" ? "Nothing left to review."
            : "Nothing confirmed yet. Use Confirm on a document."
          }
        />
      ) : (
        shown.map((doc) => (
          <FadeIn key={doc.id}>
          <ReviewRow
            doc={doc}
            entry={draft[doc.id]}
            mode={tab}
            labelOf={labelOf}
            onView={() => viewFile(doc)}
            onConfirm={() => onConfirm(doc)}
            onChange={() => setPicker({ doc, thenConfirm: false })}
            onMoveBack={() => moveBack(doc.id)}
            onRetry={() => retry(doc)}
          />
          </FadeIn>
        ))
      )}

      <TypePickerSheet
        visible={!!picker}
        selected={picker ? currentType(picker.doc, pickerEntry) : null}
        onSelect={onPick}
        onClose={() => setPicker(null)}
      />

      <ConfirmDialog
        visible={!!askSubmit}
        title={`Submit ${askSubmit?.count ?? 0} document${askSubmit?.count === 1 ? "" : "s"}?`}
        message="Once submitted, the type can't be changed. They will be added to My Documents."
        confirmLabel="Submit"
        cancelLabel="Review Again"
        loading={submitting}
        onConfirm={doSubmit}
        onCancel={() => setAskSubmit(null)}
      />

      <MessageDialog
        visible={!!notice}
        title={notice?.title ?? ""}
        message={notice?.message}
        tone={notice?.tone}
        buttonLabel="OK"
        onDismiss={() => setNotice(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: 12.5, color: NEUTRAL.textSecondary, marginBottom: 14, lineHeight: 18 },
  addRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
});
