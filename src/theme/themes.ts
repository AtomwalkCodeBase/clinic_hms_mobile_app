export interface ThemeColors {
  fill: string;
  bg: string;
  text: string;
  on: string;
}

// The app's one theme colour: BRAND. Fills (status bar, headers, buttons, tiles) use it and the deep green-black
// ON_BRAND sits on top of it. Green text and thin lines on white are BRAND_TEXT, the deeper shade of it. The three
// derived shades below are for gradients, shadows and pale backgrounds - nothing else in the app hard-codes a green.
export const BRAND = "#0FB775";
export const ON_BRAND = "#04261C";
// Green TEXT and thin lines on white are a deeper shade of the same green (5.4:1 on white; BRAND itself is 2.6:1, too pale to read at 13px).
export const BRAND_TEXT = "#077A4B";
export const BRAND_SOFT = "#96E4C4";
export const BRAND_DEEP = "#0A8856";
// Headers run from a deeper green on the left to a lighter one on the right, under a glass highlight (GlassSheen).
export const HEADER_GRADIENT = ["#058A5A", "#3DC690"] as const;
export const HEADER_SHEEN = ["rgba(255,255,255,0.10)", "rgba(255,255,255,0.34)", "rgba(255,255,255,0.08)"] as const;
export const BRAND_TINT = "#E0F5EC";

// The app's one accent colour: buttons, links, selected tabs and ticks. The brand mark (logo) is separate from this.
export const THEME: ThemeColors = { fill: BRAND, bg: BRAND_TINT, text: BRAND_TEXT, on: ON_BRAND };

// The one solid colour of the status bar and of every header band under it (screens' `topColor`, MetalHero's top edge,
// My Documents' header). Same value everywhere, so the status bar and the header read as one piece.
export const HEADER_GREEN = "#058A5A";

export const NEUTRAL = {
  bg: "#F0F1F5",
  surface: "#FFFFFF",
  surfaceAlt: "#F0F3F6",
  border: "#C9D6E3",
  textPrimary: "#0C2340",
  textSecondary: "#4B5C6C",
  textMuted: "#64748B",
  success: "#166534",
  successBg: "#E8F5EC",
  warning: "#854F0B",
  warningBg: "#FAEEDA",
  danger: "#B23A3A",
  dangerBg: "#FBE9E9",
  brandMark: "#0F4A3A",
};
