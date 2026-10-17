import { useRef, useState } from "react";
import { Modal, Pressable, View, Text, StyleSheet, Dimensions, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MoreVertical } from "lucide-react-native";
import { NEUTRAL, ON_BRAND } from "@/theme/themes";
import type { LucideIcon } from "@/theme/icons";

export interface MenuItem {
  key: string;
  label: string;
  icon: LucideIcon;
  /** red text and icon: a destructive choice */
  danger?: boolean;
  /** shows a small spinner and ignores taps (a download in progress) */
  busy?: boolean;
  onPress: () => void;
}

/** The height of one choice in the popup (padding and text), used to decide whether it fits under the dots. */
const ITEM_HEIGHT = 50;

/**
 * The three dots at the top right of a card and the small popup of choices under it. Every choice is passed in, so
 * My Documents (View, Download, Delete) and Bulk Upload (Change type, Ready to Submit, Delete) use the same control.
 * The popup opens just under the dots and closes on any tap outside it or on a choice.
 */
export function CardMenu({ items, label = "More options", round = false }: { items: MenuItem[]; label?: string; round?: boolean }) {
  const ref = useRef<View>(null);
  const insets = useSafeAreaInsets();
  const [at, setAt] = useState<{ top?: number; bottom?: number; right: number } | null>(null);

  if (!items.length) return null;

  // The popup always opens fully on screen: under the dots when there is room, above them when there isn't (a card at
  // the bottom of the list), and in the worst case slid up to fit. Its right edge lines up with the dots' right edge.
  const open = () => {
    ref.current?.measureInWindow((x, y, w, h) => {
      const { width, height } = Dimensions.get("window");
      const menuHeight = items.length * ITEM_HEIGHT;
      const bottomGap = Math.max(insets.bottom, 24) + 8;            // the phone's navigation bar and a margin
      const spaceBelow = height - (y + h) - bottomGap;
      const spaceAbove = y - insets.top - 8;
      const right = Math.max(12, width - (x + w) - 7);
      if (spaceBelow >= menuHeight) setAt({ top: y + h + 2, right });
      else if (spaceAbove >= menuHeight) setAt({ bottom: height - y + 2, right });
      else setAt({ top: Math.max(insets.top + 8, height - bottomGap - menuHeight), right });
    });
  };
  const close = () => setAt(null);

  return (
    <>
      <Pressable ref={ref} onPress={open} hitSlop={8} accessibilityRole="button" accessibilityLabel={label} style={round ? styles.round : styles.dots}>
        <MoreVertical size={round ? 21 : 20} color={round ? ON_BRAND : NEUTRAL.textSecondary} strokeWidth={2.4} />
      </Pressable>
      <Modal visible={!!at} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={close}>
          {at && (
            <View style={[styles.menu, { top: at.top, bottom: at.bottom, right: at.right }]} onStartShouldSetResponder={() => true}>
              {items.map((it, i) => {
                const Icon = it.icon;
                const color = it.danger ? NEUTRAL.danger : NEUTRAL.textPrimary;
                return (
                  <Pressable
                    key={it.key}
                    disabled={it.busy}
                    onPress={() => { close(); setTimeout(it.onPress, 0); }}
                    style={({ pressed }) => [styles.item, i > 0 && styles.itemLine, pressed && { backgroundColor: NEUTRAL.surfaceAlt }]}
                  >
                    {it.busy ? <ActivityIndicator size="small" color={color} /> : <Icon size={18} color={color} strokeWidth={2.1} />}
                    <Text style={[styles.itemText, { color }]}>{it.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  dots: { width: 30, height: 30, alignItems: "center", justifyContent: "center", marginTop: -4, marginRight: -7 },
  // on a screen header band: an outlined circle, the same as the "?" help button next to it
  round: {
    width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: ON_BRAND,
  },
  backdrop: { flex: 1, backgroundColor: "rgba(12,35,64,0.18)" },
  menu: {
    position: "absolute", minWidth: 200, backgroundColor: NEUTRAL.surface, borderRadius: 14, borderWidth: 0.5,
    borderColor: NEUTRAL.border, overflow: "hidden", elevation: 8,
    shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  item: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  itemLine: { borderTopWidth: 0.5, borderTopColor: NEUTRAL.border },
  itemText: { fontSize: 14.5, fontWeight: "600" },
});
