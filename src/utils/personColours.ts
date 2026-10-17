import { familyAccentFor } from "@/theme/familyColors";
import { BRAND_TEXT, BRAND_TINT } from "@/theme/themes";
import type { FamilyMember } from "@/api/types";

const GREEN = { bg: BRAND_TINT, text: BRAND_TEXT };

/** The colours of a person's avatar: their family accent by age and gender, the patient themself (and adults) green. */
export function personColours(member?: Pick<FamilyMember, "gender" | "date_of_birth"> | null) {
  const accent = member ? familyAccentFor({ gender: member.gender, date_of_birth: member.date_of_birth }) : null;
  return accent ? { bg: accent.bg, text: accent.text } : GREEN;
}
