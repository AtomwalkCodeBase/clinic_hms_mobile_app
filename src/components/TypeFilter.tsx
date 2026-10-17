import { Modal, Pressable, View, Text, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronDown, Files, SlidersHorizontal } from "lucide-react-native";
import type { LucideIcon } from "@/theme/icons";
import { docTypeStyle } from "@/theme/docTypes";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";

/**
 * The type filter used by My Documents, the day screen and Bulk Upload: one pill that shows the current choice
 * ("All (24)" or the picked type), and the sheet it opens (every type that is actually there, each with its own
 * coloured icon and count).
 */

/**
 * The one filter control: a pill that reads "All (24)" by default (or "Lab Report (8)" once a type is picked) and opens
 * the sheet. Grey normally; green with a dot while a type is selected. Clearing is done inside the sheet.
 */
export function FilterPill({ label, count, active, onPress }: { label: string; count?: number; active: boolean; onPress: () => void }) {
  const { theme } = useAppTheme();
  const text = count != null ? `${label} (${count})` : label;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={active ? `Filter: ${text}. Change` : `Filter: ${text}`}
      style={[styles.btn, active && { borderColor: theme.fill, backgroundColor: NEUTRAL.successBg }]}
    >
      <SlidersHorizontal size={16} color={active ? theme.text : NEUTRAL.textPrimary} strokeWidth={2.3} />
      <Text style={[styles.btnText, active && { color: theme.text }]} numberOfLines={1}>{text}</Text>
      <ChevronDown size={15} color={active ? theme.text : NEUTRAL.textSecondary} strokeWidth={2.5} />
      {active && <View style={[styles.dot, { backgroundColor: theme.fill }]} />}
    </Pressable>
  );
}

/** The default icons of the sheet: the look of each document type, and a stack of files for the All row. */
const documentIcon = (code: string) => (code ? docTypeStyle(code) : { Icon: Files, ink: "" });

/** The sheet: "All" first, then one row per type present, with a green tick on the current choice. */
export function FilterSheet({
  visible, items, total, selected, onSelect, onClose, labelOf, allLabel = "All files",
  title = "Filter by type", subtitle = "Show only one kind of document.", iconOf = documentIcon, clearLabel = "Clear filter",
}: {
  visible: boolean;
  /** `count` is left out where a count means nothing (a period, a sort order) */
  items: { code: string; count?: number }[];
  total?: number;
  /** the selected type code, or "" for everything */
  selected: string;
  onSelect: (code: string) => void;
  onClose: () => void;
  labelOf: (code?: string | null) => string;
  allLabel?: string;
  title?: string;
  subtitle?: string;
  /** the icon and its colour for a code; "" is the All row. Document types by default. */
  iconOf?: (code: string) => { Icon: LucideIcon; ink: string };
  /** the text of the button that clears the choice; "" hides it */
  clearLabel?: string;
}) {
  const { theme } = useAppTheme();
  const AllIcon = iconOf("").Icon;
  const insets = useSafeAreaInsets();
  const pick = (code: string) => { onSelect(code); onClose(); };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={[styles.sheet, { paddingBottom: Math.max(20, insets.bottom + 12) }]} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>{subtitle}</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Pressable onPress={() => pick("")} style={({ pressed }) => [styles.row, pressed && { backgroundColor: NEUTRAL.surfaceAlt }]}>
              <AllIcon size={23} color={theme.fill} strokeWidth={2} />
              <Text style={styles.rowText}>{allLabel}</Text>
              {total != null && <Text style={styles.count}>{total}</Text>}
              {!selected && <Check size={21} color={theme.fill} strokeWidth={2.8} />}
            </Pressable>
            {items.map((it) => {
              const s = iconOf(it.code);
              const Icon = s.Icon;
              return (
                <Pressable key={it.code} onPress={() => pick(it.code)} style={({ pressed }) => [styles.row, styles.rowLine, pressed && { backgroundColor: NEUTRAL.surfaceAlt }]}>
                  <Icon size={23} color={s.ink} strokeWidth={2} />
                  <Text style={styles.rowText} numberOfLines={1}>{labelOf(it.code)}</Text>
                  {it.count != null && <Text style={styles.count}>{it.count}</Text>}
                  {selected === it.code && <Check size={21} color={theme.fill} strokeWidth={2.8} />}
                </Pressable>
              );
            })}
          </ScrollView>
          {!!selected && !!clearLabel && (
            <Pressable onPress={() => pick("")} style={styles.clear}><Text style={[styles.clearText, { color: theme.text }]}>{clearLabel}</Text></Pressable>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 13, minHeight: 38, borderRadius: 20,
    borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface,
  },
  btnText: { fontSize: 13.5, fontWeight: "700", color: NEUTRAL.textPrimary, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },

  backdrop: { flex: 1, backgroundColor: "rgba(12,35,64,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: NEUTRAL.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 10, maxHeight: "80%" },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: NEUTRAL.border, alignSelf: "center", marginBottom: 12 },
  title: { fontSize: 19, fontWeight: "800", color: NEUTRAL.textPrimary, textAlign: "center" },
  sub: { fontSize: 13, color: NEUTRAL.textSecondary, textAlign: "center", marginTop: 3, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 6 },
  rowLine: { borderTopWidth: 0.5, borderTopColor: NEUTRAL.border },
  rowText: { flex: 1, fontSize: 16, fontWeight: "700", color: NEUTRAL.textPrimary },
  count: { fontSize: 14, fontWeight: "700", color: NEUTRAL.textSecondary, minWidth: 22, textAlign: "right" },
  clear: { alignItems: "center", paddingVertical: 14 },
  clearText: { fontSize: 14.5, fontWeight: "800" },
});
