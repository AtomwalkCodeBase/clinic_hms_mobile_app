import * as FileSystem from "expo-file-system/legacy";
import type { UploadMode } from "@/api/portal";

/** One file waiting to be sent: our own staged copy on the phone, never a path the picker still owns. */
export type PendingFile = { name: string; mimeType: string; size: number; uri: string };
export type PendingUpload = { files: PendingFile[]; mode: UploadMode; patientAwpid?: string };

// Lives in the same folder as the staged copies (utils/fileHelpers), so signing out or in, which wipes that folder,
// removes this note too and the next person never sees someone else's files.
const DIR = `${FileSystem.documentDirectory}pending-uploads/`;
const NOTE = `${DIR}pending.json`;

/** Remembers a batch before it is sent, so an upload cut off by the app closing or the phone switching off can be offered again. */
export async function savePending(p: PendingUpload): Promise<void> {
  try {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
    await FileSystem.writeAsStringAsync(NOTE, JSON.stringify(p));
  } catch {
    // Not being able to remember a batch must never stop it from being sent.
  }
}

/** The batch left over from an earlier run, with only the files still on the phone; null when there is nothing to offer. */
export async function loadPending(): Promise<PendingUpload | null> {
  try {
    const info = await FileSystem.getInfoAsync(NOTE);
    if (!info.exists) return null;
    const p = JSON.parse(await FileSystem.readAsStringAsync(NOTE)) as PendingUpload;
    const checked = await Promise.all((p.files ?? []).map(async (f) => ((await FileSystem.getInfoAsync(f.uri).catch(() => null))?.exists ? f : null)));
    const files = checked.filter((f): f is PendingFile => !!f);
    if (!files.length) {
      await clearPending();
      return null;
    }
    return { files, mode: p.mode, patientAwpid: p.patientAwpid };
  } catch {
    return null;
  }
}

export async function clearPending(): Promise<void> {
  await FileSystem.deleteAsync(NOTE, { idempotent: true }).catch(() => {});
}
