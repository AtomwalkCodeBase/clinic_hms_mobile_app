export interface ThemeColors {
  fill: string;
  bg: string;
  text: string;
  on: string;
}

// The app's one accent colour (clinical green): buttons, links, selected tabs and ticks. The brand mark (logo) is a
// fixed dark green, separate from this.
export const THEME: ThemeColors = { fill: "#15803D", bg: "#E8F5EC", text: "#166534", on: "#FFFFFF" };

export const NEUTRAL = {
  bg: "#F4F8FC",
  surface: "#FFFFFF",
  surfaceAlt: "#F0F3F6",
  border: "#C9D6E3",
  textPrimary: "#0C2340",
  textSecondary: "#5A6B7A",
  textMuted: "#8B98A5",
  success: "#166534",
  successBg: "#E8F5EC",
  warning: "#854F0B",
  warningBg: "#FAEEDA",
  danger: "#B23A3A",
  dangerBg: "#FBE9E9",
  brandMark: "#0F4A3A",
};
