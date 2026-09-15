import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AppStackParamList } from "./types";
import { NEUTRAL } from "@/theme/themes";
import { AppTabs } from "./AppTabs";
import { FindDoctorsScreen } from "@/screens/appointments/FindDoctorsScreen";
import { DoctorDetailScreen } from "@/screens/appointments/DoctorDetailScreen";
import { BookingForScreen } from "@/screens/appointments/BookingForScreen";
import { ConfirmBookingScreen } from "@/screens/appointments/ConfirmBookingScreen";
import { BookingSuccessScreen } from "@/screens/appointments/BookingSuccessScreen";
import { PrescriptionDetailScreen } from "@/screens/records/PrescriptionDetailScreen";
import { RxReportsScreen } from "@/screens/records/RxReportsScreen";
import { AITrendsScreen } from "@/screens/records/AITrendsScreen";
import { CaptureScreen } from "@/screens/records/CaptureScreen";
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
import { ShareRecordsScreen } from "@/screens/profile/ShareRecordsScreen";
import { SharedRecordsPrivacyScreen } from "@/screens/profile/SharedRecordsPrivacyScreen";

const Stack = createNativeStackNavigator<AppStackParamList>();

// React Navigation's native-stack handles the Android hardware back button
// automatically (pops to the previous screen in this stack) — no custom
// wiring needed for that part. The "press back again to exit" case is only
// relevant on the Home tab (nothing left to pop to), handled there via
// useExitOnDoubleBack.
export function AppStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        statusBarTranslucent: true,
        statusBarColor: "transparent",
        // react-native-screens' native Screen view defaults to a BLACK
        // background on Android — with translucent status bar + no header,
        // that default paints straight through as a black strip behind the
        // status bar, since nothing in JS renders there before our own
        // Screen component's content mounts over it. This is that fix.
        contentStyle: { backgroundColor: NEUTRAL.bg },
      }}
    >
      <Stack.Screen name="Tabs" component={AppTabs} />
      <Stack.Screen name="FindDoctors" component={FindDoctorsScreen} />
      <Stack.Screen name="DoctorDetail" component={DoctorDetailScreen} />
      <Stack.Screen name="BookingFor" component={BookingForScreen} />
      <Stack.Screen name="ConfirmBooking" component={ConfirmBookingScreen} />
      <Stack.Screen name="BookingSuccess" component={BookingSuccessScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="PrescriptionDetail" component={PrescriptionDetailScreen} />
      <Stack.Screen name="RxReports" component={RxReportsScreen} />
      <Stack.Screen name="AITrends" component={AITrendsScreen} />
      <Stack.Screen name="RxCapture" component={CaptureScreen} options={{ presentation: "fullScreenModal", animation: "fade" }} />
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
      <Stack.Screen name="ShareRecords" component={ShareRecordsScreen} />
      <Stack.Screen name="SharedRecordsPrivacy" component={SharedRecordsPrivacyScreen} />
    </Stack.Navigator>
  );
}
