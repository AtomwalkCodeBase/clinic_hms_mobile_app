import { Image } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

// A phone photo is 3000-4000 px and several MB. At 3000 px / 85% the document OCR reads as much as it does from the
// untouched photo (tested on 20 phone-style document photos); at 2000 px / 80% it lost about a fifth of the words.
const MAX_SIDE = 3000;
const QUALITY = 0.85;
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
    // Loaded here, not at the top: a build made before expo-image-manipulator was added has no native code for it, and
    // importing it would crash the whole app at start. Without it the photo is simply uploaded as it is.
    const { manipulateAsync, SaveFormat } = require("expo-image-manipulator") as typeof import("expo-image-manipulator");
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
    // The original is only set aside until the smaller one is in place, so a failed move can never leave the photo lost.
    const aside = `${uri}.orig`;
    await FileSystem.moveAsync({ from: uri, to: aside });
    try {
      await FileSystem.moveAsync({ from: out.uri, to: uri });
    } catch (err) {
      await FileSystem.moveAsync({ from: aside, to: uri }).catch(() => {});
      throw err;
    }
    await FileSystem.deleteAsync(aside, { idempotent: true }).catch(() => {});
    return smaller;
  } catch {
    return size;
  }
}
