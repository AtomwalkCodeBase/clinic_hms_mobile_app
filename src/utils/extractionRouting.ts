/**
 * Client-side sync-vs-bulk routing for the upload-and-extract flow — applies
 * the same caps the server enforces (portal_extraction_views.py) BEFORE
 * calling either endpoint, so an obviously oversized/too-many-files
 * selection gets an instant, specific message instead of a doomed
 * round-trip. The server re-validates everything regardless (never trust
 * the client alone) — this is purely for fast, accurate UX.
 *
 * Page-count (PDF, max 20) isn't cheaply checkable here — no PDF-parsing
 * library in the app — so it's left server-enforced only; a rejected file
 * on that ground surfaces as a normal per-file error same as any other.
 */

const SYNC_MAX_FILES = 2;
const BULK_MIN_FILES = 3;
const BULK_MAX_FILES = 50;
const TYPE_MAX_BYTES: Record<string, number> = {
  "application/pdf": 5 * 1024 * 1024,
  "image/jpeg": 12 * 1024 * 1024,
  "image/png": 12 * 1024 * 1024,
};

export type RoutableFile = { size: number; mimeType: string };

export type SkippedFile = { name: string; reason: string };

/**
 * Splits a selection into files that can be uploaded and files that can't (wrong type, or over the
 * size cap for their type). One bad file must never sink the rest — the caller uploads `valid` and
 * tells the patient about `skipped`.
 */
export function partitionExtractable<T extends RoutableFile & { name: string }>(files: T[]): { valid: T[]; skipped: SkippedFile[] } {
  const valid: T[] = [];
  const skipped: SkippedFile[] = [];
  for (const f of files) {
    const cap = TYPE_MAX_BYTES[f.mimeType];
    if (cap === undefined) {
      skipped.push({ name: f.name, reason: "Only PDF, JPG and PNG files are supported." });
    } else if (f.size > cap) {
      const capMb = cap / (1024 * 1024);
      skipped.push({ name: f.name, reason: `Over the ${capMb} MB limit for ${f.mimeType === "application/pdf" ? "PDFs" : "photos"}.` });
    } else {
      valid.push(f);
    }
  }
  return { valid, skipped };
}

export type RouteResult =
  | { route: "sync" }
  | { route: "bulk" }
  | { route: "reject"; reason: string };

export function routeExtraction(files: RoutableFile[]): RouteResult {
  if (files.length === 0) {
    return { route: "reject", reason: "No files selected." };
  }

  const badType = files.find((f) => !(f.mimeType in TYPE_MAX_BYTES));
  if (badType) {
    return { route: "reject", reason: "Only PDF, JPG and PNG files are supported." };
  }

  const oversized = files.find((f) => f.size > TYPE_MAX_BYTES[f.mimeType]);
  if (oversized) {
    const capMb = TYPE_MAX_BYTES[oversized.mimeType] / (1024 * 1024);
    return { route: "reject", reason: `One of the files is over the ${capMb}MB limit.` };
  }

  if (files.length <= SYNC_MAX_FILES) {
    return { route: "sync" };
  }
  if (files.length > BULK_MAX_FILES) {
    return { route: "reject", reason: `Upload at most ${BULK_MAX_FILES} files at a time.` };
  }
  if (files.length >= BULK_MIN_FILES) {
    return { route: "bulk" };
  }
  return { route: "sync" };
}
