/**
 * The one look shared by every gadget tile (Home and Health) and by the tinted rows on the Profile tab: "Whisper
 * green" — a very light green gradient with a soft border and shadow — with the app's emerald icon badge on top. Every
 * gadget uses exactly this; there is no per-gadget colour any more.
 */
export const WHISPER_GREEN = {
  bg: ["#FAFEFC", "#F2FAF6", "#E8F6EF"] as const,
  border: "#ECF7F1",
  shadow: "#0A4020",
  shadowOpacity: 0.1,
  /** the diagonal highlight laid over the gradient */
  sheen: ["rgba(255,255,255,0.8)", "rgba(255,255,255,0.14)", "rgba(255,255,255,0)"] as const,
};
