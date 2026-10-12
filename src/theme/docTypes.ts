import {
  ClipboardPlus, FlaskConical, ScanLine, BedDouble, Stethoscope, Receipt, Syringe, Send, BadgeCheck, FileText, FileQuestion,
} from "lucide-react-native";
import type { LucideIcon } from "@/theme/icons";

/**
 * How each document type looks, in one place: My Documents, Bulk Upload, the type picker and the privacy screen all read
 * this, so a type has the same icon and colour everywhere. The type NAMES still come from the server (useDocumentTypes);
 * this table is only the look. `ink` is the strong colour (icon, tag text), `tint` the pale fill behind it.
 */
export interface DocTypeStyle {
  Icon: LucideIcon;
  ink: string;
  tint: string;
  /** short label for a list-row tag */
  tag: string;
  /** for a sentence: "1 prescription" / "3 prescriptions" */
  singular: string;
  plural: string;
}

const TYPES: Record<string, DocTypeStyle> = {
  prescription:        { Icon: ClipboardPlus, ink: "#2563EB", tint: "#DBE7FD", tag: "RX",     singular: "prescription",        plural: "prescriptions" },
  lab_report:          { Icon: FlaskConical,  ink: "#DC2626", tint: "#FBE0E0", tag: "LAB",    singular: "lab report",          plural: "lab reports" },
  imaging_report:      { Icon: ScanLine,      ink: "#EA7A0E", tint: "#FDEBD3", tag: "IMG",    singular: "imaging report",      plural: "imaging reports" },
  discharge_summary:   { Icon: BedDouble,     ink: "#0D9488", tint: "#D5F2EE", tag: "DISCH",  singular: "discharge summary",   plural: "discharge summaries" },
  consultation_note:   { Icon: Stethoscope,   ink: "#7C3AED", tint: "#EBE0FC", tag: "NOTE",   singular: "consultation note",   plural: "consultation notes" },
  medical_bill:        { Icon: Receipt,       ink: "#16A34A", tint: "#D9F3E1", tag: "BILL",   singular: "bill",                plural: "bills" },
  vaccination_record:  { Icon: Syringe,       ink: "#0891B2", tint: "#D3EEF5", tag: "VAX",    singular: "vaccination record",  plural: "vaccination records" },
  referral_letter:     { Icon: Send,          ink: "#DB2777", tint: "#FADCEA", tag: "REF",    singular: "referral letter",     plural: "referral letters" },
  medical_certificate: { Icon: BadgeCheck,    ink: "#B45309", tint: "#F8E5CE", tag: "CERT",   singular: "certificate",         plural: "certificates" },
  other:               { Icon: FileText,      ink: "#475569", tint: "#E3E8EE", tag: "DOC",    singular: "other document",      plural: "other documents" },
  not_classified:      { Icon: FileQuestion,  ink: "#6B7280", tint: "#E9EAEE", tag: "NEW",    singular: "unclassified file",   plural: "unclassified files" },
};

/** The look for a type code: no code reads as "not classified", a code this table doesn't know as "other". */
export const docTypeStyle = (code?: string | null): DocTypeStyle => (code ? TYPES[code] ?? TYPES.other : TYPES.not_classified);
