import { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Image } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CameraView, useCameraPermissions } from "expo-camera";
import { X, Camera as CameraIcon, QrCode, Check } from "lucide-react-native";
import { CloseButton } from "@/components/IconButtons";
import { AppStackParamList } from "@/navigation/types";
import * as FileSystem from "expo-file-system/legacy";
import { useDocumentUpload, UploadCandidate } from "@/context/DocumentUploadContext";
import { setViewingPerson } from "@/utils/viewingPerson";
import { shrinkPhoto } from "@/utils/imageCompress";
import { isPhoneFull, PHONE_FULL } from "@/utils/storageErrors";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Mode = "qr" | "photo";

// The bottom bar holds the shutter: 16 of padding above it and the 66 px button. The system navigation bar (Android) or the home indicator
// (iOS) sits below that, and its height is added from the screen's safe-area inset, so the shutter is never under it.
const BAR_CONTENT = 16 + 66;
const TRAY_HEIGHT = 8 + 68 + 8;                          // the strip with the photo's thumbnail above the bar: padding, thumbnail, padding

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
  const size = info.exists ? await shrinkPhoto(uri, "image/jpeg", info.size) : 0;      // a camera photo is several MB; the limit is per file
  return { name, mimeType: "image/jpeg", size, uri };
}

/**
 * The camera for Add Document in My Documents: one document. Two modes chosen by a toggle at the top:
 *   "Scan QR" — a bounded frame; a document QR held inside it auto-snaps and uploads on its own.
 *   "Photo"   — full-screen viewfinder + shutter, exactly one shot, then "Upload".
 * Afterwards My Documents opens with that document, to confirm its type. Bulk Upload has no camera: it only takes files.
 */
export function CaptureScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "DocumentCapture">>();
  const patientAwpid = route.params?.patientAwpid;
  const { queueUpload } = useDocumentUpload();
  const insets = useSafeAreaInsets();
  const bottomPad = insets.bottom + 14;                  // the space under the shutter, above the system bar
  const barHeight = BAR_CONTENT + bottomPad;
  const topInset = insets.top + 10;                      // below the status bar (clock, battery)

  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const [mode, setMode] = useState<Mode>("qr");
  const [shot, setShot] = useState<string | null>(null);   // the photo taken (a file path), photo mode
  const [capturing, setCapturing] = useState(false);       // guards double-tap while grabbing a frame
  const [error, setError] = useState("");
  const handledQr = useRef(false);

  // Leave the camera as soon as the upload has been started, without waiting for it to finish (it carries on in the
  // background): My Documents opens with a bar that follows the upload, then the reading, then offers the confirmation.
  const leaveAfterUpload = useCallback(() => {
    setViewingPerson(patientAwpid);          // My Documents shows the person the photo was taken for
    navigation.navigate("MyDocuments");
  }, [navigation, patientAwpid]);

  const grabFrame = useCallback(async (): Promise<string | null> => {
    if (!camRef.current) return null;
    const frame = await camRef.current.takePictureAsync({ quality: 0.7, skipProcessing: true });
    return frame?.uri ?? null;
  }, []);

  // ── QR: capture the frame and upload it as the document ──
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
      const outcome = queueUpload([await shotToCandidate(shotUri, 0)], "instant", patientAwpid);
      if (outcome.status !== "queued") {
        setError(outcome.reason);
        handledQr.current = false;
        setCapturing(false);
        return;
      }
      leaveAfterUpload();
    } catch (err) {
      setError(isPhoneFull(err) ? PHONE_FULL : "Couldn't use the camera. Try again.");
      handledQr.current = false;
      setCapturing(false);
    }
  }, [capturing, grabFrame, queueUpload, patientAwpid, leaveAfterUpload]);

  const onBarcode = useCallback(({ data }: { data: string }) => {
    if (handledQr.current || capturing || !data) return;
    handledQr.current = true;
    captureQr(data);
  }, [capturing, captureQr]);

  // ── Photo: take the one shot ────────────────────────────────────────────
  const takeShot = useCallback(async () => {
    if (capturing || shot) return;
    setCapturing(true);
    try {
      setShot(await grabFrame());
    } catch (err) {
      setError(isPhoneFull(err) ? PHONE_FULL : "Couldn't use the camera. Try again.");
    }
    setCapturing(false);
  }, [capturing, shot, grabFrame]);

  const removeShot = () => {
    if (shot) FileSystem.deleteAsync(shot, { idempotent: true }).catch(() => {});
    setShot(null);
  };

  const uploadShot = useCallback(async () => {
    if (!shot || capturing) return;
    setCapturing(true);                                // a second tap while the photo is being moved would move it twice
    setError("");
    try {
      const candidate = await shotToCandidate(shot, 0);
      const outcome = queueUpload([candidate], "instant", patientAwpid);
      if (outcome.status !== "queued") {
        setError(outcome.reason);
        setShot(candidate.uri);                        // the photo has moved: the thumbnail must point at where it is now
        return;
      }
      setShot(null);
      leaveAfterUpload();
    } catch (err) {
      setError(isPhoneFull(err) ? PHONE_FULL : "Couldn't prepare your photo for upload. Please try again.");
    } finally {
      setCapturing(false);
    }
  }, [shot, capturing, queueUpload, patientAwpid, leaveAfterUpload]);

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
  const aboveBar = barHeight + (!isQr && shot ? TRAY_HEIGHT : 0);     // the free space for the guide and the hint: not under the bar or the thumbnail

  return (
    <View style={styles.fill}>
      <CameraView
        ref={camRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={isQr && !capturing ? onBarcode : undefined}
      />

      {/* mode toggle */}
      <View style={[styles.toggleWrap, { top: topInset }]}>
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
        <View style={[styles.overlay, { bottom: aboveBar }]} pointerEvents="none">
          <View style={styles.reticle} />
          <Text style={styles.hint}>Hold the hospital QR code inside the frame.</Text>
        </View>
      ) : (
        <View style={[styles.overlay, { bottom: aboveBar }]} pointerEvents="none">
          <Text style={styles.hint}>{shot ? "Got it — tap Upload." : "Fit the whole page in view, in good light, then tap the shutter."}</Text>
        </View>
      )}

      <CloseButton variant="overlay" style={[styles.close, { top: topInset }]} onPress={() => navigation.goBack()} />

      {/* photo-mode thumbnail */}
      {!isQr && shot && (
        <View style={[styles.tray, { bottom: barHeight }]}>
          <View style={styles.thumbWrap}>
            <Image source={{ uri: shot }} style={styles.thumb} />
            <Pressable style={styles.thumbX} hitSlop={8} onPress={removeShot}>
              <X size={11} color="#fff" strokeWidth={3} />
            </Pressable>
          </View>
        </View>
      )}

      <View style={[styles.bottomBar, { height: barHeight, paddingBottom: bottomPad }]}>
        {isQr ? (
          <View style={styles.qrStatus}>
            <QrCode size={13} color="#fff" />
            <Text style={styles.qrStatusText}>Auto-detecting…</Text>
          </View>
        ) : (
          <View style={styles.photoBar}>
            <View style={styles.sideSlot} />
            <Pressable style={[styles.shutter, !!shot && styles.shutterOff]} disabled={capturing || !!shot} onPress={takeShot}>
              <View style={styles.shutterInner} />
            </Pressable>
            <View style={styles.sideSlot}>
              {shot && (
                <Pressable style={styles.uploadBtn} onPress={uploadShot}>
                  <Check size={15} color="#111" strokeWidth={3} />
                  <Text style={styles.uploadBtnText}>Upload</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </View>

      {!!error && (
        <View style={[styles.errBar, { bottom: barHeight + 10 }]}>
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

  toggleWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  toggle: { flexDirection: "row", backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 999, padding: 3 },
  toggleBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 18, borderRadius: 999 },
  toggleBtnOn: { backgroundColor: "#fff" },
  toggleText: { color: "#fff", fontSize: 12.5, fontWeight: "600" },
  toggleTextOn: { color: "#111" },

  overlay: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" },
  reticle: { width: "64%", aspectRatio: 1, borderWidth: 3, borderColor: "rgba(255,255,255,0.95)", borderRadius: 20 },
  hint: { color: "#fff", fontSize: 12.5, textAlign: "center", marginTop: 18, paddingHorizontal: 36, lineHeight: 18 },

  close: { position: "absolute", left: 18 },

  tray: { position: "absolute", left: 0, right: 0, paddingVertical: 8, paddingHorizontal: 14 },
  thumbWrap: { width: 52, height: 68, borderRadius: 6, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.6)" },
  thumb: { width: "100%", height: "100%" },
  thumbX: { position: "absolute", top: 2, right: 2, width: 16, height: 16, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center" },

  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 16, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  qrStatus: { flexDirection: "row", alignItems: "center", gap: 7 },
  qrStatusText: { color: "#fff", fontSize: 12, fontWeight: "600" },

  photoBar: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sideSlot: { width: 108, alignItems: "center", justifyContent: "center" },
  shutter: { width: 66, height: 66, borderRadius: 33, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  shutterOff: { opacity: 0.35 },
  shutterInner: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#fff" },
  uploadBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#fff", borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14 },
  uploadBtnText: { color: "#111", fontSize: 12.5, fontWeight: "700" },

  errBar: { position: "absolute", left: 16, right: 16, backgroundColor: "rgba(185,28,28,0.95)", borderRadius: 10, padding: 12 },
  errText: { color: "#fff", fontSize: 12.5, textAlign: "center" },
});
