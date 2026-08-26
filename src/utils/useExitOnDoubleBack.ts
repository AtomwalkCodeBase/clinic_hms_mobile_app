import { useEffect, useRef } from "react";
import { BackHandler, ToastAndroid, Platform } from "react-native";
import { useIsFocused } from "@react-navigation/native";

/**
 * Standard Android pattern: pressing back on the root screen (nothing left
 * in the stack to pop to) shows "press back again to exit" instead of
 * closing the app immediately, so an accidental tap doesn't lose the
 * session. Only arms while the screen it's used on is actually focused,
 * so it doesn't fire while the user is elsewhere in the app.
 */
export function useExitOnDoubleBack() {
  const isFocused = useIsFocused();
  const lastPress = useRef(0);

  useEffect(() => {
    if (Platform.OS !== "android" || !isFocused) return;

    const onBackPress = () => {
      const now = Date.now();
      if (now - lastPress.current < 2000) {
        BackHandler.exitApp();
        return true;
      }
      lastPress.current = now;
      ToastAndroid.show("Press back again to exit", ToastAndroid.SHORT);
      return true;
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [isFocused]);
}
