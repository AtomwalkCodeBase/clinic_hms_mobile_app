import React, { useState } from "react";
import { ViewStyle } from "react-native";
import { SecondaryButton } from "@/components/Buttons";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MessageDialog } from "@/components/MessageDialog";
import { apiErrorMessage } from "@/api/client";

type State = "idle" | "confirming" | "downloading" | "done" | "error";

/**
 * The single download control used everywhere a file leaves the app
 * (documents, lab reports, vaccination certificates) — confirm -> real
 * loading state on the button -> an explicit "Downloaded" acknowledgment,
 * or a real error dialog on failure, instead of a bare button that just
 * silently succeeds or fails with nothing shown for it.
 */
export function DownloadButton({
  label = "Download",
  fileLabel,
  onDownload,
  style,
  compact,
}: {
  label?: string;
  /** What's being downloaded, shown in the confirm dialog (e.g. the file name/title). */
  fileLabel: string;
  onDownload: () => Promise<void>;
  style?: ViewStyle;
  compact?: boolean;
}) {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");

  const runDownload = async () => {
    setState("downloading");
    try {
      await onDownload();
      setState("done");
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't download this file."));
      setState("error");
    }
  };

  return (
    <>
      <SecondaryButton
        label={state === "downloading" ? "Downloading…" : label}
        loading={state === "downloading"}
        onPress={() => setState("confirming")}
        style={style}
        compact={compact}
      />

      <ConfirmDialog
        visible={state === "confirming"}
        title="Download this file?"
        message={fileLabel}
        confirmLabel="Download"
        cancelLabel="Not now"
        onConfirm={runDownload}
        onCancel={() => setState("idle")}
      />

      <MessageDialog
        visible={state === "done"}
        title="Downloaded"
        message={`${fileLabel} has been saved to your device.`}
        buttonLabel="Done"
        onDismiss={() => setState("idle")}
      />

      <MessageDialog
        visible={state === "error"}
        tone="error"
        title="Download failed"
        message={error}
        buttonLabel="OK"
        onDismiss={() => setState("idle")}
      />
    </>
  );
}
