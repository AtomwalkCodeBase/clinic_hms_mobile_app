import { Component, ReactNode, useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { MessageDialog } from "@/components/MessageDialog";
import { PrimaryButton } from "@/components/Buttons";
import { NEUTRAL } from "@/theme/themes";
import { dismissError, subscribeErrorDialog, ErrorNotice } from "@/utils/errors";

/** Renders the app's error dialog. Mounted once, near the root, so any code can raise it with showError(). */
export function ErrorDialogHost() {
  const [notice, setNotice] = useState<ErrorNotice | null>(null);
  useEffect(() => subscribeErrorDialog(setNotice), []);
  return (
    <MessageDialog
      visible={!!notice}
      tone="error"
      title={notice?.title ?? ""}
      message={notice?.message}
      buttonLabel="OK"
      onDismiss={dismissError}
    />
  );
}

/**
 * Catches an error thrown while a screen draws, so one broken screen shows "Something went wrong" with a way back
 * instead of a blank or red screen.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    if (__DEV__) console.log("[render error]", (error as any)?.stack || error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.text}>This screen couldn't be shown. Your information is safe.</Text>
        <PrimaryButton label="Try again" onPress={() => this.setState({ failed: false })} style={{ marginTop: 18, alignSelf: "stretch" }} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: NEUTRAL.bg },
  title: { fontSize: 20, fontWeight: "800", color: NEUTRAL.textPrimary },
  text: { fontSize: 14.5, color: NEUTRAL.textSecondary, textAlign: "center", marginTop: 8 },
});
