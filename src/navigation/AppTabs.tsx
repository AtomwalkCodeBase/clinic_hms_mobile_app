import { useEffect, useRef } from "react";
import { Animated, View, StyleSheet, Pressable, Text } from "react-native";
import * as Haptics from "expo-haptics";
import { createBottomTabNavigator, type BottomTabBarProps } from "@react-navigation/bottom-tabs";
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

/** One tab: the pill behind the icon grows in with a spring when the tab is chosen, and the icon lifts a touch. */
function TabButton({ label, Icon, focused, onPress, onLongPress }: { label: string; Icon: LucideIcon; focused: boolean; onPress: () => void; onLongPress: () => void }) {
  const { theme } = useAppTheme();
  const v = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: focused ? 1 : 0, useNativeDriver: true, speed: 18, bounciness: 8 }).start();
  }, [focused, v]);
  const color = focused ? theme.text : NEUTRAL.textMuted;
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={label} style={styles.item}>
      <View style={styles.iconWrap}>
        <Animated.View style={[styles.pill, { backgroundColor: theme.bg, opacity: v, transform: [{ scaleX: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }]} />
        <Animated.View style={{ transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -1] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }}>
          <Icon size={19} color={color} strokeWidth={2.2} />
        </Animated.View>
      </View>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

/** The bottom bar: same look as before, with the sliding pill and a light tick when you switch tabs. */
function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  // The fixed bar height must grow with the device's bottom safe-area inset (gesture nav bar / home indicator), or the
  // icons and labels get squeezed into whatever sliver is left above the system nav.
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { height: 56 + insets.bottom, paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const label = (descriptors[route.key].options.title as string) ?? route.name;
        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            Haptics.selectionAsync().catch(() => {});
            navigation.navigate(route.name as never);
          }
        };
        return <TabButton key={route.key} label={label} Icon={ICONS[route.name as keyof AppTabsParamList]} focused={focused} onPress={onPress} onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })} />;
      })}
    </View>
  );
}

export function AppTabs() {
  return (
    <Tab.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }} sceneContainerStyle={{ backgroundColor: NEUTRAL.bg }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Appointments" component={AppointmentsScreen} options={{ title: "Visits" }} />
      <Tab.Screen name="Health" component={HealthScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: NEUTRAL.border,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 6,
    backgroundColor: NEUTRAL.surface,
    shadowColor: "#0C2340",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    // Android's `elevation` ignores shadowColor/shadowOffset entirely and
    // always draws its own grey drop shadow, no matter how low — even at 3
    // it still reads as a visible hazy grey band bleeding into the page
    // above the bar. borderTopWidth/borderTopColor above already draws a
    // real, crisp edge, so elevation isn't needed at all here; 0 removes
    // Android's shadow entirely and leaves just that border on both
    // platforms (iOS never used elevation to begin with).
    elevation: 0,
  },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  iconWrap: { width: 34, height: 26, alignItems: "center", justifyContent: "center" },
  pill: { position: "absolute", width: 34, height: 26, borderRadius: 13 },
  label: { fontSize: 10, fontWeight: "600" },
});
