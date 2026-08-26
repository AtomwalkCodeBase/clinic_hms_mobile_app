import {
  Stethoscope,
  Baby,
  Sparkles,
  HeartPulse,
  Bone,
  Ear,
  Venus,
  Smile,
  Brain,
  HeartHandshake,
  Wind,
  Utensils,
  Eye,
  Droplet,
  Ribbon,
  Activity,
} from "lucide-react-native";
import type { LucideIcon } from "./icons";

// Reuses the same 10 color families as GADGET_TINTS/DASHBOARD_TINTS
// (green/blue/coral/purple/amber/teal/indigo/rose/gold/slate) so a
// specialty's color reads as "this app's palette", not an arbitrary
// rainbow bolted on for this one screen.
const SWATCHES = [
  { bg: "#EAF8EF", fg: "#15803D" },
  { bg: "#EAF3FC", fg: "#185FA5" },
  { bg: "#FCEFEA", fg: "#993C1D" },
  { bg: "#EFEDFD", fg: "#534AB7" },
  { bg: "#FDF4E6", fg: "#B7791F" },
  { bg: "#E6F7F5", fg: "#0F8577" },
  { bg: "#EDEDFC", fg: "#4A46B8" },
  { bg: "#FDEEF2", fg: "#C22A5F" },
  { bg: "#FDF6E3", fg: "#A67C1B" },
  { bg: "#EEF1F4", fg: "#54677A" },
] as const;

// Substring match against the free-text specialty name, same approach as
// the backend's own _SPECIALITY_SYNONYMS (apps/patients/portal_views.py)
// — hospital admins type specialties in freehand, so this matches on
// meaningful fragments rather than requiring an exact name.
const KEYWORD_MAP: { match: string[]; icon: LucideIcon; swatch: number }[] = [
  { match: ["general", "physician", "family", " gp", "gp "], icon: Stethoscope, swatch: 0 },
  { match: ["pediatric", "paediatric", "child"], icon: Baby, swatch: 1 },
  { match: ["dermatolog", "skin"], icon: Sparkles, swatch: 2 },
  { match: ["cardiolog", "cardiac", "heart"], icon: HeartPulse, swatch: 3 },
  { match: ["ortho", "bone"], icon: Bone, swatch: 4 },
  { match: ["ent", "ear", "nose", "throat", "otolaryngolog"], icon: Ear, swatch: 5 },
  { match: ["gynaecolog", "gynecolog", "obstetric", "women"], icon: Venus, swatch: 6 },
  { match: ["dental", "dentist"], icon: Smile, swatch: 7 },
  { match: ["neurolog", "brain"], icon: Brain, swatch: 8 },
  { match: ["psychiatr", "mental"], icon: HeartHandshake, swatch: 9 },
  { match: ["pulmonolog", "respiratory", "lung"], icon: Wind, swatch: 0 },
  { match: ["gastroenterolog", "stomach"], icon: Utensils, swatch: 1 },
  { match: ["ophthalmolog", "eye"], icon: Eye, swatch: 2 },
  { match: ["urolog", "nephrolog", "kidney"], icon: Droplet, swatch: 3 },
  { match: ["oncolog", "cancer"], icon: Ribbon, swatch: 4 },
];

function hashIndex(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % mod;
}

/** A colored icon for any specialty name the backend hands back — known ones get a fitting icon, unknown ones still get a distinct color (hashed, not always gray) instead of falling back to one generic look. */
export function getSpecialtyStyle(name: string): { icon: LucideIcon; bg: string; fg: string } {
  const n = name.toLowerCase();
  for (const entry of KEYWORD_MAP) {
    if (entry.match.some((k) => n.includes(k))) {
      const s = SWATCHES[entry.swatch];
      return { icon: entry.icon, bg: s.bg, fg: s.fg };
    }
  }
  const s = SWATCHES[hashIndex(n, SWATCHES.length)];
  return { icon: Activity, bg: s.bg, fg: s.fg };
}
