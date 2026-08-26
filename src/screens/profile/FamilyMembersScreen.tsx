import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen, BackHeader, ErrorBanner } from "@/components/Layout";
import { Card } from "@/components/Card";
import { NEUTRAL } from "@/theme/themes";
import { RELATIONSHIP_OPTIONS } from "@/constants/options";
import { getFamily } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { FamilyMember } from "@/api/types";
import { AppStackParamList } from "@/navigation/types";

export function FamilyMembersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setFamily(await getFamily());
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

  return (
    <Screen onRefresh={load} refreshing={loading}>
      <View style={styles.headerRow}>
        <BackHeader title="Family members" onBack={() => navigation.goBack()} />
        <Pressable onPress={() => navigation.navigate("AddFamilyMember")} hitSlop={8}>
          <Text style={styles.addLink}>+ Add</Text>
        </Pressable>
      </View>

      {!!error && <ErrorBanner message={error} onRetry={load} />}

      {family.length === 0 ? (
        <Card>
          <Text style={styles.empty}>No family members added yet.</Text>
        </Card>
      ) : (
        family.map((f, i) => (
          <Card key={i}>
            <Text style={styles.name}>{f.full_name}</Text>
            <Text style={styles.meta}>
              {relationshipLabel(f.relationship) || "Family member"}
              {f.date_of_birth ? ` · Born ${f.date_of_birth}` : ""}
            </Text>
          </Card>
        ))
      )}
    </Screen>
  );
}

function relationshipLabel(value: string): string {
  return RELATIONSHIP_OPTIONS.find((o) => o.value === value)?.label || value;
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  addLink: { fontSize: 13, fontWeight: "600", color: NEUTRAL.textPrimary, marginRight: 16 },
  empty: { fontSize: 12, color: NEUTRAL.textMuted },
  name: { fontSize: 13, fontWeight: "600", color: NEUTRAL.textPrimary },
  meta: { fontSize: 11.5, color: NEUTRAL.textSecondary, marginTop: 3 },
});
