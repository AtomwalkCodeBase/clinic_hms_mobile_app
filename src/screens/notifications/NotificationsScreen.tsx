import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen, BackHeader, EmptyState, ErrorBanner } from "@/components/Layout";
import { Card } from "@/components/Card";
import { Pill } from "@/components/Pill";
import { NEUTRAL } from "@/theme/themes";
import { getNotifications, markNotificationRead } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { NotificationItem } from "@/api/types";
import { AppStackParamList } from "@/navigation/types";

const TYPE_LABEL: Record<NotificationItem["type"], string> = {
  appointment_reminder: "Appointment",
  followup_reminder: "Follow-up",
  vaccination_due: "Vaccination due",
};

export function NotificationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getNotifications();
      setItems(res.results);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onMarkRead = async (item: NotificationItem) => {
    // Vaccination-due entries are computed live and have no backing row —
    // nothing to mark read (see PortalNotificationMarkReadView docstring).
    if (item.type === "vaccination_due") return;
    setMarkingId(item.id);
    try {
      await markNotificationRead(item.id);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <Screen onRefresh={load} refreshing={loading}>
      <BackHeader title="Reminders" onBack={() => navigation.goBack()} />
      {!!error && <ErrorBanner message={error} onRetry={load} />}
      {items.length === 0 && !loading ? (
        <EmptyState text="No reminders right now." />
      ) : (
        items.map((item) => (
          <Pressable key={item.id} onPress={() => onMarkRead(item)} disabled={item.read || markingId === item.id}>
            <Card style={!item.read ? styles.unreadCard : undefined}>
              <View style={styles.rowBetween}>
                <Pill label={TYPE_LABEL[item.type]} tone={item.type === "vaccination_due" ? "warning" : "neutral"} />
                {!item.read && <View style={styles.dot} />}
              </View>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.meta}>
                {item.hospital ? `${item.hospital} · ` : ""}
                {item.date}
              </Text>
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  unreadCard: { borderWidth: 1, borderColor: NEUTRAL.success },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: NEUTRAL.success },
  body: { fontSize: 12.5, color: NEUTRAL.textPrimary, marginTop: 8 },
  meta: { fontSize: 11, color: NEUTRAL.textMuted, marginTop: 6 },
});
