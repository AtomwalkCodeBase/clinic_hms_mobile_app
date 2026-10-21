import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Immunization } from "@/api/types";
import { PrimaryButton } from "@/components/Buttons";
import { VaccinesSkeleton } from "@/components/health/ChartSkeleton";
import { VaccineRing } from "@/components/health/JourneyBits";
import { VaccineGroupCard } from "@/components/health/VaccineGroupCard";
import { Marker } from "@/components/health/Marker";
import { TONES } from "@/components/health/journeyTheme";
import { J } from "@/components/health/journeyStyles";
import { formatDate } from "@/components/health/chartTheme";
import { complaintFor, nextScheduled, vaccineGroups, type DoseRow } from "@/utils/journey";
import { NEUTRAL } from "@/theme/themes";

const SHOWN_CARDS = 3;

/** The vaccines: how many due doses are given, what is overdue, and the schedule by age group - all bookable. The scan and add buttons are pinned at the bottom of the screen. */
export function VaccinesSection({ data, dob, onBook }: {
  data: Immunization | undefined;
  dob: string | undefined;
  onBook: (complaint: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const groups = useMemo(() => (data && dob ? vaccineGroups(data, dob) : []), [data, dob]);
  if (!data || !dob) return <VaccinesSkeleton />;

  const s = data.summary;
  const pending: DoseRow[] = groups.flatMap((g) => g.rows).filter((r) => r.status === "overdue" || r.status === "due").sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  const next = nextScheduled(data);
  const unread = data.unresolved?.length ?? 0;

  return (
    <View style={J.stack}>
      <View style={[J.card, { gap: 12 }]}>
        <View style={[J.row, { gap: 14 }]}>
          {s.coverage_pct != null ? <VaccineRing pct={s.coverage_pct} /> : null}
          <View style={{ flex: 1 }}>
            <Text style={styles.big}>{s.given} of {s.given + s.overdue + s.due} due doses given</Text>
            {next ? <Text style={J.caption}>Next scheduled: {next.vaccine} at {data.rows.find((r) => r.code === next.code)?.due_age} ({formatDate(next.dueOn)})</Text> : null}
          </View>
        </View>
        {pending.slice(0, SHOWN_CARDS).map((r) => (
          <View key={r.code} style={[styles.pending, { backgroundColor: r.status === "overdue" ? TONES.critical.tint : TONES.warning.tint }]}>
            <Marker shape={r.status === "overdue" ? "cross" : "dot"} tone={r.status === "overdue" ? "critical" : "warning"} size={24} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pendingTitle}>{r.vaccine}, dose {r.dose}</Text>
              <Text style={J.caption}>{r.status === "overdue" ? `Overdue since ${formatDate(r.dueOn)}` : `Due ${formatDate(r.dueOn)}`}</Text>
            </View>
            <PrimaryButton label="Book" compact onPress={() => onBook(complaintFor([r]))} style={{ alignSelf: "center" }} />
          </View>
        ))}
        {pending.length > SHOWN_CARDS && (
          <View style={{ gap: 8 }}>
            <Text style={J.caption}>{pending.length - SHOWN_CARDS} more overdue or due. Open an age group below to see them.</Text>
            <PrimaryButton label={`Book all ${pending.length}`} compact onPress={() => onBook(complaintFor(pending))} style={{ alignSelf: "flex-start" }} />
          </View>
        )}
        {pending.length === 0 && <Text style={styles.upToDate}>All recorded vaccines are up to date.</Text>}
      </View>

      <View>
        {groups.map((g) => (
          <VaccineGroupCard key={g.label} group={g} open={open === g.label} onToggle={() => setOpen(open === g.label ? null : g.label)}
            onBookGroup={(rows) => onBook(complaintFor(rows))} onBookDose={(r) => onBook(complaintFor([r]))} />
        ))}
      </View>

      {unread > 0 && <Text style={J.caption}>{unread} entr{unread > 1 ? "ies" : "y"} from uploaded cards could not be matched to the schedule; the clinic will check {unread > 1 ? "them" : "it"}.</Text>}
      <Text style={[J.caption, { textAlign: "center" }]}>{data.source.split(" (")[0]}. Your doctor may advise different timing.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 19, fontWeight: "700", color: NEUTRAL.textPrimary, lineHeight: 24 },
  pending: { borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  pendingTitle: { fontSize: 14, fontWeight: "700", color: NEUTRAL.textPrimary },
  upToDate: { fontSize: 13.5, fontWeight: "700", color: TONES.good.text },
});
