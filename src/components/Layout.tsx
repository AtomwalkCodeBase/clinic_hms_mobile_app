import React, { useEffect, useRef, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl, Animated, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { BackButton } from "@/components/IconButtons";
import { LinearGradient } from "expo-linear-gradient";
import { HEADER_GREEN, HEADER_GRADIENT, NEUTRAL, ON_BRAND } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { TopProgressBar } from "@/components/TopProgressBar";

export function Screen({
  children,
  scroll = true,
  onRefresh,
  refreshing,
  topColor = HEADER_GREEN,
  bottomInset = true,
  accentColor,
  backgroundLoading = false,
  footer,
  header,
  pinnedBelow,
  stickyHeaderIndices,
}: {
  children: React.ReactNode;
  /** A block pinned at the top while `children` scroll beneath it. Pull-to-refresh lives up here: pulling the pinned
   * block refreshes, the scrolling part below has no refresh. Without it the whole screen is one scrolling page. */
  header?: React.ReactNode;
  /** A strip kept fixed between the pinned `header` and the scrolling body, e.g. the "3 selected · Select all · Cancel"
   * bar while files are selected. It takes no part in pull-to-refresh and never scrolls. */
  pinnedBelow?: React.ReactNode;
  /** Which of `children` (as a flat array) stick to the top of the scrolling part while their group scrolls past,
   * like a month label above its list. Every child before the last index must be a direct, non-null child. */
  stickyHeaderIndices?: number[];
  /** A bar pinned below the scrolling content (e.g. "Move 3 to Ready to Submit"); it stays put while the list scrolls. */
  footer?: React.ReactNode;
  scroll?: boolean;
  onRefresh?: () => void;
  /** Only true while a MANUAL pull gesture is in flight — see
   * usePullToRefresh. Drives the native RefreshControl spinner alone;
   * a silent background refetch must never set this, or it shows the
   * exact same spinner over content the user never asked to reload. */
  refreshing?: boolean;
  /** The colour of the status-bar safe-area inset. Every screen has the same solid green (HEADER_GREEN) there, so the
   * status bar and a green header under it read as one piece. A screen whose hero is another colour (the Health tab's
   * family member) passes that colour so the two still meet. */
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
  const { height: windowHeight } = useWindowDimensions();
  const { theme } = useAppTheme();
  const tint = accentColor || theme.fill;
  // The top inset is the coloured strip below, so the safe area only has the bottom edge left to take care of.
  const edges: "bottom"[] = bottomInset ? ["bottom"] : [];
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
      SystemUI.setBackgroundColorAsync(topColor);
    }, [topColor])
  );

  const refreshControl = onRefresh ? (
    <RefreshControl
      refreshing={!!refreshing}
      onRefresh={onRefresh}
      colors={[tint]}
      tintColor={tint}
      progressBackgroundColor={NEUTRAL.surface}
    />
  ) : undefined;

  return (
    <View style={styles.safe}>
      <StatusBar style="dark" />
      {topColor === HEADER_GREEN ? (
        <LinearGradient colors={HEADER_GRADIENT} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ height: insets.top }} />
      ) : (
        <View style={{ height: insets.top, backgroundColor: topColor }} />
      )}
      <SafeAreaView style={styles.safeInner} edges={edges}>
        <Animated.View style={{ flex: 1, opacity: fade, transform: [{ translateY: rise }] }}>
          <TopProgressBar visible={backgroundLoading} color={tint} />
          {!!header && (
            // The pinned block is a ScrollView only so it can carry the pull-to-refresh; its content normally fits, and
            // when it is taller than 55% of the screen (a small phone) it scrolls inside itself so the body keeps room.
            <ScrollView
              style={[styles.pinned, { maxHeight: windowHeight * 0.55 }]}
              contentContainerStyle={styles.pinnedContent}
              refreshControl={refreshControl}
              alwaysBounceVertical
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {header}
            </ScrollView>
          )}
          {!!pinnedBelow && <View style={styles.pinnedBelow}>{pinnedBelow}</View>}
          <Body
            style={styles.body}
            stickyHeaderIndices={scroll ? stickyHeaderIndices : undefined}
            contentContainerStyle={scroll ? (header ? styles.scrollContentUnderHeader : styles.scrollContent) : undefined}
            refreshControl={header ? undefined : refreshControl}
            keyboardShouldPersistTaps={header ? "handled" : undefined}
          >
            {children}
          </Body>
          {footer}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

/**
 * The solid green band at the top of a page, straight under the green status bar - one piece with it. Put it as the
 * first thing in a Screen: the negative margins cancel the Screen's side padding so it runs edge to edge and flush with
 * the status bar. The page's title, back button and buttons go inside (dark on the mint).
 */
export function HeaderBand({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <View style={[styles.band, !!color && { backgroundColor: color }]}>
      {!color && <LinearGradient colors={HEADER_GRADIENT} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />}
      {children}
    </View>
  );
}

/** A page's header: the green band with a back arrow, the title in white, and optional buttons at the right end. */
export function BackHeader({
  title,
  onBack,
  right,
  color,
  onColor,
}: {
  title: string;
  onBack: () => void;
  /** Buttons at the right end of the header (an Upload pill, a "?"). White on the green: use light-on-dark styles. */
  right?: React.ReactNode;
  /** a family member's colour for the band, and the colour of the arrow and title on it; the app's green when left out */
  color?: string;
  onColor?: string;
}) {
  return (
    <HeaderBand color={color}>
      <BackButton onPress={onBack} color={onColor} />
      <Text style={[styles.bandTitle, !!onColor && { color: onColor }]} numberOfLines={1}>{title}</Text>
      {right ? <View style={styles.bandRight}>{right}</View> : null}
    </HeaderBand>
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
  scrollContent: { padding: 16, paddingHorizontal: 10, paddingBottom: 32 },
  pinned: { flexGrow: 0, flexShrink: 1 },
  pinnedBelow: { paddingHorizontal: 10, paddingTop: 4 },
  pinnedContent: { padding: 16, paddingHorizontal: 10, paddingBottom: 0 },
  scrollContentUnderHeader: { paddingHorizontal: 10, paddingTop: 4, paddingBottom: 32 },
  band: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: HEADER_GREEN,
    marginHorizontal: -10, marginTop: -16, marginBottom: 14, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 14,
  },
  bandTitle: { flex: 1, fontWeight: "700", fontSize: 17, color: ON_BRAND },
  bandRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 12, fontWeight: "600", color: NEUTRAL.textSecondary, marginTop: 14, marginBottom: 8 },
  empty: { padding: 24, alignItems: "center" },
  emptyText: { color: NEUTRAL.textMuted, fontSize: 13, textAlign: "center" },
  errorBox: { backgroundColor: NEUTRAL.dangerBg, borderRadius: 10, padding: 12, marginBottom: 12 },
  errorText: { color: NEUTRAL.danger, fontSize: 12.5, marginBottom: 6 },
  retry: { fontSize: 12.5, fontWeight: "600" },
});
