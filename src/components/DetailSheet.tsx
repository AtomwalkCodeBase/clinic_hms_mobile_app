import React from "react";
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from "react-native";
import { X } from "lucide-react-native";
import { NEUTRAL } from "@/theme/themes";

/**
 * Generic bottom-sheet for "tap a condensed row -> see full detail"
 * interactions — used across the Health tab (vaccinations, lab reports,
 * visits, timeline) so a mobile list reads as a real app (tap in, see
 * detail, tap out) instead of a web page with everything expanded at once.
 */
export function DetailSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={16} color={NEUTRAL.textMuted} strokeWidth={2.2} />
            </Pressable>
          </View>
          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

/** Label/value row for use inside a DetailSheet. */
export function DetailRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(12,35,64,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: NEUTRAL.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20, maxHeight: "80%" },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: NEUTRAL.border, alignSelf: "center", marginBottom: 10 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  title: { fontSize: 14.5, fontWeight: "700", color: NEUTRAL.textPrimary, flex: 1, paddingRight: 12 },
  body: { flexGrow: 0 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: NEUTRAL.surfaceAlt },
  rowLabel: { fontSize: 12, color: NEUTRAL.textSecondary, flexShrink: 0, marginRight: 12 },
  rowValue: { fontSize: 12.5, color: NEUTRAL.textPrimary, fontWeight: "500", flexShrink: 1, textAlign: "right" },
});
