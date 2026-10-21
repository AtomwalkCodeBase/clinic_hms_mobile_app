import { View } from "react-native";
import Svg, { Circle, Path, Polygon } from "react-native-svg";
import { RefreshCw } from "lucide-react-native";
import { TONES } from "./journeyTheme";
import type { Shape, Tone } from "@/utils/journey";

/** The same shapes as the timeline chart, used in lists, tiles and legends. */
export function Marker({ shape, tone = "acute", size = 14 }: { shape: Shape; tone?: Tone; size?: number }) {
  const c = TONES[tone].fg;
  const s = size;
  const h = s / 2;
  switch (shape) {
    case "bar":
      return <View style={{ width: s + 4, height: Math.max(Math.round(s * 0.55), 6), borderRadius: 3, backgroundColor: c }} />;
    case "diamond":
      return <Svg width={s} height={s}><Polygon points={`${h},0.5 ${s - 0.5},${h} ${h},${s - 0.5} 0.5,${h}`} fill={c} /></Svg>;
    case "check":
      return (
        <Svg width={s} height={s}>
          <Circle cx={h} cy={h} r={h} fill={c} />
          <Path d={`M${s * 0.28} ${h} L${s * 0.44} ${s * 0.66} L${s * 0.74} ${s * 0.34}`} stroke="#FFFFFF" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case "cross":
      return (
        <Svg width={s} height={s}>
          <Circle cx={h} cy={h} r={h} fill={c} />
          <Path d={`M${s * 0.33} ${s * 0.33} L${s * 0.67} ${s * 0.67} M${s * 0.67} ${s * 0.33} L${s * 0.33} ${s * 0.67}`} stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" />
        </Svg>
      );
    case "ring":
      return <Svg width={s} height={s}><Circle cx={h} cy={h} r={h - 1.5} fill="none" stroke={c} strokeWidth={2} /></Svg>;
    case "recurrent":
      return <RefreshCw size={s + 2} color={TONES.serious.fg} strokeWidth={2.4} />;
    default:
      return <View style={{ width: s * 0.75, height: s * 0.75, borderRadius: s, backgroundColor: c }} />;
  }
}
