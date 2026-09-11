import React from "react";
import { Modal, Pressable, View, Text, StyleSheet } from "react-native";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";

export interface ChoiceAction {
  label: string;
  sub?: string;
  /** filled with the accent colour — the recommended path */
  primary?: boolean;
  /** rendered as a plain centered text button at the bottom */
  cancel?: boolean;
  onPress?: () => void;
}

/**
 * Bottom sheet for a "pick one of a few things" moment — 2-3 stacked option
 * buttons, each with an optional one-line explanation. Used by the
 * shared-records privacy flow (this visit / always / cancel) where a
 * centered ConfirmDialog's two buttons aren't enough. Matches DetailSheet's
 * chrome and Buttons' fills.
 */
export function ChoiceSheet({
  visible,
  title,
  message,
  actions,
  onClose,
}: {
  visible: boolean;
  title: string;
  message?: string;
  actions: ChoiceAction[];
  onClose: () => void;
}) {
  const { theme } = useAppTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.grab} />
          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}
          {actions.map((a, i) =>
            a.cancel ? (
              <Pressable
                key={i}
                onPress={() => {
                  onClose();
                  a.onPress?.();
                }}
                style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.cancelText}>{a.label}</Text>
              </Pressable>
            ) : (
              <Pressable
                key={i}
                onPress={() => {
                  onClose();
                  a.onPress?.();
                }}
                style={({ pressed }) => [
                  styles.opt,
                  a.primary && { backgroundColor: theme.fill, borderColor: theme.fill },
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={[styles.optLabel, a.primary && { color: theme.on }]}>{a.label}</Text>
                {!!a.sub && (
                  <Text style={[styles.optSub, a.primary && { color: "rgba(255,255,255,0.82)" }]}>{a.sub}</Text>
                )}
              </Pressable>
            ),
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(12,35,64,0.42)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: NEUTRAL.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 26,
  },
  grab: { width: 34, height: 4, borderRadius: 999, backgroundColor: NEUTRAL.border, alignSelf: "center", marginBottom: 14 },
  title: { fontSize: 16, fontWeight: "700", color: NEUTRAL.textPrimary, marginBottom: 6 },
  message: { fontSize: 13, lineHeight: 19, color: NEUTRAL.textSecondary, marginBottom: 16 },
  opt: {
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  optLabel: { fontSize: 13.5, fontWeight: "600", color: NEUTRAL.textPrimary },
  optSub: { fontSize: 11, color: NEUTRAL.textMuted, marginTop: 2 },
  cancel: { alignItems: "center", paddingVertical: 12, marginTop: 2 },
  cancelText: { fontSize: 13.5, fontWeight: "600", color: NEUTRAL.textMuted },
});
