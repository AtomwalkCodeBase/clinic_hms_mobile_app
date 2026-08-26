import React, { useCallback, useState } from "react";
import { useFocusEffect, useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen, BackHeader, EmptyState, ErrorBanner } from "@/components/Layout";
import { ListRow } from "@/components/ListRow";
import { DetailSheet, DetailRow } from "@/components/DetailSheet";
import { getGrowth } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { GrowthPoint } from "@/api/types";
import { AppStackParamList } from "@/navigation/types";
import { TrendingUp } from "lucide-react-native";

export function GrowthScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "Growth">>();
  const { patientAwpid, patientName } = route.params;

  const [series, setSeries] = useState<GrowthPoint[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<GrowthPoint | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getGrowth(patientAwpid);
      // Most recent first — a growth history reads top-down like everything else in the app.
      setSeries([...res.series].reverse());
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

  return (
    <Screen onRefresh={load} refreshing={loading}>
      <BackHeader title={`Growth — ${patientName}`} onBack={() => navigation.goBack()} />
      {!!error && <ErrorBanner message={error} onRetry={load} />}

      {series.length === 0 ? (
        <EmptyState text="No height/weight measurements recorded yet." />
      ) : (
        series.map((p, i) => (
          <ListRow
            key={i}
            icon={TrendingUp}
            title={p.date}
            subtitle={[p.height_cm != null ? `${p.height_cm} cm` : null, p.weight_kg != null ? `${p.weight_kg} kg` : null].filter(Boolean).join(" · ") || "No measurement"}
            onPress={() => setDetail(p)}
          />
        ))
      )}

      <DetailSheet visible={!!detail} onClose={() => setDetail(null)} title={detail?.date || ""}>
        {detail && (
          <>
            <DetailRow label="Height" value={detail.height_cm != null ? `${detail.height_cm} cm` : "Not recorded"} />
            <DetailRow label="Weight" value={detail.weight_kg != null ? `${detail.weight_kg} kg` : "Not recorded"} />
          </>
        )}
      </DetailSheet>
    </Screen>
  );
}
