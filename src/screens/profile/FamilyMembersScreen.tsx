import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen, BackHeader, ErrorBanner } from "@/components/Layout";
import { Card } from "@/components/Card";
import { SecondaryButton } from "@/components/Buttons";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NEUTRAL } from "@/theme/themes";
import { RELATIONSHIP_OPTIONS } from "@/constants/options";
import { getFamily, removeFamilyMember } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { FamilyMember } from "@/api/types";
import { AppStackParamList } from "@/navigation/types";

export function FamilyMembersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<FamilyMember | null>(null);
  const [removingAwpid, setRemovingAwpid] = useState<string | null>(null);

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

  const confirmRemove = async () => {
    if (!removeTarget) return;
    const target = removeTarget;
    setRemovingAwpid(target.awpid);
    setError("");
    try {
      await removeFamilyMember(target.awpid);
      setRemoveTarget(null);
      await load();
    } catch (err) {
      setRemoveTarget(null);
      setError(apiErrorMessage(err, "Couldn't remove this family member."));
    } finally {
      setRemovingAwpid(null);
    }
  };

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
        family.map((f) => (
          <Card key={f.awpid}>
            <Text style={styles.name}>{f.full_name}</Text>
            <Text style={styles.meta}>
              {relationshipLabel(f.relationship) || "Family member"}
              {f.date_of_birth ? ` · Born ${f.date_of_birth}` : ""}
            </Text>
            <View style={styles.actionsRow}>
              <SecondaryButton
                label="Edit"
                compact
                onPress={() => navigation.navigate("AddFamilyMember", { member: f })}
              />
              <SecondaryButton
                label="Remove"
                danger
                compact
                loading={removingAwpid === f.awpid}
                onPress={() => setRemoveTarget(f)}
              />
            </View>
          </Card>
        ))
      )}

      <ConfirmDialog
        visible={!!removeTarget}
        danger
        title="Remove family member?"
        message={
          removeTarget
            ? `${removeTarget.full_name} will be unlinked from your account. Past appointments and records stay intact — you just won't be able to book for them until you add them again.`
            : undefined
        }
        confirmLabel="Remove"
        cancelLabel="Keep"
        loading={!!removeTarget && removingAwpid === removeTarget.awpid}
        onConfirm={confirmRemove}
        onCancel={() => setRemoveTarget(null)}
      />
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
  actionsRow: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 10 },
});
