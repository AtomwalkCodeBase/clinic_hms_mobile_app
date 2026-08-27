import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CompositeNavigationProp } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { CalendarDays, ClipboardList, HeartPulse, Pill as PillIcon, FlaskConical, Bell, ChevronRight, Users, X } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Screen, ErrorBanner } from "@/components/Layout";
import { Card } from "@/components/Card";
import { Pill, statusTone } from "@/components/Pill";
import { LogoPill } from "@/components/Logo";
import { MetalHero } from "@/components/MetalHero";
import { IconBadge } from "@/components/IconBadge";
import { GadgetCard, DASHBOARD_TINTS, GadgetTint } from "@/components/GadgetCard";
import type { LucideIcon } from "@/theme/icons";
import { getSpecialtyStyle } from "@/theme/specialtyStyle";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { getStats, getMyBookings, getNotifications, getProfile } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { Booking } from "@/api/types";
import { AppStackParamList } from "@/navigation/types";
import { AppTabsParamList } from "@/navigation/types";
import { useExitOnDoubleBack } from "@/utils/useExitOnDoubleBack";
import { getHomeChecklistDismissed, setHomeChecklistDismissed } from "@/utils/storage";

const GET_STARTED_ITEMS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "book", label: "Book your first appointment", icon: CalendarDays },
  { key: "family", label: "Add a family member", icon: Users },
  { key: "health", label: "Complete your health profile", icon: HeartPulse },
];

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<AppTabsParamList, "Home">,
  NativeStackNavigationProp<AppStackParamList>
>;

// "Book visit" used to live here as a tile among five — pulled out into its
// own promoted CTA band (see bookCta below) since booking is the app's
// actual primary task, not one option equally weighted against the rest.
// That also fixes the 5-tiles-in-a-2-column-grid problem (an odd count
// always leaves one tile orphaned on its own row).
const QUICK_ACTIONS: { key: string; label: string; sub: string; icon: LucideIcon; tint: GadgetTint }[] = [
  { key: "appointments", label: "Appointments", sub: "Upcoming and past visits", icon: ClipboardList, tint: DASHBOARD_TINTS.teal },
  { key: "health", label: "Health journey", sub: "Vaccines, visits, and more", icon: HeartPulse, tint: DASHBOARD_TINTS.rose },
  { key: "prescriptions", label: "Prescriptions", sub: "From your past visits", icon: PillIcon, tint: DASHBOARD_TINTS.slate },
  { key: "labs", label: "Lab reports", sub: "Tests, results, and reports", icon: FlaskConical, tint: DASHBOARD_TINTS.gold },
];

function greetingForHour(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

export function HomeScreen() {
  useExitOnDoubleBack();
  const navigation = useNavigation<Nav>();
  const { theme } = useAppTheme();
  const [stats, setStats] = useState<{ hospitals: number; doctors: number } | null>(null);
  const [upcoming, setUpcoming] = useState<Booking[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [checklistDismissed, setChecklistDismissed] = useState(true);
  // Recomputed every minute so "Good morning"/the date roll over on their
  // own while the app is sitting open, not just on the next full reload.
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [s, bookingsPage, notifs, profile] = await Promise.all([
        getStats(),
        getMyBookings(),
        getNotifications().catch(() => null),
        getProfile().catch(() => null),
      ]);
      setStats(s);
      setUpcoming(bookingsPage.results.filter((b) => ["scheduled", "waiting", "vitals_done", "in_progress"].includes(b.status)));
      setUnreadCount(notifs?.unread_count ?? 0);
      setFirstName(profile?.full_name?.split(" ")[0] || "");
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't load your dashboard."));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      getHomeChecklistDismissed().then(setChecklistDismissed);
    }, [load])
  );

  const onQuickAction = (key: string) => {
    if (key === "appointments") navigation.navigate("Tabs" as any, { screen: "Appointments" } as any);
    else if (key === "health") navigation.navigate("Tabs" as any, { screen: "Health" } as any);
    else if (key === "prescriptions") navigation.navigate("Prescriptions");
    else if (key === "labs") navigation.navigate("LabReports");
  };
  const onBookVisit = () => navigation.navigate("BookingFor", undefined);

  const onDismissChecklist = () => {
    setChecklistDismissed(true);
    setHomeChecklistDismissed();
  };
  const onChecklistItem = (key: string) => {
    if (key === "book") onBookVisit();
    else if (key === "family") navigation.navigate("FamilyMembers");
    else if (key === "health") navigation.navigate("HealthSummary");
  };

  const nextUp = upcoming[0];
  // "Your bookings" used to show the next 2 upcoming appointments regardless
  // of date, which could be a week out — narrowed to just today's, since
  // that's the useful "what's on for me right now" view on the dashboard.
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayBookings = upcoming.filter((b) => b.date === todayIso);

  return (
    <Screen onRefresh={load} refreshing={loading} topColor="#249c57">
      <MetalHero compact curved style={styles.hero}>
        <View style={styles.heroTop}>
          <LogoPill size={40} />
          <Pressable onPress={() => navigation.navigate("Notifications")} hitSlop={10} style={styles.bellBtn}>
            <Bell size={18} color="#FFFFFF" strokeWidth={2.2} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
        <Text style={styles.greeting}>
          {greetingForHour(now.getHours())}
          {firstName ? `, ${firstName}` : ""}
        </Text>
        <Text style={styles.greetingDate}>{now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</Text>
        <Text style={styles.greetingSub}>
          {stats ? `${stats.hospitals} hospital${stats.hospitals === 1 ? "" : "s"} · ${stats.doctors}+ doctors on the platform` : "Here's your health at a glance"}
        </Text>
      </MetalHero>

      {!!error && <ErrorBanner message={error} onRetry={load} />}

      <Pressable
        onPress={() => navigation.navigate("Tabs" as any, { screen: "Appointments" } as any)}
        style={styles.reminderCard}
      >
        <IconBadge icon={Bell} size={32} />
        <View style={{ flex: 1 }}>
          {nextUp ? (
            <>
              <Text style={styles.remTitle}>
                {upcoming.length} upcoming appointment{upcoming.length === 1 ? "" : "s"}
              </Text>
              <Text style={styles.remSub}>
                {nextUp.doctor} · {nextUp.hospital} · {nextUp.date}
                {nextUp.time ? `, ${nextUp.time}` : ""}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.remTitle}>No upcoming appointments</Text>
              <Text style={styles.remSub}>Tap Book an appointment below to see a doctor</Text>
            </>
          )}
        </View>
        <Text style={styles.remChev}>›</Text>
      </Pressable>

      {/* Promoted out of the quick-access grid — booking is what this app
          is actually for, not one tile among several. */}
      <Pressable onPress={onBookVisit} style={({ pressed }) => [styles.bookCta, pressed && { opacity: 0.92 }]}>
        <LinearGradient
          colors={["#249c57", "#15803D", "#0f5c2e"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.bookGlow} pointerEvents="none" />
        <View style={styles.bookIcon}>
          <CalendarDays size={22} color="#FFFFFF" strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bookTitle}>Book an appointment</Text>
          <Text style={styles.bookSub}>Find a doctor and a slot</Text>
        </View>
        <View style={styles.bookArrow}>
          <ChevronRight size={16} color="#FFFFFF" strokeWidth={2.4} />
        </View>
      </Pressable>

      {!checklistDismissed && !loading && upcoming.length === 0 && (
        <Card style={styles.checklistCard}>
          <View style={styles.checklistHeader}>
            <Text style={styles.checklistTitle}>Get started</Text>
            <Pressable onPress={onDismissChecklist} hitSlop={8}>
              <X size={15} color={NEUTRAL.textMuted} strokeWidth={2.2} />
            </Pressable>
          </View>
          {GET_STARTED_ITEMS.map((item, i) => {
            const Icon = item.icon;
            return (
              <Pressable
                key={item.key}
                onPress={() => onChecklistItem(item.key)}
                style={[styles.checklistItem, i > 0 && styles.checklistItemBorder]}
              >
                <View style={[styles.checklistDot, { backgroundColor: theme.bg }]}>
                  <Icon size={13} color={theme.text} strokeWidth={2.2} />
                </View>
                <Text style={styles.checklistText}>{item.label}</Text>
                <ChevronRight size={15} color={NEUTRAL.textMuted} strokeWidth={2.2} />
              </Pressable>
            );
          })}
        </Card>
      )}

      <Text style={styles.sectionTitle}>Quick access</Text>
      <View style={styles.grid}>
        {QUICK_ACTIONS.map((qa) => (
          <GadgetCard
            key={qa.key}
            icon={qa.icon}
            title={qa.label}
            subtitle={qa.sub}
            tint={qa.tint}
            iconSize={34}
            radius={22}
            cardPadding={16}
            onPress={() => onQuickAction(qa.key)}
            style={styles.qa}
          />
        ))}
      </View>

      <Text style={styles.sectionTitle}>Today's bookings</Text>
      {todayBookings.length === 0 ? (
        <Card>
          <Text style={styles.emptyText}>
            {upcoming.length === 0 ? "No upcoming appointments yet." : "Nothing on for today."}
          </Text>
        </Card>
      ) : (
        todayBookings.map((b) => {
          // Colored by what the visit is for (the reason given at booking),
          // not by hospital/status — so a parent glancing at the dashboard
          // can tell "vaccination visit" from "fever follow-up" by color
          // alone, the same way the specialty icons on Find Doctors do.
          const st = getSpecialtyStyle(b.chief_complaint || b.doctor);
          const Icon = st.icon;
          return (
            <Card key={b.id} style={{ ...styles.bookingCard, borderColor: st.fg, backgroundColor: st.bg }}>
              <View style={styles.rowBetween}>
                <View style={styles.bookingLeft}>
                  <View style={[styles.bookingIcon, { backgroundColor: "#FFFFFF" }]}>
                    <Icon size={16} color={st.fg} strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hospitalName}>{b.hospital}</Text>
                    <Text style={styles.doctorLine}>
                      {b.doctor}
                      {b.time ? ` · ${b.time}` : ""}
                    </Text>
                  </View>
                </View>
                <Pill label={b.status} tone={statusTone(b.status)} />
              </View>
              {!!b.chief_complaint && (
                <Text style={[styles.reasonLine, { color: st.fg }]} numberOfLines={1}>
                  {b.chief_complaint}
                </Text>
              )}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: 16 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  bellBtn: { position: "relative", padding: 4 },
  badge: { position: "absolute", top: -2, right: -2, minWidth: 15, height: 15, borderRadius: 8, backgroundColor: "#B23A3A", alignItems: "center", justifyContent: "center", paddingHorizontal: 2 },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  greeting: { fontSize: 16, fontWeight: "600", color: "#FFFFFF", marginTop: 12 },
  greetingDate: { fontSize: 11, color: "#EAF3DE", marginTop: 2, opacity: 0.9 },
  greetingSub: { fontSize: 11.5, color: "#EAF3DE", marginTop: 6 },
  reminderCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: NEUTRAL.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    shadowColor: "#0a4020",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 3,
  },
  remTitle: { fontSize: 12.5, fontWeight: "600", color: NEUTRAL.textPrimary },
  remSub: { fontSize: 11, color: NEUTRAL.textSecondary, marginTop: 3 },
  bookCta: {
    position: "relative",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    padding: 14,
    marginBottom: 18,
    shadowColor: "#0f5c2e",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  bookGlow: { position: "absolute", top: -30, right: -30, width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.14)" },
  bookIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  bookTitle: { fontWeight: "700", fontSize: 14.5, color: "#FFFFFF" },
  bookSub: { fontSize: 11, color: "rgba(255,255,255,0.82)", marginTop: 2 },
  bookArrow: { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  remChev: { fontSize: 18, color: NEUTRAL.textMuted },
  checklistCard: { marginBottom: 16 },
  checklistHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  checklistTitle: { fontSize: 11, fontWeight: "700", color: NEUTRAL.textSecondary, textTransform: "uppercase", letterSpacing: 0.3 },
  checklistItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  checklistItemBorder: { borderTopWidth: 0.5, borderTopColor: NEUTRAL.border },
  checklistDot: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  checklistText: { flex: 1, fontSize: 12.5, fontWeight: "600", color: NEUTRAL.textPrimary },
  sectionTitle: { fontSize: 12, fontWeight: "600", color: NEUTRAL.textSecondary, marginBottom: 8, marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 4 },
  qa: { width: "47%" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hospitalName: { fontSize: 13, fontWeight: "600", color: NEUTRAL.textPrimary },
  doctorLine: { fontSize: 11.5, color: NEUTRAL.textSecondary, marginTop: 4 },
  emptyText: { fontSize: 12.5, color: NEUTRAL.textMuted },
  bookingCard: { borderWidth: 1 },
  bookingLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, marginRight: 8 },
  bookingIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  reasonLine: { fontSize: 11, fontWeight: "600", marginTop: 8 },
});
