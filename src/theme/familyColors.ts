
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

type AgeTier = "toddler" | "school" | "teen";

const TIER_BOUNDS: { max: number; tier: AgeTier }[] = [
  { max: 3, tier: "toddler" },
  { max: 12, tier: "school" },
  { max: 18, tier: "teen" },
];

function ageTierFromDob(dob: string | null): AgeTier | null {
  if (!dob) return null;
  const years = (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000);
  if (years < 0) return null;
  const bound = TIER_BOUNDS.find((b) => years < b.max);
  return bound ? bound.tier : null; // 18+ -> null, not a pediatric tier
}

interface FamilyAccent {
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
