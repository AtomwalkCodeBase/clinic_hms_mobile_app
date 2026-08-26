import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Check } from "lucide-react-native";
import { Screen, BackHeader } from "@/components/Layout";
import { Card } from "@/components/Card";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { AppStackParamList } from "@/navigation/types";

export function ThemeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { theme, allThemes, setThemeKey } = useAppTheme();

  return (
    <Screen>
      <BackHeader title="Theme" onBack={() => navigation.goBack()} />
      <Card>
        {allThemes.map((t, i) => (
          <Pressable
            key={t.key}
            onPress={() => setThemeKey(t.key)}
            style={[styles.row, i < allThemes.length - 1 && styles.rowBorder]}
          >
            <View style={[styles.swatch, { backgroundColor: t.fill }]} />
            <Text style={styles.label}>{t.label}</Text>
            {t.key === theme.key && <Check size={18} color={theme.text} strokeWidth={2.4} />}
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 0.5, borderBottomColor: NEUTRAL.border },
  swatch: { width: 26, height: 26, borderRadius: 13 },
  label: { flex: 1, fontSize: 13, color: NEUTRAL.textPrimary },
});
