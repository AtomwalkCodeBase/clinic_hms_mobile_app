// Shapes mirror the real Django responses read directly from
// apps/patients/portal_views.py and apps/auth_app/views.py — not guessed.

export interface Tokens {
  access: string;
  refresh: string;
}

// Confirmed against _make_tokens() in apps/auth_app/views.py:46 — the
// response body only ever contains the two tokens, wrapped in the
// {success,message,data} envelope. user_id/email/full_name/awpid/role are
// embedded as JWT *claims* inside the access token itself, not returned as
// separate top-level fields — do not assume they exist on this response.
export type LoginResponse = Tokens;

export interface Hospital {
  tenant_id: number;
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
  tenant_id?: number;
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
  tenant_id: number;
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

export interface ConsentRequired {
  consent_required: true;
  hospital_name: string;
  share_categories: string[];
  message: string;
}

// PortalEmergencyTokenView's 428 body — distinct from ConsentRequired above
// (no hospital_name; carries ttl_minutes instead) since this is a patient-
// initiated share to an unknown scanner, not a per-hospital HIE consent.
export interface EmergencyConsentPrompt {
  consent_required: true;
  share_categories: string[];
  ttl_minutes: number;
  message: string;
}

export interface EmergencyTokenResult {
  token: string;
  view_url: string;
  /** data:image/png;base64,... — server-rendered, ready for <Image source={{uri}}>. */
  qr_image: string;
  expires_at: string;
  ttl_minutes: number;
}

/* ── "Share Records" — patient side of the laptop flow ── */
export interface RecordsSharePendingDownload {
  id: number;
  title: string;
}
export interface RecordsShareStatus {
  token: string;
  status: "pending" | "approved" | "denied" | "ended" | "expired";
  code?: string;
  requester_label: string;
  window_hours: number;
  seconds_left: number;
  patient_name?: string;
  pending_download?: RecordsSharePendingDownload | null;
}
export interface RecordsShareCreated {
  token: string;
  code: string;
  link: string;
  status: string;
  window_hours: number;
}
export interface RecordsShareConsentPrompt {
  consent_required: true;
  share_categories: string[];
  private_count: number;
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
  tenant_db: string;
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
  // PortalPrescriptionReceiptPDFView takes exactly (tenant_db, prescription_id).
  prescription_id: string | null;
  rx_number: string | null;
  investigations: string;
  advice: string;
  follow_up_in_days: number | null;
  signed: boolean;
  vitals: { bp: string | null; pulse: number | null; spo2: number | null; temperature: string | null; weight_kg: string | null } | null;
}

export interface PatientDocument {
  id: number;
  title: string;
  doc_type: "lab_report" | "prescription" | "scan" | "discharge_summary" | "consult_note" | "other";
  file_name: string;
  mime_type: string;
  uploaded_by: "patient" | "staff";
  created_at: string;
  // My Reports pipeline fields — PortalDocumentListCreateView.get()
  document_date?: string | null;
  public_document_id?: string;
  hospital_label?: string;
  doctor_label?: string;
  source_tenant_id?: number | null;
  review_state?: "filed" | "unsorted" | string;
  /** Which specific field(s) the classifier couldn't resolve — a subset of
   *  "kind" | "category" | "date" | "file" (file = unreadable, needs a
   *  retake). Empty/absent for a normal confident or QR-verified row. Drives
   *  the review flow: ask only for what's actually missing. */
  review_needs?: string[];
  verification_status?: "verified" | "unverified" | "needs_review" | string;
  /** the typeset prescription's handwritten sibling, if any */
  handwritten_doc_id?: number | null;
  /** Lab-report panel slugs (cbc, lipid, thyroid, …) — used by the
   *  shared-records privacy screen to group and filter. */
  report_categories?: string[];
}

/** One row on the Shared-records privacy screen — the vault annotated with
 *  its effective visibility to a scanning doctor. */
export interface RecordsPrivacyDoc {
  id: number;
  title: string;
  doc_type: PatientDocument["doc_type"];
  report_categories: string[];
  document_date?: string | null;
  created_at: string;
  hospital_label?: string | null;
  doctor_label?: string | null;
  /** hidden from a scanning doctor right now */
  private: boolean;
  /** hidden because of a category / kind / hide-all rule, not an individual lock */
  private_by_rule: boolean;
  /** surfaced for the currently-live visit only */
  revealed_for_visit: boolean;
}

/** One page of the privacy list — the list is paged on category boundaries
 *  server-side (whole panels per page), so `documents` is just this page. */
export interface RecordsPrivacyPagination {
  page: number;
  page_size: number;
  total_pages: number;
  total_count: number;
  has_next: boolean;
  has_previous: boolean;
}

/** Whole-vault figures the screen's readout / facets / Hide-all speak for,
 *  computed over every record regardless of the current page or filter. */
export interface RecordsPrivacySummary {
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

export interface LabReportItem {
  parameter_name: string;
  result_value: string;
  unit: string;
  reference_range: string;
  is_abnormal: boolean;
}

export interface LabOrder {
  id: number;
  tenant_db: string;
  hospital: string;
  test_name: string;
  price: string | null;
  turnaround_hours: number;
  status: "ordered" | "collected" | "processing" | "completed" | "cancelled";
  patient_choice: "pending" | "in_house" | "outside";
  payment_preference: string;
  payment_status: "unpaid" | "pending_online" | "paid";
  ordered_at: string;
  report: {
    id: number;
    status: "pending" | "delivered";
    result_summary: string;
    has_file: boolean;
    delivered_at: string | null;
    items?: LabReportItem[];
  } | null;
  attached_document: { id: number; title: string; created_at: string } | null;
  source_ref: string;
}

// PortalPrescriptionListView's shape — "every prescription any doctor has
// written for this patient", resolved via the full Appointment ->
// OPDEncounter -> Prescription chain (not narrowed to one encounter per
// appointment the way PortalMyRecordsView's display records are), with the
// same in-house/outside choice tracking LabOrder already has.
export interface PrescriptionOrder {
  id: string;
  tenant_db: string;
  hospital: string;
  rx_number: string | null;
  doctor_name: string | null;
  status: "active" | "dispensed" | "expired";
  patient_choice: "pending" | "in_house" | "outside";
  payment_preference: string;
  payment_status: string;
  created_at: string;
  items: { drug_name: string; dosage: string; frequency: string; quantity: number }[];
}

export interface Profile {
  awpid: string;
  full_name: string;
  email: string;
  mobile: string;
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
  active_allergies: { substance: string; reaction: string; severity: string }[];
  active_diagnoses: { description: string; onset_date: string }[];
  last_visit: string | null;
  last_hospital: string | null;
  linked_hospitals: { hospital_name: string; tenant_id: number; last_visit: string }[];
}

export interface VaccinationRoadmapItem {
  vaccine_name: string;
  scheduled_label?: string;
  administered_date: string | null;
  status: string;
  record_id?: number;
  has_certificate?: boolean;
  // Only set on unrecorded ("unknown") items — see build_roadmap() in
  // apps/registry/vaccine_schedule.py. `timing` is the source of truth for
  // due_now/past_window; `min_age_days` is planning metadata a client can
  // combine with date_of_birth to estimate a calendar due date.
  timing?: "upcoming" | "due_now" | "past_window" | null;
  min_age_days?: number | null;
}

export interface VaccinationSummary {
  date_of_birth: string | null;
  roadmap: VaccinationRoadmapItem[];
  completed_count: number;
  total_count: number;
  // The backend returns the full roadmap item due next, not a name string.
  next_recommended: VaccinationRoadmapItem | null;
  stats: Record<string, number>;
}

export interface TimelineEntry {
  date: string;
  type: "visit" | "vaccination" | "growth" | "lab" | "document";
  icon_hint: string;
  title: string;
  subtitle: string | null;
  detail: Record<string, any> | null;
}

export interface GrowthPoint {
  date: string;
  height_cm: number | null;
  weight_kg: number | null;
}

export interface FamilyMember {
  awpid: string;
  full_name: string;
  date_of_birth: string | null;
  gender: string;
  relationship: string;
}

// Confirmed against PortalNotificationsView's actual return
// (apps/patients/portal_views.py:2487) — "id" is a composite string
// ("<tenant_db>:<log_id>" for real reminders, "vaccine:<label>" for
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


// PortalHealthInsightSummaryView (POST /portal/health-insights/summary/) — the
// combined, point-form summary across every changed value at once (drawing
// on lab values AND any prescriptions started in the same window), distinct
// from the per-parameter narrative above.
export interface HealthInsightSummary {
  points: string[];
  flagged_count: number;
  /** Trending parameters that exist but didn't change enough to flag —
   * always a real count, never inferred client-side. */
  stable_count: number;
}

// PortalHealthInsightsView (GET /portal/health-insights/) — powers the
// Activity page: month-by-month document counts and the report-type
// breakdown, plus pattern_insights (deterministic, non-LLM sentences
// already written server-side, e.g. "You've had 3 CBC reports on file").
export interface HealthActivityMonth {
  month: string; // "YYYY-MM"
  count: number;
}
export interface HealthActivityPanel {
  slug: string;
  label: string;
  count: number;
}
export interface HealthActivity {
  range: string;
  total_documents: number;
  total_reports: number;
  total_prescriptions: number;
  most_common_panel: string | null;
  latest_report_date: string | null;
  report_distribution: HealthActivityPanel[];
  upload_activity: HealthActivityMonth[];
  pattern_insights: string[];
}
