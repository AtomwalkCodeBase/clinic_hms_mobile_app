import { useCallback, useState } from "react";

/**
 * Tracks ONLY a manual pull-to-refresh gesture, separately from React
 * Query's own `isFetching` — which is also true for the silent
 * background refetch that `useRefreshOnFocus` triggers on every stale
 * refocus. Without this split, that background refetch would trigger the
 * exact same native pull-to-refresh spinner as an actual user pull,
 * covering content that's already on screen. `refreshing` here is only
 * ever true while this hook's own `onRefresh` is in flight, i.e. while
 * RefreshControl itself is what asked for the refetch.
 */
export function usePullToRefresh(refetch: () => unknown) {
  const [pulling, setPulling] = useState(false);
  const onRefresh = useCallback(async () => {
    setPulling(true);
    try {
      await refetch();
    } finally {
      setPulling(false);
    }
  }, [refetch]);
  return { refreshing: pulling, onRefresh };
}
