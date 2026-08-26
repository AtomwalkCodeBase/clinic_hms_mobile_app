import React from "react";
import { Modal, View, Text, StyleSheet } from "react-native";
import { AlertTriangle, HelpCircle } from "lucide-react-native";
import { NEUTRAL } from "@/theme/themes";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";

/**
 * A themed replacement for React Native's native Alert.alert — the OS
 * confirm dialog renders as bare system chrome (no app styling at all),
 * which read as "developer mode" placeholder UI. This is a real centered
 * card matching the rest of the app: icon, title, message, two buttons.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = "Never mind",
  danger,
  loading,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: danger ? NEUTRAL.dangerBg : NEUTRAL.surfaceAlt }]}>
            {danger ? (
              <AlertTriangle size={24} color={NEUTRAL.danger} strokeWidth={2.2} />
            ) : (
              <HelpCircle size={24} color={NEUTRAL.textSecondary} strokeWidth={2.2} />
            )}
          </View>
          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}
          <View style={styles.actions}>
            <SecondaryButton label={cancelLabel} onPress={onCancel} disabled={loading} style={styles.btn} />
            <PrimaryButton
              label={confirmLabel}
              onPress={onConfirm}
              loading={loading}
              style={[styles.btn, danger ? { backgroundColor: NEUTRAL.danger } : null] as any}
            />
          </View>
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
  actions: { flexDirection: "row", gap: 10, marginTop: 22, width: "100%" },
  btn: { flex: 1, paddingVertical: 12 },
});
