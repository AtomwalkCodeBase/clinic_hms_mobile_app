import { useQueryClient } from "@tanstack/react-query";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  extractSync, extractBulkCreate, extractBulkStart, putToS3,
  ExtractSyncFileResult, ExtractBatchStatus,
} from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { routeExtraction, partitionExtractable, SkippedFile } from "@/utils/extractionRouting";
import { useExtractionBatchStatus } from "@/hooks/useExtractionBatchStatus";

/** One file to upload — `uri` (file:// or data:) is used directly for a bulk
 *  S3 PUT; `toDataUri()` is only called for the sync path, so a large bulk
 *  batch never pays for a base64 conversion it doesn't need. */
export type UploadCandidate = {
  name: string;
  mimeType: string;
  size: number;
  uri: string;
  toDataUri: () => Promise<string>;
};

export type InstantResult = { extracted: number; failed: number; lines: string[] };

export type StartUploadOutcome =
  | { status: "rejected"; reason: string }
  | { status: "busy"; reason: string }
  // `skipped`: files left out because they can't be uploaded (wrong type / over the size cap); the rest went ahead.
  | { status: "started-sync"; skipped: SkippedFile[] }
  | { status: "started-bulk"; skipped: SkippedFile[] };

interface UploadTasksContextValue {
  instantBusy: boolean;
  lastInstantResult: InstantResult | null;
  clearInstantResult: () => void;
  bulkStarting: boolean;
  bulkStartError: string | null;
  bulkStatus: ExtractBatchStatus["batch"] | undefined;
  /** Per-file status from the server once the batch exists. */
  bulkItems: ExtractBatchStatus["items"];
  /** Files sent to storage so far, while the phone is still uploading (before the server has a status). */
  bulkUploadProgress: { done: number; total: number; names: string[] } | null;
  /** How many files the in-flight instant (inline) extraction covers. */
  instantFileCount: number;
  /** Inside the one instant request: still sending the file, or the server is now reading it. */
  instantPhase: "upload" | "read";
  instantUploadPct: number;
  startUpload: (files: UploadCandidate[], patientAwpid?: string) => Promise<StartUploadOutcome>;
}

const UploadTasksContext = createContext<UploadTasksContextValue | null>(null);

const ACTIVE_BULK_STATUSES = new Set(["pending", "queued", "processing"]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Start is idempotent on the server, so retrying it is always safe. Retries only
 * what can plausibly recover — the queue being briefly unavailable (503) or no
 * answer at all — and gives up immediately on a real answer like "nothing
 * arrived" (400). The uploaded files stay in S3 between attempts.
 */
async function startWithRetry(batchId: string) {
  const waits = [3000, 8000];
  for (let attempt = 0; ; attempt++) {
    try {
      return await extractBulkStart(batchId);
    } catch (err: any) {
      const code = err?.response?.status;
      const retryable = code === 503 || !err?.response;
      if (!retryable || attempt >= waits.length) throw err;
      await sleep(waits[attempt]);
    }
  }
}

export function UploadTasksProvider({ children }: { children: React.ReactNode }) {
  const [instantBusy, setInstantBusy] = useState(false);
  const [lastInstantResult, setLastInstantResult] = useState<InstantResult | null>(null);
  const [bulkBatchId, setBulkBatchId] = useState<string | null>(null);
  const [bulkStarting, setBulkStarting] = useState(false);
  const [bulkStartError, setBulkStartError] = useState<string | null>(null);
  const [bulkUploadProgress, setBulkUploadProgress] = useState<{ done: number; total: number; names: string[] } | null>(null);
  const [instantFileCount, setInstantFileCount] = useState(0);
  const [instantPhase, setInstantPhase] = useState<"upload" | "read">("upload");
  const [instantUploadPct, setInstantUploadPct] = useState(0);
  const queryClient = useQueryClient();

  const bulkStatusQ = useExtractionBatchStatus(bulkBatchId);
  const bulkStatus = bulkStatusQ.data?.batch;
  const bulkItems = bulkStatusQ.data?.items ?? [];
  const bulkActiveRef = useRef(false);
  bulkActiveRef.current = !!bulkStatus && ACTIVE_BULK_STATUSES.has(bulkStatus.status);
  // setState is async — two quick taps on "Upload" could both read a stale
  // `false` from state and start two tasks. These refs flip synchronously,
  // so the second tap is refused even before the first one re-renders.
  const instantBusyRef = useRef(false);
  const bulkStartingRef = useRef(false);

  // Auto-clear a finished bulk batch a few seconds after it settles, so the
  // pill and the "in progress" flag both go away without the patient having
  // to dismiss anything.
  // Any non-active state is final: done / partial / failed / cancelled.
  useEffect(() => {
    if (bulkStatus && !ACTIVE_BULK_STATUSES.has(bulkStatus.status)) {
      queryClient.invalidateQueries({ queryKey: ["extractedItems"] });
      const t = setTimeout(() => setBulkBatchId(null), 4000);
      return () => clearTimeout(t);
    }
  }, [bulkStatus?.status]);

  // Keep the upload chips on screen until the server's own status takes over,
  // so there's no blank gap between "uploaded" and the first poll answering.
  useEffect(() => {
    if (bulkStatus || bulkStatusQ.isError) setBulkUploadProgress(null);
  }, [bulkStatus, bulkStatusQ.isError]);

  // Each finished file becomes viewable straight away, so refresh the list as the count moves.
  useEffect(() => {
    if (bulkStatus?.processed) queryClient.invalidateQueries({ queryKey: ["extractedItems"] });
  }, [bulkStatus?.processed]);

  const clearInstantResult = useCallback(() => setLastInstantResult(null), []);

  // Auto-dismiss the "extracted/failed" toast a few seconds after it lands —
  // same pattern as the bulk pill, so nobody has to tap anything to clear it.
  useEffect(() => {
    if (lastInstantResult) {
      queryClient.invalidateQueries({ queryKey: ["extractedItems"] });
      const t = setTimeout(() => setLastInstantResult(null), 5000);
      return () => clearTimeout(t);
    }
  }, [lastInstantResult]);

  // Same auto-dismiss treatment for a bulk-start failure (e.g. presigned S3
  // PUT failed partway through) — shown as a toast, doesn't need a tap.
  useEffect(() => {
    if (bulkStartError) {
      const t = setTimeout(() => setBulkStartError(null), 6000);
      return () => clearTimeout(t);
    }
  }, [bulkStartError]);

  const startUpload = useCallback(
    async (allFiles: UploadCandidate[], patientAwpid?: string): Promise<StartUploadOutcome> => {
      // Each file is judged on its own: one that can't be uploaded is skipped, the others go ahead.
      const { valid: files, skipped } = partitionExtractable(allFiles);
      if (files.length === 0) {
        if (allFiles.length === 0) return { status: "rejected", reason: "No files selected." };
        return {
          status: "rejected",
          reason: allFiles.length === 1
            ? `${skipped[0].name}\n${skipped[0].reason}`
            : `None of these files can be uploaded.\n\n${skipped.map((s) => `${s.name} — ${s.reason}`).join("\n")}`,
        };
      }
      const routed = routeExtraction(files.map((f) => ({ size: f.size, mimeType: f.mimeType })));
      if (routed.route === "reject") return { status: "rejected", reason: routed.reason };

      if (routed.route === "sync") {
        if (instantBusyRef.current) return { status: "busy", reason: "Still processing your last upload — wait a moment." };
        instantBusyRef.current = true;
        setInstantBusy(true);
        setInstantFileCount(files.length);
        setInstantPhase("upload");
        setInstantUploadPct(0);
        setLastInstantResult(null);
        // Deliberately NOT awaited by the caller — this keeps running (and
        // will update context state on completion) even if the screen that
        // triggered it navigates away or unmounts in the meantime.
        (async () => {
          const result: InstantResult = { extracted: 0, failed: 0, lines: [] };
          try {
            const payload = await Promise.all(
              files.map(async (f) => ({ file_name: f.name, mime_type: f.mimeType, file_data: await f.toDataUri() }))
            );
            const results: ExtractSyncFileResult[] = await extractSync(payload, patientAwpid, (loaded, total) => {
              if (total <= 0) return;
              setInstantUploadPct(Math.min(100, Math.round((loaded / total) * 100)));
              if (loaded >= total) setInstantPhase("read"); // everything is on the server; now it is being read
            });
            results.forEach((r, i) => {
              if (r.status === "done") result.extracted += 1;
              else {
                result.failed += 1;
                result.lines.push(`${files[i].name} — ${r.reason || "couldn't process, try again"}`);
              }
            });
          } catch (err) {
            result.failed = files.length;
            result.lines = [apiErrorMessage(err, "upload failed, try again")];
          }
          setLastInstantResult(result);
          instantBusyRef.current = false;
          setInstantBusy(false);
        })();
        return { status: "started-sync", skipped };
      }

      // bulk
      if (bulkStartingRef.current || (bulkBatchId && bulkActiveRef.current)) {
        return { status: "busy", reason: "You already have an upload in progress. Please wait for it to finish." };
      }
      bulkStartingRef.current = true;
      setBulkStarting(true);
      setBulkStartError(null);
      setBulkUploadProgress({ done: 0, total: files.length, names: files.map((f) => f.name) });
      // Also detached — the S3 PUTs and the start call can take a real
      // moment for a big batch, and the whole point is the patient isn't
      // stuck waiting on that either.
      (async () => {
        try {
          const manifest = files.map((f) => ({ name: f.name, size: f.size, mime_type: f.mimeType }));
          const created = await extractBulkCreate(manifest, patientAwpid);
          // The server may leave out files it can't accept, so match each upload link to its file by
          // the position it reports, not by order.
          const sendList = created.items.map((it, i) => files[it.index ?? i]);
          setBulkUploadProgress({ done: 0, total: sendList.length, names: sendList.map((f) => f.name) });
          for (let i = 0; i < created.items.length; i++) {
            try {
              await putToS3(created.items[i].put_url, created.items[i].content_type, sendList[i].uri);
            } catch (e) {
              // One failed upload must not sink the whole batch: keep going, then
              // call Start anyway — the server checks what actually reached S3,
              // fails the missing files, and processes the rest.
              console.warn(`S3 upload failed for ${sendList[i].name}:`, e);
            }
            setBulkUploadProgress({ done: i + 1, total: sendList.length, names: sendList.map((f) => f.name) });
          }
          await startWithRetry(created.batch_id);
          setBulkBatchId(created.batch_id);
        } catch (err) {
          setBulkStartError(apiErrorMessage(err, "Couldn't start the upload. Try again."));
          setBulkUploadProgress(null);
        }
        bulkStartingRef.current = false;
        setBulkStarting(false);
      })();
      return { status: "started-bulk", skipped };
    },
    [bulkBatchId]
  );

  return (
    <UploadTasksContext.Provider
      value={{
        instantBusy, lastInstantResult, clearInstantResult, bulkStarting, bulkStartError, bulkStatus, bulkItems,
        bulkUploadProgress, instantFileCount, instantPhase, instantUploadPct, startUpload,
      }}
    >
      {children}
    </UploadTasksContext.Provider>
  );
}

export function useUploadTasks() {
  const ctx = useContext(UploadTasksContext);
  if (!ctx) throw new Error("useUploadTasks must be used within UploadTasksProvider");
  return ctx;
}
