import { useEffect, useRef } from "react";
import { useNetwork } from "@/context/NetworkContext";

/**
 * Calls `refetch` once each time the device regains connectivity after
 * having been offline — so a screen that failed to load (or went stale)
 * while the network was down refreshes itself the moment it's back, without
 * the patient having to pull-to-refresh.
 *
 * No-op on the first render and while online; only the offline -> online
 * transition fires it.
 */
export function useReconnectRefetch(refetch: () => void) {
  const { reconnectNonce } = useNetwork();
  const lastSeen = useRef(reconnectNonce);
  const cb = useRef(refetch);
  cb.current = refetch;

  useEffect(() => {
    if (reconnectNonce !== lastSeen.current) {
      lastSeen.current = reconnectNonce;
      cb.current();
    }
  }, [reconnectNonce]);
}
