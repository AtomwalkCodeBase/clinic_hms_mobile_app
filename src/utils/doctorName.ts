/**
 * The one rule for a doctor's name the patient types: letters and spaces, plus the apostrophe, hyphen and dot that real
 * names carry (D'Souza, Anand-Kumar, A. K. Rao), at most 60 characters. The "Dr." is never typed or stored: the app
 * writes it. The server applies the same rule (apps/documents/doctor_names.py), so this is only the early warning.
 */
export const DOCTOR_NAME_MAX = 60;

const TYPED = /^[A-Za-z][A-Za-z '’.\-]*$/;

/** The text with any typed "Dr." removed and spaces tidied. */
export function tidyDoctorName(value: string): string {
  let name = value.replace(/\s+/g, " ").trim();
  if (/^dr\.?\s/i.test(name)) name = name.replace(/^dr\.?\s*/i, "").trim();
  return name;
}

/** "" is allowed (it removes the doctor). Anything else must be a believable name. */
export function isValidDoctorName(value: string): boolean {
  const name = tidyDoctorName(value);
  return name === "" || (name.length <= DOCTOR_NAME_MAX && TYPED.test(name));
}

/** Why a name is refused, for the line under the box; "" when it is fine. */
export function doctorNameProblem(value: string): string {
  return isValidDoctorName(value) ? "" : "Only letters and spaces are allowed.";
}
