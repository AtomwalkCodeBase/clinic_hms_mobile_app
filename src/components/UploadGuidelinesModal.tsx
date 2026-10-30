import { ReactNode, useCallback, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { AlertTriangle, File, FileCheck, FileX, Files, ImageOff, Images, Scale, Smartphone, Sun } from "lucide-react-native";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { PrimaryButton } from "@/components/Buttons";
import type { LucideIcon } from "@/theme/icons";
import { MAX_FILES, MAX_FILE_BYTES, MAX_PHOTOS, MAX_TOTAL_BYTES, sizeText } from "@/utils/uploadLimits";

type Rule = { icon: LucideIcon; text: string };

/** Bulk Upload takes many files; Add Document (the + in My Documents) takes one. The photo tips are the same for both. */
const LIMITS_MANY: Rule[] = [
  { icon: Files, text: `Maximum ${MAX_FILES} files at a time` },
  { icon: Images, text: `Maximum ${MAX_PHOTOS} photos at a time` },
  { icon: Scale, text: `Maximum ${sizeText(MAX_TOTAL_BYTES)} in total` },
  { icon: FileCheck, text: `Each file must be ${sizeText(MAX_FILE_BYTES)} or smaller` },
];
const LIMITS_ONE: Rule[] = [
  { icon: File, text: "One file at a time" },
  { icon: FileCheck, text: `The file must be ${sizeText(MAX_FILE_BYTES)} or smaller` },
];
const PHOTO_TIPS: Rule[] = [
  { icon: Images, text: "One document per photo, never several together" },
  { icon: Sun, text: "Take it in good light, sharp and in focus" },
  { icon: Smartphone, text: "Hold the phone upright, not rotated" },
  { icon: FileX, text: "No torn or crumpled papers" },
  { icon: ImageOff, text: "No blank pages, selfies or other unrelated photos" },
];

function Section({ title, rules }: { title: string; rules: Rule[] }) {
  const { theme } = useAppTheme();
  return (
    <View>
      <Text style={[styles.section, { color: theme.text }]}>{title}</Text>
      {rules.map((r, i) => (
        <View key={r.text} style={[styles.row, i === rules.length - 1 && { borderBottomWidth: 0 }]}>
          <View style={[styles.chip, { backgroundColor: theme.bg }]}><r.icon size={17} color={theme.text} strokeWidth={2.2} /></View>
          <Text style={styles.ruleText}>{r.text}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Shown before the picker or the camera opens, so the patient knows the limits and how to take a readable photo before
 * anything is sent. `many` is Bulk Upload (all the limits); otherwise one file (My Documents).
 */
export function UploadGuidelinesModal({ visible, many, onChoose }: { visible: boolean; many: boolean; onChoose: (go: boolean) => void }) {
  const { height } = useWindowDimensions();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => onChoose(false)} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}><AlertTriangle size={26} color={NEUTRAL.warning} strokeWidth={2.2} /></View>
          <Text style={styles.title}>Before you upload</Text>

          <ScrollView style={[styles.list, { maxHeight: Math.min(540, Math.max(220, height - 340)) }]} showsVerticalScrollIndicator={false}>
            <Section title="LIMITS" rules={many ? LIMITS_MANY : LIMITS_ONE} />
            <Section title="FOR A CLEAR PHOTO" rules={PHOTO_TIPS} />
            <View style={styles.warn}><Text style={styles.warnText}>If the photo is unclear, the system may read it wrongly.</Text></View>
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
  warn: { backgroundColor: NEUTRAL.dangerBg, borderRadius: 12, padding: 10, marginTop: 12 },
  warnText: { fontSize: 12.5, lineHeight: 17, color: NEUTRAL.danger },
  full: { alignSelf: "stretch" },
  cancel: { alignItems: "center", paddingVertical: 12, alignSelf: "stretch" },
  cancelText: { fontSize: 14.5, fontWeight: "700", color: NEUTRAL.textSecondary },
});
