import React from "react";
import { View, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, CalendarDays, HeartPulse, UserRound } from "lucide-react-native";
import { AppTabsParamList } from "./types";
import { NEUTRAL } from "@/theme/themes";
import type { LucideIcon } from "@/theme/icons";
import { useAppTheme } from "@/context/ThemeContext";
import { HomeScreen } from "@/screens/home/HomeScreen";
import { AppointmentsScreen } from "@/screens/appointments/AppointmentsScreen";
import { HealthScreen } from "@/screens/health/HealthScreen";
import { ProfileScreen } from "@/screens/profile/ProfileScreen";

const Tab = createBottomTabNavigator<AppTabsParamList>();

const ICONS: Record<keyof AppTabsParamList, LucideIcon> = {
  Home: Home,
  Appointments: CalendarDays,
  Health: HeartPulse,
  Profile: UserRound,
};

export function AppTabs() {
  const { theme } = useAppTheme();
  // The fixed bar height below must grow with the device's bottom safe-area
  // inset (gesture nav bar / home indicator) — hardcoding just the content
  // height without it squeezed icons/labels into whatever sliver was left
  // above the system nav on devices with a inset, reading as "shrunk".
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: NEUTRAL.textMuted,
        tabBarStyle: [styles.bar, { height: 56 + insets.bottom, paddingBottom: Math.max(insets.bottom, 8) }],
        // A filled pill behind the active icon (not just a tint-color swap)
        // reads as a real "you are here" indicator instead of flat text —
        // same idea as the reference's highlighted active tab circle.
        tabBarIcon: ({ color, focused }) => {
          const Icon = ICONS[route.name as keyof AppTabsParamList];
          return (
            <View style={[styles.iconWrap, focused && { backgroundColor: theme.bg }]}>
              <Icon size={19} color={color} strokeWidth={2.2} />
            </View>
          );
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Appointments" component={AppointmentsScreen} options={{ title: "Visits" }} />
      <Tab.Screen name="Health" component={HealthScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopColor: NEUTRAL.border,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 6,
    backgroundColor: NEUTRAL.surface,
    shadowColor: "#0C2340",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  iconWrap: { width: 34, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
});
