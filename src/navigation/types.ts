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
        hospitalId?: number;
        hospitalName?: string;
        initialSpecialty?: string;
        initialComplaint?: string;
        patientAwpid?: string;
        patientName?: string;
      }
    | undefined;
  DoctorDetail: { hospitalId: number; doctorId: number; initialComplaint?: string; patientAwpid?: string; patientName?: string };
  BookingFor: { initialComplaint?: string } | undefined;
  ConfirmBooking: {
    hospitalId: number;
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
  MyDocuments: undefined;
  // One upload day of the By-date view: its files. `date` is "2026-05-12"; `byType` is how many of each type that day
  // holds (from the day card), so the type filter inside the day can show its counts without another request.
  DocumentDay: { date: string; patientAwpid?: string; byType: Record<string, number> };
  // mode "instant" = one document on the fast lane (QR scan or one photo); "bulk" = several photos at once
  DocumentCapture: { mode: "instant" | "bulk"; patientAwpid?: string };
  DocumentUpload: { patientAwpid?: string } | undefined;
  // The full-screen viewer: the files of the list it was opened from (ids), which one to open (index), whose they are.
  DocumentViewer: { ids: number[]; index: number; patientAwpid?: string };
  Notifications: undefined;
  Reschedule: { bookingId: number; hospitalId: number; doctorId: number; doctorName: string; hospitalName: string; patientName: string };
  // Only the Health tab's header takes the family member's colour; the screens below always use the app theme.
  // headerColor / headerOn: the selected family member's colour for the header band only (Health tab sets them)
  Vaccinations: { patientAwpid?: string; patientName: string; headerColor?: string; headerOn?: string };
  AddVaccine: { patientAwpid?: string; patientName: string };
  HealthTimeline: { patientAwpid?: string; patientName: string; headerColor?: string; headerOn?: string };
  HealthVisits: { patientAwpid?: string; patientName: string; headerColor?: string; headerOn?: string };
  AddFamilyMember: { member?: import("@/api/types").FamilyMember } | undefined;
  PersonalDetails: undefined;
  HealthSummary: undefined;
  FamilyMembers: undefined;
  LinkedHospitals: undefined;
  Support: undefined;
  ShareRecords: undefined;
  SharedRecordsPrivacy: undefined;
};
