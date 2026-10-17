import { useState } from "react";
import { Text, StyleSheet } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Screen, BackHeader, ErrorBanner } from "@/components/Layout";
import { TextField } from "@/components/TextField";
import { DateField } from "@/components/DateField";
import { PrimaryButton } from "@/components/Buttons";
import { usePeople } from "@/hooks/usePeople";
import { NEUTRAL } from "@/theme/themes";
import { addVaccine } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { AppStackParamList } from "@/navigation/types";

/** A parent adds a vaccine from the card: the name as written on it and the day it was given. */
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
      // the Vaccinations list and the count on the Health tab read this key
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
    if (!vaccine.trim()) return setError("Enter the vaccine name.");
    if (!date) return setError("Enter the date it was given.");
    setError("");
    save.mutate();
  };

  return (
    <Screen>
      <BackHeader title="Add a vaccine" onBack={() => navigation.goBack()} />
      <Text style={styles.hint}>
        Add a vaccine {patientName} has had, the way it is written on the card. A clinic confirms it later; until then it shows in the list.
      </Text>
      {!!error && <ErrorBanner message={error} />}
      <TextField label="Vaccine, as written on the card" placeholder="e.g. Hexaxim 2" value={vaccine} onChangeText={setVaccine} />
      <DateField label="Date given" value={date} onChange={setDate} maximumDate={new Date()} />
      <PrimaryButton label="Save vaccine" onPress={onSave} loading={save.isPending} style={{ marginTop: 16 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12.5, color: NEUTRAL.textSecondary, marginBottom: 18, lineHeight: 18 },
});
