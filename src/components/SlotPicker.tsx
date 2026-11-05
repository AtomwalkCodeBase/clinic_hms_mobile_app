import { View, Text, Pressable, StyleSheet } from "react-native";
import { SectionTitle, EmptyState } from "@/components/Layout";
import { SlidingTabs } from "@/components/SlidingTabs";
import { ActionGradient } from "@/components/ActionGradient";
import { ACTION, ON_ACTION } from "@/theme/buttons";
import { NEUTRAL } from "@/theme/themes";
import { SlotEntry } from "@/api/types";
import { formatTime12 } from "@/utils/indianTime";

const COLUMNS = 3;

/** "Choose a time slot" with the All / Available only switch. Pinned above the grid so only the slots scroll. */
export function SlotHeader({ title = "Choose a time slot", showFilter, availableOnly, onChange }: {
  title?: string;
  showFilter: boolean;
  availableOnly: boolean;
  onChange: (availableOnly: boolean) => void;
}) {
  return (
    <View style={styles.headerRow}>
      <SectionTitle>{title}</SectionTitle>
      {showFilter && (
        <SlidingTabs
          label="Slots to show"
          look="small"
          options={[{ key: "all", label: "All slots" }, { key: "free", label: "Available only" }]}
          value={availableOnly ? "free" : "all"}
          onChange={(k) => onChange(k === "free")}
          style={styles.filter}
        />
      )}
    </View>
  );
}

/**
 * The slots of one day as a grid of equal boxes, three to a row, each saying Available, Booked or Selected. Booking a new
 * visit and rescheduling one both use this, so the two screens always look and behave the same.
 */
export function SlotGrid({ slots, loading, selectedTime, availableOnly, onSelect }: {
  slots: SlotEntry[];
  loading: boolean;
  selectedTime: string | null;
  availableOnly: boolean;
  onSelect: (time: string) => void;
}) {
  if (loading) return <Text style={styles.loading}>Loading slots…</Text>;
  if (slots.length === 0) return <EmptyState text="No slots configured for this day — try a different date." />;

  const visible = availableOnly ? slots.filter((s) => s.available) : slots;
  if (visible.length === 0) return <EmptyState text="All slots are booked for this day — try a different date." />;
  const hidden = slots.length - visible.length;

  const rows: SlotEntry[][] = [];
  for (let i = 0; i < visible.length; i += COLUMNS) rows.push(visible.slice(i, i + COLUMNS));

  return (
    <View>
      {rows.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((s) => {
            const active = s.time === selectedTime;
            return (
              <Pressable
                key={s.time}
                disabled={!s.available}
                onPress={() => onSelect(s.time)}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled: !s.available }}
                style={[
                  styles.slot,
                  s.available && { borderColor: NEUTRAL.border },
                  !s.available && styles.slotBooked,
                  active && { backgroundColor: ACTION, borderColor: ACTION },
                ]}
              >
                {active && <ActionGradient />}
                <Text style={[styles.time, !s.available && styles.timeBooked, active && { color: ON_ACTION }]}>{formatTime12(s.time)}</Text>
                <Text style={[styles.caption, !s.available && styles.captionBooked, active && { color: ON_ACTION }]}>
                  {active ? "SELECTED" : s.available ? "AVAILABLE" : "BOOKED"}
                </Text>
              </Pressable>
            );
          })}
          {row.length < COLUMNS && Array.from({ length: COLUMNS - row.length }, (_, i) => <View key={`pad${i}`} style={styles.pad} />)}
        </View>
      ))}
      {availableOnly && hidden > 0 && (
        <Text style={styles.hidden}>
          {hidden} booked slot{hidden > 1 ? "s" : ""} hidden
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  filter: { width: 170 },
  loading: { fontSize: 12, color: NEUTRAL.textMuted, marginTop: 4, marginBottom: 8 },
  row: { flexDirection: "row", gap: 8, marginBottom: 8 },
  slot: {
    flex: 1,
    height: 54,
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: NEUTRAL.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  pad: { flex: 1 },
  slotBooked: { backgroundColor: NEUTRAL.dangerBg, borderColor: "#F3D3D3" },
  time: { fontSize: 13, color: NEUTRAL.textPrimary, fontWeight: "600" },
  timeBooked: { color: NEUTRAL.danger, textDecorationLine: "line-through" },
  caption: { fontSize: 8.5, color: NEUTRAL.textMuted, fontWeight: "700", marginTop: 2, letterSpacing: 0.4 },
  captionBooked: { color: NEUTRAL.danger },
  hidden: { fontSize: 10, color: NEUTRAL.textMuted, marginBottom: 8 },
});
