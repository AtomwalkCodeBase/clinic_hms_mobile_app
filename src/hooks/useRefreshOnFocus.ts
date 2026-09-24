import { useCallback, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";

export interface RefreshableQuery {
  /** React Query's own staleTime-vs-dataUpdatedAt verdict — true only once
   * this query's data is actually old enough to be worth a network call. */
  isStale: boolean;
  refetch: () => unknown;
}

/**
 * Refetches on every focus AFTER the first, but ONLY the queries that are
 * actually stale — useQuery already fetches on mount, so without skipping
 * that first focus this would fire a duplicate request the instant a screen
 * appears, and without the `isStale` check every single tab switch would
 * force a real network call regardless of how fresh the data already is.
 *
 * That second part is not optional: `.refetch()` is an explicit, forced
 * call — it ignores `staleTime` completely, that guard only governs React
 * Query's OWN automatic refetch triggers (on mount, on its own focus
 * manager). Calling `.refetch()` unconditionally here, the way an earlier
 * version of this hook did, meant every tab revisit re-fetched and showed
 * TopProgressBar's "Updating" pill even a few seconds after the same data
 * had just loaded — staleTime was doing nothing to prevent it. Checking
 * `isStale` first is what actually makes "already open recently" feel
 * instant with zero network chatter, which is the entire point of caching
 * in memory in the first place.
 *
 * Pass one query result, or an array of them for a screen that combines
 * several — each is refetched independently only if IT is stale, not all
 * scoop-refetched because ANY one of them is.
 */
export function useRefreshOnFocus(queries: RefreshableQuery | RefreshableQuery[]) {
  const enabledRef = useRef(false);
  const queriesRef = useRef(queries);
  queriesRef.current = queries;
  useFocusEffect(
    useCallback(() => {
      if (enabledRef.current) {
        const list = Array.isArray(queriesRef.current) ? queriesRef.current : [queriesRef.current];
        list.forEach((q) => {
          if (q.isStale) q.refetch();
        });
      } else {
        enabledRef.current = true;
      }
    }, [])
  );
}
