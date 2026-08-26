import React from "react";
import { Modal, View, Text, StyleSheet } from "react-native";
import { CheckCircle2, XCircle } from "lucide-react-native";
import { NEUTRAL } from "@/theme/themes";
import { PrimaryButton } from "@/components/Buttons";
import { useAppTheme } from "@/context/ThemeContext";

/**
 * A single-button acknowledgment dialog — for actions that used to complete
 * silently (e.g. reschedule just did navigation.goBack() with no feedback
 * at all). Same visual language as ConfirmDialog, but for "this worked",
 * not "are you sure".
 */
export function MessageDialog({
  visible,
  title,
  message,
  buttonLabel = "Done",
  tone = "success",
  onDismiss,
}: {
  visible: boolean;
  title: string;
  message?: string;
  buttonLabel?: string;
  tone?: "success" | "error";
  onDismiss: () => void;
}) {
  const { theme, neutral } = useAppTheme();
  const isError = tone === "error";
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: isError ? neutral.dangerBg : theme.bg }]}>
            {isError ? (
              <XCircle size={26} color={neutral.danger} strokeWidth={2.2} />
            ) : (
              <CheckCircle2 size={26} color={theme.text} strokeWidth={2.2} />
            )}
          </View>
          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}
          <PrimaryButton
            label={buttonLabel}
            onPress={onDismiss}
            style={[styles.btn, isError ? { backgroundColor: neutral.danger } : null] as any}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(12,35,64,0.45)", alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: NEUTRAL.surface,
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
    alignItems: "center",
    shadowColor: "#0C2340",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 10,
  },
  iconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  title: { fontSize: 16, fontWeight: "700", color: NEUTRAL.textPrimary, textAlign: "center" },
  message: { fontSize: 12.5, color: NEUTRAL.textSecondary, textAlign: "center", marginTop: 8, lineHeight: 18 },
  btn: { marginTop: 20, alignSelf: "stretch", paddingVertical: 12 },
});
