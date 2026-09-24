import React, { useState } from "react";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { Screen, BackHeader, EmptyState, ErrorBanner } from "@/components/Layout";
import { ListRow } from "@/components/ListRow";
import { DetailSheet, DetailRow } from "@/components/DetailSheet";
import { familyAccentFor, familyGadgetPaletteFor } from "@/theme/familyColors";
import { getGrowth } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { GrowthPoint } from "@/api/types";
import { AppStackParamList } from "@/navigation/types";
import { TrendingUp } from "lucide-react-native";

export function GrowthScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "Growth">>();
  const { patientAwpid, patientName, patientGender, patientDob } = route.params;
  // Growth isn't one of the 4 primary gadget cards — it's reached from
  // Health timeline, so it borrows that palette entry rather than needing
  // its own anchor color.
  const palette = patientGender ? familyGadgetPaletteFor({ gender: patientGender, date_of_birth: patientDob ?? null }) : null;
  const accent = patientGender ? familyAccentFor({ gender: patientGender, date_of_birth: patientDob ?? null }) : null;

  const [detail, setDetail] = useState<GrowthPoint | null>(null);

  // Most recent first — a growth history reads top-down like everything else in the app.
  const { data: series = [], error, refetch, isFetching, isStale } = useQuery({
    queryKey: ["growth", patientAwpid],
    queryFn: async () => {
      const res = await getGrowth(patientAwpid);
      return [...res.series].reverse();
    },
  });
  useRefreshOnFocus({ isStale, refetch });

  return (
    <Screen onRefresh={refetch} refreshing={isFetching}>
      <BackHeader title={`Growth — ${patientName}`} onBack={() => navigation.goBack()} tint={accent ? { bg: accent.bg, text: accent.text } : undefined} />
      {!!error && <ErrorBanner message={apiErrorMessage(error)} onRetry={refetch} />}

      {series.length === 0 ? (
        <EmptyState text="No height/weight measurements recorded yet." />
      ) : (
        series.map((p, i) => (
          <ListRow
            key={i}
            icon={TrendingUp}
            iconColors={palette?.timeline.icon}
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
