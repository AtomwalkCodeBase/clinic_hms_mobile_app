import React, { useEffect, useRef, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl, Animated } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { ArrowLeft } from "lucide-react-native";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { TopProgressBar } from "@/components/TopProgressBar";

export function Screen({
  children,
  scroll = true,
  onRefresh,
  refreshing,
  topColor,
  bottomInset = true,
  accentColor,
  backgroundLoading = false,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  onRefresh?: () => void;
  /** Only true while a MANUAL pull gesture is in flight — see
   * usePullToRefresh. Drives the native RefreshControl spinner alone;
   * a silent background refetch must never set this, or it shows the
   * exact same spinner over content the user never asked to reload. */
  refreshing?: boolean;
  /** Extends this color into the status-bar safe-area inset instead of the
   * default page background — for screens whose first element is a
   * MetalHero, so the hero's own color reaches all the way to the top of
   * the screen instead of showing a mismatched light strip above it. Pass
   * the hero gradient's own top-left stop (see MetalHero's METAL_STOPS). */
  topColor?: string;
  /** False for a screen that sits directly under AppTabs' bottom Tab.Navigator
   * (Home/Visits/Health/Profile) — its tabBarStyle already reserves the
   * bottom safe-area inset (height + paddingBottom, see AppTabs.tsx), and
   * the tab bar is NOT position:absolute, so React Navigation already sizes
   * the content area to stop exactly at the tab bar. Also reserving that
   * same inset here (the default, for every other screen — pushed via
   * Stack.Navigator, no tab bar below them) double-counts it: a gap of
   * this Screen's own plain background, exactly insets.bottom tall,
   * appears between the content and the tab bar. */
  bottomInset?: boolean;
  /** Tint for the pull-to-refresh spinner and the background-refresh pill —
   * defaults to the signed-in user's chosen accent theme. Pass a
   * dependent's family-accent color on a screen that's currently showing
   * their data instead of the account owner's own. */
  accentColor?: string;
  /** True while a query refetches in the background with data already on
   * screen (i.e. `isFetching` while NOT also the manual-pull case above) —
   * shows the small "Updating" pill instead of the native spinner, so a
   * routine refresh never covers or blanks real content. See
   * useRefreshOnFocus and TopProgressBar. */
  backgroundLoading?: boolean;
}) {
  const Body = scroll ? ScrollView : View;
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const tint = accentColor || theme.fill;
  const edges = (topColor ? ["bottom"] : ["top", "bottom"]).filter(
    (e) => bottomInset || e !== "bottom",
  ) as ("top" | "bottom")[];
  // Every screen used to pop in the instant its data resolved — fine on a
  // fast connection, but a visible "blank, then sudden content" flash on
  // any real network delay. A short fade+rise on mount doesn't remove the
  // delay, just stops it from reading as a jarring pop — applied once here
  // instead of per-screen since every screen goes through Screen.
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(8)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start();
  }, []);

  // The strip above the header on Android wasn't the status bar's own paint
  // (translucent/contentStyle changes on the navigator made no visible
  // difference) — it was the native Activity's window background, which
  // defaults to black and shows through in the sliver before/around
  // whatever the JS tree renders. Coloring that root window directly (not
  // just the RN view tree) is the fix; re-applied on every screen focus so
  // it always matches whichever screen is currently on top.
  useFocusEffect(
    useCallback(() => {
      SystemUI.setBackgroundColorAsync(topColor || NEUTRAL.bg);
    }, [topColor])
  );

  return (
    <View style={styles.safe}>
      <StatusBar style={topColor ? "light" : "dark"} />
      {!!topColor && <View style={{ height: insets.top, backgroundColor: topColor }} />}
      <SafeAreaView style={styles.safeInner} edges={edges}>
        <Animated.View style={{ flex: 1, opacity: fade, transform: [{ translateY: rise }] }}>
          <TopProgressBar visible={backgroundLoading} color={tint} />
          <Body
            style={styles.body}
            contentContainerStyle={scroll ? styles.scrollContent : undefined}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={!!refreshing}
                  onRefresh={onRefresh}
                  colors={[tint]}
                  tintColor={tint}
                  progressBackgroundColor={NEUTRAL.surface}
                />
              ) : undefined
            }
          >
            {children}
          </Body>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

export function BackHeader({
  title,
  onBack,
  tint,
}: {
  title: string;
  onBack: () => void;
  /** A dependent's family-accent colors (familyAccentFor), when this screen
   * is currently showing their data instead of the account owner's own —
   * so a detail screen reached from a colored family member card doesn't
   * suddenly go back to plain neutral gray, the one place in the header
   * chain that used to stay untinted regardless of who's selected. */
  tint?: { bg: string; text: string };
}) {
  return (
    <View style={styles.backRow}>
      <Pressable
        onPress={onBack}
        hitSlop={8}
        style={({ pressed }) => [styles.backBtn, tint && { backgroundColor: tint.bg }, pressed && styles.backBtnPressed]}
      >
        <ArrowLeft size={19} color={tint?.text ?? NEUTRAL.textPrimary} strokeWidth={2.3} />
      </Pressable>
      <Text style={[styles.backTitle, tint && { color: tint.text }]}>{title}</Text>
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry && (
        <Pressable onPress={onRetry}>
          <Text style={[styles.retry, { color: theme.text }]}>Retry</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: NEUTRAL.bg },
  safeInner: { flex: 1 },
  body: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16 },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: NEUTRAL.surfaceAlt,
  },
  backBtnPressed: { opacity: 0.7 },
  backTitle: { fontWeight: "600", fontSize: 15, color: NEUTRAL.textPrimary },
  sectionTitle: { fontSize: 12, fontWeight: "600", color: NEUTRAL.textSecondary, marginTop: 14, marginBottom: 8 },
  empty: { padding: 24, alignItems: "center" },
  emptyText: { color: NEUTRAL.textMuted, fontSize: 13, textAlign: "center" },
  errorBox: { backgroundColor: NEUTRAL.dangerBg, borderRadius: 10, padding: 12, marginBottom: 12 },
  errorText: { color: NEUTRAL.danger, fontSize: 12.5, marginBottom: 6 },
  retry: { fontSize: 12.5, fontWeight: "600" },
});
