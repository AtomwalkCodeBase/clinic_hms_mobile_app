import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { CheckCircle2, UploadCloud } from "lucide-react-native";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";

/**
 * Shown from the moment Upload is pressed until the server has the files: its progress, and the reminder to keep the
 * app open. When the files are in, it says so and that the app can be left now. The patient can hide it (back button or
 * Hide) and go on using the app; the status bar carries on showing the progress.
 */
export function UploadingModal({
  visible, stage, pct, count, onHide,
}: {
  visible: boolean;
  stage: "sending" | "done";
  pct: number;
  count: number;
  onHide: () => void;
}) {
  const { theme } = useAppTheme();
  const sending = stage === "sending";
  const files = `${count} file${count === 1 ? "" : "s"}`;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onHide} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: sending ? NEUTRAL.surfaceAlt : theme.bg }]}>
            {sending
              ? <UploadCloud size={26} color={NEUTRAL.textSecondary} strokeWidth={2.2} />
              : <CheckCircle2 size={26} color={theme.text} strokeWidth={2.2} />}
          </View>
          <Text style={styles.title}>{sending ? `Uploading ${files}` : "Upload complete"}</Text>

          {sending ? (
            <>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.max(4, pct)}%`, backgroundColor: theme.fill }]} />
              </View>
              <Text style={styles.pct}>{pct}%</Text>
              <Text style={styles.body}>
                Please keep the app open until the upload is complete. It can take a little while on a slow connection.
              </Text>
            </>
          ) : (
            <Text style={styles.body}>
              Your files are uploaded. You can use other apps now. We are reading your documents and will tell you when they are ready.
            </Text>
          )}

          <Pressable onPress={onHide} style={styles.hide} accessibilityRole="button" accessibilityLabel={sending ? "Hide" : "Close"}>
            <Text style={styles.hideText}>{sending ? "Hide" : "Close"}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(12,35,64,0.45)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  card: {
    width: "100%", maxWidth: 360, backgroundColor: NEUTRAL.surface, borderRadius: 22, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 10,
    alignItems: "center", shadowColor: "#0C2340", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 18, elevation: 10,
  },
  iconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  title: { fontSize: 17, fontWeight: "700", color: NEUTRAL.textPrimary, textAlign: "center", marginBottom: 14 },
  track: { alignSelf: "stretch", height: 8, borderRadius: 4, backgroundColor: NEUTRAL.surfaceAlt, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  pct: { fontSize: 13, fontWeight: "700", color: NEUTRAL.textSecondary, marginTop: 8, marginBottom: 10 },
  body: { fontSize: 13.5, lineHeight: 19, color: NEUTRAL.textSecondary, textAlign: "center", marginBottom: 6 },
  hide: { alignSelf: "stretch", alignItems: "center", paddingVertical: 12 },
  hideText: { fontSize: 14.5, fontWeight: "700", color: NEUTRAL.textSecondary },
});
