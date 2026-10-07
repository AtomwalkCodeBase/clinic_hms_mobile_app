import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { requireOptionalNativeModule } from "expo";
import { registerPushToken } from "@/api/portal";

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
 * Asks for notification permission (a real OS prompt the first time), gets
 * this device's Expo push token, and registers it with the server so a
 * finished background upload can reach the patient even with the app
 * closed. Returns null — and quietly does nothing — if push isn't available
 * here, permission is denied, this isn't a real device (simulators can't
 * receive push), or anything else goes wrong: push is a bonus on top of the
 * in-app status, never something the rest of the app should depend on.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (!pushIsAvailable()) return null;

    const Notifications = await import("expo-notifications");

    // Foreground behavior: show the banner + play the sound even while the app
    // is open, so a "bulk upload complete" push isn't silently swallowed just
    // because the patient happened to still have the app in front.
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
    let granted = existing.granted;
    if (!granted) {
      const asked = await Notifications.requestPermissionsAsync();
      granted = asked.granted;
    }
    if (!granted) return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const tokenRes = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const token = tokenRes.data;
    if (!token) return null;

    await registerPushToken(token, Platform.OS);
    return token;
  } catch {
    return null;
  }
}
