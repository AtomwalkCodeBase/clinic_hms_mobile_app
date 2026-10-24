import { memo } from "react";
import { Text, View } from "react-native";
import { RefreshCw } from "lucide-react-native";
import { TONES } from "./journeyTheme";
import type { Shape, Tone } from "@/utils/journey";

/**
 * The same shapes as the timeline chart, used in lists, tiles and legends. Plain views and text, not SVG: a list holds dozens
 * of these, and a native drawing surface per marker is what made scrolling it heavy.
 */
export const Marker = memo(function Marker({ shape, tone = "acute", size = 14 }: { shape: Shape; tone?: Tone; size?: number }) {
  const c = TONES[tone].fg;
  const s = size;
  switch (shape) {
    case "bar":
      return <View style={{ width: s + 4, height: Math.max(Math.round(s * 0.55), 6), borderRadius: 3, backgroundColor: c }} />;
    case "diamond": {
      const side = s * 0.72;                     // a square turned 45° spans side × 1.41, which is about s
      return <View style={{ width: s, height: s, alignItems: "center", justifyContent: "center" }}><View style={{ width: side, height: side, backgroundColor: c, transform: [{ rotate: "45deg" }] }} /></View>;
    }
    case "check":
    case "cross":
      return (
        <View style={{ width: s, height: s, borderRadius: s, backgroundColor: c, alignItems: "center", justifyContent: "center" }}>
          <Text allowFontScaling={false} style={{ color: "#FFFFFF", fontSize: s * 0.7, lineHeight: s * 0.9, fontWeight: "800", includeFontPadding: false }}>{shape === "check" ? "✓" : "✕"}</Text>
        </View>
      );
    case "ring":
      return <View style={{ width: s, height: s, borderRadius: s, borderWidth: 2, borderColor: c }} />;
    case "recurrent":
      return <RefreshCw size={s + 2} color={TONES.serious.fg} strokeWidth={2.4} />;
    default:
      return <View style={{ width: s * 0.75, height: s * 0.75, borderRadius: s, backgroundColor: c }} />;
  }
});
