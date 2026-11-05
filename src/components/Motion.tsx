import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { AURORA } from "@/theme/themes";

/** Fades and lifts its children in when it mounts; `index` staggers a list (the first eight, 45 ms apart). */
export function Rise({ children, index = 0, style }: { children: React.ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 380, delay: Math.min(index, 8) * 45, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, index]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** A number that counts up from 0 when it first appears. */
export function CountUp({ value, prefix = "", style, duration = 700 }: { value: number; prefix?: string; style?: StyleProp<any>; duration?: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = Date.now();
    const step = () => {
      const k = Math.min(1, (Date.now() - t0) / duration);
      setShown(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <Text style={style}>{prefix}{shown}</Text>;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** The booking-done mark: a green circle that pops in, then a white tick that draws itself. */
export function AnimatedCheck({ size = 96 }: { size?: number }) {
  const pop = useRef(new Animated.Value(0)).current;
  const draw = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 12 }),
      Animated.timing(draw, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
  }, [pop, draw]);
  const LEN = 60;
  return (
    <Animated.View style={{ transform: [{ scale: pop }], ...AURORA.shadow }}>
      <Svg width={size} height={size} viewBox="0 0 96 96">
        <Circle cx="48" cy="48" r="44" fill="#12A877" />
        <Circle cx="48" cy="48" r="44" fill="#2C8BE0" opacity={0.25} />
        <AnimatedPath
          d="M30 49l12 12 24-26"
          stroke="#FFFFFF"
          strokeWidth={7}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${LEN}`}
          strokeDashoffset={draw.interpolate({ inputRange: [0, 1], outputRange: [LEN, 0] }) as unknown as number}
        />
      </Svg>
    </Animated.View>
  );
}

const CONFETTI = ["#12A877", "#2C8BE0", "#F4B740", "#E2725B", "#7C5CD6"];

/** A one-off burst of confetti from the top centre. Purely decorative; it ignores touches. */
export function Confetti({ count = 36 }: { count?: number }) {
  const pieces = useRef(
    Array.from({ length: count }, (_, i) => ({
      v: new Animated.Value(0),
      x: (Math.random() - 0.5) * 320,
      y: 160 + Math.random() * 260,
      r: Math.random() * 720 - 360,
      c: CONFETTI[i % CONFETTI.length],
      w: 6 + Math.random() * 6,
      d: 900 + Math.random() * 700,
    })),
  ).current;
  useEffect(() => {
    Animated.parallel(pieces.map((p) => Animated.timing(p.v, { toValue: 1, duration: p.d, easing: Easing.out(Easing.quad), useNativeDriver: true }))).start();
  }, [pieces]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center" }]}>
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute", top: 30, width: p.w, height: p.w * 0.5, borderRadius: 1.5, backgroundColor: p.c,
            opacity: p.v.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateX: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, p.x] }) },
              { translateY: p.v.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, -40, p.y] }) },
              { rotate: p.v.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${p.r}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

/** A short left-right shake for a field that was just rejected. Spread `style` on the wrapper and call `shake()`. */
export function useShake() {
  const v = useRef(new Animated.Value(0)).current;
  const shake = () => {
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 400, easing: Easing.linear, useNativeDriver: true }).start();
  };
  const style = { transform: [{ translateX: v.interpolate({ inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1], outputRange: [0, -6, 6, -6, 6, 0] }) }] };
  return { shake, style };
}
