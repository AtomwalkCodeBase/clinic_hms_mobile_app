import { ReactNode, useCallback, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AlertTriangle, FileText, Image as ImageIcon, UploadCloud } from "lucide-react-native";
import { NEUTRAL } from "@/theme/themes";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import type { PickedFile } from "@/utils/fileHelpers";
import { batchProblem, fileProblem, sizeText } from "@/utils/uploadLimits";

export type PickedChoice = "upload" | "edit" | "cancel";

/**
 * Shown right after files are chosen in the phone's file picker, before anything is sent: what will be uploaded, which
 * files cannot be (and why), and three choices - Upload, Edit (choose again) and Cancel (send nothing).
 */
export function ConfirmPickedDialog({ visible, files, onChoose }: { visible: boolean; files: PickedFile[]; onChoose: (choice: PickedChoice) => void }) {
  const checked = files.map((f) => ({ file: f, problem: fileProblem({ mimeType: f.mimeType, size: f.size ?? 0 }) }));
  const ok = checked.filter((c) => !c.problem);
  const bad = checked.filter((c) => c.problem);
  // Too many files, too many photos or too big in total: nothing can be sent until the patient chooses again.
  const together = batchProblem(ok.map((c) => ({ mimeType: c.file.mimeType, size: c.file.size ?? 0 })));
  const title = ok.length === 0
    ? (files.length === 1 ? "This file can't be uploaded" : "These files can't be uploaded")
    : together ? "These files can't be uploaded together"
    : ok.length === 1 ? "Upload this file?" : `Upload these ${ok.length} files?`;
  const canUpload = ok.length > 0 && !together;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => onChoose("cancel")} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: canUpload ? NEUTRAL.surfaceAlt : NEUTRAL.dangerBg }]}>
            {canUpload
              ? <UploadCloud size={24} color={NEUTRAL.textSecondary} strokeWidth={2.2} />
              : <AlertTriangle size={24} color={NEUTRAL.danger} strokeWidth={2.2} />}
          </View>
          <Text style={styles.title}>{title}</Text>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false} nestedScrollEnabled>
            {together && (
              <View style={[styles.badBox, { marginBottom: 10 }]}>
                <Text style={styles.badWhy}>{together} Choose fewer files and try again.</Text>
              </View>
            )}
            {ok.map(({ file }, i) => (
              <View key={`ok${i}`} style={styles.row}>
                {file.mimeType === "application/pdf"
                  ? <FileText size={18} color={NEUTRAL.textSecondary} strokeWidth={2} />
                  : <ImageIcon size={18} color={NEUTRAL.textSecondary} strokeWidth={2} />}
                <Text style={styles.name} numberOfLines={1}>{file.name}</Text>
                <Text style={styles.size}>{sizeText(file.size ?? 0)}</Text>
              </View>
            ))}
            {bad.length > 0 && (
              <View style={[styles.badBox, ok.length > 0 && { marginTop: 10 }]}>
                <Text style={styles.badHead}>
                  {bad.length === 1 ? "1 file can't be uploaded" : `${bad.length} files can't be uploaded`}
                </Text>
                {bad.map(({ file, problem }, i) => (
                  <View key={`bad${i}`} style={{ marginTop: 6 }}>
                    <Text style={styles.badName} numberOfLines={1}>{file.name}</Text>
                    <Text style={styles.badWhy}>{problem}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {canUpload && (
            <>
              <View style={styles.keepOpen}>
                <Text style={styles.keepOpenText}>
                  Kindly keep the app open until the upload is complete. Once it is done, you can switch to other apps while your documents are read in the background.
                </Text>
              </View>
              <PrimaryButton
                label={ok.length === 1 ? "Upload" : `Upload ${ok.length} files`}
                onPress={() => onChoose("upload")}
                style={styles.full}
              />
            </>
          )}
          <View style={styles.row2}>
            <SecondaryButton label="Edit" onPress={() => onChoose("edit")} style={styles.half} />
            <SecondaryButton label="Cancel" onPress={() => onChoose("cancel")} style={styles.half} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * `confirm(files)` shows the dialog and resolves with the patient's choice. Render `dialog` once in the screen:
 *   const { confirm, dialog } = useConfirmPicked();   ...   {dialog}
 */
export function useConfirmPicked(): { confirm: (files: PickedFile[]) => Promise<PickedChoice>; dialog: ReactNode } {
  const [files, setFiles] = useState<PickedFile[] | null>(null);
  const resolveRef = useRef<((c: PickedChoice) => void) | null>(null);

  const confirm = useCallback(
    (picked: PickedFile[]) =>
      new Promise<PickedChoice>((resolve) => {
        resolveRef.current = resolve;
        setFiles(picked);
      }),
    [],
  );
  const choose = useCallback((choice: PickedChoice) => {
    setFiles(null);
    resolveRef.current?.(choice);
    resolveRef.current = null;
  }, []);

  const dialog = <ConfirmPickedDialog visible={!!files} files={files ?? []} onChoose={choose} />;
  return { confirm, dialog };
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(12,35,64,0.45)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  card: {
    width: "100%", maxWidth: 360, backgroundColor: NEUTRAL.surface, borderRadius: 22, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 16,
    alignItems: "center", shadowColor: "#0C2340", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 18, elevation: 10,
  },
  iconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  title: { fontSize: 16, fontWeight: "700", color: NEUTRAL.textPrimary, textAlign: "center", marginBottom: 12 },
  list: { alignSelf: "stretch", maxHeight: 240, marginBottom: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: NEUTRAL.border },
  name: { flex: 1, fontSize: 13, color: NEUTRAL.textPrimary },
  size: { fontSize: 12, color: NEUTRAL.textSecondary },
  badBox: { backgroundColor: NEUTRAL.dangerBg, borderRadius: 12, padding: 12 },
  badHead: { fontSize: 12.5, fontWeight: "700", color: NEUTRAL.danger },
  badName: { fontSize: 12.5, fontWeight: "600", color: NEUTRAL.textPrimary },
  badWhy: { fontSize: 12, color: NEUTRAL.danger, marginTop: 1, lineHeight: 16 },
  keepOpen: { alignSelf: "stretch", backgroundColor: NEUTRAL.surfaceAlt, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 10 },
  keepOpenText: { fontSize: 12.5, lineHeight: 17, color: NEUTRAL.textSecondary, textAlign: "center" },
  full: { alignSelf: "stretch", marginBottom: 8 },
  row2: { flexDirection: "row", gap: 10, alignSelf: "stretch" },
  half: { flex: 1 },
});
