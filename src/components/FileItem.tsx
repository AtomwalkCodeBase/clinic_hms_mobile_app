import { ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Check, CheckCircle2, Clock, Eye, Building2, Pencil, User } from "lucide-react-native";
import { CardMenu, MenuItem } from "@/components/CardMenu";
import { docTypeStyle } from "@/theme/docTypes";
import { NEUTRAL, BRAND_TEXT, BRAND_TINT } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { CARD } from "@/theme/cardSizes";
import { CardEdge } from "@/components/CardEdge";
import { Toggle } from "@/components/Toggle";

const GREEN = { bg: BRAND_TINT, text: BRAND_TEXT };

/**
 * One document on any list: Bulk Upload (review and ready), the one-file review sheet and My Documents.
 *
 *   [type icon] Type name                                             date   ⋮
 *   Doctor: Dr. Anita Rao  [Edit]
 *   For: Aarav
 *   ─────────────────────────────────────────────────────────────────────────
 *   footerLeft                                                   footerRight
 *
 * It only draws what it is given; each screen decides the words, the footer buttons and the menu
 * (utils/documentLabels.ts).
 */
export function FileItem({
  title, date, forName, nameColor,
  doctorName, onEditDoctor, showDoctor,
  status, extra,
  footerLeft, footerRight, typeCode, edgeColor,
  menu, selected, onPress, onLongPress,
}: {
  /** the document type's name, shown big at the top beside its icon */
  title: string;
  date: string;
  /** "For: <name>" */
  forName: string;
  /** the colour of the person's name; the app's green when left out */
  nameColor?: string;
  /** the doctor named on the document, without "Dr." */
  doctorName?: string;
  /** present when the patient may add or correct the doctor; absent for a hospital's document */
  onEditDoctor?: () => void;
  /** draw the doctor line ("Doctor not mentioned" when there is no name) even without an edit button */
  showDoctor?: boolean;
  /** "Reading your document…", a failure and its retry, "Not classified…" */
  status?: ReactNode;
  /** small tags such as PRIVATE */
  extra?: ReactNode;
  /** the left and right ends of the footer: <SourceFooter/>, <ViewButton/>, <ReadyButton/> */
  footerLeft?: ReactNode;
  footerRight?: ReactNode;
  /** picks the icon and colour beside the title */
  typeCode?: string | null;
  /** the colour of the card's left edge; the type's icon colour when left out */
  edgeColor?: string;
  menu?: MenuItem[];
  selected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const { theme } = useAppTheme();
  const type = docTypeStyle(typeCode);
  const TypeIcon = type.Icon;
  const frame = [styles.frame, selected && { borderColor: theme.fill, borderWidth: 1.5, backgroundColor: NEUTRAL.successBg }];
  const hasFooter = !!footerLeft || !!footerRight;

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={380} disabled={!onPress && !onLongPress} style={frame}>
      <CardEdge color={edgeColor ?? type.ink} />
      <View style={styles.top}>
        {selected && (
          <View style={[styles.tick, { backgroundColor: theme.fill }]}><Check size={13} color={theme.on} strokeWidth={3.4} /></View>
        )}
        <View style={[styles.typeTile, { backgroundColor: type.tint }]}>
          <TypeIcon size={22} color={type.ink} strokeWidth={2.2} />
        </View>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        <Text style={styles.date}>{date}</Text>
        {!!menu?.length && <CardMenu items={menu} />}
      </View>

      {(!!doctorName || !!onEditDoctor || showDoctor) && (
        <View style={styles.doctorRow}>
          <Text style={styles.doctor} numberOfLines={1}>
            {doctorName ? (
              <>Doctor <Text style={styles.doctorName}>Dr. {doctorName}</Text></>
            ) : (
              <Text style={styles.doctorMissing}>Doctor not mentioned</Text>
            )}
          </Text>
          {!!onEditDoctor && (
            <Pressable onPress={onEditDoctor} hitSlop={6} accessibilityRole="button" accessibilityLabel={doctorName ? "Edit doctor's name" : "Add doctor's name"} style={styles.editBtn}>
              <Pencil size={14} color={NEUTRAL.textPrimary} strokeWidth={2.4} />
              <Text style={styles.editText}>{doctorName ? "Edit" : "Add doctor"}</Text>
            </Pressable>
          )}
        </View>
      )}

      <Text style={styles.whoText} numberOfLines={1}>
        For: <Text style={[styles.whoName, { color: nameColor ?? GREEN.text }]}>{forName}</Text>
      </Text>

      {status}
      {extra}

      {hasFooter && (
        <View style={styles.footer}>
          <View style={{ flexShrink: 1 }}>{footerLeft}</View>
          <View>{footerRight}</View>
        </View>
      )}
    </Pressable>
  );
}

/** My Documents footer, left side: where the document came from. */
export function SourceFooter({ hospital }: { hospital: boolean }) {
  const Icon = hospital ? Building2 : User;
  return (
    <View>
      <Text style={styles.srcLead}>{hospital ? "Issued by" : "Uploaded by"}</Text>
      <View style={styles.srcRow}>
        <View style={[styles.srcIcon, { backgroundColor: hospital ? "#E3ECFB" : GREEN.bg }]}>
          <Icon size={17} color={hospital ? "#2455C3" : GREEN.text} strokeWidth={2.4} />
        </View>
        <Text style={styles.srcValue} numberOfLines={1}>{hospital ? "Your hospital" : "You"}</Text>
      </View>
    </View>
  );
}

/** Opens the file in the in-app viewer. */
export function ViewButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel="View this file" style={styles.outlineBtn}>
      <Eye size={16} color={BRAND_TEXT} strokeWidth={2.3} />
      <Text style={styles.outlineText}>View</Text>
    </Pressable>
  );
}

/** Bulk Upload: moves the file to "Ready to Submit". Same look as View. Greyed out until the file has a type. */
export function ReadyButton({ onPress, enabled = true }: { onPress: () => void; enabled?: boolean }) {
  const color = enabled ? BRAND_TEXT : NEUTRAL.textMuted;
  const line = enabled ? NEUTRAL.border : color;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel="Move to Ready to Submit"
      style={[styles.outlineBtn, { borderColor: line }]}
    >
      <CheckCircle2 size={16} color={color} strokeWidth={2.3} />
      <Text style={[styles.outlineText, { color }]}>Ready to submit</Text>
    </Pressable>
  );
}

/** Shared records privacy: whether a doctor you share with sees this file. "visit" is shown only for the live visit. */
export function ShareToggle({ state, onPress, disabled }: { state: "on" | "visit" | "off"; onPress: () => void; disabled?: boolean }) {
  const tone =
    state === "on" ? { fg: BRAND_TEXT, bg: BRAND_TINT, line: BRAND_TEXT, label: "Shared with doctor" }
    : state === "visit" ? { fg: NEUTRAL.warning, bg: NEUTRAL.warningBg, line: NEUTRAL.warning, label: "Shared for this visit" }
    : { fg: NEUTRAL.textSecondary, bg: NEUTRAL.surfaceAlt, line: NEUTRAL.border, label: "Hidden from doctor" };
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="switch"
      accessibilityState={{ checked: state !== "off" }}
      accessibilityLabel={tone.label}
      style={[styles.shareFrame, { backgroundColor: tone.bg, borderColor: tone.line }, disabled && { opacity: 0.6 }]}
    >
      {state === "visit" ? <Clock size={14} color={tone.fg} strokeWidth={2.4} /> : <View style={[styles.shareDot, { backgroundColor: tone.fg }]} />}
      <Text style={[styles.shareText, { color: tone.fg }]} numberOfLines={1}>{tone.label}</Text>
      <Toggle on={state !== "off"} color={tone.fg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shareFrame: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingLeft: 11, paddingRight: 8, paddingVertical: 7 },
  shareDot: { width: 7, height: 7, borderRadius: 4 },
  shareText: { fontSize: 12.5, fontWeight: "800" },

  frame: {
    backgroundColor: NEUTRAL.surface, borderRadius: CARD.radius,
    paddingTop: 12, paddingHorizontal: 14, marginBottom: CARD.gap,
  },
  top: { flexDirection: "row", alignItems: "center", gap: 10 },
  tick: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  typeTile: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 18.5, fontWeight: "800", color: NEUTRAL.textPrimary, lineHeight: 24 },
  date: { fontSize: 15.5, fontWeight: "700", color: "#3D4B5C" },

  doctorRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  doctor: { flexShrink: 1, fontSize: 15, color: NEUTRAL.textSecondary },
  doctorName: { fontSize: 17, fontWeight: "800", color: NEUTRAL.textPrimary },
  doctorMissing: { fontStyle: "italic", color: NEUTRAL.textMuted },
  editBtn: {
    flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: NEUTRAL.surface,
    borderWidth: 1.2, borderColor: BRAND_TEXT, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5,
  },
  editText: { fontSize: 13, fontWeight: "700", color: BRAND_TEXT },

  whoText: { fontSize: 15.5, color: NEUTRAL.textSecondary, marginTop: 10 },
  whoName: { fontSize: 16.5, fontWeight: "800" },

  footer: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10,
    borderTopWidth: 0.5, borderTopColor: NEUTRAL.border, marginTop: 12, marginHorizontal: -14, paddingHorizontal: 14, paddingVertical: 10,
  },

  srcLead: { fontSize: 13.5, fontWeight: "600", color: NEUTRAL.textSecondary },
  srcRow: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 4 },
  srcIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  srcValue: { fontSize: 16, fontWeight: "800", color: NEUTRAL.textPrimary },

  outlineBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 },
  outlineText: { fontSize: 13, fontWeight: "800", color: BRAND_TEXT },
});
