import { Pressable, StyleSheet, Text, View } from "react-native";
import { CalendarPlus, ChevronDown, ChevronRight } from "lucide-react-native";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { NEUTRAL } from "@/theme/themes";
import { formatDate } from "./chartTheme";
import { Marker } from "./Marker";
import { TONES } from "./journeyTheme";
import type { DoseRow, DoseStatus, VaccineGroup, Shape, Tone } from "@/utils/journey";

const LOOK: Record<DoseStatus, { shape: Shape; tone: Tone }> = {
  given: { shape: "check", tone: "good" },
  overdue: { shape: "cross", tone: "critical" },
  due: { shape: "dot", tone: "warning" },
  upcoming: { shape: "ring", tone: "muted" },
  later: { shape: "ring", tone: "muted" },
};

const summaryOf = (g: VaccineGroup): string => (g.overdue ? `${g.overdue} overdue` : g.status === "given" ? `${g.given}/${g.total}` : g.status === "due" ? "Due" : g.status === "upcoming" ? "Coming up" : "Later");

/**
 * One age group of the schedule ("Birth", "6–14 weeks"...): tap it to open its doses. A group with a dose that can be
 * booked has a Book button in its header, and each such dose has its own.
 */
export function VaccineGroupCard({
  group, open, onToggle, onBookGroup, onBookDose,
}: {
  group: VaccineGroup;
  open: boolean;
  onToggle: () => void;
  onBookGroup: (rows: DoseRow[]) => void;
  onBookDose: (row: DoseRow) => void;
}) {
  const look = LOOK[group.status];
  const tone = TONES[group.status === "given" ? "good" : group.status === "overdue" ? "critical" : group.status === "due" ? "warning" : "muted"];
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${group.label}, ${summaryOf(group)}`} onPress={onToggle} style={styles.headMain}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title}>{group.label}</Text>
            <Text style={styles.names} numberOfLines={1}>{group.names.join(", ")}</Text>
          </View>
          <View style={styles.status}>
            <Marker shape={look.shape} tone={look.tone} size={14} />
            <Text style={[styles.statusText, { color: tone.text }]}>{summaryOf(group)}</Text>
          </View>
          {open ? <ChevronDown size={18} color={NEUTRAL.textMuted} /> : <ChevronRight size={18} color={NEUTRAL.textMuted} />}
        </Pressable>
        {group.pending.length > 0 && <PrimaryButton label="Book" icon={CalendarPlus} compact onPress={() => onBookGroup(group.pending)} style={{ alignSelf: "center" }} />}
      </View>
      {open && group.rows.map((r) => {
        const l = LOOK[r.status];
        return (
          <View key={r.code} style={styles.dose}>
            <Marker shape={l.shape} tone={l.tone} size={12} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.doseName}>{r.vaccine} · dose {r.dose}</Text>
              <Text style={styles.doseMeta}>{r.status === "given" && r.givenOn ? `${formatDate(r.givenOn)}${r.late ? " · late" : ""}` : `Due ${formatDate(r.dueOn)}`}</Text>
            </View>
            {r.bookable && <SecondaryButton label="Book" icon={CalendarPlus} compact onPress={() => onBookDose(r)} style={{ alignSelf: "center" }} />}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: NEUTRAL.surface, borderRadius: 14, overflow: "hidden", marginBottom: 8 },
  head: { flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 12 },
  headMain: { flex: 1, minWidth: 0, minHeight: 60, flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 12, paddingVertical: 8 },
  title: { fontSize: 15, fontWeight: "700", color: NEUTRAL.textPrimary },
  names: { fontSize: 12.5, color: NEUTRAL.textSecondary, marginTop: 1 },
  status: { flexDirection: "row", alignItems: "center", gap: 5 },
  statusText: { fontSize: 12, fontWeight: "600" },
  dose: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingVertical: 6, paddingHorizontal: 12, borderTopWidth: 0.5, borderTopColor: NEUTRAL.border },
  doseName: { fontSize: 13.5, color: NEUTRAL.textPrimary },
  doseMeta: { fontSize: 12, color: NEUTRAL.textSecondary },
});
