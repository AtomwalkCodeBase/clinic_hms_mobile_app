import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Check } from "lucide-react-native";
import { docTypeStyle } from "@/theme/docTypes";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { CARD_ICON } from "@/theme/cardSizes";

/** The round coloured icon of a document type. `selected` adds a green tick; `working` shows a spinner instead of the icon. */
export function TypeAvatar({
  code, size = CARD_ICON, selected, working, onTint,
}: {
  code?: string | null;
  size?: number;
  selected?: boolean;
  working?: boolean;
  /** the avatar sits on a tinted background of its own colour, so give it a white circle to stand out */
  onTint?: boolean;
}) {
  const { theme } = useAppTheme();
  const s = docTypeStyle(code);
  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: working ? NEUTRAL.surfaceAlt : onTint ? NEUTRAL.surface : s.tint }]}>
        {working ? <ActivityIndicator size="small" color={theme.fill} /> : <s.Icon size={Math.round(size * 0.48)} color={s.ink} strokeWidth={2} />}
      </View>
      {selected && (
        <View style={[styles.tick, { backgroundColor: theme.fill, borderColor: NEUTRAL.surface }]}>
          <Check size={11} color={theme.on} strokeWidth={3.4} />
        </View>
      )}
    </View>
  );
}

/** The type's short name as a small coloured tag. */
export function TypeTag({ code, label }: { code?: string | null; label?: string }) {
  const s = docTypeStyle(code);
  return (
    <View style={[styles.tag, { backgroundColor: s.tint }]}>
      <Text style={[styles.tagText, { color: s.ink }]} numberOfLines={1}>{label ?? s.tag}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: "center", justifyContent: "center" },
  tick: { position: "absolute", right: -3, bottom: -3, width: 19, height: 19, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  tag: { alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 10.5, fontWeight: "700", letterSpacing: 0.3 },
});
