import { Image } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

// A phone photo is 3000-4000 px and several MB; a page of text stays perfectly readable (and OCR works) at 2000 px.
const MAX_SIDE = 2000;
const QUALITY = 0.8;
// A photo already this small and not oversized is left alone: re-saving it would only lose quality.
const LEAVE_ALONE_BYTES = 1024 * 1024;

const dimensions = (uri: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) =>
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject));

/**
 * Makes a photo smaller where it is: the file at `uri` is replaced by a resized, recompressed copy and its new size is
 * returned. Never fails the upload: if anything goes wrong, or the result would not be smaller, the original stays and
 * its size is returned. PDFs are never passed here.
 */
export async function shrinkPhoto(uri: string, mimeType: string, size: number): Promise<number> {
  try {
    const { width, height } = await dimensions(uri);
    const longest = Math.max(width, height);
    if (size > 0 && size <= LEAVE_ALONE_BYTES && longest <= MAX_SIDE) return size;
    const resize = longest > MAX_SIDE ? [{ resize: width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE } }] : [];
    const out = await manipulateAsync(uri, resize, {
      compress: QUALITY,
      format: mimeType === "image/png" ? SaveFormat.PNG : SaveFormat.JPEG,
    });
    const info = await FileSystem.getInfoAsync(out.uri);
    const smaller = info.exists ? info.size : 0;
    if (!smaller || (size > 0 && smaller >= size)) {
      await FileSystem.deleteAsync(out.uri, { idempotent: true }).catch(() => {});
      return size;
    }
    await FileSystem.deleteAsync(uri, { idempotent: true });
    await FileSystem.moveAsync({ from: out.uri, to: uri });
    return smaller;
  } catch {
    return size;
  }
}
