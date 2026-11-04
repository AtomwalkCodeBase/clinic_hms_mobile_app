export interface ThemeColors {
  fill: string;
  bg: string;
  text: string;
  on: string;
}

/**
 * Aurora Glass. One brand green that drifts into sky blue, frosted white surfaces on a soft mint wash, deep green-ink text.
 * Every screen reads these names, so changing a value here restyles the whole app.
 *
 * BRAND        solid fills (buttons, selected chips, badges); white text sits on it at 4.6:1
 * ON_BRAND     text and icons on BRAND and on the gradient headers
 * BRAND_TEXT   green text and thin lines on white (6:1)
 * BRAND_SOFT   light green for gradient ends and soft badges
 * BRAND_DEEP   shadows under green things
 * BRAND_TINT   pale green backgrounds (selected rows, info banners)
 */
export const BRAND = "#0C8A63";
export const ON_BRAND = "#FFFFFF";
export const BRAND_TEXT = "#0A6E50";
export const BRAND_SOFT = "#5FD3A6";
export const BRAND_DEEP = "#0A6F50";
export const BRAND_TINT = "#DFF3EA";

/** Every header band and hero, as in the prototype: linear-gradient(140deg, deep green, green 55%, sky blue). Draw it with AngledGradient. */
export const HEADER_GRADIENT = ["#0B7D5A", "#12A877", "#2C8BE0"] as const;
export const HEADER_LOCATIONS = [0, 0.55, 1] as const;
export const HEADER_ANGLE = 140;
/** The status bar strip above a header: the top edge of that gradient on a typical header (deep green at the left, to green, to a teal-blue at the right). */
export const HEADER_STRIP = ["#0B7D5A", "#12A877", "#1B9E9A"] as const;
export const HEADER_STRIP_LOCATIONS = [0, 0.79, 1] as const;
/** The glass highlight laid over headers (GlassSheen). */
export const HEADER_SHEEN = ["rgba(255,255,255,0.06)", "rgba(255,255,255,0.18)", "rgba(255,255,255,0.04)"] as const;

/** The accent used for buttons, links, selected tabs and ticks. */
export const THEME: ThemeColors = { fill: BRAND, bg: BRAND_TINT, text: BRAND_TEXT, on: ON_BRAND };

/** The solid colour of the status bar strip above a header (the gradient's starting green). */
export const HEADER_GREEN = "#0B7D5A";

export const NEUTRAL = {
  bg: "#F3F7F6",
  surface: "#FFFFFF",
  surfaceAlt: "#EEF4F2",
  border: "#DCE7E3",
  textPrimary: "#0E2A23",
  textSecondary: "#3A5049",
  textMuted: "#5B6E68",
  success: "#146B3A",
  successBg: "#E3F3E8",
  warning: "#8A5300",
  warningBg: "#FBF0DC",
  danger: "#B4342F",
  dangerBg: "#FBE9E8",
  brandMark: "#0E2A23",
};

/** Aurora Glass building blocks used by the buttons. */
export const AURORA = {
  /** the main button and selected date / slot */
  action: ["#0B7D5A", "#12A877", "#1E93C4"] as const,
  /** soft green-tinted drop shadow for floating cards */
  shadow: {
    shadowColor: "#0E3C2E",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
} as const;
