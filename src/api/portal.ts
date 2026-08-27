import { api } from "./client";
import type {
  Booking,
  BookingResult,
  ConsentRequired,
  DoctorCard,
  DoctorDetail,
  EmergencyConsentPrompt,
  EmergencyTokenResult,
  Envelope,
  FamilyMember,
  GrowthPoint,
  HealthSummary,
  Hospital,
  LabOrder,
  MedicalRecord,
  NotificationItem,
  Pagination,
  PatientDocument,
  PrescriptionOrder,
  Profile,
  RescheduleResult,
  SlotEntry,
  Specialty,
  TimelineEntry,
  VaccinationSummary,
} from "./types";

// Note: newer portal views (hospitals/search/doctors/slots/book/my-bookings)
// return raw objects, not the {success,data} envelope older auth/register
// views use — this file calls each endpoint with the shape actually read
// from apps/patients/portal_views.py.

export async function getHospitals() {
  const res = await api.get<{ results: Hospital[] }>("/portal/hospitals/");
  return res.data.results;
}

export async function getStats() {
  const res = await api.get<{ hospitals: number; doctors: number }>("/portal/stats/");
  return res.data;
}

export async function search(params: { q?: string; specialty?: string; city?: string; sort?: string }) {
  const res = await api.get<{ hospitals: Hospital[]; doctors: DoctorCard[] }>("/portal/search/", { params });
  return res.data;
}

export async function getSpecialties() {
  const res = await api.get<{ results: Specialty[] }>("/portal/specialties/");
  return res.data.results;
}

export async function getDoctors(tenantId: number) {
  const res = await api.get<{ results: DoctorCard[] }>(`/portal/hospitals/${tenantId}/doctors/`);
  return res.data.results;
}

export async function getDoctorDetail(tenantId: number, doctorId: number) {
  const res = await api.get<DoctorDetail>(`/portal/hospitals/${tenantId}/doctors/${doctorId}/`);
  return res.data;
}

export async function getNextToken(tenantId: number, doctorId: number, date?: string) {
  const res = await api.get<{ date: string; next_token: number }>(
    `/portal/hospitals/${tenantId}/doctors/${doctorId}/next-token/`,
    { params: date ? { date } : {} }
  );
  return res.data;
}

export async function getSlots(tenantId: number, doctorId: number, date?: string) {
  const res = await api.get<{ results: SlotEntry[] }>(`/portal/hospitals/${tenantId}/doctors/${doctorId}/slots/`, {
    params: date ? { date } : {},
  });
  return res.data.results;
}

export interface BookPayload {
  tenant_id: number;
  doctor_id: number;
  scheduled_date?: string;
  scheduled_time?: string;
  chief_complaint?: string;
  payment_preference?: string;
  patient_awpid?: string;
  data_sharing_consent?: boolean;
}

/**
 * POST /api/v1/portal/book/
 * First booking at a new hospital returns HTTP 428 with
 * {consent_required, hospital_name, share_categories, message} instead of
 * creating the appointment — the caller must re-submit with
 * data_sharing_consent: true after showing that to the patient.
 */
export async function book(payload: BookPayload): Promise<BookingResult | ConsentRequired> {
  // 428 (first-booking consent gate) is an expected outcome, not a failure —
  // let it resolve so the caller can show the consent prompt. Any 2xx is a
  // real booking; don't pin to 201 only (a backend that answers 200 would
  // otherwise throw here and the screen would look frozen).
  const res = await api.post("/portal/book/", payload, {
    validateStatus: (s) => (s >= 200 && s < 300) || s === 428,
  });
  return res.data;
}

// page_size 20 matches the backend's own default (core/pagination.py) —
// passed explicitly so this doesn't silently drift if that default ever
// changes. Ordered newest-first server-side, so upcoming appointments
// (future dates sort above past ones) land on page 1 in practice; "Load
// more" is what actually reaches deep history once someone has more than
// a page of past visits.
export async function getMyBookings(page = 1, pageSize = 20) {
  const res = await api.get<{ results: Booking[]; pagination: Pagination }>("/portal/my-bookings/", {
    params: { page, page_size: pageSize },
  });
  return res.data;
}

/** POST /portal/my-bookings/<id>/cancel/ — patient self-service cancellation. */
export async function cancelBooking(id: number) {
  const res = await api.post<{ status: string }>(`/portal/my-bookings/${id}/cancel/`);
  return res.data;
}

/** POST /portal/my-bookings/<id>/reschedule/ {scheduled_date, scheduled_time?} */
export async function rescheduleBooking(id: number, payload: { scheduled_date: string; scheduled_time?: string }) {
  const res = await api.post<RescheduleResult>(`/portal/my-bookings/${id}/reschedule/`, payload);
  return res.data;
}

/**
 * GET /portal/prescriptions/ — "every prescription any doctor has written",
 * with in-house/outside choice + rx_number/payment state. Distinct from
 * getMyRecords()'s prescription arrays below: this is resolved via the full
 * Appointment -> OPDEncounter -> Prescription chain (PortalPrescriptionListView),
 * not narrowed to "the first encounter/prescription per appointment" the
 * way the display records PortalMyRecordsView builds are — mirrors
 * getLabOrders/chooseLabOrder's shape (same "buy in-house or elsewhere"
 * pattern PortalLabOrderListView already has on the lab side).
 */
export async function getPrescriptions(patientAwpid?: string) {
  const res = await api.get<{ results: PrescriptionOrder[]; pagination: any }>("/portal/prescriptions/", {
    params: patientAwpid ? { patient_awpid: patientAwpid } : {},
  });
  return res.data.results;
}

export async function choosePrescription(payload: {
  tenant_db: string;
  prescription_id: string;
  patient_choice: "in_house" | "outside";
  payment_preference?: "pay_online" | "pay_at_pharmacy";
}) {
  const res = await api.post<Envelope<null>>("/portal/prescriptions/choice/", payload);
  return res.data;
}

/**
 * GET /portal/prescriptions/<tenant_db>/<prescription_id>/receipt/ — the
 * prescription PDF as a base64-data-URI in the standard envelope; only ever
 * called for a record whose prescription_id is set (see MedicalRecord).
 */
export async function getPrescriptionReceipt(tenantDb: string, prescriptionId: string) {
  const res = await api.get<Envelope<{ file_data: string; file_name: string; mime_type: string }>>(
    `/portal/prescriptions/${tenantDb}/${prescriptionId}/receipt/`
  );
  return res.data.data;
}

export async function getMyRecords(patientAwpid?: string) {
  const res = await api.get<{ results: MedicalRecord[]; pagination: any }>("/portal/my-records/", {
    params: patientAwpid ? { patient_awpid: patientAwpid } : {},
  });
  return res.data.results;
}

export async function getProfile() {
  const res = await api.get<Envelope<Profile>>("/portal/profile/");
  return res.data.data;
}

/**
 * POST /portal/emergency/token/ — mints a short-lived (20 min) QR the
 * patient shows a doctor outside their network. Every call is a fresh
 * disclosure decision (see core/emergency_access.py) — the first call always
 * omits consent_confirmed and gets back the 428 share-categories prompt,
 * same validateStatus trick as book() above so that 428 lands as a normal
 * return value instead of a thrown error. Only the 200 body is enveloped
 * ({success, data}); the 428 body is raw, matching PortalEmergencyTokenView.
 */
export async function generateEmergencyToken(payload: {
  patient_awpid?: string;
  consent_confirmed: boolean;
}): Promise<EmergencyTokenResult | EmergencyConsentPrompt> {
  const res = await api.post("/portal/emergency/token/", payload, { validateStatus: (s) => s === 200 || s === 428 });
  return res.status === 428 ? res.data : res.data.data;
}

/**
 * PATCH /portal/profile/ — update name / gender / DOB / photo / emergency
 * contact. `mobile` is special: changing it to a NEW number requires
 * `action_token` (from verifyContactChangeOtp in api/auth.ts) proving a code
 * sent to the email on file was entered. Sending the same number back, or
 * omitting it, needs no token. Email and AWPID are identity keys — read-only.
 */
export async function updateProfile(payload: Partial<Profile> & { photo?: string; action_token?: string }) {
  const res = await api.patch<Envelope<Profile>>("/portal/profile/", payload);
  return res.data.data;
}

/**
 * POST /portal/profile/mobile-change/request-otp/ — no body. Sends a
 * verification code to the EMAIL currently on file (proving account control
 * before a number change). Requires an email to be set on the profile.
 * Follow with verifyContactChangeOtp(email, code) then updateProfile({ mobile,
 * action_token }).
 */
export async function requestMobileChangeOtp() {
  const res = await api.post<Envelope<{ masked_identifier: string }>>("/portal/profile/mobile-change/request-otp/");
  return res.data;
}

export async function changePassword(old_password: string, new_password: string) {
  const res = await api.post<Envelope<null>>("/portal/profile/change-password/", { old_password, new_password });
  return res.data;
}

export async function getFamily() {
  const res = await api.get<Envelope<{ results: FamilyMember[] }>>("/portal/family/");
  return res.data.data.results;
}

export async function addFamilyMember(payload: {
  full_name: string;
  date_of_birth: string;
  gender?: string;
  relationship?: string;
}) {
  const res = await api.post<Envelope<FamilyMember>>("/portal/family/", payload);
  return res.data.data;
}

/**
 * PATCH /portal/family/<awpid>/ — edit a linked family member. The backend
 * (PatientService.update_family_member) requires a non-empty full_name and a
 * date_of_birth whenever either is present — DOB is the cross-hospital
 * identity key, so it can't be cleared.
 */
export async function updateFamilyMember(
  awpid: string,
  payload: { full_name?: string; date_of_birth?: string; gender?: string; relationship?: string }
) {
  const res = await api.patch<Envelope<FamilyMember>>(`/portal/family/${awpid}/`, payload);
  return res.data.data;
}

/**
 * DELETE /portal/family/<awpid>/ — unlink a family member from this account.
 * Their identity and any past bookings/records are untouched; they just drop
 * off the "book for / view records of" list until re-added.
 */
export async function removeFamilyMember(awpid: string) {
  const res = await api.delete<Envelope<null>>(`/portal/family/${awpid}/`);
  return res.data;
}

export async function getHealthSummary(patientAwpid?: string) {
  const res = await api.get<Envelope<HealthSummary>>("/portal/health-summary/", {
    params: patientAwpid ? { patient_awpid: patientAwpid } : {},
  });
  return res.data.data;
}

export async function getVaccinations(patientAwpid?: string) {
  const res = await api.get<Envelope<VaccinationSummary>>("/portal/vaccinations/", {
    params: patientAwpid ? { patient_awpid: patientAwpid } : {},
  });
  return res.data.data;
}

/**
 * POST /portal/vaccinations/upload/ — a parent self-reports a vaccination
 * given outside the network. Always lands as verification_status
 * "pending_review" server-side until a doctor/nurse confirms it.
 */
export async function uploadVaccinationRecord(payload: {
  vaccine_name: string;
  administered_date: string;
  scheduled_label?: string;
  patient_awpid?: string;
  file_data?: string;
  file_name?: string;
  mime_type?: string;
}) {
  const res = await api.post<Envelope<{ id: number; vaccine_name: string; administered_date: string; verification_status: string }>>(
    "/portal/vaccinations/upload/",
    payload
  );
  return res.data;
}

/** GET /portal/vaccinations/<record_id>/file/ — full certificate content, fetched only when actually downloading (the roadmap list only carries has_certificate). */
export async function getVaccinationFile(recordId: number) {
  const res = await api.get<Envelope<{ file_data: string; file_name: string; mime_type: string }>>(`/portal/vaccinations/${recordId}/file/`);
  return res.data.data;
}

/** Confirmed against PortalGrowthView's actual return (apps/patients/portal_views.py:1606). */
export async function getGrowth(patientAwpid?: string) {
  const res = await api.get<Envelope<{ date_of_birth: string | null; age_years: number | null; is_minor: boolean; series: GrowthPoint[]; latest: GrowthPoint | null }>>(
    "/portal/growth/",
    { params: patientAwpid ? { patient_awpid: patientAwpid } : {} }
  );
  return res.data.data;
}

/**
 * Confirmed against PortalHealthTimelineView's actual return
 * (apps/patients/portal_views.py:2030) — the key is `results`, not `entries`.
 * This was the exact cause of the "Cannot read property 'length' of
 * undefined" crash when opening the Health Timeline tab: the old code read
 * `.entries` (always undefined) and then checked `.length` on it.
 */
export async function getTimeline(patientAwpid?: string, limit = 30) {
  const res = await api.get<Envelope<{ results: TimelineEntry[]; count: number }>>("/portal/timeline/", {
    params: { limit, ...(patientAwpid ? { patient_awpid: patientAwpid } : {}) },
  });
  return res.data.data.results;
}

/** PortalDocumentListCreateView returns a raw object, not the {success,data} envelope. */
export async function getMyDocuments() {
  const res = await api.get<{ results: PatientDocument[]; pagination: any }>("/portal/documents/");
  return res.data.results;
}

export async function getDocumentDetail(id: number) {
  const res = await api.get<Envelope<PatientDocument & { file_data: string }>>(`/portal/documents/${id}/`);
  return res.data.data;
}

/** Same raw-object shape as the GET above, not the {success,data} envelope. */
export async function uploadDocument(payload: {
  title: string;
  doc_type: string;
  file_name: string;
  mime_type: string;
  file_data: string;
}) {
  const res = await api.post<PatientDocument>("/portal/documents/", payload);
  return res.data;
}

/** PortalLabOrderListView returns a raw object, not the {success,data} envelope. */
export async function getLabOrders(patientAwpid?: string) {
  const res = await api.get<{ results: LabOrder[]; pagination: any }>("/portal/lab-orders/", {
    params: patientAwpid ? { patient_awpid: patientAwpid } : {},
  });
  return res.data.results;
}

export async function chooseLabOrder(payload: {
  tenant_db: string;
  request_id: number;
  patient_choice: "in_house" | "outside";
  payment_preference?: "pay_online" | "pay_at_lab";
}) {
  const res = await api.post<Envelope<null>>("/portal/lab-orders/choice/", payload);
  return res.data;
}

/**
 * GET /portal/lab-orders/<tenant_db>/<request_id>/report/ — the actual
 * uploaded in-house lab report file (a short-lived signed URL under
 * file_data, not a data URI — downloadDataUri handles both). Only call this
 * when the order's report.has_file is true and it's been delivered; the
 * backend 404s / 400s otherwise. `result_summary` rides along so a caller
 * doesn't need the list row to show it.
 */
export async function getLabReportFile(tenantDb: string, requestId: number) {
  const res = await api.get<Envelope<{ file_data: string; file_name: string; mime_type: string; result_summary: string }>>(
    `/portal/lab-orders/${tenantDb}/${requestId}/report/`
  );
  return res.data.data;
}

export async function getNotifications(patientAwpid?: string) {
  const res = await api.get<Envelope<{ results: NotificationItem[]; unread_count: number }>>("/portal/notifications/", {
    params: patientAwpid ? { patient_awpid: patientAwpid } : {},
  });
  return res.data.data;
}

/**
 * Only real NotificationLog-backed entries can be marked read — their "id"
 * is "<tenant_db>:<log_id>" (see PortalNotificationsView). Vaccination-due
 * entries ("vaccine:<label>") are computed live and have no backing row, so
 * callers must not invoke this for them.
 */
export async function markNotificationRead(compositeId: string) {
  const [tenantDb, pk] = compositeId.split(":");
  const res = await api.post<Envelope<null>>(`/portal/notifications/${tenantDb}/${pk}/read/`);
  return res.data;
}
