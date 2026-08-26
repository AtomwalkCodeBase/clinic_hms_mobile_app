import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Calendar } from "lucide-react-native";
import { NEUTRAL } from "@/theme/themes";

interface Props {
  label: string;
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  maximumDate?: Date;
  minimumDate?: Date;
}

function toDate(value: string): Date {
  if (value) {
    const parsed = new Date(`${value}T00:00:00`);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplay(value: string): string {
  if (!value) return "";
  const d = toDate(value);
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function DateField({ label, value, onChange, placeholder = "Select date", error, maximumDate, minimumDate }: Props) {
  const [open, setOpen] = useState(false);

  const onPick = (event: { type: string }, selected?: Date) => {
    // Android fires "dismissed" on cancel and closes the dialog itself.
    if (Platform.OS === "android") setOpen(false);
    if (event.type === "dismissed" || !selected) return;
    onChange(toIso(selected));
    if (Platform.OS === "ios") setOpen(false);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.inputRow, { borderColor: error ? NEUTRAL.danger : NEUTRAL.border }]}
      >
        <Text style={[styles.value, !value && styles.placeholder]}>
          {value ? formatDisplay(value) : placeholder}
        </Text>
        <Calendar size={15} color={NEUTRAL.textSecondary} strokeWidth={2.2} />
      </Pressable>
      {!!error && <Text style={styles.error}>{error}</Text>}

      {open && (
        <DateTimePicker
          value={toDate(value)}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "calendar"}
          onChange={onPick}
          maximumDate={maximumDate}
          minimumDate={minimumDate}
        />
      )}
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
  value: { fontSize: 14, color: NEUTRAL.textPrimary },
  placeholder: { color: NEUTRAL.textMuted },
  error: { fontSize: 11, color: NEUTRAL.danger, marginTop: 4 },
});
