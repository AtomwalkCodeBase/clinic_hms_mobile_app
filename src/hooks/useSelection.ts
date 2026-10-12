import { useCallback, useState } from "react";

/**
 * Which rows the patient has selected (by long press) on a list. Held in memory only: it is a momentary choice, not
 * something to keep after the screen closes. `selecting` is true as soon as one row is selected, and that is what
 * switches a tap from "view the file" to "toggle this row".
 */
export function useSelection() {
  const [ids, setIds] = useState<Set<number>>(new Set());
  const add = useCallback((id: number) => setIds((prev) => new Set(prev).add(id)), []);
  const toggle = useCallback(
    (id: number) => setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    }),
    [],
  );
  const setMany = useCallback((list: number[]) => setIds(new Set(list)), []);
  const clear = useCallback(() => setIds((prev) => (prev.size ? new Set() : prev)), []);
  /** Drop selected ids that are no longer selectable (deleted, moved, submitted, or changed). */
  const keepOnly = useCallback((valid: number[]) => {
    const ok = new Set(valid);
    setIds((prev) => {
      const next = new Set([...prev].filter((id) => ok.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, []);
  return { ids, count: ids.size, selecting: ids.size > 0, add, toggle, setMany, clear, keepOnly };
}
