export interface ThemeColors {
  key: string;
  label: string;
  fill: string;
  bg: string;
  text: string;
  on: string;
}

// Green is the default per the latest design decision — the toggle lets a
// patient pick any of these as their personal accent color; the brand mark
// (logo) itself stays a fixed dark green regardless of this choice.
export const THEMES: ThemeColors[] = [
  { key: "green", label: "Clinical green", fill: "#15803D", bg: "#E8F5EC", text: "#166534", on: "#FFFFFF" },
  { key: "blue", label: "Clinical blue", fill: "#185FA5", bg: "#E6F1FB", text: "#0C447C", on: "#FFFFFF" },
  { key: "plum", label: "Plum", fill: "#993556", bg: "#FBEAF0", text: "#72243E", on: "#FFFFFF" },
  { key: "purple", label: "Purple", fill: "#534AB7", bg: "#EEEDFE", text: "#3C3489", on: "#FFFFFF" },
  { key: "coral", label: "Coral", fill: "#993C1D", bg: "#FAECE7", text: "#712B13", on: "#FFFFFF" },
];

export const DEFAULT_THEME_KEY = "green";

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
