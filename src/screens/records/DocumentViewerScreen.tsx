import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import { ArrowLeft } from "lucide-react-native";
import { getDocumentDetail } from "@/api/portal";
import { previewHeaders, previewUrl } from "@/api/previewSource";
import { DocPreview } from "@/components/DocPreview";
import { PdfViewer } from "@/components/PdfViewer";
import { ZoomableImage } from "@/components/ZoomableImage";
import { SkeletonBlock } from "@/components/Skeleton";
import { AppStackParamList } from "@/navigation/types";

const BG = "#0B0F14";

/**
 * The full-screen viewer for a document (a photo or a PDF), opened from a preview. It shows the small preview picture
 * (already on the phone from the list) blurred behind a skeleton page and "Loading document...", then the real file
 * replaces it. A strip of the other files in the same list sits at the bottom. View only: there is no Download here.
 */
export function DocumentViewerScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { ids, index, patientAwpid } = useRoute<RouteProp<AppStackParamList, "DocumentViewer">>().params;
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(Math.min(Math.max(index, 0), ids.length - 1));
  const [shownId, setShownId] = useState<number | null>(null);      // the file that has drawn: drop its skeleton
  const [failedId, setFailedId] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const id = ids[current];
  const shown = shownId === id;
  const failed = failedId === id;

  const q = useQuery({
    queryKey: ["documentView", id, patientAwpid ?? "self", attempt],
    queryFn: () => getDocumentDetail(id, { patientAwpid }),
    staleTime: 10 * 60 * 1000,
  });
  const doc = q.data;
  const src = (doc as any)?.file_data as string | undefined;
  const isPdf = (doc?.mime_type || "").includes("pdf") || /\.pdf$/i.test(doc?.file_name || "");

  const stripRef = useRef<ScrollView>(null);
  useEffect(() => { stripRef.current?.scrollTo({ x: Math.max(0, current * 50 - 120), animated: true }); }, [current]);

  const noFile = q.isError || failed || (!!doc && !src);
  const title = doc?.file_name || doc?.title || "";

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <View style={styles.top}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
          <ArrowLeft size={19} color="#FFFFFF" strokeWidth={2.3} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
      </View>

      <View style={styles.stage}>
        {src && !noFile && (
          isPdf
            ? <PdfViewer key={`${id}-${attempt}`} uri={src} onReady={() => setShownId(id)} onError={() => setFailedId(id)} />
            : <ZoomableImage key={`${id}-${attempt}`} uri={src} onReady={() => setShownId(id)} onError={() => setFailedId(id)} onDismiss={() => navigation.goBack()} />
        )}

        {!shown && !noFile && <Loading id={id} patientAwpid={patientAwpid} />}

        {noFile && (
          <View style={styles.center}>
            <Text style={styles.errTitle}>We couldn't open this file</Text>
            <Text style={styles.errSub}>Check your connection and try again.</Text>
            <Pressable onPress={() => { setFailedId(null); setShownId(null); setAttempt((n) => n + 1); }} style={styles.retry}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        )}
      </View>

      {ids.length > 1 && (
        <ScrollView ref={stripRef} horizontal showsHorizontalScrollIndicator={false} style={styles.stripWrap} contentContainerStyle={[styles.strip, { paddingBottom: Math.max(12, insets.bottom + 6) }]}>
          {ids.map((x, i) => (
            <Pressable key={x} onPress={() => setCurrent(i)} accessibilityRole="button" accessibilityLabel={`Open file ${i + 1}`} style={[styles.thumb, i === current && styles.thumbOn]}>
              <DocPreview id={x} patientAwpid={patientAwpid} order={i} width={160} showEye={false} style={StyleSheet.absoluteFill as any} />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/** What is on screen while the file loads: the blurred preview, a skeleton page and a spinner with a short line. */
function Loading({ id, patientAwpid }: { id: number; patientAwpid?: string }) {
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);
  useEffect(() => { previewHeaders().then(setHeaders); }, []);
  return (
    <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
      {headers && (
        <Image source={{ uri: previewUrl(id, { patientAwpid }), headers }} style={StyleSheet.absoluteFill} contentFit="contain" blurRadius={8} />
      )}
      <View style={styles.skelPage}>
        <SkeletonBlock width="55%" height={14} />
        <SkeletonBlock width="85%" height={10} style={{ marginTop: 14 }} />
        <SkeletonBlock width="70%" height={10} style={{ marginTop: 8 }} />
        <SkeletonBlock width="80%" height={10} style={{ marginTop: 8 }} />
        <SkeletonBlock width="60%" height={10} style={{ marginTop: 8 }} />
      </View>
      <View style={styles.loadingRow}>
        <ActivityIndicator color="#FFFFFF" size="small" />
        <Text style={styles.loadingText}>Loading document…</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  top: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  back: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  title: { flex: 1, color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  stage: { flex: 1, backgroundColor: BG, overflow: "hidden" },
  center: { alignItems: "center", justifyContent: "center" },
  skelPage: { width: "70%", backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 6, padding: 18, opacity: 0.92 },
  loadingRow: { position: "absolute", bottom: 26, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18 },
  loadingText: { color: "#FFFFFF", fontSize: 12.5, fontWeight: "600" },
  errTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  errSub: { color: "#9fb0c3", fontSize: 12.5, marginTop: 6 },
  retry: { marginTop: 14, backgroundColor: "#15803D", paddingHorizontal: 22, paddingVertical: 10, borderRadius: 20 },
  retryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  stripWrap: { flexGrow: 0, backgroundColor: BG },
  strip: { gap: 8, paddingHorizontal: 12, paddingTop: 10 },
  thumb: { width: 42, height: 54, borderRadius: 5, overflow: "hidden", opacity: 0.55, borderWidth: 2, borderColor: "transparent" },
  thumbOn: { opacity: 1, borderColor: "#4ADE80" },
});
