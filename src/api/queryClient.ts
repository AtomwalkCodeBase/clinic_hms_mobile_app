import { QueryClient, onlineManager } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";

/**
 * React Query assumes a browser (`navigator.onLine`) by default, which
 * doesn't exist on RN — without this, `refetchOnReconnect` silently never
 * fires. This one wire-up covers reconnect-refetch for every query in the
 * app, replacing the old useReconnectRefetch hook that only 5 of ~20
 * screens remembered to call.
 */
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(!!state.isConnected))
);

export const queryClient = new QueryClient({
  defaultOptions: {
    // Data younger than this is served straight from cache on refocus —
    // no network call at all, not even the quiet background-refresh pill.
    // 3 minutes covers ordinary back-and-forth between tabs within a
    // session (which is most tab switching) with zero network chatter;
    // older data still refetches in the background (useRefreshOnFocus)
    // without ever blanking what's already on screen — see
    // TopProgressBar.tsx. Also doubles as backend courtesy: fewer
    // redundant refetches means less traffic against the shared per-user
    // rate limit.
    queries: { staleTime: 3 * 60_000, gcTime: 15 * 60_000, retry: 2 },
    // Writes aren't safe to blindly retry — matches the isLikelyNetworkError
    // gating already used for mutation retries elsewhere in this app.
    mutations: { retry: 0 },
  },
});
