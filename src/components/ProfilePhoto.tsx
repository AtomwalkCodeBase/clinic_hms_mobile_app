import { useState } from "react";
import { View, Text, Image, Pressable, Modal, StyleSheet } from "react-native";
import { Camera } from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { CloseButton } from "@/components/IconButtons";
import { NEUTRAL, ON_BRAND, BRAND_DEEP } from "@/theme/themes";
import { updateProfile } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { pickImage, pickImageFromCamera, fileToDataUri } from "@/utils/fileHelpers";

/**
 * Taking, choosing and removing the patient's profile photo, shared by the Profile page and the Home header. The new
 * photo goes into the same ["profile"] cache entry every screen reads, so it shows up everywhere at once.
 */
export function useProfilePhoto(onError: (message: string) => void) {
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const pick = async (source: "camera" | "gallery") => {
    setSheetOpen(false);
    try {
      const file = source === "camera" ? await pickImageFromCamera() : await pickImage();
      if (!file) return;
      setBusy(true);
      const dataUri = await fileToDataUri(file);
      const updated = await updateProfile({ photo: dataUri });
      queryClient.setQueryData(["profile"], updated);
    } catch (err) {
      onError(apiErrorMessage(err, "Couldn't update your photo."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setSheetOpen(false);
    setBusy(true);
    try {
      const updated = await updateProfile({ photo: "" });
      queryClient.setQueryData(["profile"], updated);
    } catch (err) {
      onError(apiErrorMessage(err, "Couldn't remove your photo."));
    } finally {
      setBusy(false);
    }
  };

  return { sheetOpen, openSheet: () => setSheetOpen(true), closeSheet: () => setSheetOpen(false), busy, pick, remove };
}

/** The round profile picture: the saved photo, or the first letter of the name, with a small camera button to change it. */
export function ProfileAvatar({
  photo, name, size = 56, busy, onPress,
}: {
  photo?: string | null;
  name?: string | null;
  size?: number;
  busy?: boolean;
  onPress: () => void;
}) {
  const cam = Math.round(size * 0.46);
  return (
    <Pressable onPress={onPress} disabled={busy} hitSlop={6} accessibilityRole="button" accessibilityLabel="Change profile photo" style={{ width: size, height: size }}>
      <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.avatarImg} />
        ) : (
          <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{name?.[0]?.toUpperCase() || "?"}</Text>
        )}
      </View>
      <View style={[styles.camBtn, { width: cam, height: cam, borderRadius: cam / 2 }]}>
        {busy ? <Text style={styles.camBusy}>…</Text> : <Camera size={Math.round(cam * 0.5)} color={BRAND_DEEP} strokeWidth={2.4} />}
      </View>
    </Pressable>
  );
}

/** The bottom sheet that opens from the avatar: take a photo, choose one, or remove the current one. */
export function ProfilePhotoSheet({
  visible, hasPhoto, onClose, onPick, onRemove,
}: {
  visible: boolean;
  hasPhoto: boolean;
  onClose: () => void;
  onPick: (source: "camera" | "gallery") => void;
  onRemove: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <CloseButton onPress={onClose} style={{ position: "absolute", top: 12, right: 14, zIndex: 1 }} />
          <Text style={[styles.sheetTitle, { paddingHorizontal: 30 }]}>Update profile photo</Text>
          <Pressable style={styles.sheetOpt} onPress={() => onPick("camera")}>
            <Text style={styles.sheetOptText}>Take photo</Text>
          </Pressable>
          <Pressable style={styles.sheetOpt} onPress={() => onPick("gallery")}>
            <Text style={styles.sheetOptText}>Choose from gallery</Text>
          </Pressable>
          {hasPhoto && (
            <Pressable style={styles.sheetOpt} onPress={onRemove}>
              <Text style={[styles.sheetOptText, { color: NEUTRAL.danger }]}>Remove photo</Text>
            </Pressable>
          )}
          <Pressable style={styles.sheetCancel} onPress={onClose}>
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  avatar: { backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: "100%", height: "100%" },
  avatarText: { fontWeight: "700", color: ON_BRAND },
  camBtn: { position: "absolute", right: -3, bottom: -3, backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: BRAND_DEEP, alignItems: "center", justifyContent: "center" },
  camBusy: { fontSize: 12 },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(14,42,35,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: NEUTRAL.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  sheetTitle: { fontSize: 12.5, fontWeight: "700", color: NEUTRAL.textPrimary, textAlign: "center", marginBottom: 12 },
  sheetOpt: { paddingVertical: 13, borderRadius: 10, backgroundColor: NEUTRAL.surfaceAlt, alignItems: "center", marginBottom: 8 },
  sheetOptText: { fontSize: 13, color: NEUTRAL.textPrimary, fontWeight: "500" },
  sheetCancel: { paddingVertical: 13, alignItems: "center", marginTop: 4 },
  sheetCancelText: { fontSize: 13, color: NEUTRAL.textSecondary, fontWeight: "600" },
});
