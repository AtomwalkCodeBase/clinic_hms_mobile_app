import React, { createContext, useContext } from "react";
import { NEUTRAL, THEME, ThemeColors } from "@/theme/themes";

interface ThemeContextValue {
  theme: ThemeColors;
  neutral: typeof NEUTRAL;
}

const value: ThemeContextValue = { theme: THEME, neutral: NEUTRAL };
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useAppTheme must be used within ThemeProvider");
  return ctx;
}
