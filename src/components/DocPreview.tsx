import { useEffect, useState } from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Eye } from "lucide-react-native";
import { SkeletonBlock } from "@/components/Skeleton";
import { docTypeStyle } from "@/theme/docTypes";
import { previewHeaders, previewUrl } from "@/api/previewSource";
import { isPreviewLoaded, requestPreview } from "@/utils/previewQueue";

/**
 * The picture of a document: a grey shimmer box while it loads in the background (4 at a time, in list order), then
 * the real preview fades in. If the server can't draw it (a damaged file, say) the document's coloured type icon is
 * shown instead, so a row is never an empty box. `order` is the row's place in the list: the top rows load first.
 */
export function DocPreview({
  id, typeCode, patientAwpid, order = 0, width = 300, style, showEye = true,
}: {
  id: number;
  typeCode?: string | null;
  patientAwpid?: string;
  order?: number;
  width?: number;
  style?: ViewStyle;
  showEye?: boolean;
}) {
  const url = previewUrl(id, { width, patientAwpid });
  const [ready, setReady] = useState(isPreviewLoaded(url));
  const [failed, setFailed] = useState(false);
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    if (isPreviewLoaded(url)) setReady(true);
    else {
      setReady(false);
      requestPreview(url, order).then((ok) => { if (alive) { if (ok) setReady(true); else setFailed(true); } });
    }
    return () => { alive = false; };
  }, [url, order]);

  useEffect(() => {
    let alive = true;
    previewHeaders().then((h) => { if (alive) setHeaders(h); });
    return () => { alive = false; };
  }, []);

  const t = docTypeStyle(typeCode);
  return (
    <View style={[styles.box, style]}>
      {failed ? (
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: t.tint }]}>
          <t.Icon size={22} color={t.ink} strokeWidth={2} />
        </View>
      ) : ready && headers ? (
        <Image
          source={{ uri: url, headers }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="top"
          transition={180}
          cachePolicy="disk"
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <SkeletonBlock width="100%" height={1} radius={0} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, height: "100%" }} />
      )}
      {showEye && !failed && (
        <View style={styles.eye}><Eye size={11} color="#FFFFFF" strokeWidth={2.4} /></View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: "hidden", backgroundColor: "#EEF2F7" },
  center: { alignItems: "center", justifyContent: "center" },
  eye: { position: "absolute", right: 4, bottom: 4, width: 19, height: 19, borderRadius: 10, backgroundColor: "rgba(12,35,64,0.85)", alignItems: "center", justifyContent: "center" },
});
