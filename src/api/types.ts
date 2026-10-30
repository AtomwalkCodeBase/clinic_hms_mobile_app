// Shapes mirror the real Django responses read directly from
// apps/patients/views.py and core/auth/views.py — not guessed.

interface Tokens {
  access: string;
  refresh: string;
}

// Confirmed against _make_tokens() in core/auth/views.py:46 — the
// response body only ever contains the two tokens, wrapped in the
// {success,message,data} envelope. user_id/email/full_name/awpid/role are
// embedded as JWT *claims* inside the access token itself, not returned as
// separate top-level fields — do not assume they exist on this response.
export type LoginResponse = Tokens;

export interface Hospital {
  hospital_id: number;
  name: string;
  city: string;
  state: string;
  accreditations: string[];
  about: string;
}

export interface DoctorCard {
  id: number;
  name: string;
  photo: string | null;
  specialisation: string;
  qualification: string;
  experience_years: number | null;
  consultation_fee: string | null;
  bio: string;
  languages: string;
  known_for: string;
  hospital?: string;
  hospital_city?: string;
  hospital_id?: number;
}

export interface DoctorDetail extends DoctorCard {
  hospital: any;
  consultations_count: number;
}

export interface SlotEntry {
  time: string;
  available: boolean;
}

// Matches core/pagination.py's _build_meta — every paginated portal list
// endpoint returns this shape alongside "results".
export interface Pagination {
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface Booking {
  id: number;
  hospital_id: number;
  hospital: string;
  doctor: string;
  doctor_id: number | null;
  date: string;
  time: string | null;
  chief_complaint: string;
  status: string;
  token_number: number | null;
  people_ahead: number | null;
  now_serving_token: number | null;
  patient_name: string | null;
  patient_awpid: string | null;
}

/* ── "Share Records" — patient side of the laptop flow ── */
export interface RecordsShareCreated {
  token: string;
  code: string;
  link: string;
  status: string;
  window_hours: number;
}
export type RecordsShareScope = "all" | "default";
export interface RecordsShareDecision {
  token: string;
  status: string;
  requester_label: string;
  expires_at: string | null;
  seconds_left: number;
  share_all: boolean;
}
interface RecordsSharePendingDownload {
  id: number;
  title: string;
}
export interface RecordsShareGrant {
  token: string;
  requester_label: string;
  approved_at: string | null;
  expires_at: string | null;
  seconds_left: number;
  last_seen_at: string | null;
  pending_download: RecordsSharePendingDownload | null;
  share_all: boolean;
}

export interface BookingResult {
  booking_id: number;
  hospital: string;
  doctor: string;
  date: string;
  time: string | null;
  token_number: number;
  status: string;
  payment_preference: string;
  patient_name: string;
}

export interface MedicalRecord {
  hospital: string;
  hospital_db: string;
  date: string;
  time: string | null;
  doctor: string;
  status: string;
  chief_complaint: string;
  diagnoses: { description: string; onset_date?: string }[];
  prescription: {
    drug_name: string;
    dosage: string;
    frequency: string;
    route: string;
    duration_days: number;
    instructions: string;
  }[];
  // Set only once a prescription actually exists for this record (PortalMyRecordsView) —
  // PortalPrescriptionReceiptPDFView takes exactly (hospital_db, prescription_id).
  prescription_id: string | null;
  rx_number: string | null;
  investigations: string;
  advice: string;
  follow_up_in_days: number | null;
  signed: boolean;
  vitals: { bp: string | null; pulse: number | null; spo2: number | null; temperature: string | null; weight_kg: string | null } | null;
}

/** The categories a document can be filed under (GET /records/types/ is the source of truth). */
export type DocumentTypeCode =
  | "prescription" | "lab_report" | "imaging_report" | "discharge_summary" | "consultation_note"
  | "medical_bill" | "vaccination_record" | "referral_letter" | "medical_certificate" | "other";

/** queued -> extracting -> classifying -> completed | review_required | failed (apps/documents/models.py). */
export type ProcessingStatus = "queued" | "extracting" | "classifying" | "completed" | "review_required" | "failed";

export interface PatientDocument {
  id: number;
  title: string;
  /** "" or "not_classified" until the rules (or the patient) have settled it */
  doc_type: DocumentTypeCode | "not_classified" | "";
  file_name: string;
  mime_type: string;
  size?: number;
  uploaded_by: "patient" | "staff";
  created_at: string;
  document_date?: string | null;
  public_document_id?: string;
  source_hospital_id?: number | string | null;
  processing_status: ProcessingStatus;
  /** The rule engine's points (not a percentage); only meaningful once the document has been read. */
  score?: number | null;
  /** How doc_type was decided: "rule" (the keyword rules) or "staff" (a person, or the issuing hospital). */
  method?: "rule" | "staff" | "";
  /** The type the rules filed it under, or null if they could not tell (or a person has decided). */
  suggested_type?: DocumentTypeCode | null;
  /** True once the patient (or the issuing hospital) confirmed the type: the document is locked. */
  confirmed?: boolean;
  /** Failure reason, only set when processing_status is "failed". */
  error?: string;
  batch_id?: number | null;
  /** the typeset prescription's handwritten sibling, if any */
  handwritten_doc_id?: number | null;
  /** The doctor named on the document, without "Dr." (read from its text, or typed by the patient). "" when unknown. */
  doctor_name?: string;
  /** True for the patient's own upload that is no longer being read: the one rule for showing Delete. */
  deletable?: boolean;
}

/** One row on the Shared-records privacy screen — the vault annotated with
 *  its effective visibility to a scanning doctor. */
export interface RecordsPrivacyDoc {
  id: number;
  title: string;
  doc_type: PatientDocument["doc_type"];
  /** only the older backend sent these; the current one groups by doc_type alone */
  report_categories?: string[];
  document_date?: string | null;
  created_at: string;
  /** hidden from a scanning doctor right now */
  private: boolean;
  /** hidden because of a category / kind / hide-all rule, not an individual lock */
  private_by_rule: boolean;
  /** surfaced for the currently-live visit only */
  revealed_for_visit: boolean;
}

/** One page of the privacy list — the list is paged on category boundaries
 *  server-side (whole panels per page), so `documents` is just this page. */
interface RecordsPrivacyPagination {
  page: number;
  page_size: number;
  total_pages: number;
  total_count: number;
  has_next: boolean;
  has_previous: boolean;
}

/** Whole-vault figures the screen's readout / facets / Hide-all speak for,
 *  computed over every record regardless of the current page or filter. */
interface RecordsPrivacySummary {
  vault_total: number;
  filtered_total: number;
  shown: number;
  visit: number;
  private: number;
  /** individually locked & unlockable — the "Show all" target */
  showable_ids: number[];
  /** every vault id — the "Hide all" target */
  hideable_ids: number[];
  /** every id matching the current filter — for select-all on web */
  filtered_ids: number[];
  category_counts: Record<string, number>;
  kind_counts: Record<string, number>;
  category_labels: Record<string, string>;
  kind_labels: Record<string, string>;
  months: string[];
  truncated: boolean;
}

export interface RecordsPrivacyPayload {
  hide_all: boolean;
  hidden_categories: string[];
  hidden_kinds: string[];
  hidden_sections: string[];
  sections: string[];
  section_labels: Record<string, string>;
  documents: RecordsPrivacyDoc[];
  pagination: RecordsPrivacyPagination;
  summary: RecordsPrivacySummary;
  /** present only while a Share Records grant is live — the frontend then
   *  asks "just this visit or always?" instead of a plain confirm. */
  active_session:
    | { token: string; requester_label: string; seconds_left: number; shown_private_ids: number[] }
    | null;
}

export interface Specialty {
  name: string;
  doctor_count: number;
}

export interface Profile {
  awpid: string;
  full_name: string;
  email: string;
  mobile: string;
  /** the server keeps the number to itself: true when the account has one, even if `mobile` comes back empty */
  mobile_on_file?: boolean;
  gender: string;
  date_of_birth: string | null;
  created_at: string;
  last_login: string | null;
  blood_group: string;
  photo: string | null;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relation: string;
}

export interface HealthSummary {
  patient_name: string;
  blood_group: string;
  active_diagnoses: { description: string; onset_date: string }[];
  last_visit: string | null;
  last_hospital: string | null;
  linked_hospitals: { hospital_name: string; hospital_id: number; last_visit: string }[];
}

// The pediatric health endpoints (apps/documents/views_timeline.py). They return raw objects, not the {success,data} envelope.
type TimelineSeverity = "NORMAL" | "MILD" | "ABNORMAL" | "CRITICAL";

interface TimelineEvent {
  id?: number;
  date: string;
  severity: TimelineSeverity;
  document_id: number | null;
  text: string;
  verified: boolean;
  age_label: string;
}

export interface TimelineEpisode {
  key: string;
  start: string;
  end: string | null;
  last_seen: string;
  peak_severity: TimelineSeverity;
  peak_severity_label: string;
  onset_age: string;
  event_count: number;
  document_ids: number[];
  is_provisional: boolean;
  events: TimelineEvent[];
}

/** Why a condition is marked "happens often". The server also sends a clinician hint; the app never shows it. */
interface TimelineRecurrence {
  group: string;
  label: string;
  is_recurrent: boolean;
  triggered_on: string | null;
  rule: { min_count: number; window_months: number } | null;
  episodes_total: number;
  episodes_last_12m: number;
  context: string | null;
  episode_keys: string[];
}

interface GrowthPointTimeline { date: string; age_months: number; value: number; z: number | null; percentile: number | null; flag: string | null; document_id: number | null }
interface GrowthAlert { from: string; to: string; z_from: number; z_to: number; drop: number }

export interface HospitalItem {
  kind: "ADMISSION" | "LAB";
  start: string;
  end: string | null;
  ward?: string;
  reason?: string;
  analyte?: string;
  value?: number;
  direction?: string;
  is_critical: boolean;
  label: string;
  age_label: string;
  document_id: number | null;
}

export type TimelineLane =
  | { id: string; type: "birth"; label: string; items: { date: string; gestation_weeks: number | null; birth_weight_kg: number | null; nicu_admission: boolean; nicu_days: number | null; preterm: boolean; document_id: number | null }[] }
  | { id: string; type: "growth"; label: string; series: Record<string, GrowthPointTimeline[]>; alerts: GrowthAlert[] }
  | { id: string; type: "immunization"; label: string; items: ImmunizationRow[] }
  | { id: string; type: "chronic"; label: string; episode: TimelineEpisode }
  | { id: string; type: "acute"; label: string; is_recurrent: boolean; recurrence: TimelineRecurrence | null; episodes: TimelineEpisode[] }
  | { id: string; type: "hospital"; label: string; items: HospitalItem[] };

export interface HealthTimeline {
  patient: { dob: string; sex: string; age_label: string; uses_corrected_age: boolean };
  period: { from: string; to: string };
  summary: {
    chronic_conditions: number;
    acute_episodes: number;
    recurrent_conditions: number;
    hospital_stays: number;
    growth_flags: number;
    vaccines_overdue: number;
  };
  lanes: TimelineLane[];
}

export type GrowthIndicator = "weight_kg" | "height_cm" | "head_circ_cm";

interface GrowthReading {
  date: string;
  age_months: number;
  value: number;
  percentile: number | null;
  flag: string | null;
}

export interface GrowthSeries {
  uses_corrected_age: boolean;
  /** centile curves by z-score ("-3", "-2", "0", "2", "3"): [age in months, value] pairs */
  reference: Record<string, [number, number][]>;
  reference_note: string;
  points: GrowthReading[];
}

type ImmunizationStatus = "GIVEN" | "OVERDUE" | "DUE" | "UPCOMING" | "SCHEDULED";

export interface ImmunizationRow {
  code: string;
  vaccine: string;
  dose: number;
  due_on: string;
  due_age: string;
  status: ImmunizationStatus;
  status_label: string;
  given_on: string | null;
  date: string;
  late: boolean;
  document_id: number | null;
}

export interface Immunization {
  summary: { given: number; overdue: number; due: number; upcoming: number; coverage_pct: number | null };
  rows: ImmunizationRow[];
  next_due: ImmunizationRow | null;
  /** card entries the schedule could not match (e.g. a vaccine that is not on it); the clinic checks them */
  unresolved?: { vaccine_text: string; immunization_record_id: number | null }[];
  source: string;
}

export interface FamilyMember {
  awpid: string;
  full_name: string;
  date_of_birth: string | null;
  gender: string;
  relationship: string;
}

// Confirmed against PortalNotificationsView's actual return
// (apps/patients/views.py:2487) — "id" is a composite string
// ("<hospital_db>:<log_id>" for real reminders, "vaccine:<label>" for
// vaccination-due ones, which have no backing row and can't be marked read).
export interface NotificationItem {
  id: string;
  type: "appointment_reminder" | "followup_reminder" | "vaccination_due";
  hospital: string | null;
  body: string;
  date: string;
  created_at: string | null;
  read: boolean;
}

export interface RescheduleResult {
  status: string;
  date: string;
  time: string | null;
  token_number: number;
  room_name: string | null;
  floor: string | null;
}

export type Envelope<T> = { success: boolean; message: string; data: T };
