import { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform, Image, ScrollView } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CameraView, useCameraPermissions } from "expo-camera";
import { X, Camera as CameraIcon, QrCode, Check } from "lucide-react-native";
import { AppStackParamList } from "@/navigation/types";
import * as FileSystem from "expo-file-system/legacy";
import { useDocumentUpload, UploadCandidate } from "@/context/DocumentUploadContext";

type Mode = "qr" | "photo";

// How many photos one bulk capture session holds before it makes you upload and
// start again — keeps the tray manageable. Add Document (instant) takes exactly one.
const MAX_SHOTS = 20;

// The camera already saves each photo as a file and hands back its path, and the upload is one multipart request built
// straight from a file path, so the photo is never turned into text. It is only moved (instantly) from the camera's cache
// folder to documentDirectory: Android (MIUI especially) can reclaim a cache-directory file before the upload reads it;
// see fileHelpers.ts's stageForUpload for the same issue on the document-picker path.
async function shotToCandidate(shotUri: string, i: number): Promise<UploadCandidate> {
  const dir = `${FileSystem.documentDirectory}pending-uploads/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const name = `capture-${Date.now()}-${i}.jpg`;
  const uri = `${dir}${name}`;
  await FileSystem.moveAsync({ from: shotUri, to: uri });
  const info = await FileSystem.getInfoAsync(uri);
  return { name, mimeType: "image/jpeg", size: info.exists ? info.size : 0, uri };
}

/**
 * One camera screen, opened from two places (route param `mode`):
 *   • "instant" (Add Document in My Documents) — one document. Two modes chosen by a toggle at the top:
 *       "Scan QR" — a bounded frame; a document QR held inside it auto-snaps and uploads on its own.
 *       "Photo"   — full-screen viewfinder + shutter, exactly one shot, then "Upload".
 *     Afterwards My Documents opens with that document, to confirm its type.
 *   • "bulk" (Bulk Upload) — Photo mode only. Each tap adds a page to a tray; "Upload N" sends them all and
 *     returns to Bulk Upload, where they are reviewed. At MAX_SHOTS the shutter locks until you upload.
 */
export function CaptureScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "DocumentCapture">>();
  const patientAwpid = route.params?.patientAwpid;
  const uploadMode = route.params?.mode ?? "instant";
  const maxShots = uploadMode === "instant" ? 1 : MAX_SHOTS;
  const { startUpload } = useDocumentUpload();

  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const [mode, setMode] = useState<Mode>(uploadMode === "instant" ? "qr" : "photo");
  const [shots, setShots] = useState<string[]>([]);     // the photos taken (file paths), photo mode
  const [capturing, setCapturing] = useState(false);     // guards double-tap while grabbing a frame
  const [error, setError] = useState("");
  const handledQr = useRef(false);

  // Leave the camera once the files are on the server: an instant document goes back to My Documents (a bar there follows
  // it until it is read, then offers the confirmation); a bulk upload goes back to Bulk Upload for the review.
  const leaveAfterUpload = useCallback(() => {
    if (uploadMode === "instant") {
      navigation.navigate({ name: "MyDocuments", params: patientAwpid ? { patientAwpid } : undefined, merge: true });
    } else {
      navigation.navigate({ name: "DocumentUpload", params: patientAwpid ? { patientAwpid } : undefined, merge: true });
    }
  }, [navigation, patientAwpid, uploadMode]);

  const grabFrame = useCallback(async (): Promise<string | null> => {
    if (!camRef.current) return null;
    const shot = await camRef.current.takePictureAsync({ quality: 0.7, skipProcessing: true });
    return shot?.uri ?? null;
  }, []);

  // ── QR: capture the frame and upload it as one instant document ──
  const captureQr = useCallback(async (_qrToken: string) => {
    if (capturing) return;
    setCapturing(true);
    setError("");
    try {
      const shotUri = await grabFrame();
      if (!shotUri) {
        setError("Couldn't use the camera. Try again.");
        handledQr.current = false;
        setCapturing(false);
        return;
      }
      const outcome = await startUpload([await shotToCandidate(shotUri, 0)], "instant", patientAwpid);
      if (outcome.status !== "started") {
        setError(outcome.reason);
        handledQr.current = false;
        setCapturing(false);
        return;
      }
      leaveAfterUpload();
    } catch (err) {
      setError("Couldn't use the camera. Try again.");
      handledQr.current = false;
      setCapturing(false);
    }
  }, [capturing, grabFrame, startUpload, patientAwpid, leaveAfterUpload]);

  const onBarcode = useCallback(({ data }: { data: string }) => {
    if (handledQr.current || capturing || !data) return;
    handledQr.current = true;
    captureQr(data);
  }, [capturing, captureQr]);

  // ── Photo: add to the tray ──────────────────────────────────────────────
  const addShot = useCallback(async () => {
    if (capturing || shots.length >= maxShots) return;
    setCapturing(true);
    try {
      const shotUri = await grabFrame();
      if (shotUri) setShots((s) => (s.length >= maxShots ? s : [...s, shotUri]));
    } catch {
      setError("Couldn't use the camera. Try again.");
    }
    setCapturing(false);
  }, [capturing, shots.length, grabFrame, maxShots]);

  const removeShot = (i: number) => {
    FileSystem.deleteAsync(shots[i], { idempotent: true }).catch(() => {});
    setShots((s) => s.filter((_, idx) => idx !== i));
  };

  const uploadAll = useCallback(async () => {
    if (shots.length === 0) return;
    setError("");
    const candidates = await Promise.all(shots.map((shotUri, i) => shotToCandidate(shotUri, i)));
    const outcome = await startUpload(candidates, uploadMode, patientAwpid);
    if (outcome.status !== "started") {
      setError(outcome.reason);
      return;
    }
    setShots([]);
    leaveAfterUpload();
  }, [shots, startUpload, uploadMode, patientAwpid, leaveAfterUpload]);

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
  const atLimit = shots.length >= maxShots;

  return (
    <View style={styles.fill}>
      <CameraView
        ref={camRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={isQr && !capturing ? onBarcode : undefined}
      />

      {/* mode toggle (only Add Document can scan a QR) */}
      {uploadMode === "instant" && <View style={styles.toggleWrap}>
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
      </View>}

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
              ? (uploadMode === "instant" ? "Got it — tap Upload." : `That's ${maxShots} pages — upload them, then keep going.`)
              : (uploadMode === "instant"
                ? "Fit the whole page in view, in good light, then tap the shutter."
                : "Fit the whole page in view, in good light, then tap the shutter. Add as many pages as you need.")}
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
            {shots.map((shotUri, i) => (
              <View key={i} style={styles.thumbWrap}>
                <Image source={{ uri: shotUri }} style={styles.thumb} />
                <Pressable style={styles.thumbX} hitSlop={8} onPress={() => removeShot(i)}>
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
              {shots.length > 0 && uploadMode === "bulk" && <Text style={styles.countText}>{shots.length}/{maxShots}</Text>}
            </View>
            <Pressable style={[styles.shutter, atLimit && styles.shutterOff]} disabled={capturing || atLimit} onPress={addShot}>
              <View style={styles.shutterInner} />
            </Pressable>
            <View style={styles.sideSlot}>
              {shots.length > 0 && (
                <Pressable style={styles.uploadBtn} onPress={uploadAll}>
                  <Check size={15} color="#111" strokeWidth={3} />
                  <Text style={styles.uploadBtnText}>{uploadMode === "instant" ? "Upload" : `Upload ${shots.length}`}</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </View>

      {!!error && (
        <View style={styles.errBar}>
          <Text style={styles.errText}>{error}</Text>
        </View>
      )}
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

  errBar: { position: "absolute", left: 16, right: 16, bottom: 118, backgroundColor: "rgba(185,28,28,0.95)", borderRadius: 10, padding: 12 },
  errText: { color: "#fff", fontSize: 12.5, textAlign: "center" },
});
