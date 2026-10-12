import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Animated, BackHandler } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Eye, Hand, LayoutGrid, Pencil, RefreshCw, Trash2, Upload } from "lucide-react-native";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { BackHeader, EmptyState, ErrorBanner, Screen } from "@/components/Layout";
import { SegmentedControl } from "@/components/SegmentedControl";
import { PrimaryButton } from "@/components/Buttons";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MessageDialog } from "@/components/MessageDialog";
import { FileItem, FileList, MoveBackButton, RowActions } from "@/components/FileItem";
import { HelpButton, HelpItem, HelpSheet } from "@/components/HelpSheet";
import { SelectionStrip } from "@/components/SelectionBar";
import { UploadSheet } from "@/components/UploadSheet";
import { UploadStages } from "@/components/UploadStages";
import { useWhoIsThisFor } from "@/components/WhoIsThisFor";
import { TypePickerSheet } from "@/components/TypePickerSheet";
import { TypeTag } from "@/components/TypeAvatar";
import { BatchSummaryCard } from "@/components/BatchSummaryCard";
import { TypeChipsRow } from "@/components/TypeChipsRow";
import { ViewModeToggle } from "@/components/ViewModeToggle";
import { NEUTRAL } from "@/theme/themes";
import { CARD_TEXT } from "@/theme/cardSizes";
import { useAppTheme } from "@/context/ThemeContext";
import { useDocumentUpload } from "@/context/DocumentUploadContext";
import { useViewMode } from "@/context/ViewModeContext";
import { useDocumentTypes } from "@/hooks/useDocumentTypes";
import { useReviewDraft } from "@/hooks/useReviewDraft";
import { useSelection } from "@/hooks/useSelection";
import { apiErrorMessage } from "@/api/client";
import { dismissDocument, getFamily, getMyDocuments, retryDocument, submitDecisions } from "@/api/portal";
import type { PatientDocument } from "@/api/types";
import { buildDecisions, canSelect, currentType, isEdited, isReviewable, stageOf, typeCounts } from "@/utils/reviewDraft";
import { pickDocuments } from "@/utils/fileHelpers";
import { AppStackParamList } from "@/navigation/types";

const IN_PROGRESS = new Set(["queued", "extracting", "classifying"]);
const NOT_EXTRACTED = new Set(["queued", "extracting"]);
const REVEAL_GAP_MS = 220;
const PAGE_SIZE = 100;
const MAX_PAGES = 10;
/** Previews are started for this many rows; "Load more" shows the next batch, so a long list never fires 100 downloads. */
const SHOW_FIRST = 30;

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
type PickerState = { doc: PatientDocument } | null;
type Notice = { title: string; message: string; tone: "success" | "error" } | null;

const HELP: HelpItem[] = [
  { icon: Upload, title: "Upload button", text: "At the top. Opens a sheet where you choose files or take photos with the camera." },
  { icon: Eye, title: "Tap the preview", text: "Opens the file here in the app so you can check it is the right one. Pinch or double-tap to zoom." },
  { icon: Hand, title: "Press and hold a file", text: "Selects it. Select more, then move them to Ready to Submit." },
  { icon: LayoutGrid, title: "List or grid", text: "The two icons next to the type chips. Your choice is remembered on every screen." },
  { icon: Pencil, title: "Pencil icon", text: "Change the type of a file that was filed wrongly. A file with no type shows Classify." },
  { icon: Trash2, title: "Bin icon", text: "Deletes a file for good. It asks first." },
  { icon: RefreshCw, title: "Pull the top part down", text: "Refreshes the screen. The list itself does not refresh." },
];

/**
 * Bulk Upload: send several files at once, then review them here. Each file lands in the Files list with the system's
 * suggested type, already confirmed; the patient changes a type that is wrong (or gives one to a file the rules could
 * not classify). Tap a preview to open the file in the viewer. Press and hold selects files, and "Move to Ready to
 * Submit" sends the selected ones to the Ready list. Nothing is saved until they submit — the server then files each
 * document under the chosen type and locks it, and it appears in My Documents.
 */
export function DocumentUploadScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "DocumentUpload">>();
  // Whose files this screen is about: the person chosen in "Who is this for?" (asked every time files are added). The list
  // below, the review and the submit all follow it.
  const [patientAwpid, setPatientAwpid] = useState<string | undefined>(route.params?.patientAwpid);
  const who = useWhoIsThisFor(patientAwpid);
  const familyQ = useQuery({ queryKey: ["family"], queryFn: getFamily });
  const { theme } = useAppTheme();
  const { mode } = useViewMode();
  const queryClient = useQueryClient();
  const { uploading, uploadPct, fileCount, startUpload, ready: justRead, clearReady } = useDocumentUpload();
  // The files just sent are read right here, so the "ready to review" bar on My Documents has nothing left to say.
  useEffect(() => { if (justRead) clearReady(); }, [justRead, clearReady]);
  const { labelOf } = useDocumentTypes();
  const { draft, loaded, setType, moveToReady, moveBack, keepOnly } = useReviewDraft(patientAwpid ?? "self");
  const sel = useSelection();

  const [tab, setTab] = useState<Tab>("review");
  const [picker, setPicker] = useState<PickerState>(null);
  const [askSubmit, setAskSubmit] = useState<{ scope: "ready" | "all"; count: number; left: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [actionError, setActionError] = useState("");
  const [dismissing, setDismissing] = useState<PatientDocument | null>(null);
  const [removing, setRemoving] = useState(false);
  const [hint, setHint] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [limit, setLimit] = useState(SHOW_FIRST);

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
  useEffect(() => { seeded.current = false; setRevealed(new Set()); }, [patientAwpid]);       // another person, another list
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

  const inReview = visible.filter((d) => stageOf(d, draft[d.id]) === "review");
  const ready = visible.filter((d) => stageOf(d, draft[d.id]) === "ready" && isReviewable(d));
  const tabList = tab === "review" ? inReview : ready;
  const chipItems = useMemo(() => typeCounts(tabList, draft), [tabList, draft]);
  const batchCounts = useMemo(() => typeCounts(visible, draft), [visible, draft]);
  // Tapping a type chip shows only that type; drop the filter when nothing of that type is left on this tab.
  const [typeFilter, setTypeFilter] = useState("");
  useEffect(() => {
    if (typeFilter && !chipItems.some((c) => c.code === typeFilter)) setTypeFilter("");
  }, [typeFilter, chipItems]);
  useEffect(() => { setLimit(SHOW_FIRST); }, [tab, typeFilter, patientAwpid]);
  const shown = typeFilter ? tabList.filter((d) => (currentType(d, draft[d.id]) ?? "not_classified") === typeFilter) : tabList;
  const onScreen = shown.slice(0, limit);
  const submittable = visible.filter((d) => canSelect(d, draft[d.id])).length;

  // Only a read file that has a type can be selected; drop anything that stops being so (deleted, moved, retyped away).
  const selectableKey = inReview.filter((d) => canSelect(d, draft[d.id])).map((d) => d.id).join(",");
  const { keepOnly: keepSelected, clear: clearSelected, selecting, count: selectedCount } = sel;
  useEffect(() => { keepSelected(selectableKey ? selectableKey.split(",").map(Number) : []); }, [selectableKey, keepSelected]);
  useEffect(() => { clearSelected(); }, [tab, clearSelected]);
  useEffect(() => {
    if (!selecting) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { clearSelected(); return true; });
    return () => sub.remove();
  }, [selecting, clearSelected]);

  // ── actions ────────────────────────────────────────────────────────────────
  async function addFiles() {
    try {
      const target = await who.ask();
      if (!target) return;
      setPatientAwpid(target.awpid);
      const picked = await pickDocuments();
      if (!picked.length) return;
      const outcome = await startUpload(
        picked.map((f) => ({ name: f.name || "upload", mimeType: f.mimeType || "application/octet-stream", size: f.size || 0, uri: f.uri })),
        "bulk",
        target.awpid,
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

  async function takePhotos() {
    const target = await who.ask();
    if (!target) return;
    setPatientAwpid(target.awpid);
    navigation.navigate("DocumentCapture", { mode: "bulk", ...(target.awpid ? { patientAwpid: target.awpid } : {}) });
  }

  /** The Upload sheet closes first, then the chosen action starts (a sheet and a dialog can't both be on screen). */
  function chooseUpload(action: () => void) {
    setUploadOpen(false);
    setTimeout(action, 320);
  }

  async function changePerson() {
    const target = await who.ask();
    if (target) setPatientAwpid(target.awpid);
  }

  /** Opens the file in the in-app viewer, with the other files of this list in its strip. */
  function openViewer(doc: PatientDocument) {
    const ids = shown.map((d) => d.id);
    navigation.navigate("DocumentViewer", { ids, index: Math.max(0, ids.indexOf(doc.id)), ...(patientAwpid ? { patientAwpid } : {}) });
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

  async function doDismiss() {
    if (!dismissing) return;
    setRemoving(true);
    setActionError("");
    try {
      await dismissDocument(dismissing.id, patientAwpid);
      setDismissing(null);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["documentCounts"] });
    } catch (err) {
      setDismissing(null);
      setActionError(apiErrorMessage(err, "Couldn't delete that file."));
    } finally {
      setRemoving(false);
    }
  }

  function showHint(text: string) {
    setHint(text);
    setTimeout(() => setHint(""), 2600);
  }

  /** Press and hold: start a selection with this file (only a read file that has a type can be selected). */
  function onRowLongPress(doc: PatientDocument) {
    if (tab !== "review" || !isReviewable(doc)) return;
    if (!canSelect(doc, draft[doc.id])) { showHint("Classify this file first, then you can select it."); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    sel.add(doc.id);
  }

  /** While files are selected, a tap on a file toggles it. */
  function toggleSelected(doc: PatientDocument) {
    if (!canSelect(doc, draft[doc.id])) { showHint("Classify this file first."); return; }
    sel.toggle(doc.id);
  }

  /** The preview: opens the viewer, or toggles the file while others are selected. */
  function onPreview(doc: PatientDocument) {
    if (sel.selecting) toggleSelected(doc);
    else openViewer(doc);
  }

  function selectAll() {
    sel.setMany(shown.filter((d) => canSelect(d, draft[d.id])).map((d) => d.id));
  }

  function moveSelected() {
    moveToReady([...sel.ids]);
    sel.clear();
    setTab("ready");
  }

  /** The patient picks a type: it becomes their choice for this file (a file with no type is now classified). */
  function onPick(code: string) {
    if (!picker) return;
    setType(picker.doc, code);
    setPicker(null);
  }

  function requestSubmit(scope: "ready" | "all") {
    const { decisions, missing } = buildDecisions(visible, draft, scope);
    if (!decisions.length) {
      setNotice({
        title: "Nothing to submit",
        message: scope === "ready" ? "Move some files to Ready to Submit first."
          : missing.length ? "Give each file a type first: tap Classify on it."
          : "No documents are ready yet.",
        tone: "error",
      });
      return;
    }
    // Files with no type are left behind in the list; everything that has a type goes.
    setAskSubmit({ scope, count: decisions.length, left: scope === "all" ? missing.length : 0 });
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
              message: "Some documents couldn't be submitted. They are still in the list; check them and try again.",
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

  /** What goes under a file's name: its type tag (a card shows the tag over the preview instead), or its state. */
  function lineFor(doc: PatientDocument) {
    const type = currentType(doc, draft[doc.id]);
    if (!isReviewable(doc) && doc.processing_status !== "failed") return <Text style={styles.sub}>Reading your document…</Text>;
    if (doc.processing_status === "failed") {
      return (
        <View>
          <Text style={[styles.sub, { color: NEUTRAL.danger }]} numberOfLines={2}>{doc.error || "Couldn't read this file"}</Text>
          <Pressable onPress={() => retry(doc)} hitSlop={8} style={{ alignSelf: "flex-start", marginTop: 4 }}>
            <Text style={[styles.link, { color: theme.text }]}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    if (!type) return <Text style={[styles.sub, { color: NEUTRAL.warning }]}>Not classified — choose a type</Text>;
    if (mode === "grid" && !isEdited(draft[doc.id])) return null;      // the card shows the tag over its preview
    return (
      <View style={styles.lineRow}>
        {mode === "list" && <TypeTag code={type} label={labelOf(type)} />}
        {isEdited(draft[doc.id]) ? <Text style={styles.edited}>edited</Text> : null}
      </View>
    );
  }

  function actionsFor(doc: PatientDocument) {
    if (sel.selecting) return undefined;
    const failed = doc.processing_status === "failed";
    const reading = !isReviewable(doc) && !failed;
    if (reading) return undefined;
    if (tab === "ready") return <MoveBackButton onPress={() => moveBack(doc.id)} />;
    return (
      <RowActions
        hasType={!!currentType(doc, draft[doc.id])}
        showChange={!failed}
        onChange={() => setPicker({ doc })}
        onDelete={() => setDismissing(doc)}
        row={mode === "grid"}
      />
    );
  }

  const error = (pendingQ.error && apiErrorMessage(pendingQ.error)) || actionError;
  const pickerEntry = picker ? draft[picker.doc.id] : undefined;
  const footer = tab === "review" && selectedCount > 0 ? (
    <View style={styles.footer}>
      <PrimaryButton label={`Move ${selectedCount} to Ready to Submit`} onPress={moveSelected} />
    </View>
  ) : null;

  return (
    <Screen
      onRefresh={onRefresh}
      refreshing={refreshing}
      footer={footer}
      pinnedBelow={tab === "review" && selecting ? <SelectionStrip count={selectedCount} onSelectAll={selectAll} onCancel={clearSelected} /> : undefined}
      header={
        <>
          <BackHeader
            title="Bulk Upload"
            onBack={() => navigation.goBack()}
            right={
              <>
                <Pressable onPress={() => setUploadOpen(true)} disabled={uploading} accessibilityRole="button" accessibilityLabel="Upload" style={[styles.upload, { backgroundColor: theme.fill }, uploading && { opacity: 0.6 }]}>
                  {uploading ? <ActivityIndicator size="small" color={theme.on} /> : <Upload size={15} color={theme.on} strokeWidth={2.4} />}
                  <Text style={[styles.uploadText, { color: theme.on }]}>Upload</Text>
                </Pressable>
                <HelpButton onPress={() => setHelpOpen(true)} />
              </>
            }
          />
          {(familyQ.data?.length ?? 0) > 0 && (
            <View style={styles.forRow}>
              <Text style={styles.forText}>
                For: <Text style={styles.forName}>{patientAwpid ? familyQ.data!.find((m) => m.awpid === patientAwpid)?.full_name ?? "Family member" : "Myself"}</Text>
              </Text>
              <Pressable onPress={changePerson} hitSlop={8}><Text style={[styles.forChange, { color: theme.text }]}>Change</Text></Pressable>
            </View>
          )}

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

          {!uploading && !groupWorking && <BatchSummaryCard counts={batchCounts} />}

          <SegmentedControl<Tab>
            options={[
              { key: "review", label: `Files (${inReview.length})` },
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
              style={styles.submit}
            />
          )}

          {tabList.length > 0 && (
            <TypeChipsRow items={chipItems} total={tabList.length} selected={typeFilter} onSelect={setTypeFilter} labelOf={labelOf} trailing={<ViewModeToggle />} />
          )}
        </>
      }
    >
      {!!hint && <Text style={styles.hint}>{hint}</Text>}

      {pendingQ.isLoading || !loaded ? (
        <ActivityIndicator color={theme.fill} style={{ marginTop: 30 }} />
      ) : shown.length === 0 ? (
        <EmptyState
          text={
            docs.length === 0 ? "No documents waiting. Tap Upload to add some."
            : waitingToShow > 0 && visible.length === 0 ? "Your documents will appear here as soon as they have been read."
            : tab === "review" ? "No files here."
            : "Nothing is ready yet. Press and hold files, then move them here."
          }
        />
      ) : (
        <>
          <FileList layout={mode}>
            {onScreen.map((doc, i) => {
              const type = currentType(doc, draft[doc.id]);
              return (
                <FadeIn key={doc.id}>
                  <FileItem
                    doc={doc}
                    layout={mode}
                    order={i}
                    patientAwpid={patientAwpid}
                    typeCode={type}
                    line={lineFor(doc)}
                    actions={actionsFor(doc)}
                    selected={sel.ids.has(doc.id)}
                    onOpen={() => onPreview(doc)}
                    onPress={sel.selecting ? () => toggleSelected(doc) : undefined}
                    onLongPress={() => onRowLongPress(doc)}
                  />
                </FadeIn>
              );
            })}
          </FileList>
          {shown.length > limit && (
            <Pressable onPress={() => setLimit((n) => n + SHOW_FIRST)} style={styles.more}>
              <Text style={[styles.moreText, { color: theme.text }]}>Show {Math.min(SHOW_FIRST, shown.length - limit)} more files</Text>
            </Pressable>
          )}
        </>
      )}

      {who.sheet}

      <UploadSheet
        visible={uploadOpen}
        many
        onClose={() => setUploadOpen(false)}
        onFiles={() => chooseUpload(addFiles)}
        onCamera={() => chooseUpload(takePhotos)}
      />
      <HelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} items={HELP} />

      <TypePickerSheet
        visible={!!picker}
        selected={picker ? currentType(picker.doc, pickerEntry) : null}
        onSelect={onPick}
        onClose={() => setPicker(null)}
      />

      <ConfirmDialog
        visible={!!dismissing}
        title="Delete this file?"
        message={
          dismissing?.processing_status === "failed"
            ? `${dismissing.file_name || dismissing.title || "This file"} couldn't be read. Deleting it removes it for good; you can upload it again any time.`
            : `${dismissing?.file_name || dismissing?.title || "This file"} will be deleted for good. This can't be undone.`
        }
        confirmLabel="Delete"
        cancelLabel="Keep"
        danger
        loading={removing}
        onConfirm={doDismiss}
        onCancel={() => setDismissing(null)}
      />

      <ConfirmDialog
        visible={!!askSubmit}
        title={`Submit ${askSubmit?.count ?? 0} document${askSubmit?.count === 1 ? "" : "s"}?`}
        message={`Once submitted, the type can't be changed. They will be added to My Documents.${askSubmit?.left ? ` ${askSubmit.left} file${askSubmit.left === 1 ? " has" : "s have"} no type and stay${askSubmit.left === 1 ? "s" : ""} here.` : ""}`}
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
  forRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  forText: { fontSize: 13, color: NEUTRAL.textSecondary },
  forName: { fontWeight: "700", color: NEUTRAL.textPrimary },
  forChange: { fontSize: 13, fontWeight: "600" },
  upload: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 13, height: 30, borderRadius: 15 },
  uploadText: { fontSize: 12.5, fontWeight: "700" },
  submit: { paddingVertical: 8, marginBottom: 10 },
  sub: { fontSize: CARD_TEXT.meta, color: NEUTRAL.textSecondary, marginTop: 3 },
  link: { fontSize: CARD_TEXT.meta, fontWeight: "600" },
  lineRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginTop: 4 },
  edited: { fontSize: CARD_TEXT.tiny, color: NEUTRAL.warning, backgroundColor: NEUTRAL.warningBg, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 8, marginLeft: 6, overflow: "hidden" },
  hint: { fontSize: 12.5, color: NEUTRAL.warning, backgroundColor: NEUTRAL.warningBg, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 10, overflow: "hidden" },
  more: { alignItems: "center", paddingVertical: 12 },
  moreText: { fontSize: 13, fontWeight: "600" },
  footer: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, backgroundColor: NEUTRAL.bg, borderTopWidth: 0.5, borderTopColor: NEUTRAL.border },
});
