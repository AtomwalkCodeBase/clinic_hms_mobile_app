import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

interface NetworkContextValue {
  /**
   * true only when we're confident there's no usable connection — either the
   * radio reports no network at all, or it's connected to a network that
   * can't actually reach the internet. A null/unknown reachability (common
   * for the first beat after launch, or on networks NetInfo can't probe) is
   * treated as online, so the offline UI never flashes on a good connection.
   */
  isOffline: boolean;
  /**
   * Bumps by one every time the connection is regained after having been
   * offline. Screens include it in an effect's deps (see useReconnectRefetch)
   * to reload data the moment the network comes back.
   */
  reconnectNonce: number;
}

const NetworkContext = createContext<NetworkContextValue>({ isOffline: false, reconnectNonce: 0 });

function computeOffline(state: { isConnected: boolean | null; isInternetReachable: boolean | null }): boolean {
  if (state.isConnected === false) return true;
  if (state.isInternetReachable === false) return true;
  return false;
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOffline, setIsOffline] = useState(false);
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const wasOffline = useRef(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = computeOffline(state);
      setIsOffline(offline);
      if (wasOffline.current && !offline) {
        setReconnectNonce((n) => n + 1);
      }
      wasOffline.current = offline;
    });
    return unsubscribe;
  }, []);

  return <NetworkContext.Provider value={{ isOffline, reconnectNonce }}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  return useContext(NetworkContext);
}
