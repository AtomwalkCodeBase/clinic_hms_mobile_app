import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { requireOptionalNativeModule } from "expo";

/**
 * True only where `expo-notifications` can actually be loaded.
 *
 * Merely importing it is dangerous: on Android in Expo Go it THROWS while the
 * module loads (remote push was removed from Expo Go in SDK 53), and Metro
 * reports an error during module load as fatal — a try/catch around the
 * import cannot stop that (red screen in development, a crash in production).
 * A development build made before the module was added fails the same way,
 * because its native half is missing. So check first and never load it when
 * it can't work.
 */
function pushIsAvailable(): boolean {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false; // Expo Go
  return !!requireOptionalNativeModule("ExpoPushTokenManager");                          // native half present?
}

/**
 * A local notification for the app being in the background when documents finish being read: "ready to review" or
 * "couldn't be read". Needs no server and no Firebase, but, like push, it only exists where expo-notifications loads
 * (not Expo Go on Android); anywhere else it quietly does nothing and the in-app bar says it instead.
 */
export async function notifyDocumentsReady(ready: number, failed: number): Promise<void> {
  try {
    if (!pushIsAvailable() || (!ready && !failed)) return;
    const Notifications = await import("expo-notifications");
    const granted = (await Notifications.getPermissionsAsync()).granted;
    if (!granted) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: ready ? (ready === 1 ? "Your document is ready" : `${ready} documents are ready`) : "A document couldn't be read",
        body: ready ? "Open the app to review and confirm it." : "Open the app to try again or remove it.",
      },
      trigger: null,
    });
  } catch {
    /* a notification is a convenience, never something the upload depends on */
  }
}

/**
 * Gets the phone ready for the notification above: asks for notification permission (a real OS prompt the first
 * time), shows notifications as a banner even while the app is open, and creates the Android channel. Nothing is
 * sent to the server; the backend has no push service. Quietly does nothing if notifications aren't available here
 * or permission is denied: a notification is a bonus on top of the in-app status, never something the rest of the
 * app depends on.
 */
export async function setUpNotifications(): Promise<void> {
  try {
    if (!pushIsAvailable()) return;

    const Notifications = await import("expo-notifications");

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    if (!existing.granted) await Notifications.requestPermissionsAsync();
  } catch {
    /* a notification is a convenience; nothing to do if the phone can't show one */
  }
}
