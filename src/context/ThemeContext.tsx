import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_THEME_KEY, NEUTRAL, THEMES, ThemeColors } from "@/theme/themes";

const STORAGE_KEY = "aw_theme_key";

interface ThemeContextValue {
  theme: ThemeColors;
  neutral: typeof NEUTRAL;
  setThemeKey: (key: string) => void;
  allThemes: ThemeColors[];
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeKey, setThemeKeyState] = useState(DEFAULT_THEME_KEY);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved && THEMES.some((t) => t.key === saved)) setThemeKeyState(saved);
    });
  }, []);

  const setThemeKey = (key: string) => {
    setThemeKeyState(key);
    AsyncStorage.setItem(STORAGE_KEY, key);
  };

  const theme = useMemo(() => THEMES.find((t) => t.key === themeKey) || THEMES[0], [themeKey]);

  return (
    <ThemeContext.Provider value={{ theme, neutral: NEUTRAL, setThemeKey, allThemes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useAppTheme must be used within ThemeProvider");
  return ctx;
}
