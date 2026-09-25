import * as FileSystem from "expo-file-system/legacy";
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
  HealthActivity,
  HealthInsightSummary,
  HealthSummary,
  Hospital,
  LabOrder,
  MedicalRecord,
  NotificationItem,
  Pagination,
  PatientDocument,
  PrescriptionOrder,
  Profile,
  RecordsPrivacyPayload,
  RecordsShareConsentPrompt,
  RecordsShareCreated,
  RecordsShareDecision,
  RecordsShareGrant,
  RecordsShareScope,
  RecordsShareStatus,
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

/* ── "Share Records" — the patient side of the doctor-has-a-laptop flow.
 * The clinician's laptop shows a QR/code + link; the patient scans or types
 * it here, approves once (2-hour window), and can end it or release
 * individual downloads afterwards. Backend: apps/patients/records_share_views.py */

/** The patient starts the flow: mint a pending session + a link to hand to the doctor. */
export async function createRecordsShare(note?: string): Promise<RecordsShareCreated> {
  const res = await api.post("/portal/records-share/", note ? { note } : {});
  return res.data.data;
}

/** Public status lookup — accepts the 32-char token OR the 6-digit pairing code. */
export async function getRecordsShareStatus(tokenOrCode: string): Promise<RecordsShareStatus> {
  const res = await api.get(`/records-share/${tokenOrCode}/`);
  return res.data.data;
}

/**
 * Approve / decline after scanning. The patient must pass the session's
 * `pairing` — the 6-character code on the doctor's screen, lifted out of the
 * scanned QR (…?p=XXXXXX) or typed by hand. A wrong one is a real 400 (with
 * errors.attempts_left); a locked session is 423; the doctor not having
 * opened the link yet is 409. The right pairing but no consent yet is 428 +
 * share_categories.
 *
 * `shareScope` is the one-time bulk choice made on the consent screen:
 * "all" shares this grant's private records too (this doctor only, this
 * visit only — see registry.RecordsShareRequest.share_all); "default" (the
 * default here) keeps the patient's standing privacy in effect, same as
 * before this parameter existed. Only meaningful on the approving call —
 * harmless to pass on a decline.
 */
export async function recordsShareDecision(
  token: string,
  approve: boolean,
  consent_confirmed = false,
  pairing = "",
  shareScope: RecordsShareScope = "default",
): Promise<RecordsShareDecision | RecordsShareConsentPrompt> {
  const res = await api.post(
    `/portal/records-share/${token}/decision/`,
    { approve, consent_confirmed, pairing, share_scope: shareScope },
    { validateStatus: (s) => s === 200 || s === 428 },
  );
  if (res.status === 428) {
    return {
      consent_required: true,
      share_categories: res.data?.errors?.share_categories || [],
      private_count: res.data?.errors?.private_count || 0,
    };
  }
  return res.data.data;
}

/** The patient's "who currently has access" list, with any pending download request. */
export async function getRecordsShareMine(): Promise<RecordsShareGrant[]> {
  const res = await api.get("/portal/records-share/mine/");
  return res.data.data.grants || [];
}

export async function endRecordsShare(token: string) {
  const res = await api.post(`/portal/records-share/${token}/end/`);
  return res.data.data;
}

export async function recordsShareDownloadDecision(token: string, approve: boolean) {
  const res = await api.post(`/portal/records-share/${token}/downloads/decision/`, { approve });
  return res.data.data;
}

// ── Shared-records privacy ──────────────────────────────────────────────────
// The patient's standing "what a doctor sees when I share my records" config,
// the per-record lock used from My Reports, and the per-visit reveal on a
// live grant. Backend: apps/patients/records_share_views.py.

export interface RecordsPrivacyQuery {
  /** 1-based page; the list is paged on category boundaries */
  page?: number;
  /** csv of panel slugs */
  category?: string;
  /** csv of doc_type slugs */
  kind?: string;
  /** YYYY-MM */
  month?: string;
  q?: string;
}

export async function getRecordsPrivacy(
  query: RecordsPrivacyQuery = {},
): Promise<RecordsPrivacyPayload> {
  const res = await api.get<Envelope<RecordsPrivacyPayload>>("/portal/records-privacy/", {
    params: query,
  });
  return res.data.data;
}

/**
 * Replace one or more of the broad-rule keys (only the keys you pass change).
 * `add_hidden_doc_ids` / `remove_hidden_doc_ids` are incremental deltas on the
 * individual-lock set — used for bulk lock/unlock now the list is paged and the
 * client can't send a full replacement `hidden_doc_ids`.
 */
export async function updateRecordsPrivacy(
  patch: Partial<
    Pick<RecordsPrivacyPayload, "hide_all" | "hidden_categories" | "hidden_kinds" | "hidden_sections">
  > & { hidden_doc_ids?: number[]; add_hidden_doc_ids?: number[]; remove_hidden_doc_ids?: number[] },
) {
  const res = await api.put<Envelope<{ ok: boolean }>>("/portal/records-privacy/", patch);
  return res.data.data;
}

/** The single-record lock — add or remove one document from standing privacy. */
export async function toggleRecordPrivacy(docId: number, isPrivate: boolean) {
  const res = await api.post<Envelope<{ doc_id: number; private: boolean }>>(
    "/portal/records-privacy/toggle/",
    { doc_id: docId, private: isPrivate },
  );
  return res.data.data;
}

/**
 * Reveal private records on a LIVE share grant.
 *   "visit"   — show them to the doctor for this visit only (auto-hide on end)
 *   "always"  — also clear them from standing privacy
 *   "conceal" — undo a this-visit reveal now
 */
export async function revealForShare(
  token: string,
  docIds: number[],
  scope: "visit" | "always" | "conceal",
) {
  const res = await api.post<Envelope<{ shown_private_ids: number[] }>>(
    `/portal/records-share/${token}/reveal/`,
    { doc_ids: docIds, scope },
  );
  return res.data.data;
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
export async function getMyDocuments(page = 1, patientAwpid?: string) {
  const res = await api.get<{ results: PatientDocument[]; pagination: Pagination }>("/portal/documents/", {
    params: { page, ...(patientAwpid ? { patient_awpid: patientAwpid } : {}) },
  });
  return res.data;
}

export async function getDocumentDetail(id: number, opts?: { download?: boolean }) {
  const res = await api.get<Envelope<PatientDocument & { file_data: string; handwritten_doc_id?: number | null }>>(
    `/portal/documents/${id}/`,
    { params: opts?.download ? { download: 1 } : {} },
  );
  return res.data.data;
}

/**
 * The combined, point-form summary across every changed value at once —
 * POST for the same reason as the narrative above (the one call on this
 * screen that hits an LLM). `points` comes back empty (not null) when
 * nothing changed enough to flag; the caller falls back to a plain
 * "nothing out of the ordinary" state rather than an error either way.
 */
export async function getHealthInsightSummary(opts?: {
  range?: "3m" | "6m" | "12m" | "all";
  patientAwpid?: string;
}) {
  const res = await api.post<Envelope<HealthInsightSummary>>("/portal/health-insights/summary/", {
    range: opts?.range || "12m",
    ...(opts?.patientAwpid ? { patient_awpid: opts.patientAwpid } : {}),
  });
  return res.data.data;
}

/**
 * Visits & reports activity — month-by-month document counts, the
 * report-type breakdown, and pattern_insights (deterministic, non-LLM
 * sentences already written server-side). No LLM call, so this is a plain
 * GET unlike the two above.
 */
export async function getHealthActivity(opts?: {
  range?: "3m" | "6m" | "12m" | "all";
  patientAwpid?: string;
}) {
  const res = await api.get<Envelope<HealthActivity>>("/portal/health-insights/", {
    params: {
      range: opts?.range || "12m",
      ...(opts?.patientAwpid ? { patient_awpid: opts.patientAwpid } : {}),
    },
  });
  return res.data.data;
}

/**
 * Re-file an unsorted / patient-uploaded document. Verified hospital docs 409.
 * Send only the field(s) the review flow is asking for right now — the
 * server recomputes `review_needs` from what's still missing afterward, so a
 * partial submission (e.g. just the type) correctly re-prompts for the rest
 * (e.g. the panel) instead of prematurely marking the row filed.
 */
export async function fileReviewDocument(
  id: number,
  patch: { doc_type?: string; report_categories?: string[]; document_date?: string },
) {
  const res = await api.patch<Envelope<{
    id: number; doc_type: string; report_categories: string[];
    document_date: string | null; review_state: string; review_needs: string[];
  }>>(`/portal/documents/${id}/`, patch);
  return res.data.data;
}

/** @deprecated use fileReviewDocument — kept for any other caller of the old, type-only shape. */
export async function recategoriseDocument(id: number, doc_type: string) {
  return fileReviewDocument(id, { doc_type });
}

/** Remove from My Records — patient upload is soft-deleted, hospital doc hidden. */
export async function deleteDocument(id: number) {
  const res = await api.delete<Envelope<{ id: number; deleted: boolean }>>(`/portal/documents/${id}/`);
  return res.data;
}

/**
 * One upload can come back three ways (all HTTP 200/201, raw object — not the
 * {success,data} envelope):
 *   • a created doc   — { id, review_state: "filed" | "unsorted", report_categories, unreadable, ... }
 *   • not a medical doc — { skipped: true, kind: "not_medical", reason }
 *   • already uploaded  — { duplicate: true, existing_id, existing_title, existing_doc_type }
 */
export type UploadResult =
  | (PatientDocument & { review_state: string; unreadable?: boolean; quality_message?: string; report_categories?: string[] })
  | { skipped: true; kind: string; reason: string }
  | { duplicate: true; existing_id: number; existing_title: string; existing_doc_type: string };

export async function uploadDocument(payload: {
  title: string;
  doc_type: string;
  file_name: string;
  mime_type: string;
  file_data: string;
  qr_token?: string;
  patient_awpid?: string;
}): Promise<UploadResult> {
  // The server reads the page (quality check -> OCR -> text/vision model) before
  // it answers, which routinely outlasts the app-wide 15s limit — the phone then
  // gave up and left the photo "uploading" while the server was still working.
  const res = await api.post<UploadResult>("/portal/documents/", payload, { timeout: 120000 });
  return res.data;
}

// ── Upload-and-extract (mobile-only, extraction phase — no classification/filing yet) ──

/** The second status, shown after "Read": the keyword rules + AI check on the linked My Reports row. */
export type ExtractAi = {
  /** queued/running = the AI check is pending; done = finished; skipped = it wasn't needed; failed = it couldn't run; none = no My Reports row. */
  status: "none" | "skipped" | "queued" | "running" | "done" | "failed";
  /** The type it was sorted as ("Lab Report"), empty when not sure. */
  label: string;
  needs_review: boolean;
};

export type ExtractSyncFileResult = {
  item_id: string;
  file_name: string;
  status: "done" | "failed";
  text: string;
  confidence: number | null;
  reason: string;
};

/** Up to instant_max_files files (see getExtractConfig), processed inline — same request/response shape family as uploadDocument. */
export async function extractSync(
  files: { file_name: string; mime_type: string; file_data: string }[],
  patient_awpid?: string,
  /** Bytes sent so far — lets the UI tell "sending" apart from "reading" inside this one request. */
  onUpload?: (loaded: number, total: number) => void
): Promise<ExtractSyncFileResult[]> {
  const res = await api.post<Envelope<{ results: ExtractSyncFileResult[] }>>(
    "/portal/documents/extract/sync/",
    { files, patient_awpid },
    { timeout: 120000, onUploadProgress: (e) => onUpload?.(e.loaded, e.total ?? 0) }
  );
  return res.data.data.results;
}

export type ExtractConfig = { instant_max_files: number; bulk_max_files: number; batch_max_bytes: number };

/** The limits the server enforces — read BEFORE choosing instant or bulk (instant_max_files is an admin setting). */
export async function getExtractConfig(): Promise<ExtractConfig> {
  const res = await api.get<Envelope<ExtractConfig>>("/portal/documents/extract/config/");
  return res.data.data;
}

export type ExtractBulkCreateResult = {
  batch_id: string;
  items: { index?: number; item_id: string; filename: string; put_url: string; content_type: string }[];
  /** Files the server left out (unsupported type / over the size cap). */
  skipped?: { index: number; name: string; reason: string }[];
};

/** Bigger uploads (up to 50 files) — returns presigned S3 PUT urls; caller PUTs each file, then calls extractBulkStart. */
export async function extractBulkCreate(
  files: { name: string; size: number; mime_type: string }[],
  patient_awpid?: string
): Promise<ExtractBulkCreateResult> {
  const res = await api.post<Envelope<ExtractBulkCreateResult>>("/portal/documents/extract/bulk/", {
    files,
    patient_awpid,
  });
  return res.data.data;
}

export async function extractBulkStart(batchId: string): Promise<{ batch_id: string; status: string }> {
  // The server checks every uploaded file in S3 before queueing, which takes a few
  // seconds for a big batch — well past the app-wide 15s default's comfort zone on a slow link.
  const res = await api.post<Envelope<{ batch_id: string; status: string }>>(
    `/portal/documents/extract/bulk/${batchId}/start/`,
    undefined,
    { timeout: 60000 }
  );
  return res.data.data;
}

export type ExtractBatchStatus = {
  batch: {
    id: string;
    status: "pending" | "queued" | "processing" | "done" | "partial" | "failed" | "cancelled";
    processed?: number;
    progress_percent?: number;
    counts?: { uploading: number; queued: number; processing: number; done: number; failed: number };
    total_files: number;
    completed: number;
    failed: number;
    created_at: string;
    started_at?: string | null;
    finished_at: string | null;
  };
  items: { id: string; original_filename: string; status: string; reason: string }[];
};

export async function extractBulkStatus(batchId: string): Promise<ExtractBatchStatus> {
  const res = await api.get<Envelope<ExtractBatchStatus>>(`/portal/documents/extract/bulk/${batchId}/status/`);
  return res.data.data;
}

export type ExtractedItem = {
  id: string;
  name: string;
  status: "done" | "failed";
  mime_type: string;
  /** False when the file was rejected (never kept) — nothing to open. */
  has_file: boolean;
  reason: string;
  snippet: string;
  created_at: string;
  ai: ExtractAi;
};
export type ExtractedGroup = {
  id: string;
  kind: "batch" | "instant";
  created_at: string;
  /** Stable number of files in this upload (items only counts the ones still showing). */
  total?: number;
  items: ExtractedItem[];
};
export type ExtractedItems = { counts: { ready: number; failed: number; ai_pending?: number }; groups: ExtractedGroup[] };

/** Finished extractions the patient hasn't dismissed yet, grouped per upload. */
export async function getExtractedItems(patientAwpid?: string): Promise<ExtractedItems> {
  const res = await api.get<Envelope<ExtractedItems>>("/portal/documents/extract/items/", {
    params: patientAwpid ? { patient_awpid: patientAwpid } : {},
  });
  return res.data.data;
}

/** A short-lived link to the kept original, to open it the same way any other report opens. */
export async function getExtractedItemFile(id: string, patientAwpid?: string) {
  const res = await api.get<Envelope<{ id: string; name: string; status: string; reason: string; mime_type: string; file_url: string }>>(
    `/portal/documents/extract/items/${id}/`,
    { params: patientAwpid ? { patient_awpid: patientAwpid } : {} }
  );
  return res.data.data;
}

/** Hides finished items from the list (nothing is deleted server-side). */
export async function dismissExtractedItems(target: { itemIds: string[] } | { all: true }, patientAwpid?: string) {
  const body = "all" in target ? { all: true } : { item_ids: target.itemIds };
  const res = await api.post<Envelope<{ dismissed: number }>>("/portal/documents/extract/items/dismiss/", {
    ...body,
    ...(patientAwpid ? { patient_awpid: patientAwpid } : {}),
  });
  return res.data.data;
}

/** Registers this device's Expo push token with the server, against the logged-in account. */
export async function registerPushToken(token: string, platform: string): Promise<void> {
  await api.post("/portal/push-token/", { token, platform });
}

/** Raw PUT straight to S3 — headers must match what presigned_put_url() signed. */
export async function putToS3(putUrl: string, mimeType: string, fileUri: string): Promise<void> {
  // Native upload straight from disk. fetch(uri).blob() would copy the whole file
  // through base64 in JS (slow, and the body it produced never reached S3).
  const res = await FileSystem.uploadAsync(putUrl, fileUri, {
    httpMethod: "PUT",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { "Content-Type": mimeType, "x-amz-server-side-encryption": "AES256" },
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Upload to storage failed (${res.status}): ${String(res.body).slice(0, 200)}`);
  }
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
