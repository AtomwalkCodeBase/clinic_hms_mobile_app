import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { withBiometricSuppressed } from "./biometricSuppress";

export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
}

/** Opens the system file picker restricted to PDFs. Returns null if the user cancels. */
export async function pickPdf(): Promise<PickedFile | null> {
  return withBiometricSuppressed(async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];
    return { uri: asset.uri, name: asset.name || "report.pdf", mimeType: asset.mimeType || "application/pdf" };
  });
}

/** Opens the photo library restricted to images. Returns null if the user cancels or denies permission. */
export async function pickImage(): Promise<PickedFile | null> {
  return withBiometricSuppressed(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return null;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];
    const mimeType = asset.mimeType || (asset.uri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
    const name = asset.fileName || `photo.${mimeType === "image/png" ? "png" : "jpg"}`;
    return { uri: asset.uri, name, mimeType };
  });
}

/** Opens the camera restricted to a square photo. Returns null if the user cancels or denies permission. */
export async function pickImageFromCamera(): Promise<PickedFile | null> {
  return withBiometricSuppressed(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return null;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];
    const mimeType = asset.mimeType || "image/jpeg";
    const name = asset.fileName || "photo.jpg";
    return { uri: asset.uri, name, mimeType };
  });
}

/** Reads a local file into a base64 data URI, ready to POST to the backend. */
export async function fileToDataUri(file: PickedFile): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
  return `data:${file.mimeType};base64,${base64}`;
}

function base64FromDataUri(dataUri: string): { mime: string; base64: string } {
  const [header, payload] = dataUri.split(",", 2);
  const mime = header.slice(5).split(";")[0] || "application/octet-stream";
  return { mime, base64: payload || "" };
}

// Android's SAF grant (from requestDirectoryPermissionsAsync) is
// persistable across app restarts — Expo already takes the persistable
// permission under the hood — but *asking* for it always re-shows the
// folder picker regardless of a prior grant. Remembering the chosen
// directoryUri ourselves is what turns "pick a folder every single
// download" into "pick it once, every download after that is silent",
// which is what a real download button should feel like.
const SAVED_DIR_KEY = "aw_download_dir_uri";

/**
 * Android: writes straight into a folder the user granted access to — a
 * real "Save As", the literal meaning of "download". Reuses a previously
 * granted folder silently; only opens the folder picker the very first
 * time, or again later if that folder's permission stops working (moved/
 * revoked/uninstalled SD card, etc). Returns true if written, false if the
 * user backs out of the (first-time) folder picker — caller falls back to
 * sharing in that case, not silence.
 */
async function saveToDeviceAndroid(fileName: string, mimeType: string, base64Content: string): Promise<boolean> {
  const dot = fileName.lastIndexOf(".");
  const baseName = dot > 0 ? fileName.slice(0, dot) : fileName;
  // SAF's createFileAsync doesn't overwrite or auto-rename — re-downloading
  // the same document (same title -> same fileName every time) would throw
  // "file already exists" here without this.
  const uniqueName = `${baseName}_${Date.now()}`;

  const savedDirUri = await AsyncStorage.getItem(SAVED_DIR_KEY);
  if (savedDirUri) {
    try {
      const destUri = await FileSystem.StorageAccessFramework.createFileAsync(savedDirUri, uniqueName, mimeType);
      await FileSystem.writeAsStringAsync(destUri, base64Content, { encoding: FileSystem.EncodingType.Base64 });
      return true;
    } catch {
      // The remembered folder no longer works — fall through and ask again.
      await AsyncStorage.removeItem(SAVED_DIR_KEY);
    }
  }

  const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!perm.granted) return false;
  await AsyncStorage.setItem(SAVED_DIR_KEY, perm.directoryUri);
  const destUri = await FileSystem.StorageAccessFramework.createFileAsync(perm.directoryUri, uniqueName, mimeType);
  await FileSystem.writeAsStringAsync(destUri, base64Content, { encoding: FileSystem.EncodingType.Base64 });
  return true;
}

/**
 * Save-to-folder is the primary path on Android (a real download, not just
 * a share). Falls back to the OS share sheet only when the user backs out
 * of the folder picker or SAF itself fails — and unlike the version of
 * this that shipped earlier, a share sheet that isn't available throws a
 * real error instead of silently doing nothing, which is what made the
 * download buttons look broken with no feedback at all.
 */
async function saveOrShare(fileName: string, mimeType: string, base64Content: string): Promise<void> {
  if (Platform.OS === "android") {
    try {
      if (await saveToDeviceAndroid(fileName, mimeType, base64Content)) return;
    } catch {
      // SAF itself failed (not just a user cancel) — fall through to share.
    }
  }
  const path = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(path, base64Content, { encoding: FileSystem.EncodingType.Base64 });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Couldn't save this file — no folder was chosen and sharing isn't available on this device.");
  }
  await Sharing.shareAsync(path, { mimeType, dialogTitle: fileName });
}

/**
 * Downloads a file to the device (see saveOrShare for platform behavior).
 * `source` is usually a base64 data URI, but some endpoints (lab reports,
 * vaccination certs — anything backed by S3 storage, see core/storage.py's
 * signed_url()) now return a real, short-lived HTTPS URL under the same
 * field instead. Fetch that URL to a local file first so the rest of the
 * save/share path can stay unchanged either way.
 */
export async function downloadDataUri(fileName: string, source: string): Promise<void> {
  if (!source.startsWith("data:")) {
    const dest = `${FileSystem.cacheDirectory}${fileName}`;
    const result = await FileSystem.downloadAsync(source, dest);
    const mime = result.mimeType || result.headers?.["Content-Type"]?.split(";")[0] || "application/octet-stream";
    const base64 = await FileSystem.readAsStringAsync(result.uri, { encoding: FileSystem.EncodingType.Base64 });
    await saveOrShare(fileName, mime, base64);
    return;
  }
  const { mime, base64 } = base64FromDataUri(source);
  await saveOrShare(fileName, mime, base64);
}

/**
 * Renders simple HTML to a real PDF (expo-print) and downloads it — used
 * for reports constructed here (e.g. a lab result summary with no
 * underlying uploaded file), where a plain .txt dump isn't what "download
 * this report" should mean.
 */
export async function downloadHtmlAsPdf(fileName: string, html: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  await saveOrShare(fileName, "application/pdf", base64);
}
