import { Image } from "expo-image";
import { previewHeaders } from "@/api/previewSource";

/**
 * Loads document previews a few at a time, in list order, so a screen of 50 files never fires 50 requests at once and
 * the files at the top of the list get their pictures first. A picture that is already on the phone resolves at once.
 * `Image.prefetch` puts each one in expo-image's disk cache under its address, which is what <Image> later reads.
 */
const MAX_AT_ONCE = 4;
const done = new Set<string>();                 // addresses already on the phone this session
const waiting = new Map<string, { priority: number; callbacks: ((ok: boolean) => void)[] }>();
let running = 0;

export const isPreviewLoaded = (url: string) => done.has(url);

export function requestPreview(url: string, priority = 0): Promise<boolean> {
  if (done.has(url)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const entry = waiting.get(url);
    if (entry) {
      entry.priority = Math.min(entry.priority, priority);
      entry.callbacks.push(resolve);
    } else {
      waiting.set(url, { priority, callbacks: [resolve] });
    }
    pump();
  });
}

/**
 * Forget the queue and every saved preview picture. Called wherever the app drops the previous person's saved screens
 * (sign-in, sign-out, an expired session), so a document preview never outlives the account it belongs to.
 */
export function clearPreviewCache() {
  done.clear();
  waiting.forEach((e) => e.callbacks.forEach((cb) => cb(false)));
  waiting.clear();
  Image.clearMemoryCache().catch(() => {});
  Image.clearDiskCache().catch(() => {});
}

async function pump() {
  while (running < MAX_AT_ONCE && waiting.size) {
    let next: string | null = null;
    let best = Infinity;
    waiting.forEach((e, url) => {
      if (e.priority < best) { best = e.priority; next = url; }
    });
    if (!next) return;
    const url: string = next;
    const entry = waiting.get(url)!;
    waiting.delete(url);
    running += 1;
    (async () => {
      let ok = false;
      try {
        ok = await Image.prefetch(url, { cachePolicy: "disk", headers: await previewHeaders() });
      } catch {
        ok = false;
      }
      if (ok) done.add(url);
      entry.callbacks.forEach((cb) => cb(ok));
      running -= 1;
      pump();
    })();
  }
}
