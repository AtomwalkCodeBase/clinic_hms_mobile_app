import React, { createContext, useContext, useEffect, useState } from "react";
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
}

const NetworkContext = createContext<NetworkContextValue>({ isOffline: false });

function computeOffline(state: { isConnected: boolean | null; isInternetReachable: boolean | null }): boolean {
  if (state.isConnected === false) return true;
  if (state.isInternetReachable === false) return true;
  return false;
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(computeOffline(state));
    });
    return unsubscribe;
  }, []);

  return <NetworkContext.Provider value={{ isOffline }}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  return useContext(NetworkContext);
}
