import { ReactNode, useCallback, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { AlertTriangle, Camera, Crop, File, FileCheck, FileX, Files, ImageOff, Scale, Smartphone, Sun, UserX } from "lucide-react-native";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { PrimaryButton } from "@/components/Buttons";
import { CloseButton, CORNER_CLOSE } from "@/components/IconButtons";
import type { LucideIcon } from "@/theme/icons";
import { MAX_FILES, MAX_FILE_BYTES, MAX_TOTAL_BYTES, sizeText } from "@/utils/uploadLimits";

/** `lead` is the bold keyword the patient scans for; `text` is the instruction. */
type Rule = { icon: LucideIcon; lead: string; text: string };

/** Bulk Upload takes many files from the phone; Add Document (the + in My Documents) takes one, chosen or photographed. */
const LIMITS_MANY: Rule[] = [
  { icon: Files, lead: "Files:", text: `up to ${MAX_FILES} at a time` },
  { icon: Scale, lead: "Total size:", text: `up to ${sizeText(MAX_TOTAL_BYTES)}` },
  { icon: FileCheck, lead: "Each file:", text: `${sizeText(MAX_FILE_BYTES)} or smaller` },
];
const LIMITS_ONE: Rule[] = [
  { icon: File, lead: "Files:", text: "one at a time" },
  { icon: FileCheck, lead: "File size:", text: `${sizeText(MAX_FILE_BYTES)} or smaller` },
];
/** What every file must be, whether it is a scan, a photo or a PDF - one list for Bulk Upload and for Add Document. */
const DOCUMENT_RULES: Rule[] = [
  { icon: File, lead: "One document per file.", text: "Do not combine several documents in one file." },
  { icon: Crop, lead: "Complete.", text: "Include every page, with all edges visible and nothing cropped." },
  { icon: Sun, lead: "Legible.", text: "Text must be sharp and readable, with no blur, glare or shadows." },
  { icon: Smartphone, lead: "Correct orientation.", text: "Upright, not rotated or upside down." },
  { icon: FileX, lead: "Flat and undamaged.", text: "No folds, creases or tears over the text." },
  { icon: ImageOff, lead: "Medical records only.", text: "No blank pages, selfies or unrelated files." },
  { icon: UserX, lead: "Your own records.", text: "For a family member, switch to their profile first." },
];

function Section({ title, rules }: { title: string; rules: Rule[] }) {
  const { theme } = useAppTheme();
  return (
    <View>
      <Text style={[styles.section, { color: theme.text }]}>{title}</Text>
      {rules.map((r, i) => (
        <View key={r.lead} style={[styles.row, i === rules.length - 1 && { borderBottomWidth: 0 }]}>
          <View style={[styles.chip, { backgroundColor: theme.bg }]}><r.icon size={17} color={theme.text} strokeWidth={2.2} /></View>
          <Text style={styles.ruleText}><Text style={styles.ruleLead}>{r.lead}</Text> {r.text}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Shown before the picker (or, in Add Document, the camera) opens, so the patient knows the limits and what a readable file looks
 * like before anything is sent. `many` is Bulk Upload (files only, all the limits); otherwise one file (My Documents), which
 * can also be photographed and so gets one extra line about that.
 */
export function UploadGuidelinesModal({ visible, many, onChoose }: { visible: boolean; many: boolean; onChoose: (go: boolean) => void }) {
  const { height } = useWindowDimensions();
  const { theme } = useAppTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => onChoose(false)} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <CloseButton onPress={() => onChoose(false)} style={CORNER_CLOSE} />
          <View style={styles.iconWrap}><AlertTriangle size={26} color={NEUTRAL.warning} strokeWidth={2.2} /></View>
          <Text style={styles.title}>Before you upload</Text>

          <ScrollView style={[styles.list, { maxHeight: Math.min(540, Math.max(220, height - 340)) }]} showsVerticalScrollIndicator={false}>
            <Section title="LIMITS" rules={many ? LIMITS_MANY : LIMITS_ONE} />
            <Section title="DOCUMENT GUIDELINES" rules={DOCUMENT_RULES} />
            {!many && (
              <View style={[styles.photoNote, { backgroundColor: theme.bg }]}>
                <Camera size={17} color={theme.text} strokeWidth={2.2} />
                <Text style={styles.photoNoteText}>
                  <Text style={styles.ruleLead}>Photographing a paper?</Text> Place it flat on a plain surface in good light and hold the phone steady, directly above it.
                </Text>
              </View>
            )}
            <View style={styles.warn}><Text style={styles.warnText}>If a file is not clear, the system may read it incorrectly and you may need to upload it again.</Text></View>
          </ScrollView>

          <PrimaryButton label="I understand, continue" onPress={() => onChoose(true)} style={styles.full} />
          <Pressable onPress={() => onChoose(false)} style={styles.cancel} accessibilityRole="button" accessibilityLabel="Cancel">
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/**
 * `ask(many)` shows the modal and resolves true when the patient continues, false when they cancel. Render `dialog` once:
 *   const { ask: askGuidelines, dialog: guidelinesDialog } = useUploadGuidelines();   ...   {guidelinesDialog}
 */
export function useUploadGuidelines(): { ask: (many: boolean) => Promise<boolean>; dialog: ReactNode } {
  const [many, setMany] = useState<boolean | null>(null);
  const resolveRef = useRef<((go: boolean) => void) | null>(null);

  const ask = useCallback(
    (m: boolean) =>
      new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
        setMany(m);
      }),
    [],
  );
  const choose = useCallback((go: boolean) => {
    setMany(null);
    resolveRef.current?.(go);
    resolveRef.current = null;
  }, []);

  const dialog = <UploadGuidelinesModal visible={many !== null} many={!!many} onChoose={choose} />;
  return { ask, dialog };
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(12,35,64,0.45)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  card: {
    width: "100%", maxWidth: 380, backgroundColor: NEUTRAL.surface, borderRadius: 22, paddingHorizontal: 18, paddingTop: 22, paddingBottom: 12,
    alignItems: "center", shadowColor: "#0C2340", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 18, elevation: 10,
  },
  iconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", marginBottom: 10, backgroundColor: NEUTRAL.warningBg },
  title: { fontSize: 17, fontWeight: "700", color: NEUTRAL.textPrimary, textAlign: "center", marginBottom: 4 },
  list: { alignSelf: "stretch", marginBottom: 12 },
  section: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, marginTop: 12, marginBottom: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: NEUTRAL.border },
  chip: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  ruleText: { flex: 1, fontSize: 13.5, lineHeight: 18, color: NEUTRAL.textPrimary },
  ruleLead: { fontWeight: "700" },
  photoNote: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 12, padding: 10, marginTop: 12 },
  photoNoteText: { flex: 1, fontSize: 13, lineHeight: 18, color: NEUTRAL.textPrimary },
  warn: { backgroundColor: NEUTRAL.dangerBg, borderRadius: 12, padding: 10, marginTop: 12 },
  warnText: { fontSize: 12.5, lineHeight: 17, color: NEUTRAL.danger },
  full: { alignSelf: "stretch" },
  cancel: { alignItems: "center", paddingVertical: 12, alignSelf: "stretch" },
  cancelText: { fontSize: 14.5, fontWeight: "700", color: NEUTRAL.textSecondary },
});
