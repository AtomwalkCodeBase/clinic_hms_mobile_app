// What the server accepts (apps/documents/serializers.py): the app checks the same numbers first so a file that will be
// refused gets an instant, specific message instead of a failed upload.
export const MB = 1024 * 1024;
export const MAX_FILE_BYTES = 5 * MB;
export const MAX_TOTAL_BYTES = 250 * MB;
export const MAX_FILES = 50;

/** A size the way a patient reads it: "7.2 MB", "300 KB". */
export function sizeText(bytes: number): string {
  if (bytes >= MB) return `${Number((bytes / MB).toFixed(1))} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}

/** The limits in one line, for the places that tell the patient what can be uploaded. */
export const LIMITS_LINE = `PDF, JPG or PNG · up to ${sizeText(MAX_FILE_BYTES)} per file · up to ${MAX_FILES} files (${sizeText(MAX_TOTAL_BYTES)}) at a time`;

/** The reason a file is over the per-file limit; the server says the same thing in the same words. */
export function tooBigReason(bytes: number): string {
  return `The file is ${sizeText(bytes)}; the limit is ${sizeText(MAX_FILE_BYTES)} per file.`;
}
