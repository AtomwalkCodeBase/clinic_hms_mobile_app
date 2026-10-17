import { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal, FlatList, TextInput } from "react-native";
import { Check, ChevronDown } from "lucide-react-native";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";

export interface SelectOption {
  value: string;
  label: string;
  meta?: string;
  disabled?: boolean;
}

interface Props {
  label: string;
  value: string;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  clearLabel?: string;
  /** "box" (default): the label above a bordered box. "text": just the chosen value with a chevron and a thin
   * underline, no box and no label above (the sheet still carries the label as its title) - for filter rows. */
  variant?: "box" | "text";
  onChange: (value: string) => void;
}

export function SelectField({
  label,
  value,
  options,
  placeholder = "Select",
  error,
  searchable,
  searchPlaceholder = "Search…",
  clearLabel,
  variant = "box",
  onChange,
}: Props) {
  const { theme } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const isText = variant === "text";
  return (
    <View style={isText ? styles.textWrap : styles.wrap}>
      {!isText && <Text style={styles.label}>{label}</Text>}
      {isText ? (
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${selected ? selected.label : placeholder}. Change`}
          style={[styles.textRow, { borderBottomColor: selected ? theme.fill : NEUTRAL.border }]}
        >
          <Text style={[styles.textValue, !selected && styles.textPlaceholder]} numberOfLines={1}>
            {selected ? selected.label : placeholder}
          </Text>
          <ChevronDown size={17} color={theme.fill} strokeWidth={2.6} />
        </Pressable>
      ) : (
        <Pressable
          onPress={() => setOpen(true)}
          style={[styles.inputRow, { borderColor: error ? NEUTRAL.danger : NEUTRAL.border }]}
        >
          <Text style={[styles.value, !selected && styles.placeholder]} numberOfLines={1}>
            {selected ? selected.label : placeholder}
          </Text>
          <Text style={styles.chevron}>▾</Text>
        </Pressable>
      )}
      {!!error && <Text style={styles.error}>{error}</Text>}

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.sheetTitle}>{label}</Text>

            {searchable && (
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={searchPlaceholder}
                placeholderTextColor={NEUTRAL.textMuted}
                style={styles.searchInput}
                autoCapitalize="none"
              />
            )}

            <FlatList
              data={filtered}
              keyExtractor={(o) => o.value}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.emptyText}>No matches.</Text>}
              ListHeaderComponent={
                clearLabel ? (
                  <Pressable
                    onPress={() => {
                      onChange("");
                      close();
                    }}
                    style={styles.option}
                  >
                    <Text style={[styles.optionText, !value && { color: theme.text, fontWeight: "600" }]}>
                      {clearLabel}
                    </Text>
                    {!value && <Check size={15} color={theme.text} strokeWidth={2.4} />}
                  </Pressable>
                ) : null
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    if (item.disabled) return;
                    onChange(item.value);
                    close();
                  }}
                  disabled={item.disabled}
                  style={[styles.option, item.disabled && styles.optionDisabled]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.optionText,
                        item.disabled && styles.optionTextDisabled,
                        item.value === value && !item.disabled && { color: theme.text, fontWeight: "600" },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                  {!!item.meta && <Text style={styles.optionMeta}>{item.meta}</Text>}
                  {item.value === value && !item.disabled && <Check size={15} color={theme.text} strokeWidth={2.4} style={{ marginLeft: 8 }} />}
                </Pressable>
              )}
            />
            <Pressable onPress={close} style={styles.closeBtn}>
              <Text style={[styles.closeText, { color: theme.text }]}>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: NEUTRAL.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: NEUTRAL.surface,
  },
  textWrap: { flexShrink: 1 },
  textRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 2, borderBottomWidth: 1.5 },
  textValue: { fontSize: 16, fontWeight: "700", color: NEUTRAL.textPrimary, flexShrink: 1 },
  textPlaceholder: { fontWeight: "400", color: NEUTRAL.textSecondary },
  value: { fontSize: 14, color: NEUTRAL.textPrimary, flex: 1, marginRight: 8 },
  placeholder: { color: NEUTRAL.textMuted },
  chevron: { fontSize: 12, color: NEUTRAL.textMuted },
  error: { fontSize: 11, color: NEUTRAL.danger, marginTop: 4 },
  backdrop: { flex: 1, backgroundColor: "rgba(12,35,64,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: NEUTRAL.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: "75%" },
  sheetTitle: { fontSize: 13, fontWeight: "700", color: NEUTRAL.textPrimary, marginBottom: 8 },
  searchInput: {
    backgroundColor: NEUTRAL.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: NEUTRAL.textPrimary,
    marginBottom: 8,
  },
  list: { flexGrow: 0 },
  option: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: NEUTRAL.border },
  optionDisabled: { opacity: 0.5 },
  optionText: { fontSize: 14, color: NEUTRAL.textPrimary },
  optionTextDisabled: { color: NEUTRAL.textMuted },
  optionMeta: { fontSize: 11, color: NEUTRAL.textMuted },
  emptyText: { fontSize: 12.5, color: NEUTRAL.textMuted, textAlign: "center", paddingVertical: 20 },
  closeBtn: { paddingVertical: 12, alignItems: "center", marginTop: 4 },
  closeText: { fontSize: 13, fontWeight: "600" },
});
