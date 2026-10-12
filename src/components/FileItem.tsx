import { ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Check, Pencil, Trash2, Undo2 } from "lucide-react-native";
import type { PatientDocument } from "@/api/types";
import { DocPreview } from "@/components/DocPreview";
import { TypeTag } from "@/components/TypeAvatar";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { CARD, CARD_TEXT } from "@/theme/cardSizes";

/** The delete icon and the pencil are exactly the same size (Classify is the same height, wider). */
export const ACTION_SIZE = 40;

/**
 * One file in any list: Bulk Upload (review and ready), the one-file Add Document sheet, and My Documents.
 *   "list"  a row: the preview at the left, the name and details in the middle, the actions at the right
 *   "grid"  a card for a two-column grid: the preview on top (with the type tag over it), the name and actions under it
 *   "wide"  a full-width card: a big preview with the name and actions under it (the one-file sheet in grid mode)
 * Tap the preview to open the file in the viewer (`onOpen`). The rest of the row is `onPress`, and press and hold
 * is `onLongPress` (it works on the preview too). What goes under the name (`line`), the small grey text (`sub`),
 * and the buttons or date at the right (`actions`, `trailing`) are passed in, so each screen decides them.
 */
export function FileItem({
  doc, layout, order, patientAwpid, typeCode, line, sub, actions, trailing, selected, onOpen, onPress, onLongPress,
}: {
  doc: PatientDocument;
  layout: "list" | "grid" | "wide";
  /** the file's place in its list: the top rows get their previews first */
  order: number;
  patientAwpid?: string;
  /** the type shown on the tag over a card's preview (and the icon if the picture can't be drawn) */
  typeCode?: string | null;
  /** under the name: usually a coloured type tag, or "Reading your document…" */
  line?: ReactNode;
  sub?: string;
  /** the pencil and bin, "Move back"… */
  actions?: ReactNode;
  /** the date and lock at the right of a My Documents row */
  trailing?: ReactNode;
  selected?: boolean;
  onOpen: () => void;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const { theme } = useAppTheme();
  const name = doc.file_name || doc.title;
  const frame = [styles.frame, layout !== "list" && styles.card, selected && { borderColor: theme.fill, borderWidth: 1.5, backgroundColor: NEUTRAL.successBg }];

  const preview = (style: object, size: number) => (
    <Pressable onPress={onOpen} onLongPress={onLongPress} delayLongPress={380} accessibilityRole="button" accessibilityLabel={`Open ${name}`}>
      <DocPreview id={doc.id} typeCode={typeCode ?? doc.doc_type} patientAwpid={patientAwpid} order={order} width={size} style={style} />
      {selected && <View style={[styles.tick, layout !== "list" && styles.tickRight, { backgroundColor: theme.fill }]}><Check size={12} color={theme.on} strokeWidth={3.4} /></View>}
    </Pressable>
  );

  if (layout === "list") {
    return (
      <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={380} style={frame}>
        <View style={styles.listRow}>
          {preview(styles.listPreview, 160)}
          <View style={styles.body}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            {line}
            {!!sub && <Text style={styles.sub} numberOfLines={1}>{sub}</Text>}
          </View>
          {trailing}
          {actions}
        </View>
      </Pressable>
    );
  }

  const big = layout === "wide";
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={380} style={frame}>
      <View>
        {preview(big ? styles.widePreview : styles.gridPreview, big ? 600 : 300)}
        {typeCode ? <View style={styles.tagOver} pointerEvents="none"><TypeTag code={typeCode} /></View> : null}
      </View>
      <View style={[styles.cardBody, big && styles.cardBodyRow]}>
        <View style={{ flex: big ? 1 : undefined, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {line}
          {!!sub && <Text style={styles.sub} numberOfLines={1}>{sub}</Text>}
        </View>
        {trailing}
        {actions}
      </View>
    </Pressable>
  );
}

/** Lays a list of FileItems out as a plain column (list layout) or two columns (grid). Each child needs a key. */
export function FileList({ layout, children }: { layout: "list" | "grid"; children: ReactNode }) {
  if (layout === "list") return <>{children}</>;
  const items = (Array.isArray(children) ? children : [children]).filter(Boolean) as any[];
  return (
    <View style={styles.grid}>
      {items.map((c, i) => <View key={c.key ?? i} style={styles.gridCell}>{c}</View>)}
    </View>
  );
}

/** The bin (always) and the pencil or Classify (when the file can still be re-typed) at the right of a review row. */
export function RowActions({
  hasType, onChange, onDelete, showChange = true, showDelete = true, row = false,
}: {
  hasType: boolean;
  onChange: () => void;
  onDelete: () => void;
  showChange?: boolean;
  showDelete?: boolean;
  /** side by side (cards) instead of stacked (list rows) */
  row?: boolean;
}) {
  return (
    <View style={[styles.actions, row && styles.actionsRow]}>
      {showDelete && (
        <Pressable onPress={onDelete} hitSlop={6} style={styles.del} accessibilityRole="button" accessibilityLabel="Delete this file">
          <Trash2 size={18} color={NEUTRAL.danger} strokeWidth={2} />
        </Pressable>
      )}
      {showChange && (
        <Pressable
          onPress={onChange}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={hasType ? "Change type" : "Classify"}
          style={[styles.change, !hasType && styles.classify]}
        >
          {hasType
            ? <Pencil size={18} color={NEUTRAL.textPrimary} strokeWidth={2} />
            : <Text style={styles.classifyText}>Classify</Text>}
        </Pressable>
      )}
    </View>
  );
}

export function MoveBackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.moveBack} accessibilityRole="button" accessibilityLabel="Move back to Files">
      <Undo2 size={15} color={NEUTRAL.textPrimary} strokeWidth={2.2} />
      <Text style={styles.moveBackText}>Move back</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: NEUTRAL.surface, borderRadius: CARD.radius, borderWidth: 0.5, borderColor: NEUTRAL.border, padding: 10, marginBottom: CARD.gap },
  card: { padding: 0, overflow: "hidden", marginBottom: 0 },
  listRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  listPreview: { width: 56, height: 72, borderRadius: 8, borderWidth: 0.5, borderColor: NEUTRAL.border },
  gridPreview: { width: "100%", height: 124 },
  widePreview: { width: "100%", height: 210 },
  body: { flex: 1, minWidth: 0 },
  name: { fontSize: CARD_TEXT.body, fontWeight: "600", color: NEUTRAL.textPrimary },
  sub: { fontSize: CARD_TEXT.tiny, color: NEUTRAL.textSecondary, marginTop: 3 },
  cardBody: { padding: 10, gap: 8 },
  cardBodyRow: { flexDirection: "row", alignItems: "center" },
  tagOver: { position: "absolute", left: 6, top: 6 },
  tick: { position: "absolute", left: 6, top: 6, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: NEUTRAL.surface },
  tickRight: { left: undefined, right: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  gridCell: { width: "48.5%", marginBottom: CARD.gap },
  actions: { gap: 6, alignItems: "flex-end" },
  actionsRow: { flexDirection: "row", justifyContent: "flex-end" },
  del: { width: ACTION_SIZE, height: ACTION_SIZE, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: NEUTRAL.surface, borderWidth: 0.5, borderColor: NEUTRAL.danger },
  change: { height: ACTION_SIZE, minWidth: ACTION_SIZE, borderRadius: 11, alignItems: "center", justifyContent: "center", borderWidth: 0.5, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface },
  classify: { backgroundColor: NEUTRAL.warningBg, borderColor: NEUTRAL.warning, paddingHorizontal: 14 },
  classifyText: { fontSize: CARD_TEXT.meta, fontWeight: "700", color: NEUTRAL.warning },
  moveBack: { flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 10, borderWidth: 0.5, borderColor: NEUTRAL.border, backgroundColor: NEUTRAL.surface },
  moveBackText: { fontSize: CARD_TEXT.meta, fontWeight: "600", color: NEUTRAL.textPrimary },
});
