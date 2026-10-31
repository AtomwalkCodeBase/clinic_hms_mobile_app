import { Modal, StyleSheet, Text, View } from "react-native";
import { AlertTriangle } from "lucide-react-native";
import { NEUTRAL } from "@/theme/themes";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";

/**
 * Said once, on whatever screen the patient is on, when an upload that carried on in the background (the camera, Add
 * Document) did not get through: why, and that the files are still on the phone. "Try again" sends them again; "Not now"
 * closes this and leaves the retry bar for later.
 */
export function UploadFailedModal({
  visible, message, onRetry, onClose,
}: {
  visible: boolean;
  message: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}><AlertTriangle size={26} color={NEUTRAL.danger} strokeWidth={2.2} /></View>
          <Text style={styles.title}>Upload didn't finish</Text>
          <Text style={styles.body}>{message}</Text>
          <Text style={styles.keep}>Your files are still on this phone.</Text>
          <PrimaryButton label="Try again" onPress={onRetry} style={styles.full} />
          <SecondaryButton label="Not now" onPress={onClose} style={styles.full} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(12,35,64,0.45)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  card: {
    width: "100%", maxWidth: 360, backgroundColor: NEUTRAL.surface, borderRadius: 22, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 16,
    alignItems: "center", shadowColor: "#0C2340", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 18, elevation: 10,
  },
  iconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", marginBottom: 12, backgroundColor: NEUTRAL.dangerBg },
  title: { fontSize: 17, fontWeight: "700", color: NEUTRAL.textPrimary, textAlign: "center", marginBottom: 8 },
  body: { fontSize: 13.5, lineHeight: 19, color: NEUTRAL.textSecondary, textAlign: "center" },
  keep: { fontSize: 12.5, color: NEUTRAL.textMuted, textAlign: "center", marginTop: 8, marginBottom: 14 },
  full: { alignSelf: "stretch", marginBottom: 8 },
});
