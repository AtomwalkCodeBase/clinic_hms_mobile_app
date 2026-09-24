import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CircleCheckBig, FileText, TriangleAlert, X } from "lucide-react-native";
import { Screen, BackHeader } from "@/components/Layout";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MessageDialog } from "@/components/MessageDialog";
import { UploadStatusCard, useUploadModels } from "@/components/UploadProgress";
import { useAppTheme } from "@/context/ThemeContext";
import { NEUTRAL } from "@/theme/themes";
import { AppStackParamList } from "@/navigation/types";
import { ExtractedGroup, ExtractedItem, getExtractedItemFile } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { useExtractedItems, useDismissExtracted } from "@/hooks/useExtractedItems";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { openInExternalApp } from "@/utils/fileHelpers";

type Tab = "ready" | "failed" | "waiting";
const COLLAPSED_ROWS = 4;

function groupLabel(iso: string, count: number) {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const day = days === 0 ? "Today" : days === 1 ? "Yesterday" : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `${day}, ${time} · ${count} file${count === 1 ? "" : "s"}`;
}

/**
 * Everything about the patient's uploads in one place: live progress at the top,
 * then Ready / Failed / Waiting. For now the only actions are View (opens the
 * original file the way any other report opens) and dismiss (hides it from
 * this list; nothing is deleted). Confirm/reject-and-file comes with the later
 * review step.
 */
export function UploadsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "Uploads">>();
  const patientAwpid = route.params?.patientAwpid;
  const { theme } = useAppTheme();
  const accent = { fill: theme.fill, bg: theme.bg, text: theme.text };

  const q = useExtractedItems(patientAwpid);
  const dismiss = useDismissExtracted(patientAwpid);
  const { refreshing, onRefresh } = usePullToRefresh(q.refetch);
  const models = useUploadModels();
  const waiting = models.reduce((n, m) => n + m.waiting, 0);

  const [tab, setTab] = useState<Tab>("ready");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [opening, setOpening] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
  const [confirm, setConfirm] = useState<{ ids: string[]; title: string } | null>(null);

  const data = q.data;
  const counts = data?.counts ?? { ready: 0, failed: 0 };
  // Ready tab: finished-and-readable items per upload. Failed tab: every failure, newest first.
  const readyGroups = useMemo(
    () =>
      (data?.groups ?? [])
        .map((g) => ({ ...g, items: g.items.filter((i) => i.status === "done") }))
        .filter((g) => g.items.length),
    [data]
  );
  const failedItems = useMemo(
    () => (data?.groups ?? []).flatMap((g) => g.items.filter((i) => i.status === "failed")),
    [data]
  );

  async function view(item: ExtractedItem) {
    if (item.status === "failed") {
      setNotice({ title: "Couldn't be read", message: item.reason || "This file couldn't be read. Try uploading it again." });
      return;
    }
    if (opening) return;
    setOpening(item.id);
    try {
      const f = await getExtractedItemFile(item.id, patientAwpid);
      if (!f.file_url) {
        setNotice({ title: "File not available", message: "The original file couldn't be opened right now. Please try again." });
      } else {
        await openInExternalApp(f.name || item.name, f.file_url, f.mime_type || item.mime_type);
      }
    } catch (err) {
      setNotice({ title: "Couldn't open the file", message: apiErrorMessage(err, "Please check your connection and try again.") });
    } finally {
      setOpening(null);
    }
  }

  const renderRow = (it: ExtractedItem) => {
    const bad = it.status === "failed";
    return (
      <Pressable key={it.id} onPress={() => view(it)} style={({ pressed }) => [styles.item, pressed && { opacity: 0.85 }]}>
        <View style={[styles.tile, { backgroundColor: bad ? NEUTRAL.warningBg : theme.bg }]}>
          {bad ? (
            <TriangleAlert size={16} color={NEUTRAL.warning} strokeWidth={2.2} />
          ) : opening === it.id ? (
            <ActivityIndicator size="small" color={theme.fill} />
          ) : (
            <FileText size={16} color={theme.text} strokeWidth={2.2} />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>{it.name}</Text>
          <Text style={styles.snip} numberOfLines={1}>{bad ? it.reason || "Couldn't be read" : it.snippet || "Tap to view"}</Text>
        </View>
        <Pressable onPress={() => dismiss.mutate({ itemIds: [it.id] })} hitSlop={10} style={styles.x} accessibilityLabel="Dismiss">
          <X size={16} color={NEUTRAL.textMuted} strokeWidth={2.4} />
        </Pressable>
      </Pressable>
    );
  };

  const caughtUp = models.length === 0;
  const tabs: { key: Tab; label: string; n: number }[] = [
    { key: "ready", label: "Ready", n: counts.ready },
    { key: "failed", label: "Failed", n: counts.failed },
    { key: "waiting", label: "Waiting", n: waiting },
  ];

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing} backgroundLoading={q.isFetching && !refreshing}>
      <BackHeader title="Uploads" onBack={() => navigation.goBack()} />

      {models.map((m) => <UploadStatusCard key={m.key} model={m} accent={accent} />)}

      <View style={[styles.tabs, models.length ? { marginTop: 14 } : null]}>
        {tabs.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, tab === t.key && styles.tabOn]}>
            <Text style={[styles.tabT, tab === t.key && styles.tabTOn]}>{t.label} {t.n}</Text>
          </Pressable>
        ))}
      </View>

      {q.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.fill} />
      ) : tab === "ready" ? (
        readyGroups.length === 0 ? (
          <View style={styles.emptyWrap}>
            <CircleCheckBig size={28} color={theme.fill} strokeWidth={2} />
            <Text style={styles.emptyTitle}>{caughtUp ? "All caught up" : "Nothing read yet"}</Text>
            <Text style={styles.empty}>
              {caughtUp ? "Nothing waiting. Reports you upload show up here once they've been read." : "Results appear here as each one finishes."}
            </Text>
          </View>
        ) : (
          readyGroups.map((g: ExtractedGroup) => {
            const shown = expanded[g.id] ? g.items : g.items.slice(0, COLLAPSED_ROWS);
            return (
              <View key={g.id} style={{ marginTop: 14 }}>
                <View style={styles.groupHdr}>
                  <Text style={styles.groupTitle}>{groupLabel(g.created_at, g.total ?? g.items.length)}</Text>
                  <Pressable
                    onPress={() => setConfirm({ ids: g.items.map((i) => i.id), title: "Dismiss all read reports?" })}
                    hitSlop={8}
                  >
                    <Text style={[styles.link, { color: theme.text }]}>Dismiss all read</Text>
                  </Pressable>
                </View>
                {shown.map(renderRow)}
                {g.items.length > COLLAPSED_ROWS && (
                  <Pressable onPress={() => setExpanded((e) => ({ ...e, [g.id]: !e[g.id] }))} style={{ paddingVertical: 10 }}>
                    <Text style={[styles.more, { color: theme.text }]}>
                      {expanded[g.id] ? "Show fewer" : `Show ${g.items.length - COLLAPSED_ROWS} more`}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })
        )
      ) : tab === "failed" ? (
        failedItems.length === 0 ? (
          <Text style={[styles.empty, { marginTop: 40 }]}>No failures.</Text>
        ) : (
          <View style={{ marginTop: 14 }}>
            <View style={styles.groupHdr}>
              <Text style={styles.groupTitle}>Couldn't be read</Text>
              <Pressable onPress={() => setConfirm({ ids: failedItems.map((i) => i.id), title: "Dismiss all failed uploads?" })} hitSlop={8}>
                <Text style={[styles.link, { color: theme.text }]}>Dismiss all</Text>
              </Pressable>
            </View>
            {failedItems.map(renderRow)}
          </View>
        )
      ) : (
        <Text style={[styles.empty, { marginTop: 40 }]}>
          {waiting
            ? `${waiting} file${waiting === 1 ? "" : "s"} in the queue.\nThey are read in order, and the estimate above updates as they go.`
            : "Nothing waiting."}
        </Text>
      )}

      <ConfirmDialog
        visible={!!confirm}
        title={confirm?.title ?? ""}
        message="They'll be hidden from this list. Your files stay safe."
        confirmLabel="Dismiss"
        onConfirm={() => {
          if (confirm) dismiss.mutate({ itemIds: confirm.ids });
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
      <MessageDialog
        visible={!!notice}
        title={notice?.title ?? ""}
        message={notice?.message}
        buttonLabel="OK"
        tone="error"
        onDismiss={() => setNotice(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", backgroundColor: "#E7EEF0", borderRadius: 11, padding: 3, marginTop: 4 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 9 },
  tabOn: { backgroundColor: "#FFFFFF", borderWidth: 0.5, borderColor: NEUTRAL.border },
  tabT: { fontSize: 12.5, fontWeight: "600", color: NEUTRAL.textSecondary, fontVariant: ["tabular-nums"] },
  tabTOn: { color: NEUTRAL.textPrimary, fontWeight: "700" },
  groupHdr: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  groupTitle: { fontSize: 12, fontWeight: "700", color: NEUTRAL.textPrimary },
  link: { fontSize: 12, fontWeight: "700" },
  item: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: NEUTRAL.surface,
    borderWidth: 0.5, borderColor: NEUTRAL.border, borderRadius: 14, paddingVertical: 9, paddingLeft: 11, paddingRight: 6, marginBottom: 6,
  },
  tile: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 13.5, fontWeight: "600", color: NEUTRAL.textPrimary },
  snip: { fontSize: 11.5, color: NEUTRAL.textSecondary, marginTop: 2 },
  x: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  more: { fontSize: 12.5, fontWeight: "700", textAlign: "center" },
  emptyWrap: { alignItems: "center", marginTop: 50, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: NEUTRAL.textPrimary, marginTop: 10 },
  empty: { fontSize: 12.5, color: NEUTRAL.textSecondary, textAlign: "center", marginTop: 6, lineHeight: 18, paddingHorizontal: 24 },
});
