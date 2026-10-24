import { Modal, Pressable, View, Text, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { ACTION, ON_ACTION } from "@/theme/buttons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CloseButton } from "@/components/IconButtons";
import { NEUTRAL } from "@/theme/themes";

export interface ChoiceAction {
  label: string;
  sub?: string;
  /** filled with the accent colour — the recommended path */
  primary?: boolean;
  /** rendered as a plain centered text button at the bottom. One labelled "Cancel" or "Close" is not drawn as text:
   *  it becomes the black cross at the top right of the sheet (its onPress, if any, runs when the cross is tapped). */
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
  large = false,
  onClose,
}: {
  visible: boolean;
  title: string;
  message?: string;
  actions: ChoiceAction[];
  /** Bigger title and buttons, for a short list of plain choices (Change view). */
  large?: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const isDismiss = (a: ChoiceAction) => !!a.cancel && /^(cancel|close)$/i.test(a.label.trim());
  const dismiss = actions.find(isDismiss);
  const rest = actions.filter((a) => !isDismiss(a));
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={[styles.sheet, { paddingBottom: Math.max(26, insets.bottom + 12) }]} onStartShouldSetResponder={() => true}>
          <View style={styles.grab} />
          <CloseButton
            onPress={() => {
              onClose();
              dismiss?.onPress?.();
            }}
            style={styles.close}
          />
          <Text style={[styles.title, large && styles.titleLarge]}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}
          {/* a long list (the family) scrolls inside the sheet instead of running off the screen */}
          <ScrollView style={{ maxHeight: height * 0.6 }} showsVerticalScrollIndicator={false}>
          {rest.map((a, i) =>
            a.cancel ? (
              <Pressable
                key={i}
                onPress={() => {
                  onClose();
                  a.onPress?.();
                }}
                style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.6 }]}
              >
                <Text style={[styles.cancelText, large && styles.cancelTextLarge]}>{a.label}</Text>
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
                  large && styles.optLarge,
                  a.primary && { backgroundColor: ACTION, borderColor: ACTION },
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={[styles.optLabel, large && styles.optLabelLarge, a.primary && { color: ON_ACTION }]}>{a.label}</Text>
                {!!a.sub && (
                  <Text style={[styles.optSub, a.primary && { color: "rgba(255,255,255,0.8)" }]}>{a.sub}</Text>
                )}
              </Pressable>
            ),
          )}
          </ScrollView>
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
  close: { position: "absolute", right: 16, top: 16, zIndex: 1 },
  title: { fontSize: 16, fontWeight: "700", color: NEUTRAL.textPrimary, marginBottom: 6, paddingRight: 36 },
  message: { fontSize: 13, lineHeight: 19, color: NEUTRAL.textSecondary, marginBottom: 16 },
  opt: {
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    alignItems: "center",
  },
  optLabel: { fontSize: 13.5, fontWeight: "600", color: NEUTRAL.textPrimary, textAlign: "center" },
  optSub: { fontSize: 11, color: NEUTRAL.textMuted, marginTop: 2, textAlign: "center" },
  titleLarge: { fontSize: 21, textAlign: "center", marginBottom: 16, paddingHorizontal: 36 },
  optLarge: { paddingVertical: 17, marginBottom: 10 },
  optLabelLarge: { fontSize: 20 },
  cancel: { alignItems: "center", paddingVertical: 12, marginTop: 2 },
  cancelText: { fontSize: 13.5, fontWeight: "600", color: NEUTRAL.textMuted },
  cancelTextLarge: { fontSize: 18 },
});
