import React, { useRef } from "react";
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A Pressable that gives way under the finger: it springs to a slightly smaller size while pressed and back when
 * released, on the native driver so it never waits for JavaScript. `haptic` adds a light tap of the vibration motor on
 * press, for the main actions (Book, Confirm, a slot).
 */
export function PressableScale({
  children, style, scaleTo = 0.97, haptic = false, onPressIn, onPressOut, disabled, ...rest
}: Omit<PressableProps, "style" | "children"> & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  // The Pressable itself is animated and carries the caller's style, so flex, width and margins lay out exactly as
  // they would on a plain Pressable.
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: v === 1 ? 6 : 0 }).start();
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        to(scaleTo);
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPressIn?.(e);
      }}
      onPressOut={(e) => { to(1); onPressOut?.(e); }}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}
