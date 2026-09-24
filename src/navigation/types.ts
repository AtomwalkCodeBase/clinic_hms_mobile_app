export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  OTPLogin: undefined;
};

export type AppTabsParamList = {
  Home: undefined;
  Appointments: undefined;
  Health: undefined;
  Profile: undefined;
};

export type AppStackParamList = {
  Tabs: undefined;
  FindDoctors:
    | {
        tenantId?: number;
        hospitalName?: string;
        initialSpecialty?: string;
        initialComplaint?: string;
        patientAwpid?: string;
        patientName?: string;
      }
    | undefined;
  DoctorDetail: { tenantId: number; doctorId: number; initialComplaint?: string; patientAwpid?: string; patientName?: string };
  BookingFor: { initialComplaint?: string } | undefined;
  ConfirmBooking: {
    tenantId: number;
    doctorId: number;
    doctorName: string;
    hospitalName: string;
    date: string;
    time?: string;
    chiefComplaint?: string;
    patientAwpid?: string;
    patientName: string;
    consultationFee?: string | null;
  };
  BookingSuccess: { hospital: string; doctor: string; date: string; time?: string; tokenNumber?: number };
  PrescriptionDetail: { record: import("@/api/types").MedicalRecord };
  RxReports: { patientAwpid?: string; patientName?: string; patientGender?: string; patientDob?: string | null } | undefined;
  RxCapture: { patientAwpid?: string } | undefined;
  Uploads: { patientAwpid?: string } | undefined;
  Notifications: undefined;
  Reschedule: { bookingId: number; tenantId: number; doctorId: number; doctorName: string; hospitalName: string; patientName: string };
  // patientGender/patientDob: raw fields for theme/familyColors.ts's
  // familyAccentFor()/familyGadgetTintFor() — the SAME derivation
  // HealthScreen's family-member switcher uses, re-run here rather than
  // precomputed and passed through, so there's one source of truth for the
  // color instead of duplicating it in nav params. Undefined for Self (or
  // any patient the derivation doesn't apply to) — callers fall back to the
  // personal accent theme.
  Vaccinations: { patientAwpid?: string; patientName: string; patientGender?: string; patientDob?: string | null };
  ReportVaccination: { patientAwpid?: string; patientName: string };
  HealthTimeline: { patientAwpid?: string; patientName: string; patientGender?: string; patientDob?: string | null };
  HealthVisits: { patientAwpid?: string; patientName: string; patientGender?: string; patientDob?: string | null };
  Growth: { patientAwpid?: string; patientName: string; patientGender?: string; patientDob?: string | null };
  AddFamilyMember: { member?: import("@/api/types").FamilyMember } | undefined;
  PersonalDetails: undefined;
  HealthSummary: undefined;
  FamilyMembers: undefined;
  LinkedHospitals: undefined;
  ThemePicker: undefined;
  Support: undefined;
  ShareRecords: undefined;
  SharedRecordsPrivacy: undefined;
};
