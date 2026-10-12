import { useRef, useState } from "react";
import { Animated, Easing, LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

const MAX_SCALE = 5;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * A photo you can pinch, double-tap and drag. At normal size, dragging it down closes the viewer (onDismiss), like a
 * phone gallery. The drag is kept inside the picture's edges when it is zoomed in.
 * Built on react-native-gesture-handler with React Native's own Animated (no extra native animation library), so it
 * runs in Expo Go as well as in the full app.
 */
export function ZoomableImage({
  uri, onReady, onError, onDismiss,
}: {
  uri: string;
  onReady?: () => void;
  onError?: () => void;
  onDismiss?: () => void;
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const scaleV = useRef(new Animated.Value(1)).current;
  const txV = useRef(new Animated.Value(0)).current;
  const tyV = useRef(new Animated.Value(0)).current;
  // The current numbers live here (the gesture callbacks run on the JS thread); the Animated values only draw them.
  const s = useRef({ scale: 1, savedScale: 1, tx: 0, ty: 0, savedTx: 0, savedTy: 0, w: 0, h: 0 }).current;

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    s.w = width;
    s.h = height;
    setBox({ w: width, h: height });
  }

  function draw() {
    scaleV.setValue(s.scale);
    txV.setValue(s.tx);
    tyV.setValue(s.ty);
  }

  function settle(scale: number, tx: number, ty: number) {
    s.scale = s.savedScale = scale;
    s.tx = s.savedTx = tx;
    s.ty = s.savedTy = ty;
    const cfg = { duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: false };
    Animated.parallel([
      Animated.timing(scaleV, { toValue: scale, ...cfg }),
      Animated.timing(txV, { toValue: tx, ...cfg }),
      Animated.timing(tyV, { toValue: ty, ...cfg }),
    ]).start();
  }

  function keepInside(scale: number, tx: number, ty: number) {
    const maxX = (s.w * scale - s.w) / 2;
    const maxY = (s.h * scale - s.h) / 2;
    return { tx: clamp(tx, -maxX, maxX), ty: clamp(ty, -maxY, maxY) };
  }

  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onUpdate((e) => {
      s.scale = clamp(s.savedScale * e.scale, 1, MAX_SCALE);
      draw();
    })
    .onEnd(() => {
      if (s.scale <= 1.02) settle(1, 0, 0);
      else {
        const p = keepInside(s.scale, s.tx, s.ty);
        settle(s.scale, p.tx, p.ty);
      }
    });

  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(6)
    .onUpdate((e) => {
      if (s.scale > 1) {
        s.tx = s.savedTx + e.translationX;
        s.ty = s.savedTy + e.translationY;
        draw();
      } else if (e.translationY > 0) {
        s.ty = e.translationY;                 // dragging a normal-size photo down, to close it
        draw();
      }
    })
    .onEnd((e) => {
      if (s.scale > 1) {
        const p = keepInside(s.scale, s.tx, s.ty);
        settle(s.scale, p.tx, p.ty);
      } else if (e.translationY > 120 && onDismiss) {
        onDismiss();
      } else {
        settle(1, 0, 0);
      }
    });

  const doubleTap = Gesture.Tap()
    .runOnJS(true)
    .numberOfTaps(2)
    .onEnd(() => {
      if (s.scale > 1) settle(1, 0, 0);
      else settle(2.5, 0, 0);
    });

  const gesture = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));

  return (
    <View style={styles.clip} onLayout={onLayout}>
      {box.w > 0 && (
        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.fill, { transform: [{ translateX: txV }, { translateY: tyV }, { scale: scaleV }] }]}>
            <Image source={{ uri }} style={styles.fill} contentFit="contain" onLoad={onReady} onError={onError} />
          </Animated.View>
        </GestureDetector>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, width: "100%" },
  clip: { flex: 1, width: "100%", overflow: "hidden" },
});
