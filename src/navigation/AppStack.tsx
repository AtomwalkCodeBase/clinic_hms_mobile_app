import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AppStackParamList } from "./types";
import { AppTabs } from "./AppTabs";
import { FindDoctorsScreen } from "@/screens/appointments/FindDoctorsScreen";
import { DoctorDetailScreen } from "@/screens/appointments/DoctorDetailScreen";
import { BookingForScreen } from "@/screens/appointments/BookingForScreen";
import { ConfirmBookingScreen } from "@/screens/appointments/ConfirmBookingScreen";
import { BookingSuccessScreen } from "@/screens/appointments/BookingSuccessScreen";
import { PrescriptionDetailScreen } from "@/screens/records/PrescriptionDetailScreen";
import { PrescriptionsListScreen } from "@/screens/records/PrescriptionsListScreen";
import { LabReportsScreen } from "@/screens/records/LabReportsScreen";
import { DocumentsScreen } from "@/screens/records/DocumentsScreen";
import { NotificationsScreen } from "@/screens/notifications/NotificationsScreen";
import { RescheduleScreen } from "@/screens/appointments/RescheduleScreen";
import { VaccinationsScreen } from "@/screens/health/VaccinationsScreen";
import { ReportVaccinationScreen } from "@/screens/health/ReportVaccinationScreen";
import { HealthTimelineScreen } from "@/screens/health/HealthTimelineScreen";
import { HealthVisitsScreen } from "@/screens/health/HealthVisitsScreen";
import { GrowthScreen } from "@/screens/health/GrowthScreen";
import { AddFamilyMemberScreen } from "@/screens/health/AddFamilyMemberScreen";
import { PersonalDetailsScreen } from "@/screens/profile/PersonalDetailsScreen";
import { HealthSummaryScreen } from "@/screens/profile/HealthSummaryScreen";
import { FamilyMembersScreen } from "@/screens/profile/FamilyMembersScreen";
import { LinkedHospitalsScreen } from "@/screens/profile/LinkedHospitalsScreen";
import { ThemeScreen } from "@/screens/profile/ThemeScreen";
import { SupportScreen } from "@/screens/profile/SupportScreen";
import { EmergencyQRScreen } from "@/screens/profile/EmergencyQRScreen";

const Stack = createNativeStackNavigator<AppStackParamList>();

// React Navigation's native-stack handles the Android hardware back button
// automatically (pops to the previous screen in this stack) — no custom
// wiring needed for that part. The "press back again to exit" case is only
// relevant on the Home tab (nothing left to pop to), handled there via
// useExitOnDoubleBack.
export function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={AppTabs} />
      <Stack.Screen name="FindDoctors" component={FindDoctorsScreen} />
      <Stack.Screen name="DoctorDetail" component={DoctorDetailScreen} />
      <Stack.Screen name="BookingFor" component={BookingForScreen} />
      <Stack.Screen name="ConfirmBooking" component={ConfirmBookingScreen} />
      <Stack.Screen name="BookingSuccess" component={BookingSuccessScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="PrescriptionDetail" component={PrescriptionDetailScreen} />
      <Stack.Screen name="Prescriptions" component={PrescriptionsListScreen} />
      <Stack.Screen name="LabReports" component={LabReportsScreen} />
      <Stack.Screen name="Documents" component={DocumentsScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Reschedule" component={RescheduleScreen} />
      <Stack.Screen name="Vaccinations" component={VaccinationsScreen} />
      <Stack.Screen name="ReportVaccination" component={ReportVaccinationScreen} />
      <Stack.Screen name="HealthTimeline" component={HealthTimelineScreen} />
      <Stack.Screen name="HealthVisits" component={HealthVisitsScreen} />
      <Stack.Screen name="Growth" component={GrowthScreen} />
      <Stack.Screen name="AddFamilyMember" component={AddFamilyMemberScreen} />
      <Stack.Screen name="PersonalDetails" component={PersonalDetailsScreen} />
      <Stack.Screen name="HealthSummary" component={HealthSummaryScreen} />
      <Stack.Screen name="FamilyMembers" component={FamilyMembersScreen} />
      <Stack.Screen name="LinkedHospitals" component={LinkedHospitalsScreen} />
      <Stack.Screen name="ThemePicker" component={ThemeScreen} />
      <Stack.Screen name="Support" component={SupportScreen} />
      <Stack.Screen name="EmergencyQR" component={EmergencyQRScreen} />
    </Stack.Navigator>
  );
}
