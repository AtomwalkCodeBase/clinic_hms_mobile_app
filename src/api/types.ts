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
  // payment/billing-v1 — mirrors PortalMyBookingsView (apps/patients/
  // portal_views.py). null for a pay_at_desk booking (no online payment
  // was ever attempted); payment_amount is only populated once "paid".
  payment_status: "unpaid" | "pending_online" | "paid" | null;
  payment_amount: string | null;
}

export interface ConsentRequired {
  consent_required: true;
  hospital_name: string;
  share_categories: string[];
  message: string;
}

// Shape of TenantPaymentGatewayConfig's create_order() result (apps/billing/
// gateway/{razorpay,cashfree}_adapter.py) as handed back on PortalBookView's
// response — provider-specific fields are optional since only one set is
// ever populated depending on `provider`.
export interface GatewayOrder {
  provider: "razorpay" | "cashfree";
  order_id: string;
  amount: string;
  currency: string;
  invoice_id?: number;
  // razorpay
  amount_paise?: number;
  key_id?: string;
  // cashfree
  cf_order_id?: string;
  payment_session_id?: string;
  app_id?: string;
  environment?: "sandbox" | "production";
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
  // Present only when payment_preference is "pay_online" and the hospital
  // actually has a working gateway connected — see PortalBookView's
  // docstring on gateway_order/gateway_error being mutually informative,
  // not both-or-neither.
  gateway_order?: GatewayOrder | null;
  gateway_error?: string | null;
}

export interface MedicalRecord {
  hospital: string;
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
  investigations: string;
  advice: string;
  follow_up_in_days: number | null;
  signed: boolean;
  vitals: { bp: string | null; pulse: number | null; spo2: number | null; temperature: string | null; weight_kg: string | null } | null;
}

export interface PatientDocument {
  id: number;
  title: string;
  doc_type: "lab_report" | "prescription" | "scan" | "discharge_summary" | "other";
  file_name: string;
  mime_type: string;
  uploaded_by: "patient" | "staff";
  created_at: string;
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
