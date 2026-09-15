import React, { useEffect, useState } from "react";
import { Modal, Pressable, View, Text, ScrollView, StyleSheet } from "react-native";
import { Check } from "lucide-react-native";
import { NEUTRAL } from "@/theme/themes";

export interface CategoryOption {
  value: string;
  label: string;
  count: number;
}

/**
 * A compact trigger opens this bottom sheet; picks apply when it closes, so
 * one dismiss is one request rather than a network call per tap.
 */
export function CategoryFilterSheet({
  visible,
  options,
  selected,
  accent,
  onClose,
  onApply,
}: {
  visible: boolean;
  options: CategoryOption[];
  selected: string[];
  accent: string;
  onClose: () => void;
  onApply: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState<Set<string>>(new Set(selected));
  useEffect(() => {
    if (visible) setDraft(new Set(selected));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const close = () => {
    const next = [...draft];
    if (next.length !== selected.length || next.some((v) => !selected.includes(v))) onApply(next);
    onClose();
  };
  const toggle = (v: string) =>
    setDraft((prev) => {
      const n = new Set(prev);
      n.has(v) ? n.delete(v) : n.add(v);
      return n;
    });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <Pressable style={styles.sheetBackdrop} onPress={close}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.sheetGrab} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Filter by category</Text>
            {draft.size > 0 && (
              <Pressable onPress={() => setDraft(new Set())} hitSlop={8}>
                <Text style={[styles.sheetClear, { color: accent }]}>Clear</Text>
              </Pressable>
            )}
          </View>
          <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
            <Pressable style={styles.optRow} onPress={() => setDraft(new Set())}>
              <Text style={[styles.optLabel, draft.size === 0 && { fontWeight: "700" }]}>All categories</Text>
              {draft.size === 0 && <Check size={15} color={accent} strokeWidth={3} />}
            </Pressable>
            {options.map((o) => {
              const on = draft.has(o.value);
              return (
                <Pressable key={o.value} style={styles.optRow} onPress={() => toggle(o.value)}>
                  <Text style={[styles.optLabel, on && { fontWeight: "700" }]} numberOfLines={1}>{o.label}</Text>
                  <Text style={styles.optCount}>{o.count}</Text>
                  {on && <Check size={15} color={accent} strokeWidth={3} />}
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable style={[styles.sheetDone, { backgroundColor: accent }]} onPress={close}>
            <Text style={styles.sheetDoneText}>Done</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(15,23,20,0.42)", justifyContent: "flex-end" },
  sheet: { backgroundColor: NEUTRAL.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 24 },
  sheetGrab: { alignSelf: "center", width: 36, height: 4, borderRadius: 999, backgroundColor: NEUTRAL.border, marginBottom: 12 },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  sheetTitle: { fontSize: 14, fontWeight: "700", color: NEUTRAL.textPrimary },
  sheetClear: { fontSize: 12, fontWeight: "600" },
  optRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: NEUTRAL.border },
  optLabel: { flex: 1, fontSize: 13, color: NEUTRAL.textPrimary },
  optCount: { fontSize: 11, color: NEUTRAL.textMuted, fontVariant: ["tabular-nums"] },
  sheetDone: { marginTop: 16, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  sheetDoneText: { fontSize: 13, fontWeight: "700", color: "#fff" },
});
