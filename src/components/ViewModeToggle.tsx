import { View, Pressable, StyleSheet } from "react-native";
import { LayoutGrid, List } from "lucide-react-native";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { useViewMode } from "@/context/ViewModeContext";

/** The list / grid switch, shown next to the type chips on every screen with a file list. */
export function ViewModeToggle() {
  const { theme } = useAppTheme();
  const { mode, setMode } = useViewMode();
  const item = (m: "list" | "grid", Icon: typeof List, label: string) => {
    const on = mode === m;
    return (
      <Pressable
        onPress={() => setMode(m)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: on }}
        style={[styles.btn, on && styles.on]}
      >
        <Icon size={17} color={on ? theme.fill : NEUTRAL.textSecondary} strokeWidth={2.2} />
      </Pressable>
    );
  };
  return (
    <View style={styles.wrap}>
      {item("list", List, "List view")}
      {item("grid", LayoutGrid, "Grid view")}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", backgroundColor: "#E4EBF2", borderRadius: 11, padding: 2 },
  btn: { width: 34, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  on: { backgroundColor: NEUTRAL.surface },
});
