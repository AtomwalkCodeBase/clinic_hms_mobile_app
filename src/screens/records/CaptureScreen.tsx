import React, { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform, Image, ScrollView } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CameraView, useCameraPermissions } from "expo-camera";
import { X, Camera as CameraIcon, QrCode, Check } from "lucide-react-native";
import { NEUTRAL } from "@/theme/themes";
import { uploadDocument, UploadResult } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { AppStackParamList } from "@/navigation/types";

type Mode = "qr" | "photo";
// `reviewGroups` keys are the exact combination of missing fields (server's
// review_needs, kind/category/date, joined in that order) — "could not
// classify" and "just needs a date" are different problems and read as such.
type Tally = { added: number; reviewGroups: Record<string, number>; retake: number; discarded: number; duplicate: number; failed: number };
const REVIEW_REASON_ORDER = ["kind", "category", "date"];
const REVIEW_REASON_LABEL: Record<string, string> = {
  "kind": "couldn't be classified",
  "kind,date": "couldn't be classified, and the date's unclear too",
  "category": "are lab reports missing their panel",
  "category,date": "are lab reports missing their panel and date",
  "date": "just need a date confirmed",
};

// How many photos one capture session holds before it makes you upload and
// start again — keeps device memory sane (each shot is a base64 JPEG).
const MAX_SHOTS = 20;

/**
 * One camera screen, two modes chosen by a toggle at the top:
 *   • "Scan QR"  — a bounded frame; a hospital-document QR held inside it is
 *     auto-detected and uploaded on its own (server verifies + files it).
 *   • "Photo"    — full-screen viewfinder + shutter. Each tap adds a page to a
 *     tray; "Upload N" sends them all in one go, then pops back. At MAX_SHOTS
 *     the shutter locks until you upload.
 * Rx & Reports reloads on focus afterwards.
 */
export function CaptureScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "RxCapture">>();
  const patientAwpid = route.params?.patientAwpid;

  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const [mode, setMode] = useState<Mode>("qr");
  const [shots, setShots] = useState<string[]>([]);     // base64 JPEGs, photo mode
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Tally | null>(null);
  const handledQr = useRef(false);

  // ── single upload (one shot, or a QR frame) ──────────────────────────────
  const sendOne = useCallback(
    (base64: string, qrToken?: string): Promise<UploadResult> =>
      uploadDocument({
        title: qrToken
          ? `Scanned ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
          : `Photo ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
        doc_type: "other", // server reads the QR / page text and files it
        file_name: `capture-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`,
        mime_type: "image/jpeg",
        file_data: `data:image/jpeg;base64,${base64}`,
        ...(qrToken ? { qr_token: qrToken } : {}),
        ...(patientAwpid ? { patient_awpid: patientAwpid } : {}),
      }),
    [patientAwpid],
  );

  const grabFrame = useCallback(async (): Promise<string | null> => {
    if (!camRef.current) return null;
    const shot = await camRef.current.takePictureAsync({ quality: 0.7, base64: true, skipProcessing: true });
    return shot?.base64 ?? null;
  }, []);

  // ── QR: capture the frame + token and upload immediately ─────────────────
  const captureQr = useCallback(async (qrToken: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const b64 = await grabFrame();
      if (b64) {
        await sendOne(b64, qrToken);
        navigation.goBack();
        return;
      }
      setError("Couldn't use the camera. Try again.");
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't upload that. Try again."));
    }
    handledQr.current = false;
    setBusy(false);
  }, [busy, grabFrame, sendOne, navigation]);

  const onBarcode = useCallback(({ data }: { data: string }) => {
    if (handledQr.current || busy || !data) return;
    handledQr.current = true;
    captureQr(data);
  }, [busy, captureQr]);

  // ── Photo: add to the tray ──────────────────────────────────────────────
  const addShot = useCallback(async () => {
    if (busy || shots.length >= MAX_SHOTS) return;
    try {
      const b64 = await grabFrame();
      if (b64) setShots((s) => (s.length >= MAX_SHOTS ? s : [...s, b64]));
    } catch {
      setError("Couldn't use the camera. Try again.");
    }
  }, [busy, shots.length, grabFrame]);

  const removeShot = (i: number) => setShots((s) => s.filter((_, idx) => idx !== i));

  const uploadAll = useCallback(async () => {
    if (busy || shots.length === 0) return;
    setBusy(true);
    setError("");
    const pending = [...shots];
    const t: Tally = { added: 0, reviewGroups: {}, retake: 0, discarded: 0, duplicate: 0, failed: 0 };
    const leftover: string[] = [];
    for (let i = 0; i < pending.length; i++) {
      setProgress(`Uploading ${i + 1} of ${pending.length}…`);
      try {
        const r = await sendOne(pending[i]);
        if ("skipped" in r && r.skipped) t.discarded++;
        else if ("duplicate" in r && r.duplicate) t.duplicate++;
        else if ("unreadable" in r && r.unreadable) t.retake++;     // too blurry / dark
        else if ("review_state" in r && r.review_state === "filed") t.added++;
        else {
          const needs = ("review_needs" in r && r.review_needs) || [];
          const key = REVIEW_REASON_ORDER.filter((n) => needs.includes(n)).join(",") || "kind";
          t.reviewGroups[key] = (t.reviewGroups[key] || 0) + 1;
        }
      } catch {
        t.failed++;
        leftover.push(pending[i]);                         // keep the ones that didn't land
      }
    }
    setProgress("");
    setBusy(false);
    setShots(leftover);
    setResult(t);
  }, [busy, shots, sendOne]);

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    handledQr.current = false;
    setError("");
    setMode(m);
  };

  if (!permission) {
    return <View style={styles.fill}><ActivityIndicator color="#fff" /></View>;
  }
  if (!permission.granted) {
    return (
      <View style={[styles.fill, styles.center]}>
        <CameraIcon size={30} color="#fff" />
        <Text style={styles.permText}>Camera access is needed to scan a QR or photograph a document.</Text>
        <Pressable style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Allow camera</Text>
        </Pressable>
        <Pressable style={styles.permCancel} onPress={() => navigation.goBack()}>
          <Text style={styles.permCancelText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  const isQr = mode === "qr";
  const atLimit = shots.length >= MAX_SHOTS;

  return (
    <View style={styles.fill}>
      <CameraView
        ref={camRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={isQr && !busy ? onBarcode : undefined}
      />

      {/* mode toggle */}
      <View style={styles.toggleWrap}>
        <View style={styles.toggle}>
          <Pressable style={[styles.toggleBtn, isQr && styles.toggleBtnOn]} onPress={() => switchMode("qr")}>
            <QrCode size={13} color={isQr ? "#111" : "#fff"} />
            <Text style={[styles.toggleText, isQr && styles.toggleTextOn]}>Scan QR</Text>
          </Pressable>
          <Pressable style={[styles.toggleBtn, !isQr && styles.toggleBtnOn]} onPress={() => switchMode("photo")}>
            <CameraIcon size={13} color={!isQr ? "#111" : "#fff"} />
            <Text style={[styles.toggleText, !isQr && styles.toggleTextOn]}>Photo</Text>
          </Pressable>
        </View>
      </View>

      {/* overlay differs by mode */}
      {isQr ? (
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.reticle} />
          <Text style={styles.hint}>Hold the hospital QR code inside the frame.</Text>
        </View>
      ) : (
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.pageGuide} />
          <Text style={styles.hint}>
            {atLimit
              ? `That's ${MAX_SHOTS} pages — upload them, then keep going.`
              : "Fit the whole page in view, in good light, then tap the shutter. Add as many pages as you need."}
          </Text>
        </View>
      )}

      <Pressable style={styles.close} hitSlop={12} onPress={() => navigation.goBack()}>
        <X size={22} color="#fff" strokeWidth={2.4} />
      </Pressable>

      {/* photo-mode tray */}
      {!isQr && shots.length > 0 && (
        <View style={styles.tray}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trayRow}>
            {shots.map((b64, i) => (
              <View key={i} style={styles.thumbWrap}>
                <Image source={{ uri: `data:image/jpeg;base64,${b64}` }} style={styles.thumb} />
                <Pressable style={styles.thumbX} hitSlop={8} onPress={() => removeShot(i)} disabled={busy}>
                  <X size={11} color="#fff" strokeWidth={3} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.bottomBar}>
        {isQr ? (
          <View style={styles.qrStatus}>
            <QrCode size={13} color="#fff" />
            <Text style={styles.qrStatusText}>Auto-detecting…</Text>
          </View>
        ) : (
          <View style={styles.photoBar}>
            <View style={styles.sideSlot}>
              {shots.length > 0 && <Text style={styles.countText}>{shots.length}/{MAX_SHOTS}</Text>}
            </View>
            <Pressable style={[styles.shutter, atLimit && styles.shutterOff]} disabled={busy || atLimit} onPress={addShot}>
              <View style={styles.shutterInner} />
            </Pressable>
            <View style={styles.sideSlot}>
              {shots.length > 0 && (
                <Pressable style={styles.uploadBtn} disabled={busy} onPress={uploadAll}>
                  <Check size={15} color="#111" strokeWidth={3} />
                  <Text style={styles.uploadBtnText}>Upload {shots.length}</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </View>

      {busy && (
        <View style={styles.busy} pointerEvents="none">
          <ActivityIndicator color="#fff" />
          <Text style={styles.busyText}>{progress || "Uploading…"}</Text>
        </View>
      )}
      {!!error && (
        <View style={styles.errBar}>
          <Text style={styles.errText}>{error}</Text>
        </View>
      )}

      {result && (
        <View style={styles.resultWrap}>
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>
              {result.added === 0 && Object.keys(result.reviewGroups).length === 0 && result.failed === 0
                ? "Nothing added"
                : "Upload complete"}
            </Text>
            <View style={{ gap: 8, marginTop: 10 }}>
              {result.added > 0 && <ResultLine n={result.added} text="added to your reports" />}
              {Object.entries(result.reviewGroups).map(([key, n]) => (
                <ResultLine key={key} n={n} text={`${REVIEW_REASON_LABEL[key] || "need a quick check"} — see Review`} />
              ))}
              {result.retake > 0 && <ResultLine n={result.retake} text="too blurry or dark — retake in better light" muted />}
              {result.discarded > 0 && <ResultLine n={result.discarded} text="discarded — not a medical document" muted />}
              {result.duplicate > 0 && <ResultLine n={result.duplicate} text="already in your reports" muted />}
              {result.failed > 0 && <ResultLine n={result.failed} text="couldn't upload — still in the tray" warn />}
            </View>
            <View style={styles.resultBtnRow}>
              {result.failed > 0 && (
                <Pressable style={[styles.resultBtn, styles.resultBtnGhost]} onPress={() => setResult(null)}>
                  <Text style={styles.resultBtnGhostText}>Keep trying</Text>
                </Pressable>
              )}
              <Pressable style={styles.resultBtn} onPress={() => navigation.goBack()}>
                <Text style={styles.resultBtnText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function ResultLine({ n, text, muted, warn }: { n: number; text: string; muted?: boolean; warn?: boolean }) {
  return (
    <View style={styles.resultLine}>
      <Text style={[styles.resultN, warn && { color: "#B91C1C" }]}>{n}</Text>
      <Text style={[styles.resultText, muted && { color: NEUTRAL.textMuted }, warn && { color: "#B91C1C" }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#000" },
  center: { alignItems: "center", justifyContent: "center", padding: 28, gap: 14 },
  permText: { color: "#fff", fontSize: 13.5, textAlign: "center", lineHeight: 20 },
  permBtn: { backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 20, paddingVertical: 11 },
  permBtnText: { color: "#000", fontWeight: "700", fontSize: 13.5 },
  permCancel: { paddingVertical: 8 },
  permCancelText: { color: "#bbb", fontSize: 13 },

  toggleWrap: { position: "absolute", left: 0, right: 0, top: Platform.OS === "ios" ? 56 : 26, alignItems: "center" },
  toggle: { flexDirection: "row", backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 999, padding: 3 },
  toggleBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 18, borderRadius: 999 },
  toggleBtnOn: { backgroundColor: "#fff" },
  toggleText: { color: "#fff", fontSize: 12.5, fontWeight: "600" },
  toggleTextOn: { color: "#111" },

  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  reticle: { width: "64%", aspectRatio: 1, borderWidth: 3, borderColor: "rgba(255,255,255,0.95)", borderRadius: 20 },
  pageGuide: { width: "82%", height: "56%", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.5)", borderRadius: 10, borderStyle: "dashed" },
  hint: { color: "#fff", fontSize: 12.5, textAlign: "center", marginTop: 18, paddingHorizontal: 36, lineHeight: 18 },

  close: { position: "absolute", top: Platform.OS === "ios" ? 56 : 24, left: 18, width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },

  tray: { position: "absolute", left: 0, right: 0, bottom: Platform.OS === "ios" ? 132 : 120, paddingVertical: 8, backgroundColor: "rgba(0,0,0,0.4)" },
  trayRow: { paddingHorizontal: 14, gap: 8 },
  thumbWrap: { width: 52, height: 68, borderRadius: 6, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.6)" },
  thumb: { width: "100%", height: "100%" },
  thumbX: { position: "absolute", top: 2, right: 2, width: 16, height: 16, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center" },

  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingBottom: Platform.OS === "ios" ? 40 : 26, paddingTop: 16, paddingHorizontal: 20, minHeight: 96, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)" },
  qrStatus: { flexDirection: "row", alignItems: "center", gap: 7 },
  qrStatusText: { color: "#fff", fontSize: 12, fontWeight: "600" },

  photoBar: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sideSlot: { width: 108, alignItems: "center", justifyContent: "center" },
  countText: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "600", fontVariant: ["tabular-nums"] },
  shutter: { width: 66, height: 66, borderRadius: 33, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  shutterOff: { opacity: 0.35 },
  shutterInner: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#fff" },
  uploadBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#fff", borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14 },
  uploadBtnText: { color: "#111", fontSize: 12.5, fontWeight: "700" },

  busy: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)", gap: 10 },
  busyText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  errBar: { position: "absolute", left: 16, right: 16, bottom: 118, backgroundColor: "rgba(185,28,28,0.95)", borderRadius: 10, padding: 12 },
  errText: { color: "#fff", fontSize: 12.5, textAlign: "center" },

  resultWrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.6)", padding: 24 },
  resultCard: { width: "100%", maxWidth: 360, backgroundColor: NEUTRAL.surface, borderRadius: 16, padding: 20 },
  resultTitle: { fontSize: 15.5, fontWeight: "700", color: NEUTRAL.textPrimary },
  resultLine: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  resultN: { fontSize: 14, fontWeight: "700", color: NEUTRAL.textPrimary, minWidth: 20, fontVariant: ["tabular-nums"] },
  resultText: { flex: 1, fontSize: 12.5, color: NEUTRAL.textSecondary, lineHeight: 18 },
  resultBtnRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  resultBtn: { flex: 1, backgroundColor: NEUTRAL.textPrimary, borderRadius: 10, paddingVertical: 11, alignItems: "center" },
  resultBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  resultBtnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: NEUTRAL.border },
  resultBtnGhostText: { color: NEUTRAL.textSecondary, fontSize: 13, fontWeight: "600" },
});
