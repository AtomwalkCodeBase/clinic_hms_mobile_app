import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { SkeletonBlock, SkeletonGadgetCard } from "@/components/Skeleton";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CompositeNavigationProp } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { CalendarDays, ClipboardList, FileText, QrCode, Bell, ChevronRight, Upload } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Screen, ErrorBanner } from "@/components/Layout";
import { Card } from "@/components/Card";
import { Pill, statusTone } from "@/components/Pill";
import { LogoPill } from "@/components/Logo";
import { MetalHero } from "@/components/MetalHero";
import { IconBadge } from "@/components/IconBadge";
import { GadgetCard } from "@/components/GadgetCard";
import type { LucideIcon } from "@/theme/icons";
import { getSpecialtyStyle } from "@/theme/specialtyStyle";
import { NEUTRAL } from "@/theme/themes";
import { getStats, getMyBookings, getNotifications, getProfile, getDocumentCounts } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { AppStackParamList } from "@/navigation/types";
import { AppTabsParamList } from "@/navigation/types";
import { useExitOnDoubleBack } from "@/utils/useExitOnDoubleBack";
import { CARD_ICON, CARD_TEXT } from "@/theme/cardSizes";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<AppTabsParamList, "Home">,
  NativeStackNavigationProp<AppStackParamList>
>;

// "Book visit" used to live here as a tile among five — pulled out into its
// own promoted CTA band (see bookCta below) since booking is the app's
// actual primary task, not one option equally weighted against the rest.
// That also fixes the 5-tiles-in-a-2-column-grid problem (an odd count
// always leaves one tile orphaned on its own row).
// "Health journey" used to live here too, but it just redirected straight
// into the Health tab — already one tap away on the bottom nav, so the tile
// was a dead extra step, not a shortcut to anything the grid itself
// couldn't reach. Freed up for a visitor-management tile a teammate is
// building.
const QUICK_ACTIONS: { key: string; label: string; sub: string; icon: LucideIcon }[] = [
  { key: "appointments", label: "Appointments", sub: "Upcoming and past visits", icon: ClipboardList },
  { key: "records", label: "My Documents", sub: "Prescriptions, lab reports and more", icon: FileText },
  { key: "shareRecords", label: "Share Records", sub: "Let any doctor view your records", icon: QrCode },
  { key: "documentUpload", label: "Bulk Upload", sub: "Add many files at once", icon: Upload },
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
  // Recomputed every minute so "Good morning"/the date roll over on their
  // own while the app is sitting open, not just on the next full reload.
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // 4 independent queries instead of one merged load() — each gets its own
  // cache entry, so e.g. ["profile"] here is the exact same cache entry
  // ProfileScreen/HealthScreen read, and a soft-failing one (notifications,
  // profile — same .catch(() => null) as before) doesn't block the others.
  const statsQ = useQuery({ queryKey: ["stats"], queryFn: getStats });
  const bookingsQ = useQuery({ queryKey: ["bookings", 1], queryFn: () => getMyBookings() });
  const notifsQ = useQuery({ queryKey: ["notifications"], queryFn: () => getNotifications().catch(() => null) });
  const profileQ = useQuery({ queryKey: ["profile"], queryFn: () => getProfile().catch(() => null) });
  // Same cache entry My Documents reads for the signed-in patient; here only for the "to review" badge.
  const docCountsQ = useQuery({ queryKey: ["documentCounts", undefined], queryFn: () => getDocumentCounts().catch(() => null) });

  const refetchAll = useCallback(async () => {
    await Promise.all([statsQ.refetch(), bookingsQ.refetch(), notifsQ.refetch(), profileQ.refetch(), docCountsQ.refetch()]);
  }, [statsQ.refetch, bookingsQ.refetch, notifsQ.refetch, profileQ.refetch, docCountsQ.refetch]);
  useRefreshOnFocus([statsQ, bookingsQ, notifsQ, profileQ, docCountsQ]);
  const { refreshing: pulling, onRefresh: pullRefresh } = usePullToRefresh(refetchAll);

  const stats = statsQ.data ?? null;
  const upcoming = (bookingsQ.data?.results ?? []).filter((b) => ["scheduled", "waiting", "vitals_done", "in_progress"].includes(b.status));
  const unreadCount = notifsQ.data?.unread_count ?? 0;
  const awaitingReview = docCountsQ.data?.awaiting_review ?? 0;
  const firstName = profileQ.data?.full_name?.split(" ")[0] || "";
  const error = statsQ.error || bookingsQ.error;
  const isInitialLoading = !statsQ.data && !bookingsQ.data;
  const isFetchingAny = statsQ.isFetching || bookingsQ.isFetching || notifsQ.isFetching || profileQ.isFetching;

  const onQuickAction = (key: string) => {
    if (key === "appointments") navigation.navigate("Tabs" as any, { screen: "Appointments" } as any);
    else if (key === "records") navigation.navigate("MyDocuments");
    else if (key === "shareRecords") navigation.navigate("ShareRecords");
    else if (key === "documentUpload") navigation.navigate("DocumentUpload");
  };
  const onBookVisit = () => navigation.navigate("BookingFor", undefined);

  const nextUp = upcoming[0];
  // "Your bookings" used to show the next 2 upcoming appointments regardless
  // of date, which could be a week out — narrowed to just today's, since
  // that's the useful "what's on for me right now" view on the dashboard.
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayBookings = upcoming.filter((b) => b.date === todayIso);

  if (isInitialLoading) {
    return (
      <Screen topColor="#249c57" bottomInset={false}>
        <View style={[styles.hero, { padding: 20, height: 150, backgroundColor: "#1f7a4d", borderRadius: 24 }]}>
          <View style={styles.heroTop}>
            <LogoPill size={40} />
          </View>
          <SkeletonBlock width={170} height={18} style={{ marginTop: 14, backgroundColor: "rgba(255,255,255,0.25)" }} />
          <SkeletonBlock width={130} height={11} style={{ marginTop: 8, backgroundColor: "rgba(255,255,255,0.25)" }} />
        </View>
        <SkeletonBlock height={62} radius={14} style={{ marginBottom: 12 }} />
        <SkeletonBlock height={70} radius={18} style={{ marginBottom: 18 }} />
        <Text style={styles.sectionTitle}>Quick access</Text>
        <View style={styles.grid}>
          <SkeletonGadgetCard style={styles.qa} />
          <SkeletonGadgetCard style={styles.qa} />
          <SkeletonGadgetCard style={styles.qa} />
          <SkeletonGadgetCard style={styles.qa} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      onRefresh={pullRefresh}
      refreshing={pulling}
      backgroundLoading={isFetchingAny && !pulling}
      topColor="#249c57"
      bottomInset={false}
    >
      <MetalHero compact curved underStatusBar style={styles.hero}>
        <View style={styles.heroTop}>
          <LogoPill size={40} />
          <View style={styles.heroActions}>
            <Pressable onPress={() => navigation.navigate("Notifications")} hitSlop={10} style={styles.bellBtn}>
              <Bell size={18} color="#FFFFFF" strokeWidth={2.2} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                </View>
              )}
            </Pressable>
          </View>
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

      {!!error && <ErrorBanner message={apiErrorMessage(error, "Couldn't load your dashboard.")} onRetry={refetchAll} />}

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

      <Text style={styles.sectionTitle}>Quick access</Text>
      <View style={styles.grid}>
        {QUICK_ACTIONS.map((qa) => (
          <GadgetCard
            key={qa.key}
            icon={qa.icon}
            title={qa.label}
            subtitle={qa.sub}
            badge={qa.key === "documentUpload" && awaitingReview > 0 ? `${awaitingReview} to review` : undefined}
            iconSize={CARD_ICON}
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
  heroActions: { flexDirection: "row", alignItems: "center", gap: 10 },
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
  remTitle: { fontSize: CARD_TEXT.title, fontWeight: "600", color: NEUTRAL.textPrimary },
  remSub: { fontSize: CARD_TEXT.meta, color: NEUTRAL.textSecondary, marginTop: 3 },
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
  bookTitle: { fontWeight: "700", fontSize: CARD_TEXT.title + 1, color: "#FFFFFF" },
  bookSub: { fontSize: CARD_TEXT.meta, color: "rgba(255,255,255,0.82)", marginTop: 2 },
  bookArrow: { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  remChev: { fontSize: 18, color: NEUTRAL.textMuted },
  sectionTitle: { fontSize: 12, fontWeight: "600", color: NEUTRAL.textSecondary, marginBottom: 8, marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 4 },
  qa: { width: "47%" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hospitalName: { fontSize: CARD_TEXT.title, fontWeight: "600", color: NEUTRAL.textPrimary },
  doctorLine: { fontSize: CARD_TEXT.meta, color: NEUTRAL.textSecondary, marginTop: 4 },
  emptyText: { fontSize: CARD_TEXT.body, color: NEUTRAL.textMuted },
  bookingCard: { borderWidth: 1 },
  bookingLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, marginRight: 8 },
  bookingIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  reasonLine: { fontSize: CARD_TEXT.meta, fontWeight: "600", marginTop: 8 },
});
