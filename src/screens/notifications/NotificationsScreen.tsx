import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
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
  const queryClient = useQueryClient();

  // Raw response kept as the cache shape (not just `.results`) — HomeScreen
  // reads `unread_count` off the same ["notifications"] key, so both need
  // to agree on what that key holds.
  const { data, error, refetch, isFetching, isStale } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotifications(),
  });
  useRefreshOnFocus({ isStale, refetch });
  const items = data?.results ?? [];

  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: (_res, id) => {
      queryClient.setQueryData<Awaited<ReturnType<typeof getNotifications>>>(["notifications"], (prev) =>
        prev ? { ...prev, results: prev.results.map((i) => (i.id === id ? { ...i, read: true } : i)) } : prev
      );
    },
  });

  const onMarkRead = (item: NotificationItem) => {
    // Vaccination-due entries are computed live and have no backing row —
    // nothing to mark read (see PortalNotificationMarkReadView docstring).
    if (item.type === "vaccination_due") return;
    markRead.mutate(item.id);
  };

  return (
    <Screen onRefresh={refetch} refreshing={isFetching}>
      <BackHeader title="Reminders" onBack={() => navigation.goBack()} />
      {!!error && <ErrorBanner message={apiErrorMessage(error)} onRetry={refetch} />}
      {items.length === 0 && !isFetching ? (
        <EmptyState text="No reminders right now." />
      ) : (
        items.map((item) => (
          <Pressable key={item.id} onPress={() => onMarkRead(item)} disabled={item.read || (markRead.isPending && markRead.variables === item.id)}>
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
