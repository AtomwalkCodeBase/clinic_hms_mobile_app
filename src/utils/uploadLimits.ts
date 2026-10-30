// What the server accepts (apps/documents/serializers.py): the app checks the same numbers first so a file that will be
// refused gets an instant, specific message instead of a failed upload.
export const MB = 1024 * 1024;
export const MAX_FILE_BYTES = 5 * MB;
export const MAX_TOTAL_BYTES = 60 * MB;
export const MAX_FILES = 50;
export const MAX_PHOTOS = 20;

/** The file kinds the server accepts. The phone's file picker is limited to exactly these, so nothing else can be chosen. */
export const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"];

/** A photo (JPG or PNG) as opposed to a PDF. */
export const isPhoto = (mimeType: string): boolean => mimeType === "image/jpeg" || mimeType === "image/png";

/** Why a file cannot be uploaded (wrong kind, empty, over the size limit), or null when it can. The server checks again. */
export function fileProblem(f: { mimeType: string; size: number }): string | null {
  if (!ALLOWED_MIME.includes(f.mimeType)) return "Only PDF, JPG and PNG files are supported.";
  if (f.size <= 0) return "The file is empty (0 KB).";
  if (f.size > MAX_FILE_BYTES) return tooBigReason(f.size);
  return null;
}

/** Why a set of otherwise fine files cannot go up together (too many, too many photos, too big in total), or null when
 * they can. Pass only the files that passed `fileProblem`. */
export function batchProblem(files: { mimeType: string; size: number }[]): string | null {
  if (files.length > MAX_FILES) return `You chose ${files.length} files; the limit is ${MAX_FILES} at a time.`;
  const photos = files.filter((f) => isPhoto(f.mimeType)).length;
  if (photos > MAX_PHOTOS) return `You chose ${photos} photos; the limit is ${MAX_PHOTOS} photos at a time.`;
  const total = files.reduce((n, f) => n + f.size, 0);
  if (total > MAX_TOTAL_BYTES) return `The files add up to ${sizeText(total)}; the limit is ${sizeText(MAX_TOTAL_BYTES)} in total.`;
  return null;
}

/** A size the way a patient reads it: "7.2 MB", "300 KB". */
export function sizeText(bytes: number): string {
  if (bytes >= MB) return `${Number((bytes / MB).toFixed(1))} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}

/** The limits in one line, for the places that tell the patient what can be uploaded. */
export const LIMITS_LINE = `PDF, JPG or PNG · up to ${sizeText(MAX_FILE_BYTES)} per file · up to ${MAX_FILES} files and ${MAX_PHOTOS} photos (${sizeText(MAX_TOTAL_BYTES)}) at a time`;

/** The reason a file is over the per-file limit; the server says the same thing in the same words. */
export function tooBigReason(bytes: number): string {
  return `The file is ${sizeText(bytes)}; the limit is ${sizeText(MAX_FILE_BYTES)} per file.`;
}
