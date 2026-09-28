import { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CircleCheckBig, FileText, TriangleAlert, Trash2 } from "lucide-react-native";
import { Screen, BackHeader } from "@/components/Layout";
import { useAppTheme } from "@/context/ThemeContext";
import { NEUTRAL } from "@/theme/themes";
import { AppStackParamList } from "@/navigation/types";
import { getMyDocuments, getDocumentDetail, deleteDocument } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { openInExternalApp } from "@/utils/fileHelpers";
import { UploadStatusCard, useUploadModel } from "@/components/UploadProgress";

const IN_PROGRESS_STATUSES = "queued,ocr,classifying";

/**
 * What's currently moving through the extraction/classification pipeline (apps/records), plus
 * anything that failed. A document that finishes just becomes a normal row in Rx & Reports —
 * there's no separate "ready to view" tray anymore, so this screen only has two tabs.
 */
export function UploadsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "Uploads">>();
  const patientAwpid = route.params?.patientAwpid;
  const { theme } = useAppTheme();
  const accent = { fill: theme.fill, bg: theme.bg, text: theme.text };
  const queryClient = useQueryClient();

  const q = useQuery({
    queryKey: ["uploadsScreen", patientAwpid],
    queryFn: () => getMyDocuments(1, patientAwpid, { status: `${IN_PROGRESS_STATUSES},failed`, pageSize: 100 }),
    refetchInterval: 5000,
  });
  const { refreshing, onRefresh } = usePullToRefresh(q.refetch);
  const model = useUploadModel();

  const [tab, setTab] = useState<"progress" | "failed">("progress");
  const [opening, setOpening] = useState<number | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  const [notice, setNotice] = useState("");

  const rows = q.data?.results ?? [];
  const inProgress = useMemo(() => rows.filter((d) => d.processing_status !== "failed"), [rows]);
  const failed = useMemo(() => rows.filter((d) => d.processing_status === "failed"), [rows]);

  const statusLabel = (s: string) => (s === "queued" ? "Waiting to be read" : s === "ocr" ? "Reading…" : "Classifying…");

  async function view(id: number, name: string, mime: string) {
    if (opening) return;
    setOpening(id);
    setNotice("");
    try {
      const full = await getDocumentDetail(id);
      const src = (full as any).file_data as string;
      if (!src) {
        setNotice("The original file couldn't be opened right now.");
      } else {
        await openInExternalApp(name, src, mime);
      }
    } catch (err) {
      setNotice(apiErrorMessage(err, "Couldn't open the file."));
    } finally {
      setOpening(null);
    }
  }

  async function remove(id: number) {
    setRemoving(id);
    try {
      await deleteDocument(id);
      queryClient.invalidateQueries({ queryKey: ["uploadsScreen"] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    } catch (err) {
      setNotice(apiErrorMessage(err, "Couldn't remove this."));
    } finally {
      setRemoving(null);
    }
  }

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing} backgroundLoading={q.isFetching && !refreshing}>
      <BackHeader title="Uploads" onBack={() => navigation.goBack()} />

      {model && <UploadStatusCard model={model} accent={accent} />}

      <View style={[styles.tabs, model ? { marginTop: 14 } : null]}>
        <Pressable onPress={() => setTab("progress")} style={[styles.tab, tab === "progress" && styles.tabOn]}>
          <Text style={[styles.tabT, tab === "progress" && styles.tabTOn]}>In progress {inProgress.length}</Text>
        </Pressable>
        <Pressable onPress={() => setTab("failed")} style={[styles.tab, tab === "failed" && styles.tabOn]}>
          <Text style={[styles.tabT, tab === "failed" && styles.tabTOn]}>Failed {failed.length}</Text>
        </Pressable>
      </View>

      {!!notice && <Text style={styles.notice}>{notice}</Text>}

      {q.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.fill} />
      ) : tab === "progress" ? (
        inProgress.length === 0 ? (
          <View style={styles.emptyWrap}>
            <CircleCheckBig size={28} color={theme.fill} strokeWidth={2} />
            <Text style={styles.emptyTitle}>All caught up</Text>
            <Text style={styles.empty}>Nothing being processed right now. Uploads you make show up here until they're read and classified.</Text>
          </View>
        ) : (
          inProgress.map((d) => (
            <Pressable key={d.id} onPress={() => view(d.id, d.file_name, d.mime_type)} style={({ pressed }) => [styles.item, pressed && { opacity: 0.85 }]}>
              <View style={[styles.tile, { backgroundColor: theme.bg }]}>
                {opening === d.id ? <ActivityIndicator size="small" color={theme.fill} /> : <FileText size={16} color={theme.text} strokeWidth={2.2} />}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name} numberOfLines={1}>{d.file_name || d.title}</Text>
                <Text style={styles.snip} numberOfLines={1}>{statusLabel(d.processing_status)}</Text>
              </View>
            </Pressable>
          ))
        )
      ) : failed.length === 0 ? (
        <Text style={[styles.empty, { marginTop: 40 }]}>No failures.</Text>
      ) : (
        failed.map((d) => (
          <View key={d.id} style={styles.item}>
            <Pressable onPress={() => view(d.id, d.file_name, d.mime_type)} style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 10 }}>
              <View style={[styles.tile, { backgroundColor: NEUTRAL.warningBg }]}>
                {opening === d.id ? <ActivityIndicator size="small" color={theme.fill} /> : <TriangleAlert size={16} color={NEUTRAL.warning} strokeWidth={2.2} />}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name} numberOfLines={1}>{d.file_name || d.title}</Text>
                <Text style={styles.snip} numberOfLines={1}>{d.error || "Couldn't be processed"}</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => remove(d.id)} hitSlop={10} style={styles.x} accessibilityLabel="Remove">
              {removing === d.id ? <ActivityIndicator size="small" color={NEUTRAL.textMuted} /> : <Trash2 size={16} color={NEUTRAL.textMuted} strokeWidth={2.2} />}
            </Pressable>
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", backgroundColor: "#E7EEF0", borderRadius: 11, padding: 3, marginTop: 4 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 9 },
  tabOn: { backgroundColor: "#FFFFFF", borderWidth: 0.5, borderColor: NEUTRAL.border },
  tabT: { fontSize: 12.5, fontWeight: "600", color: NEUTRAL.textSecondary, fontVariant: ["tabular-nums"] },
  tabTOn: { color: NEUTRAL.textPrimary, fontWeight: "700" },
  notice: { fontSize: 12, color: NEUTRAL.danger, marginTop: 10 },
  item: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: NEUTRAL.surface,
    borderWidth: 0.5, borderColor: NEUTRAL.border, borderRadius: 14, paddingVertical: 9, paddingLeft: 11, paddingRight: 6, marginTop: 10,
  },
  tile: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 13.5, fontWeight: "600", color: NEUTRAL.textPrimary },
  snip: { fontSize: 11.5, color: NEUTRAL.textSecondary, marginTop: 2 },
  x: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  emptyWrap: { alignItems: "center", marginTop: 50, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: NEUTRAL.textPrimary, marginTop: 10 },
  empty: { fontSize: 12.5, color: NEUTRAL.textSecondary, textAlign: "center", marginTop: 6, lineHeight: 18, paddingHorizontal: 24 },
});
