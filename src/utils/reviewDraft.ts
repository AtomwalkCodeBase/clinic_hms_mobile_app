import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PatientDocument } from "@/api/types";
import type { ReviewDecision } from "@/api/portal";

/**
 * What the patient has done on the Bulk Upload review screen, kept on the phone until they submit. Nothing here
 * reaches the server: the server only hears about a document when `submitDecisions` is called with the final type.
 *
 * Only the patient's own actions are stored (`selectedType`, `stage`); everything else about a file (name, the
 * system's suggestion, the score) always comes fresh from the server list, so the two never disagree.
 */
export type ReviewStage = "review" | "ready";

export interface ReviewEntry {
  /** The type the patient picked with Change, or null to keep the system's suggestion. */
  selectedType: string | null;
  /** "review" = Needs Review window, "ready" = confirmed (by default, or by the patient), waiting to be submitted. */
  stage: ReviewStage;
}

/** Keyed by document id. A document with no entry is untouched: it sits where `stageOf` puts it by default. */
export type ReviewDraft = Record<string, ReviewEntry>;

const FINISHED = new Set(["completed", "review_required"]);
const key = (awpid: string) => `aw_review_draft:${awpid}`;

export async function loadDraft(awpid: string): Promise<ReviewDraft> {
  try {
    const raw = await AsyncStorage.getItem(key(awpid));
    return raw ? (JSON.parse(raw) as ReviewDraft) : {};
  } catch {
    return {};
  }
}

export async function saveDraft(awpid: string, draft: ReviewDraft): Promise<void> {
  try {
    await AsyncStorage.setItem(key(awpid), JSON.stringify(draft));
  } catch {
    /* the draft is a convenience; losing it only means the patient redoes a few taps */
  }
}

/**
 * Where a file is. Until the patient moves it, a file the system classified starts as confirmed ("ready") and only a file
 * it could not classify starts in Needs Review. What the patient does (Confirm, Move back) is kept in the draft and wins.
 */
export const stageOf = (doc: PatientDocument, entry?: ReviewEntry): ReviewStage =>
  entry?.stage ?? (doc.suggested_type ? "ready" : "review");
export const isEdited = (entry?: ReviewEntry): boolean => !!entry?.selectedType;

/** The type this file would be submitted under: the patient's pick, else the system's suggestion, else none. */
export function currentType(doc: PatientDocument, entry?: ReviewEntry): string | null {
  return entry?.selectedType ?? doc.suggested_type ?? null;
}

/** A file is only reviewable once it has been read (the others are still working, or failed). */
export const isReviewable = (doc: PatientDocument): boolean => FINISHED.has(doc.processing_status);

/** Picking the system's own suggestion again is not an edit. */
export function withSelectedType(draft: ReviewDraft, doc: PatientDocument, type: string): ReviewDraft {
  const stage = stageOf(doc, draft[doc.id]);
  const selectedType = type === doc.suggested_type ? null : type;
  return { ...draft, [doc.id]: { selectedType, stage } };
}

export function withStage(draft: ReviewDraft, id: number, stage: ReviewStage): ReviewDraft {
  return { ...draft, [id]: { selectedType: draft[id]?.selectedType ?? null, stage } };
}

/** Forget what the patient did for files that are no longer waiting (submitted, or gone). */
export function prune(draft: ReviewDraft, pendingIds: number[]): ReviewDraft {
  const keep = new Set(pendingIds.map(String));
  const out: ReviewDraft = {};
  for (const id of Object.keys(draft)) if (keep.has(id)) out[id] = draft[id];
  return out;
}

/**
 * The list to send to the server. `ready` = only the files confirmed on the phone; `all` = every reviewable file (the
 * untouched ones go in with the system's suggestion). Files with no type at all can't be sent: they come back in
 * `missing` so the screen can ask the patient to pick one first.
 */
export function buildDecisions(
  docs: PatientDocument[],
  draft: ReviewDraft,
  scope: "ready" | "all",
): { decisions: ReviewDecision[]; missing: PatientDocument[] } {
  const decisions: ReviewDecision[] = [];
  const missing: PatientDocument[] = [];
  for (const doc of docs) {
    if (!isReviewable(doc)) continue;
    const entry = draft[doc.id];
    if (scope === "ready" && stageOf(doc, entry) !== "ready") continue;
    const type = currentType(doc, entry);
    if (!type) missing.push(doc);
    else decisions.push({ document_id: doc.id, document_type: type });
  }
  return { decisions, missing };
}
