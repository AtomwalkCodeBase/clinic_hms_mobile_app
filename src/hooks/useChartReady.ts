import { useCallback, useEffect, useRef, useState } from "react";
import { InteractionManager, NativeScrollEvent, NativeSyntheticEvent, ScrollView } from "react-native";

// Charts already drawn once in this session: coming back to them (another tab, the same period again) is instant.
const drawn = new Set<string>();

/**
 * Whether a chart may be drawn now. The moment `key` changes (another person, period, axis, view, tab) this is false
 * for the render that follows, so the screen paints a skeleton and the switch under the finger moves at once; the heavy
 * drawing starts after the tap's animation has finished. A chart drawn before in this session is ready straight away.
 */
export function useChartReady(key: string): boolean {
  const [readyKey, setReadyKey] = useState("");
  useEffect(() => {
    if (drawn.has(key)) return undefined;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        drawn.add(key);
        setReadyKey(key);
      });
    });
    return () => { cancelled = true; task.cancel(); };
  }, [key]);
  return drawn.has(key) || readyKey === key;
}

/**
 * For a chart that slides sideways: open at the latest end, and again whenever `resetKey` changes. `x` is how far it is
 * scrolled now, which a floating card needs to find a point on screen.
 */
export function useScrollToEnd(resetKey: string) {
  const ref = useRef<ScrollView>(null);
  const x = useRef(0);
  const toEnd = useRef(true);
  const seen = useRef("");
  if (seen.current !== resetKey) { seen.current = resetKey; toEnd.current = true; }
  const onContentSizeChange = useCallback(() => {
    if (!toEnd.current) return;
    toEnd.current = false;
    // one frame later, so the content has been painted before it is moved
    requestAnimationFrame(() => ref.current?.scrollToEnd({ animated: false }));
  }, []);
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => { x.current = e.nativeEvent.contentOffset.x; }, []);
  return { ref, x, onContentSizeChange, onScroll };
}

let nextId = 1;
const ids = new WeakMap<object, number>();
/** A short number that stays the same for the same object: lets a chart's cache key follow the data it was built from. */
export function idOf(obj: object): number {
  let id = ids.get(obj);
  if (!id) { id = nextId++; ids.set(obj, id); }
  return id;
}
