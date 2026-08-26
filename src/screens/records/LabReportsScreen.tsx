import React, { useCallback, useState } from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { useFocusEffect, useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Upload } from "lucide-react-native";
import { Screen, BackHeader, ErrorBanner } from "@/components/Layout";
import { LabOrdersList } from "@/components/LabOrdersList";
import { useAppTheme } from "@/context/ThemeContext";
import { getLabOrders, chooseLabOrder } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { LabOrder } from "@/api/types";
import { AppStackParamList } from "@/navigation/types";

export function LabReportsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "LabReports">>();
  const patientAwpid = route.params?.patientAwpid;
  const patientName = route.params?.patientName;
  const { theme } = useAppTheme();
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setOrders(await getLabOrders(patientAwpid));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [patientAwpid]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onChoose = async (order: LabOrder, choice: "in_house" | "outside") => {
    setSavingId(order.id);
    try {
      await chooseLabOrder({ tenant_db: order.tenant_db, request_id: order.id, patient_choice: choice });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Screen onRefresh={load} refreshing={loading}>
      <BackHeader title={patientName ? `Lab reports — ${patientName}` : "Lab reports"} onBack={() => navigation.goBack()} />

      <Pressable
        onPress={() => navigation.navigate("Documents")}
        style={[styles.uploadPill, { backgroundColor: theme.bg }]}
      >
        <Upload size={15} color={theme.text} strokeWidth={2.3} />
        <Text style={[styles.uploadPillText, { color: theme.text }]}>Upload outside report</Text>
      </Pressable>

      {!!error && <ErrorBanner message={error} onRetry={load} />}
      <LabOrdersList
        orders={orders}
        expandedId={expandedId}
        onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
        onChoose={onChoose}
        savingId={savingId}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  uploadPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  uploadPillText: { fontSize: 12.5, fontWeight: "600" },
});
