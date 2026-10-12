import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import { VIEW_DIR } from "@/utils/fileHelpers";

/**
 * The PDF page view (react-native-pdf: pinch and double-tap zoom, smooth scrolling through the pages, sharp text).
 * It is native code, so it needs the full app build; Expo Go doesn't have it. There it shows a short message instead
 * of crashing, and everything else in the app keeps working.
 *
 * The file is downloaded here, not by the library: react-native-pdf fetches web addresses with react-native-blob-util,
 * whose HTTPS client fails on current Android ("Use of own trust manager but none defined"). Given a file already on
 * the phone it never touches the network. The copy lives in VIEW_DIR, which sign-out and sign-in delete.
 */
const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
let PdfView: any = null;
if (!inExpoGo) {
  try {
    PdfView = require("react-native-pdf").default;
  } catch {
    PdfView = null;
  }
}

/** A short, file-name-safe key for an address, ignoring the changing parts of a signed link (everything after "?"). */
function keyFor(uri: string): string {
  const base = uri.split("?")[0];
  let h = 5381;
  for (let i = 0; i < base.length; i++) h = ((h * 33) ^ base.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

export function PdfViewer({ uri, onReady, onError }: { uri: string; onReady?: () => void; onError?: () => void }) {
  const isWeb = /^https?:/i.test(uri);
  const [localUri, setLocalUri] = useState<string | null>(isWeb ? null : uri);

  // Without the native reader there is nothing to wait for: drop the loading screen so the message below shows.
  useEffect(() => { if (!PdfView) onReady?.(); }, [onReady]);

  useEffect(() => {
    if (!PdfView || !isWeb) return;
    let live = true;
    (async () => {
      try {
        await FileSystem.makeDirectoryAsync(VIEW_DIR, { intermediates: true }).catch(() => {});
        const dest = `${VIEW_DIR}${keyFor(uri)}.pdf`;
        const have = await FileSystem.getInfoAsync(dest);
        if (!have.exists) {
          const res = await FileSystem.downloadAsync(uri, dest);
          if (res.status !== 200) {
            await FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => {});
            throw new Error(`download answered ${res.status}`);
          }
        }
        if (live) setLocalUri(dest);
      } catch {
        if (live) onError?.();
      }
    })();
    return () => { live = false; };
  }, [uri, isWeb]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!PdfView) {
    return (
      <View style={styles.msg}>
        <Text style={styles.title}>PDFs open in the full app</Text>
        <Text style={styles.sub}>This test version can't draw PDF pages. Photos work here.</Text>
      </View>
    );
  }
  if (!localUri) return null;   // downloading: the viewer's own "Loading document..." screen is showing
  return (
    <PdfView
      source={{ uri: localUri, cache: false }}
      style={styles.pdf}
      horizontal={false}
      enablePaging={false}
      fitPolicy={0}
      spacing={10}
      minScale={1}
      maxScale={5}
      enableDoubleTapZoom
      renderActivityIndicator={() => null}
      onLoadComplete={() => onReady?.()}
      onError={() => onError?.()}
    />
  );
}

const styles = StyleSheet.create({
  pdf: { flex: 1, width: "100%", backgroundColor: "#0b0f14" },
  msg: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  title: { color: "#FFFFFF", fontSize: 15, fontWeight: "700", textAlign: "center" },
  sub: { color: "#9fb0c3", fontSize: 12.5, textAlign: "center", marginTop: 6, lineHeight: 18 },
});
