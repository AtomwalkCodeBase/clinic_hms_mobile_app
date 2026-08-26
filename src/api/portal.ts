import { api } from "./client";
import type {
  Booking,
  BookingResult,
  ConsentRequired,
  DoctorCard,
  DoctorDetail,
  Envelope,
  FamilyMember,
  GrowthPoint,
  HealthSummary,
  Hospital,
  LabOrder,
  MedicalRecord,
  NotificationItem,
  PatientDocument,
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
  const res = await api.post("/portal/book/", payload, { validateStatus: (s) => s === 201 || s === 428 });
  return res.data;
}

export async function getMyBookings() {
  const res = await api.get<{ results: Booking[]; pagination: any }>("/portal/my-bookings/");
  return res.data.results;
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
 * GET /portal/my-bookings/<id>/receipt/ — only ever resolves once the
 * booking-fee payment has genuinely cleared (PortalBookingReceiptPDFView
 * 404s otherwise); same base64-data-URI shape as every other file endpoint
 * in this app (see getDocumentDetail above), meant to be handed straight to
 * downloadDataUri (src/utils/fileHelpers.ts).
 */
export async function getBookingReceipt(id: number) {
  const res = await api.get<Envelope<{ file_data: string; file_name: string; mime_type: string }>>(
    `/portal/my-bookings/${id}/receipt/`
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

export async function updateProfile(payload: Partial<Profile>) {
  const res = await api.patch<Envelope<Profile>>("/portal/profile/", payload);
  return res.data.data;
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
  date_of_birth?: string;
  gender?: string;
  relationship?: string;
}) {
  const res = await api.post<Envelope<FamilyMember>>("/portal/family/", payload);
  return res.data.data;
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
