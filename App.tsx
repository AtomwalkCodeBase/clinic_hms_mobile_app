import "expo-insights";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/api/queryClient";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { NetworkProvider } from "@/context/NetworkContext";
import { DocumentUploadProvider } from "@/context/DocumentUploadContext";
import { OfflineBanner } from "@/components/OfflineBanner";
import { RootNavigator } from "@/navigation/RootNavigator";
import { ErrorDialogHost, AppErrorBoundary } from "@/components/ErrorDialogHost";
import { installGlobalErrorHandling } from "@/utils/errors";

// An error nobody caught, or a promise nobody handled, becomes the app's error dialog (see utils/errors.ts).
installGlobalErrorHandling();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <ThemeProvider>
        <NetworkProvider>
          <AuthProvider>
            <QueryClientProvider client={queryClient}>
              <DocumentUploadProvider>
                <AppErrorBoundary>
                  <RootNavigator />
                </AppErrorBoundary>
                <OfflineBanner />
                <ErrorDialogHost />
              </DocumentUploadProvider>
            </QueryClientProvider>
          </AuthProvider>
        </NetworkProvider>
      </ThemeProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
