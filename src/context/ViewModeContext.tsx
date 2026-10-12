import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ViewMode = "list" | "grid";
const KEY = "aw_view_mode";

/**
 * How file lists are shown (a row with a preview at the left, or a two-column grid). One choice for the whole app,
 * saved on the phone, so Bulk Upload (Files and Ready to Submit), My Documents and every type page follow it.
 */
const Ctx = createContext<{ mode: ViewMode; setMode: (m: ViewMode) => void } | undefined>(undefined);

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>("list");
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v === "grid" || v === "list") setModeState(v); }).catch(() => {});
  }, []);
  const setMode = (m: ViewMode) => {
    setModeState(m);
    AsyncStorage.setItem(KEY, m).catch(() => {});
  };
  return <Ctx.Provider value={{ mode, setMode }}>{children}</Ctx.Provider>;
}

export function useViewMode() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useViewMode must be used within ViewModeProvider");
  return v;
}
