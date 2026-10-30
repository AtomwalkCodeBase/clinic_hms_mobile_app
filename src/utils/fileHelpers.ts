import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { shrinkPhoto } from "@/utils/imageCompress";
import { ALLOWED_MIME } from "@/utils/uploadLimits";

export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  /** Bytes, when the picker reports it (DocumentPicker does; not always populated by every source). */
  size?: number;
}

const UPLOAD_STAGING_DIR = `${FileSystem.documentDirectory}pending-uploads/`;
/** Where downloaded / shared copies of a person's documents are written, so sign-out can delete exactly these. */
const SHARE_DIR = `${FileSystem.cacheDirectory}aw-shared/`;

/** Where PDFs are saved while the in-app viewer shows them (see PdfViewer); wiped with the other private files. */
export const VIEW_DIR = `${FileSystem.cacheDirectory}aw-view/`;

/**
 * Deletes every copy of a person's documents the app has left on the phone: files made for sharing or saving, files
 * staged for upload, and the pickers' temporary copies. Called on sign-out and sign-in so the next person using the
 * phone does not inherit them. Only the app's own folders; the gallery and Downloads are never touched.
 */
export async function wipePrivateFiles(): Promise<void> {
  const cache = FileSystem.cacheDirectory ?? "";
  const dirs = [UPLOAD_STAGING_DIR, SHARE_DIR, VIEW_DIR, `${cache}ImagePicker/`, `${cache}DocumentPicker/`, `${cache}Camera/`];
  await Promise.all(dirs.map((d) => FileSystem.deleteAsync(d, { idempotent: true }).catch(() => {})));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * DocumentPicker's `getDocumentAsync({ copyToCacheDirectory: true })` can resolve its JS promise
 * before the freshly-copied cache file is actually openable for a real byte-level read — confirmed
 * on-device: `getInfoAsync` (a stat() call — exists + size) reports the file present and non-empty
 * immediately, yet the very next `copyAsync` (an actual open()/read()) on that same URI still
 * throws "isn't readable". So a metadata check alone doesn't prove the file is readable — only
 * retrying the real read operation does. This retries copyAsync itself, since that's the operation
 * that actually needs to succeed, not a proxy for it.
 */
async function copyWithRetry(from: string, to: string, attempts = 6, delayMs = 200): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      await FileSystem.copyAsync({ from, to });
      return;
    } catch (err) {
      if (i === attempts - 1) throw err;
      await sleep(delayMs);
    }
  }
}

/**
 * Copies a picked file out of DocumentPicker's cache copy into the app's own persistent storage.
 * Uploading happens after the pick, with a network round-trip in between — Android can reclaim a cache-directory file at any time, and MIUI in
 * particular does this aggressively for Expo Go, so a file that read fine right after picking can
 * throw "isn't readable" by the time the PUT actually runs. documentDirectory isn't OS-reclaimable
 * the way cacheDirectory is, so staging here closes that window. Callers delete the staged copy
 * once the upload succeeds (see DocumentUploadContext.startUpload).
 */
async function stageForUpload(sourceUri: string, name: string, index = 0): Promise<{ uri: string; size: number }> {
  await FileSystem.makeDirectoryAsync(UPLOAD_STAGING_DIR, { intermediates: true }).catch(() => {});
  // The index keeps two same-named files picked in the same millisecond from overwriting each other.
  const dest = `${UPLOAD_STAGING_DIR}${Date.now()}-${index}-${name}`;
  await copyWithRetry(sourceUri, dest);
  // The picker's own size is sometimes missing; the staged copy's size is the truth about what will be sent.
  const info = await FileSystem.getInfoAsync(dest).catch(() => null);
  return { uri: dest, size: info && info.exists ? info.size : 0 };
}

/**
 * Opens the system file picker for PDFs / images — several in one pick by default (Bulk Upload), or exactly one
 * (Add Document: `pickDocuments(false)`). Returns [] if the user cancels.
 */
/** Some pickers hand over a URL-encoded name ("Complete%20Blood%20Count.pdf"); show and send the readable one. */
function readableName(name: string): string {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

/** Deletes the copies pickDocuments made, for files the patient decided not to upload. */
export async function discardPicked(files: { uri: string }[]): Promise<void> {
  await Promise.all(files.map((f) => FileSystem.deleteAsync(f.uri, { idempotent: true }).catch(() => {})));
}

export async function pickDocuments(multiple = true): Promise<PickedFile[]> {
  // copyToCacheDirectory: false — DocumentPicker's own cache copy lands in the app's raw
  // context.cacheDir, not the per-experience sandboxed folder Expo Go's FileSystem module reads
  // from, so a subsequent copyAsync/uploadAsync on that path throws "isn't readable" even though
  // the bytes are genuinely there. Staging straight from the picker's original content:// URI into
  // our own documentDirectory (which IS in the sandboxed folder) avoids that mismatch entirely.
  const result = await DocumentPicker.getDocumentAsync({
    type: ALLOWED_MIME,          // exactly what the server accepts: other kinds (Word, HEIC, WebP) cannot be chosen
    multiple,
    copyToCacheDirectory: false,
  });
  if (result.canceled || !result.assets?.length) return [];
  const staged = await Promise.allSettled(result.assets.map(async (a, i) => {
    const rawName = a.name || "document";
    const mimeType = a.mimeType || (a.name?.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
    const copy = await stageForUpload(a.uri, rawName, i);      // the raw name: a decoded "%2F" would turn into a path
    let size = copy.size || a.size || 0;
    if (mimeType === "image/jpeg" || mimeType === "image/png") size = await shrinkPhoto(copy.uri, mimeType, size);      // photos only: a PDF is sent as it is
    return { uri: copy.uri, name: readableName(rawName), mimeType, size };
  }));
  const files = staged.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  // One unreadable file must not lose the others; only when none could be read is it an error.
  if (!files.length) throw new Error("Those files could not be read. Pick them again.");
  return files;
}

/** Opens the photo library restricted to images. Returns null if the user cancels or denies permission. */
export async function pickImage(): Promise<PickedFile | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.85,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const mimeType = asset.mimeType || (asset.uri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
  const name = asset.fileName || `photo.${mimeType === "image/png" ? "png" : "jpg"}`;
  return { uri: asset.uri, name, mimeType };
}

/** Opens the camera restricted to a square photo. Returns null if the user cancels or denies permission. */
export async function pickImageFromCamera(): Promise<PickedFile | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.85,
    allowsEditing: true,
    aspect: [1, 1],
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const mimeType = asset.mimeType || "image/jpeg";
  const name = asset.fileName || "photo.jpg";
  return { uri: asset.uri, name, mimeType };
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
/** Which path saveOrShare actually took — the caller uses this to word its success message accurately. */
type SaveOutcome = "saved" | "shared";

async function saveOrShare(fileName: string, mimeType: string, base64Content: string): Promise<SaveOutcome> {
  if (Platform.OS === "android") {
    try {
      if (await saveToDeviceAndroid(fileName, mimeType, base64Content)) return "saved";
    } catch {
      // SAF itself failed (not just a user cancel) — fall through to share.
    }
  }
  await FileSystem.makeDirectoryAsync(SHARE_DIR, { intermediates: true }).catch(() => {});
  const path = `${SHARE_DIR}${fileName}`;
  await FileSystem.writeAsStringAsync(path, base64Content, { encoding: FileSystem.EncodingType.Base64 });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Couldn't save this file — no folder was chosen and sharing isn't available on this device.");
  }
  await Sharing.shareAsync(path, { mimeType, dialogTitle: fileName });
  return "shared";
}

/**
 * Downloads a file to the device (see saveOrShare for platform behavior).
 * `source` is usually a base64 data URI, but some endpoints (lab reports,
 * vaccination certs — anything backed by S3 storage, see core/storage.py's
 * signed_url()) now return a real, short-lived HTTPS URL under the same
 * field instead. Fetch that URL to a local file first so the rest of the
 * save/share path can stay unchanged either way.
 */
export async function downloadDataUri(fileName: string, source: string): Promise<SaveOutcome> {
  if (!source.startsWith("data:")) {
    await FileSystem.makeDirectoryAsync(SHARE_DIR, { intermediates: true }).catch(() => {});
    const dest = `${SHARE_DIR}${fileName}`;
    const result = await FileSystem.downloadAsync(source, dest);
    const mime = result.mimeType || result.headers?.["Content-Type"]?.split(";")[0] || "application/octet-stream";
    const base64 = await FileSystem.readAsStringAsync(result.uri, { encoding: FileSystem.EncodingType.Base64 });
    return saveOrShare(fileName, mime, base64);
  }
  const { mime, base64 } = base64FromDataUri(source);
  return saveOrShare(fileName, mime, base64);
}
