import type { PatientDocument } from "@/api/types";

/**
 * The words on a document card, in one place so My Documents, Bulk Upload and the review sheet say the same thing.
 */

/** Whether the document came from a hospital (the patient cannot change or delete it). */
export const isIssuedByHospital = (doc: PatientDocument): boolean => doc.uploaded_by === "staff" || !!doc.source_hospital_id;

/**
 * The one date on every card: the date printed on the document when we know it, otherwise the day it was uploaded.
 * "9 Oct", with the year when it isn't this year ("9 Oct 2025").
 */
export function cardDate(doc: { document_date?: string | null; created_at?: string | null }): string {
  const d = new Date(doc.document_date || doc.created_at || "");
  if (isNaN(d.getTime())) return "";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-IN", sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
}
