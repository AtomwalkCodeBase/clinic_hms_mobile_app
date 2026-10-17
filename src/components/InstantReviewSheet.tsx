import { useEffect, useState } from "react";
import { Modal, Pressable, View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Pencil, Trash2 } from "lucide-react-native";
import { CloseButton } from "@/components/IconButtons";
import { NEUTRAL } from "@/theme/themes";
import { CARD_TEXT } from "@/theme/cardSizes";
import { useAppTheme } from "@/context/ThemeContext";
import { apiErrorMessage } from "@/api/client";
import { dismissDocument, getDocumentDetail, getFamily, retryDocument, submitDecisions, updateDoctorName } from "@/api/portal";
import { useDocumentTypes } from "@/hooks/useDocumentTypes";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PrimaryButton } from "@/components/Buttons";
import { FileItem, ViewButton } from "@/components/FileItem";
import type { MenuItem } from "@/components/CardMenu";
import { DoctorNameSheet } from "@/components/DoctorNameSheet";
import { personColours } from "@/utils/personColours";
import { AppStackParamList } from "@/navigation/types";
import { TypePickerSheet } from "@/components/TypePickerSheet";
import { currentType, isReviewable } from "@/utils/reviewDraft";
import { cardDate } from "@/utils/documentLabels";

const IN_PROGRESS = new Set(["queued", "extracting", "classifying"]);

/**
 * Add Document (one file): once the file has been uploaded, this follows it while the server reads it, then shows the
 * suggested type. Change (or Classify, when there is none) opens the category list; Submit saves the file under its type.
 * A final "Submit or Edit" dialog guards the save, because a submitted document is locked.
 * Closing without submitting leaves the file in the Files list on the Bulk Upload screen.
 */
export function InstantReviewSheet({
  documentId,
  patientAwpid,
  onClose,
  onSubmitted,
}: {
  documentId: number | null;
  patientAwpid?: string;
  onClose: () => void;
  /** called once the document is submitted, with its final type */
  onSubmitted: (type: string) => void;
}) {
  const { theme } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [viewing, setViewing] = useState(false);
  useEffect(() => navigation.addListener("focus", () => setViewing(false)), [navigation]);
  const insets = useSafeAreaInsets();
  const { labelOf } = useDocumentTypes();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [asking, setAsking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingDoctor, setEditingDoctor] = useState(false);

  const queryClient = useQueryClient();
  const familyQ = useQuery({ queryKey: ["family"], queryFn: getFamily });
  const person = familyQ.data?.find((m) => m.awpid === patientAwpid);
  const docQ = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => getDocumentDetail(documentId as number, { patientAwpid }),
    enabled: documentId != null,
    refetchInterval: (query) => (!query.state.data || IN_PROGRESS.has(query.state.data.processing_status) ? 1500 : false),
  });
  const doc = docQ.data;
  const entry = { selectedType, stage: "review" as const };
  const type = doc ? currentType(doc, entry) : null;

  function close() {
    setSelectedType(null);
    setError("");
    onClose();
  }

  async function save() {
    if (!doc || !type) return;
    setSaving(true);
    setError("");
    try {
      const result = await submitDecisions([{ document_id: doc.id, document_type: type }], patientAwpid);
      setAsking(false);
      if (result.submitted.includes(doc.id)) {
        setSelectedType(null);
        onSubmitted(type);
      } else {
        setError("This document couldn't be saved. Please try again.");
      }
    } catch (err) {
      setAsking(false);
      setError(apiErrorMessage(err, "Nothing was saved. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  /** Opens the file in the viewer; this sheet steps aside until the patient comes back. */
  function openViewer() {
    if (!doc) return;
    setViewing(true);
    navigation.navigate("DocumentViewer", { ids: [doc.id], index: 0, ...(patientAwpid ? { patientAwpid } : {}) });
  }

  async function retry() {
    if (!doc) return;
    try {
      await retryDocument(doc.id, patientAwpid);
      docQ.refetch();
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't try again."));
    }
  }

  async function saveDoctor(name: string) {
    if (!doc) return;
    try {
      await updateDoctorName(doc.id, name, patientAwpid);
    } catch (err) {
      throw new Error(apiErrorMessage(err, "Couldn't save the name."));
    }
    await docQ.refetch();
    queryClient.invalidateQueries({ queryKey: ["documents"] });
    setEditingDoctor(false);
  }

  async function dismiss() {
    if (!doc) return;
    try {
      await dismissDocument(doc.id, patientAwpid);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["documentCounts"] });
      setDeleting(false);
      close();
    } catch (err) {
      setDeleting(false);
      setError(apiErrorMessage(err, "Couldn't delete that file."));
    }
  }

  const working = !doc || IN_PROGRESS.has(doc.processing_status);
  const failed = doc?.processing_status === "failed";

  return (
    <>
      <Modal visible={documentId != null && !viewing} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={close}>
          <View style={[styles.sheet, { paddingBottom: Math.max(20, insets.bottom + 12) }]} onStartShouldSetResponder={() => true}>
            <View style={styles.handle} />
            <View style={styles.head}>
              <Text style={styles.title}>Add Document</Text>
              <CloseButton onPress={close} />
            </View>

            {working ? (
              <View style={styles.center}>
                <ActivityIndicator color={theme.fill} />
                <Text style={styles.centerTitle}>Reading your document…</Text>
                <Text style={styles.centerSub}>This takes a few seconds.</Text>
              </View>
            ) : failed ? (
              <View style={styles.center}>
                <Text style={[styles.centerTitle, { color: NEUTRAL.danger }]}>We couldn't read this file</Text>
                <Text style={styles.centerSub}>{doc?.error || "Something went wrong while reading it."}</Text>
                <Pressable onPress={retry} style={[styles.retry, { backgroundColor: theme.fill }]}><Text style={[styles.retryText, { color: theme.on }]}>Try again</Text></Pressable>
                <Pressable onPress={() => setDeleting(true)} hitSlop={8}><Text style={styles.removeText}>Delete this file</Text></Pressable>
              </View>
            ) : doc && isReviewable(doc) ? (
              <>
                <View style={styles.notice}>
                  <AlertCircle size={15} color={NEUTRAL.warning} strokeWidth={2.2} />
                  <Text style={styles.noticeText}>Check the type below, then submit.</Text>
                </View>
                <FileItem
                  title={type ? labelOf(type) : "Not classified"}
                  date={cardDate(doc)}
                  forName={patientAwpid ? person?.full_name ?? "Family member" : "Myself"}
                  nameColor={personColours(person).text}
                  doctorName={doc.doctor_name}
                  onEditDoctor={() => setEditingDoctor(true)}
                  status={!type ? (
                    <Pressable onPress={() => setPicking(true)} hitSlop={8} style={{ alignSelf: "flex-start", marginTop: 6 }}>
                      <Text style={[styles.lineText, { color: NEUTRAL.warning, fontWeight: "700" }]}>Not classified. Choose a type ›</Text>
                    </Pressable>
                  ) : undefined}
                  footerLeft={<ViewButton onPress={openViewer} />}
                  typeCode={type}
                  menu={[
                    { key: "type", label: "Change type", icon: Pencil, onPress: () => setPicking(true) },
                    { key: "delete", label: "Delete", icon: Trash2, danger: true, onPress: () => setDeleting(true) },
                  ] as MenuItem[]}
                />
                <PrimaryButton label="Submit" onPress={() => setAsking(true)} disabled={!type} style={{ marginTop: 6, marginBottom: 8 }} />
                <Text style={styles.foot}>If you close this, the document stays in Bulk Upload until you submit it.</Text>
              </>
            ) : null}
            {!!error && <Text style={styles.error}>{error}</Text>}
          </View>
        </Pressable>
      </Modal>

      <TypePickerSheet
        visible={picking}
        selected={type}
        onSelect={(code) => { setSelectedType(code === doc?.suggested_type ? null : code); setPicking(false); }}
        onClose={() => setPicking(false)}
      />
      <DoctorNameSheet
        visible={editingDoctor}
        initial={doc?.doctor_name ?? ""}
        onSave={saveDoctor}
        onClose={() => setEditingDoctor(false)}
      />
      <ConfirmDialog
        visible={deleting}
        title="Delete this file?"
        message={`${doc?.file_name || doc?.title || "This file"} will be deleted for good. This can't be undone.`}
        confirmLabel="Delete"
        cancelLabel="Keep"
        danger
        onConfirm={dismiss}
        onCancel={() => setDeleting(false)}
      />

      <ConfirmDialog
        visible={asking}
        title="Submit this document?"
        message={`It will be saved as ${labelOf(type)} and the type can't be changed afterwards.`}
        confirmLabel="Submit"
        cancelLabel="Edit"
        loading={saving}
        onConfirm={save}
        onCancel={() => setAsking(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(12,35,64,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: NEUTRAL.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 14, paddingTop: 8 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: NEUTRAL.border, alignSelf: "center", marginBottom: 10 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingHorizontal: 2 },
  title: { fontSize: 15, fontWeight: "700", color: NEUTRAL.textPrimary },
  center: { alignItems: "center", paddingVertical: 26, gap: 8 },
  centerTitle: { fontSize: 14, fontWeight: "600", color: NEUTRAL.textPrimary },
  centerSub: { fontSize: 12, color: NEUTRAL.textSecondary, textAlign: "center", paddingHorizontal: 12 },
  retry: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText: { fontSize: 13, fontWeight: "700" },
  removeText: { fontSize: 12.5, fontWeight: "600", color: NEUTRAL.danger, marginTop: 4 },
  notice: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: NEUTRAL.warningBg, borderRadius: 10, padding: 10, marginBottom: 10 },
  noticeText: { flex: 1, fontSize: 12.5, fontWeight: "600", color: NEUTRAL.warning },
  foot: { fontSize: 11, color: NEUTRAL.textMuted, textAlign: "center", marginTop: 2 },
  lineText: { fontSize: CARD_TEXT.meta, marginTop: 3 },
  error: { fontSize: 12, color: NEUTRAL.danger, textAlign: "center", marginTop: 10 },
});
