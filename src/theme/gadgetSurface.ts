import { BRAND_DEEP } from "./themes";

/**
 * The one look shared by every gadget tile (Home and Health) and by the tinted rows on the Profile tab: frosted white
 * glass with a faint mint corner, a soft border and a soft green shadow.
 */
export const WHISPER_GREEN = {
  bg: ["#FFFFFF", "#FBFEFC", "#F1FAF5"] as const,
  border: "#FFFFFF",
  shadow: BRAND_DEEP,
  shadowOpacity: 0.12,
  /** the diagonal highlight laid over the gradient */
  sheen: ["rgba(255,255,255,0.9)", "rgba(255,255,255,0.2)", "rgba(255,255,255,0)"] as const,
};
