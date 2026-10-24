import { useState } from "react";
import { Text, StyleSheet } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Screen, BackHeader, ErrorBanner } from "@/components/Layout";
import { TextField } from "@/components/TextField";
import { DateField } from "@/components/DateField";
import { FooterAction } from "@/components/FooterAction";
import { usePeople } from "@/hooks/usePeople";
import { NEUTRAL } from "@/theme/themes";
import { addVaccine } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { AppStackParamList } from "@/navigation/types";

/**
 * A parent adds a vaccine from the card: the name as written on it and the day it was given. A page of its own (fields
 * at the top, Save at the bottom) so the keyboard never covers what is being typed. The server checks the name against
 * the schedule and says so when it does not match.
 */
export function AddVaccineScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "AddVaccine">>();
  const { patientAwpid, patientName } = route.params;
  const queryClient = useQueryClient();
  const { people } = usePeople();
  const awpid = patientAwpid ?? people.find((p) => p.isSelf)?.awpid;

  const [vaccine, setVaccine] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: () => addVaccine(awpid!, { vaccine_text: vaccine.trim(), given_on: date }),
    onSuccess: () => {
      // the Vaccines tab, the timeline and the count on the Health tab all read these keys
      queryClient.invalidateQueries({ queryKey: ["immunization", awpid] });
      queryClient.invalidateQueries({ queryKey: ["healthTimeline", awpid] });
      navigation.goBack();
    },
    onError: (err) => {
      const fields = (err as { response?: { data?: { errors?: Record<string, string[]> } } }).response?.data?.errors;
      setError(fields?.vaccine_text?.[0] ?? fields?.given_on?.[0] ?? apiErrorMessage(err, "Couldn't save this vaccine."));
    },
  });

  const onSave = () => {
    if (!awpid) return;
    if (!vaccine.trim()) return setError("Enter the vaccine name as written on the card.");
    if (!date) return setError("Enter the date it was given.");
    setError("");
    save.mutate();
  };

  return (
    <Screen footer={<FooterAction label="Save vaccine" onPress={onSave} loading={save.isPending} />}>
      <BackHeader title="Add a vaccine" onBack={() => navigation.goBack()} />
      <Text style={styles.hint}>
        Add a vaccine {patientName} has had, the way it is written on the card. A clinic confirms it later; until then it shows in the list.
      </Text>
      {!!error && <ErrorBanner message={error} />}
      <TextField label="Vaccine, as written on the card" placeholder="e.g. Hexaxim 2" value={vaccine} onChangeText={(t) => { setVaccine(t); setError(""); }} />
      <DateField label="Date given" value={date} onChange={(d) => { setDate(d); setError(""); }} maximumDate={new Date()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12.5, color: NEUTRAL.textSecondary, marginBottom: 18, lineHeight: 18 },
});
