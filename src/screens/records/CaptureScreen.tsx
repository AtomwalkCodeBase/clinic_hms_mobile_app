import React, { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CameraView, useCameraPermissions } from "expo-camera";
import { X, Camera as CameraIcon, QrCode } from "lucide-react-native";
import { NEUTRAL } from "@/theme/themes";
import { uploadDocument } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { AppStackParamList } from "@/navigation/types";

/**
 * One camera window that does both jobs for "Rx & Reports":
 *   • holds a hospital-document QR in frame  → captures that frame + the QR
 *     token and uploads it (the server verifies + auto-files it), or
 *   • tap the shutter                        → captures the page as a photo
 *     and uploads it (the server reads the page text).
 * Either way it pops back and Rx & Reports reloads on focus.
 */
export function CaptureScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "RxCapture">>();
  const patientAwpid = route.params?.patientAwpid;

  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const handledQr = useRef(false);

  const send = useCallback(
    async (base64: string, qrToken?: string) => {
      setBusy(true);
      setError("");
      try {
        await uploadDocument({
          title: qrToken
            ? `Scanned ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
            : `Photo ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
          doc_type: "other", // server reads the QR / page text and files it
          file_name: `capture-${Date.now()}.jpg`,
          mime_type: "image/jpeg",
          file_data: `data:image/jpeg;base64,${base64}`,
          ...(qrToken ? { qr_token: qrToken } : {}),
          ...(patientAwpid ? { patient_awpid: patientAwpid } : {}),
        });
        navigation.goBack();
      } catch (err) {
        setError(apiErrorMessage(err, "Couldn't upload that. Try again."));
        handledQr.current = false;
        setBusy(false);
      }
    },
    [navigation, patientAwpid],
  );

  const capture = useCallback(async (qrToken?: string) => {
    if (busy || !camRef.current) return;
    try {
      const shot = await camRef.current.takePictureAsync({ quality: 0.7, base64: true, skipProcessing: true });
      if (shot?.base64) await send(shot.base64, qrToken);
    } catch {
      setError("Couldn't use the camera. Try again.");
      handledQr.current = false;
    }
  }, [busy, send]);

  const onBarcode = useCallback(({ data }: { data: string }) => {
    if (handledQr.current || busy || !data) return;
    handledQr.current = true;
    capture(data);
  }, [busy, capture]);

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

  return (
    <View style={styles.fill}>
      <CameraView
        ref={camRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={busy ? undefined : onBarcode}
      />

      {/* framing guide */}
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.reticle} />
        <Text style={styles.hint}>
          Hold a QR code in the frame, or tap the shutter to capture the page.
        </Text>
      </View>

      <Pressable style={styles.close} hitSlop={12} onPress={() => navigation.goBack()}>
        <X size={22} color="#fff" strokeWidth={2.4} />
      </Pressable>

      <View style={styles.bottomBar}>
        <View style={styles.modeChip}>
          <QrCode size={13} color="#fff" />
          <Text style={styles.modeChipText}>Auto-scans QR</Text>
        </View>
        <Pressable style={styles.shutter} disabled={busy} onPress={() => capture()}>
          <View style={styles.shutterInner} />
        </Pressable>
        <View style={{ width: 96 }} />
      </View>

      {busy && (
        <View style={styles.busy} pointerEvents="none">
          <ActivityIndicator color="#fff" />
          <Text style={styles.busyText}>Uploading…</Text>
        </View>
      )}
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

  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  reticle: { width: "62%", aspectRatio: 1, borderWidth: 3, borderColor: "rgba(255,255,255,0.9)", borderRadius: 20 },
  hint: { color: "#fff", fontSize: 12.5, textAlign: "center", marginTop: 18, paddingHorizontal: 40, lineHeight: 18 },

  close: { position: "absolute", top: Platform.OS === "ios" ? 56 : 24, left: 18, width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },

  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingBottom: Platform.OS === "ios" ? 40 : 28, paddingTop: 18, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(0,0,0,0.35)" },
  modeChip: { width: 96, flexDirection: "row", alignItems: "center", gap: 5 },
  modeChipText: { color: "#fff", fontSize: 10.5, fontWeight: "600" },
  shutter: { width: 68, height: 68, borderRadius: 34, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  shutterInner: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#fff" },

  busy: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.45)", gap: 10 },
  busyText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  errBar: { position: "absolute", left: 16, right: 16, bottom: 118, backgroundColor: "rgba(185,28,28,0.95)", borderRadius: 10, padding: 12 },
  errText: { color: "#fff", fontSize: 12.5, textAlign: "center" },
});
