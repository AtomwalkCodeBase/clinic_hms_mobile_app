import { createContext, useContext, useMemo, useState } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HEADER_GRADIENT, HEADER_LOCATIONS, HEADER_ANGLE, HEADER_STRIP, HEADER_STRIP_LOCATIONS } from "@/theme/themes";

/**
 * The header gradient drawn the way CSS `linear-gradient(140deg, ...)` draws it: the angle is fixed on screen and the
 * colours run corner to corner along it, so the blue gathers in the bottom right however tall or wide the header is.
 * (LinearGradient's own start and end are fractions of the box, which bends the angle on a wide, short header.)
 *
 * The prototype paints one gradient over the status bar and the header together. Here they are two views, so the header
 * tells the status bar its size (HeaderGeometry) and both draw their own slice of the one gradient: the header the part
 * below the status bar, the status bar the part above it. The two meet without a seam on every screen.
 */
type Size = { w: number; h: number };
const HeaderGeometry = createContext<{ size: Size | null; report: (size: Size) => void } | null>(null);

export function HeaderGeometryProvider({ children }: { children: React.ReactNode }) {
  const [size, setSize] = useState<Size | null>(null);
  const value = useMemo(
    () => ({
      size,
      report: (next: Size) => setSize((prev) => (prev && prev.w === next.w && prev.h === next.h ? prev : next)),
    }),
    [size],
  );
  return <HeaderGeometry.Provider value={value}>{children}</HeaderGeometry.Provider>;
}

/** Start and end of the gradient line, in pixels, for a box w wide and H tall. */
function line(w: number, H: number, angle: number) {
  const a = (angle * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const half = (Math.abs(w * dx) + Math.abs(H * dy)) / 2;
  return { sx: w / 2 - dx * half, sy: H / 2 - dy * half, ex: w / 2 + dx * half, ey: H / 2 + dy * half };
}

/** The gradient behind a header (below the status bar). */
export function AngledGradient({ angle = HEADER_ANGLE }: { angle?: number }) {
  const inset = useSafeAreaInsets().top;
  const ctx = useContext(HeaderGeometry);
  const [box, setBox] = useState<Size>({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== box.w || height !== box.h) {
      setBox({ w: width, h: height });
      ctx?.report({ w: width, h: height });
    }
  };
  const ready = box.w > 0 && box.h > 0;
  const { sx, sy, ex, ey } = line(box.w, box.h + inset, angle);
  const start = ready ? { x: sx / box.w, y: (sy - inset) / box.h } : { x: 0, y: 0 };
  const end = ready ? { x: ex / box.w, y: (ey - inset) / box.h } : { x: 1, y: 1 };
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout}>
      <LinearGradient colors={HEADER_GRADIENT} locations={HEADER_LOCATIONS} start={start} end={end} style={StyleSheet.absoluteFill} />
    </View>
  );
}

/** The slice of that same gradient that lies behind the status bar. Until the header has reported its size, a close match. */
export function StatusStripGradient({ inset }: { inset: number }) {
  const size = useContext(HeaderGeometry)?.size;
  if (!size || size.w <= 0 || size.h <= 0 || inset <= 0) {
    return <LinearGradient colors={HEADER_STRIP} locations={HEADER_STRIP_LOCATIONS} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />;
  }
  const { sx, sy, ex, ey } = line(size.w, size.h + inset, HEADER_ANGLE);
  return (
    <LinearGradient
      colors={HEADER_GRADIENT}
      locations={HEADER_LOCATIONS}
      start={{ x: sx / size.w, y: sy / inset }}
      end={{ x: ex / size.w, y: ey / inset }}
      style={StyleSheet.absoluteFill}
    />
  );
}
