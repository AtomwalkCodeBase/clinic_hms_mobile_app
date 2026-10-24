import { memo, startTransition, useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { NEUTRAL } from "@/theme/themes";
import { ACTION, ON_ACTION } from "@/theme/buttons";
import { INK, MIN_TAP } from "@/components/health/journeyTheme";

export interface TabOption<T extends string> { key: T; label: string }

const FADE_MS = 140;
const TRACK = "#E3E9EE";
const PILL_GAP = 6;

/**
 * The few shapes a switch takes in the app. "pills" are separate rounded buttons, the chosen one filled green; a "track" is one
 * grey bar with a white thumb under the chosen option. Equal widths share the row; content widths keep each label's own width
 * and scroll sideways when they do not fit.
 */
const LOOKS = {
  tabs:  { pills: true,  widths: "equal",   minHeight: MIN_TAP - 2, padX: 4,  radius: 13,  font: 13,   weight: "700" },
  chips: { pills: true,  widths: "content", minHeight: 38,          padX: 14, radius: 999, font: 13,   weight: "500" },
  large: { pills: true,  widths: "content", minHeight: 46,          padX: 20, radius: 24,  font: 15,   weight: "700" },
  bar:   { pills: false, widths: "equal",   minHeight: MIN_TAP - 4, padX: 2,  radius: 12,  font: 12.5, weight: "500" },
  small: { pills: false, widths: "equal",   minHeight: 30,          padX: 8,  radius: 8,   font: 10.5, weight: "600" },
} as const;

export type TabsLook = keyof typeof LOOKS;

/**
 * The one switch used everywhere a person picks one of a few options. The chosen option's highlight fades in on it and out of the
 * last one. Only opacity is animated, and on the native driver, so a tap never waits for the JavaScript thread (which is busy
 * drawing the screen the tab opens); nothing is measured, so it is right from the first frame.
 */
function SlidingTabsImpl<T extends string>({
  options, value, onChange, label, look, scroll = true, style,
}: {
  options: TabOption<T>[];
  value: T;
  onChange: (key: T) => void;
  /** read out by screen readers, e.g. "Journey sections" */
  label: string;
  look: TabsLook;
  /** content-width switches only: let the row scroll sideways instead of squeezing when it is wider than the screen */
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const spec = LOOKS[look];
  const equal = spec.widths === "equal";
  // The tap shows at once from this local choice; the screen's own state follows as a low-priority update, so a heavy tab
  // being drawn can never hold the button back. It falls back to the screen's value whenever that changes.
  const [tapped, setTapped] = useState<T | null>(null);
  useEffect(() => { setTapped(null); }, [value]);
  const shown = tapped ?? value;
  const index = Math.max(0, options.findIndex((o) => o.key === shown));
  // one highlight per option, 1 on the chosen one; created on first sight of an option and kept
  const fades = useRef<Record<string, Animated.Value>>({});
  const fadeOf = (key: string, on: boolean) => (fades.current[key] ??= new Animated.Value(on ? 1 : 0));
  useEffect(() => {
    options.forEach((o, i) => {
      Animated.timing(fadeOf(o.key, i === index), { toValue: i === index ? 1 : 0, duration: FADE_MS, useNativeDriver: true }).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const cells = options.map((o, i) => {
    const on = i === index;
    const textColor = spec.pills ? (on ? ON_ACTION : INK) : (on ? INK : NEUTRAL.textSecondary);
    return (
      <Pressable
        key={o.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        onPress={() => { if (o.key === shown) return; setTapped(o.key); startTransition(() => onChange(o.key)); }}
        style={[equal ? styles.equalCell : null, equal && spec.pills ? { paddingHorizontal: PILL_GAP / 2 } : null]}
      >
        <View
          style={[
            styles.cell,
            { minHeight: spec.minHeight, paddingHorizontal: spec.padX, borderRadius: spec.pills ? spec.radius : 0 },
            spec.pills ? [styles.pillBorder, { backgroundColor: NEUTRAL.surface, borderColor: on ? ACTION : NEUTRAL.border }] : null,
          ]}
        >
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, spec.pills ? styles.pillThumb : styles.trackThumb, { borderRadius: spec.radius, opacity: fadeOf(o.key, on) }]}
          />
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit={equal}
            minimumFontScale={0.8}
            style={{ fontSize: spec.font, fontWeight: on ? "700" : spec.weight, color: textColor }}
          >
            {o.label}
          </Text>
        </View>
      </Pressable>
    );
  });

  const row = (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={[styles.row, spec.pills ? (equal ? styles.pillsEqual : styles.pillsContent) : styles.track, spec.pills ? null : { borderRadius: spec.radius + 2 }]}>
      {cells}
    </View>
  );

  if (!equal && scroll) {
    return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style} contentContainerStyle={styles.scrollContent}>{row}</ScrollView>;
  }
  return <View style={style}>{row}</View>;
}

/** Redrawn only when its own options or value change, not whenever the screen around it is. */
export const SlidingTabs = memo(SlidingTabsImpl) as typeof SlidingTabsImpl;

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "stretch" },
  pillsEqual: { marginHorizontal: -PILL_GAP / 2 },
  pillsContent: { gap: PILL_GAP },
  track: { padding: 2, backgroundColor: TRACK },
  scrollContent: { paddingRight: 8 },
  equalCell: { flex: 1, minWidth: 0 },
  cell: { flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  pillBorder: { borderWidth: 1 },
  pillThumb: { backgroundColor: ACTION },
  trackThumb: { backgroundColor: NEUTRAL.surface, borderWidth: 1, borderColor: NEUTRAL.border },
});
