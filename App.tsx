import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { RootNavigator } from "@/navigation/RootNavigator";

// Temporary — Metro was only printing the bare error message for the
// "Cannot read property 'length' of undefined" crash, no stack trace.
// This forces the full JS stack into the terminal so it's actually
// findable. Remove once that bug is fixed.
const g = globalThis as any;
if (g.ErrorUtils) {
  const prevHandler = g.ErrorUtils.getGlobalHandler?.();
  g.ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    console.log("FULL_STACK_TRACE " + (error?.stack || String(error)));
    prevHandler?.(error, isFatal);
  });
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
