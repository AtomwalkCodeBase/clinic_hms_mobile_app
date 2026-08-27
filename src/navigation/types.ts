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
  BookingSuccess: { hospital: string; doctor: string; date: string; time?: string; tokenNumber: number };
  PrescriptionDetail: { record: import("@/api/types").MedicalRecord };
  Prescriptions: { patientAwpid?: string; patientName?: string } | undefined;
  LabReports: { patientAwpid?: string; patientName?: string } | undefined;
  Documents: undefined;
  Notifications: undefined;
  Reschedule: { bookingId: number; tenantId: number; doctorId: number; doctorName: string; hospitalName: string; patientName: string };
  Vaccinations: { patientAwpid?: string; patientName: string };
  ReportVaccination: { patientAwpid?: string; patientName: string };
  HealthTimeline: { patientAwpid?: string; patientName: string };
  HealthVisits: { patientAwpid?: string; patientName: string };
  Growth: { patientAwpid?: string; patientName: string };
  AddFamilyMember: { member?: import("@/api/types").FamilyMember } | undefined;
  PersonalDetails: undefined;
  HealthSummary: undefined;
  FamilyMembers: undefined;
  LinkedHospitals: undefined;
  ThemePicker: undefined;
  Support: undefined;
  EmergencyQR: undefined;
};
