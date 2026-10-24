import { NEUTRAL } from "@/theme/themes";
import { CHART } from "./chartTheme";
import type { Tone } from "@/utils/journey";

/** The colours of the Health journey: the mark itself (fg), text on a chip (text) and the chip's background (tint). */
export const TONES: Record<Tone, { fg: string; text: string; tint: string }> = {
  ink: { fg: NEUTRAL.textPrimary, text: NEUTRAL.textSecondary, tint: NEUTRAL.surfaceAlt },
  muted: { fg: NEUTRAL.textMuted, text: NEUTRAL.textSecondary, tint: NEUTRAL.surfaceAlt },
  acute: { fg: CHART.acute, text: NEUTRAL.textSecondary, tint: NEUTRAL.surfaceAlt },
  chronic: { fg: CHART.chronic, text: "#1D4FB0", tint: "#E4EEFA" },
  info: { fg: CHART.chronic, text: "#1D4FB0", tint: "#E4EEFA" },
  critical: { fg: NEUTRAL.danger, text: "#8F2C2C", tint: NEUTRAL.dangerBg },
  serious: { fg: "#B3541E", text: "#8F4317", tint: "#FCEEE3" },
  good: { fg: "#1E7A3C", text: "#1E6B35", tint: "#E3F2E7" },
  warning: { fg: CHART.warning, text: NEUTRAL.warning, tint: NEUTRAL.warningBg },
};

/** The dark ink of the active tab and the switches: the app text colour. */
export const INK = NEUTRAL.textPrimary;
export const SOFT_LINE = "#E3E9ED";
export const MIN_TAP = 44;
