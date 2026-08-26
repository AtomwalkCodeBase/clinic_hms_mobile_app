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
    paymentPreference?: "pay_at_desk" | "pay_online";
    chiefComplaint?: string;
    patientAwpid?: string;
    patientName: string;
    consultationFee?: string | null;
  };
  BookingSuccess: { hospital: string; doctor: string; date: string; time?: string; tokenNumber: number };
  PaymentPending: {
    bookingId: number;
    gatewayOrder: import("@/api/types").GatewayOrder;
    hospitalName: string;
    doctorName: string;
    date: string;
    time?: string;
    tokenNumber: number;
    // Carries everything needed to make a genuinely fresh POST /portal/book/
    // call for "Try payment again" / "Book & pay at front desk instead" —
    // the abandoned booking is already cancelled server-side by the time
    // either button is shown, so resuming it isn't an option, only
    // resubmitting is (mirrors the web app's retryOnlinePayment/
    // retryPayAtFrontDesk in DoctorProfilePage.jsx).
    rebook: {
      tenantId: number;
      doctorId: number;
      scheduledDate: string;
      scheduledTime?: string;
      chiefComplaint?: string;
      patientAwpid?: string;
      patientName: string;
    };
  };
  PrescriptionDetail: { record: import("@/api/types").MedicalRecord };
  Prescriptions: undefined;
  LabReports: { patientAwpid?: string; patientName?: string } | undefined;
  Documents: undefined;
  Notifications: undefined;
  Reschedule: { bookingId: number; tenantId: number; doctorId: number; doctorName: string; hospitalName: string; patientName: string };
  Vaccinations: { patientAwpid?: string; patientName: string };
  ReportVaccination: { patientAwpid?: string; patientName: string };
  HealthTimeline: { patientAwpid?: string; patientName: string };
  HealthVisits: { patientAwpid?: string; patientName: string };
  Growth: { patientAwpid?: string; patientName: string };
  AddFamilyMember: undefined;
  PersonalDetails: undefined;
  HealthSummary: undefined;
  FamilyMembers: undefined;
  LinkedHospitals: undefined;
  ThemePicker: undefined;
  Support: undefined;
};
