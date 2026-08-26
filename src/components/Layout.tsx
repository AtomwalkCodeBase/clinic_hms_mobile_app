import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";

export function Screen({
  children,
  scroll = true,
  onRefresh,
  refreshing,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const Body = scroll ? ScrollView : View;
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

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <Animated.View style={{ flex: 1, opacity: fade, transform: [{ translateY: rise }] }}>
        <Body
          style={styles.body}
          contentContainerStyle={scroll ? styles.scrollContent : undefined}
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
        >
          {children}
        </Body>
      </Animated.View>
    </SafeAreaView>
  );
}

export function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.backRow}>
      <Pressable onPress={onBack} hitSlop={8} style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}>
        <ArrowLeft size={19} color={NEUTRAL.textPrimary} strokeWidth={2.3} />
      </Pressable>
      <Text style={styles.backTitle}>{title}</Text>
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
