export const PHONE_FULL = "Your phone is full. Free up some space and try again.";

/** True when an error from the phone's file system means there was no room left to write. */
export function isPhoneFull(err: unknown): boolean {
  const text = err instanceof Error ? err.message : String(err ?? "");
  return /ENOSPC|no space left|not enough space|disk full|storage (is )?full/i.test(text);
}

/** Why a picked file could not be copied onto the phone, in words the patient can act on. */
export function copyFailReason(err: unknown): string {
  if (isPhoneFull(err)) return PHONE_FULL;
  const text = err instanceof Error ? err.message : String(err ?? "");
  if (/ENAMETOOLONG|name too long/i.test(text)) return "The file name is too long. Rename the file and choose it again.";
  return "This file couldn't be opened. If it is in a cloud drive, make sure it is downloaded to your phone first.";
}
