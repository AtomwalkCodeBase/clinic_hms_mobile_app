import type { GadgetTint } from "@/components/GadgetCard";

/**
 * Per-family-member identity color, derived from age + gender rather than
 * picked arbitrarily — grounded in two real pediatric conventions:
 *   - gender -> hue: the CDC/WHO growth-chart convention (2000-), boys blue /
 *     girls pink, using the exact NHS digital service manual tokens
 *     (blue #005eb8 / dark-blue #003087, pink #ae2573 / dark-pink #7c2855).
 *   - age -> shade: lighter to darker across the three pediatric brackets
 *     that actually have a distinct color-coding precedent (the Broselow
 *     pediatric tape uses a similar light-to-saturated progression by age,
 *     though not these exact hues — reused here as a shading pattern, not
 *     its literal palette, since Broselow's colors carry a specific
 *     emergency-dosing meaning that would be confusing to reuse verbatim).
 * Adults (18+) and anyone with an unrecognised gender value fall outside
 * both pediatric standards on purpose — callers should fall back to the
 * patient's own personal accent theme (see theme/themes.ts) instead of a
 * color from this set.
 */

export type AgeTier = "toddler" | "school" | "teen";

const TIER_BOUNDS: { max: number; tier: AgeTier }[] = [
  { max: 3, tier: "toddler" },
  { max: 12, tier: "school" },
  { max: 18, tier: "teen" },
];

export function ageTierFromDob(dob: string | null): AgeTier | null {
  if (!dob) return null;
  const years = (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000);
  if (years < 0) return null;
  const bound = TIER_BOUNDS.find((b) => years < b.max);
  return bound ? bound.tier : null; // 18+ -> null, not a pediatric tier
}

export interface FamilyAccent {
  fill: string;
  bg: string;
  text: string;
  on: string;
  label: string;
}

const ACCENTS: Record<"M" | "F", Record<AgeTier, FamilyAccent>> = {
  M: {
    toddler: { fill: "#ccdff1", bg: "#eef5fb", text: "#00386e", on: "#00386e", label: "Toddler" },
    school: { fill: "#005eb8", bg: "#ccdff1", text: "#00386e", on: "#FFFFFF", label: "School-age" },
    teen: { fill: "#003087", bg: "#ccdff1", text: "#00386e", on: "#FFFFFF", label: "Teen" },
  },
  F: {
    toddler: { fill: "#efd3e3", bg: "#fbeef4", text: "#681645", on: "#681645", label: "Toddler" },
    school: { fill: "#ae2573", bg: "#efd3e3", text: "#681645", on: "#FFFFFF", label: "School-age" },
    teen: { fill: "#7c2855", bg: "#efd3e3", text: "#681645", on: "#FFFFFF", label: "Teen" },
  },
};

function normaliseGender(gender: string): "M" | "F" | null {
  const g = (gender || "").trim().toUpperCase();
  if (g === "M" || g === "MALE") return "M";
  if (g === "F" || g === "FEMALE") return "F";
  return null;
}

/** null for adults / unrecognised gender — caller falls back to the personal accent theme. */
export function familyAccentFor(person: { gender: string; date_of_birth: string | null }): FamilyAccent | null {
  const g = normaliseGender(person.gender);
  const tier = ageTierFromDob(person.date_of_birth);
  if (!g || !tier) return null;
  return ACCENTS[g][tier];
}

// ── coordinated gadget palette ──────────────────────────────────────────
// One flat color repeated across all 4 gadget cards read as monochrome next
// to Self's 4 distinct feature colors (green/blue/coral/purple) — the fix
// isn't a flat recolor, it's each person getting their OWN 4-color family:
// one anchor hue (their identity color) plus 3 analogous neighbors, so it
// still reads as "this is a different person's screen" while keeping the
// same "4 different colors" liveliness. Literally mixing each feature color
// with the person's hue (e.g. green + pink) goes muddy, so instead each
// gender gets a hand-picked 4-anchor family that stays harmonious with its
// identity hue, and age tier only lightens/darkens those anchors — not a
// new hue per tier.
const PALETTE_ANCHORS: Record<"M" | "F", [string, string, string, string]> = {
  // vaccinations, health timeline, visits, rx & reports
  M: ["#005eb8", "#0f7a8f", "#3a4fa0", "#4a6580"],
  F: ["#ae2573", "#c2585f", "#7c2855", "#8a4a7a"],
};

const TIER_SHIFT: Record<AgeTier, number> = {
  toddler: 0.35, // lighten toward white
  school: 0,
  teen: -0.18, // darken toward black
};

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
/** amount > 0 mixes toward white (lighten), amount < 0 mixes toward black (darken). */
function shift(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const target = amount >= 0 ? 255 : 0;
  const a = Math.abs(amount);
  return rgbToHex(r + (target - r) * a, g + (target - g) * a, b + (target - b) * a);
}

function tintFromAnchor(anchor: string): GadgetTint {
  return {
    bg: [shift(anchor, 0.88), shift(anchor, 0.72), shift(anchor, 0.52)],
    icon: [shift(anchor, 0.15), anchor, shift(anchor, -0.28)],
    shadow: shift(anchor, -0.55),
    border: shift(anchor, 0.6),
  };
}

export interface FamilyGadgetPalette {
  vaccinations: GadgetTint;
  timeline: GadgetTint;
  visits: GadgetTint;
  rx: GadgetTint;
}

/** null for adults / unrecognised gender — caller falls back to the default per-feature tints. */
export function familyGadgetPaletteFor(person: { gender: string; date_of_birth: string | null }): FamilyGadgetPalette | null {
  const g = normaliseGender(person.gender);
  const tier = ageTierFromDob(person.date_of_birth);
  if (!g || !tier) return null;
  const shiftAmt = TIER_SHIFT[tier];
  const [vax, tl, vis, rx] = PALETTE_ANCHORS[g].map((a) => tintFromAnchor(shiftAmt ? shift(a, shiftAmt) : a));
  return { vaccinations: vax, timeline: tl, visits: vis, rx };
}
