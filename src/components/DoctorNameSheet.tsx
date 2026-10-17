import { useEffect, useState } from "react";
import { apiErrorMessage } from "@/api/client";
import { Modal, Pressable, View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CloseButton } from "@/components/IconButtons";
import { NEUTRAL, BRAND_TEXT } from "@/theme/themes";
import { PrimaryButton } from "@/components/Buttons";
import { DOCTOR_NAME_MAX, doctorNameProblem, isValidDoctorName, tidyDoctorName } from "@/utils/doctorName";

/**
 * "Doctor's name": a bottom sheet with a fixed "Dr." in front of the box, so the patient types only the name. Letters
 * and spaces only (the rule is in utils/doctorName.ts and is checked again by the server). Saving an empty box removes
 * the doctor. `onSave` gets the tidied name and may throw; the message is shown under the box.
 */
export function DoctorNameSheet({
  visible, initial, onSave, onClose,
}: {
  visible: boolean;
  /** the name now on the document, without "Dr." */
  initial: string;
  onSave: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) { setValue(initial); setError(""); setSaving(false); }
  }, [visible, initial]);

  const problem = doctorNameProblem(value);
  const name = tidyDoctorName(value);

  async function save() {
    if (!isValidDoctorName(value) || saving) return;
    setSaving(true);
    setError("");
    try {
      await onSave(name);
    } catch (err: any) {
      setError(apiErrorMessage(err, "Couldn't save the name. Try again."));
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <View style={[styles.sheet, { paddingBottom: Math.max(18, insets.bottom + 10) }]} onStartShouldSetResponder={() => true}>
            <View style={styles.handle} />
            <View style={styles.head}>
              <Text style={styles.title}>Doctor's name</Text>
              <CloseButton onPress={onClose} />
            </View>
            <Text style={styles.help}>As written on the document. Letters and spaces only.</Text>

            <View style={[styles.field, !!problem && { borderColor: NEUTRAL.danger }]}>
              <Text style={styles.prefix}>Dr.</Text>
              <TextInput
                value={value}
                onChangeText={setValue}
                placeholder="Anita Rao"
                placeholderTextColor={NEUTRAL.textMuted}
                style={styles.input}
                autoFocus
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={DOCTOR_NAME_MAX + 4}
                returnKeyType="done"
                onSubmitEditing={save}
              />
            </View>
            {problem ? (
              <Text style={[styles.note, { color: NEUTRAL.danger }]}>{problem}</Text>
            ) : error ? (
              <Text style={[styles.note, { color: NEUTRAL.danger }]}>{error}</Text>
            ) : (
              <Text style={styles.note}>{name ? `Shown as Dr. ${name}` : "Leave empty to remove the doctor."}</Text>
            )}

            <PrimaryButton label="Save" onPress={save} loading={saving} disabled={!!problem} style={{ marginTop: 6 }} />
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(12,35,64,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: NEUTRAL.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 8 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: NEUTRAL.border, alignSelf: "center", marginBottom: 10 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 17, fontWeight: "700", color: NEUTRAL.textPrimary },
  help: { fontSize: 12.5, color: NEUTRAL.textSecondary, marginTop: 4 },
  field: {
    flexDirection: "row", alignItems: "center", marginTop: 14, borderWidth: 1.5, borderColor: BRAND_TEXT,
    borderRadius: 12, backgroundColor: NEUTRAL.surface, overflow: "hidden",
  },
  prefix: { paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontWeight: "700", color: NEUTRAL.textSecondary, backgroundColor: NEUTRAL.surfaceAlt },
  input: { flex: 1, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: NEUTRAL.textPrimary },
  note: { fontSize: 12, color: NEUTRAL.textSecondary, marginTop: 6, marginBottom: 12, minHeight: 16 },
});
