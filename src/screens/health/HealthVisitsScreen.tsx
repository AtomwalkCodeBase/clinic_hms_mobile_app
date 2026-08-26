import React, { useCallback, useState } from "react";
import { useFocusEffect, useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen, BackHeader, EmptyState, ErrorBanner } from "@/components/Layout";
import { ListRow } from "@/components/ListRow";
import { DetailSheet, DetailRow } from "@/components/DetailSheet";
import { SecondaryButton } from "@/components/Buttons";
import { getMyRecords } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { MedicalRecord } from "@/api/types";
import { AppStackParamList } from "@/navigation/types";
import { Stethoscope } from "lucide-react-native";

export function HealthVisitsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "HealthVisits">>();
  const { patientAwpid, patientName } = route.params;

  const [visits, setVisits] = useState<MedicalRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<MedicalRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setVisits(await getMyRecords(patientAwpid));
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
      <BackHeader title={`Visits — ${patientName}`} onBack={() => navigation.goBack()} />
      {!!error && <ErrorBanner message={error} onRetry={load} />}

      {visits.length === 0 ? (
        <EmptyState text="No visits recorded yet." />
      ) : (
        visits.map((v, i) => (
          <ListRow key={i} icon={Stethoscope} title={v.hospital} subtitle={`${v.doctor} · ${v.date}`} pillLabel={v.status} pillTone="neutral" onPress={() => setDetail(v)} />
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
