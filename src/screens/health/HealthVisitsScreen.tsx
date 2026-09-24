import React, { useState } from "react";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { Screen, BackHeader, EmptyState, ErrorBanner } from "@/components/Layout";
import { ListRow } from "@/components/ListRow";
import { DetailSheet, DetailRow } from "@/components/DetailSheet";
import { SecondaryButton } from "@/components/Buttons";
import { familyAccentFor, familyGadgetPaletteFor } from "@/theme/familyColors";
import { getMyRecords } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { MedicalRecord } from "@/api/types";
import { AppStackParamList } from "@/navigation/types";
import { Stethoscope } from "lucide-react-native";

export function HealthVisitsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "HealthVisits">>();
  const { patientAwpid, patientName, patientGender, patientDob } = route.params;
  const palette = patientGender ? familyGadgetPaletteFor({ gender: patientGender, date_of_birth: patientDob ?? null }) : null;
  const accent = patientGender ? familyAccentFor({ gender: patientGender, date_of_birth: patientDob ?? null }) : null;

  const [detail, setDetail] = useState<MedicalRecord | null>(null);

  const { data: visits = [], error, refetch, isFetching, isStale } = useQuery({
    queryKey: ["visits", patientAwpid],
    queryFn: () => getMyRecords(patientAwpid),
  });
  useRefreshOnFocus({ isStale, refetch });

  return (
    <Screen onRefresh={refetch} refreshing={isFetching}>
      <BackHeader title={`Visits — ${patientName}`} onBack={() => navigation.goBack()} tint={accent ? { bg: accent.bg, text: accent.text } : undefined} />
      {!!error && <ErrorBanner message={apiErrorMessage(error)} onRetry={refetch} />}

      {visits.length === 0 ? (
        <EmptyState text="No visits recorded yet." />
      ) : (
        visits.map((v, i) => (
          <ListRow key={i} icon={Stethoscope} iconColors={palette?.visits.icon} title={v.hospital} subtitle={`${v.doctor} · ${v.date}`} pillLabel={v.status} pillTone="neutral" onPress={() => setDetail(v)} />
        ))
      )}

      <DetailSheet visible={!!detail} onClose={() => setDetail(null)} title={detail?.hospital || ""}>
        {detail && (
          <>
            <DetailRow label="Doctor" value={detail.doctor} />
            <DetailRow label="Date" value={detail.date} />
            {!!detail.chief_complaint && <DetailRow label="Chief complaint" value={detail.chief_complaint} />}
            <DetailRow label="Status" value={detail.status} />
            {detail.signed && (
              <SecondaryButton
                label="View prescription"
                style={{ marginTop: 16 }}
                onPress={() => {
                  const v = detail;
                  setDetail(null);
                  navigation.navigate("PrescriptionDetail", { record: v });
                }}
              />
            )}
          </>
        )}
      </DetailSheet>
    </Screen>
  );
}
