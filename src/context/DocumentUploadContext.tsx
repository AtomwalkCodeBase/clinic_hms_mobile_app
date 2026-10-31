import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { getMyDocuments, uploadDocuments, UploadMode } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { notifyDocumentsReady } from "@/utils/pushNotifications";
import { isReviewable } from "@/utils/reviewDraft";
import { useAuth } from "@/context/AuthContext";
import { UploadFailedModal } from "@/components/UploadFailedModal";
import { UploadingModal } from "@/components/UploadingModal";
import { clearPending, loadPending, savePending } from "@/utils/pendingUploads";
import { MAX_FILES, MAX_TOTAL_BYTES, batchProblem, fileProblem } from "@/utils/uploadLimits";

/** Why an upload did not get through, in words a patient can act on. A reason the server gives (a file too big, the wrong
 * kind) is shown as it is; the rest are named by what went wrong. */
function uploadReason(err: unknown): string {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status && status >= 500) return "Our server had a problem and couldn't take your files. Please try again in a moment.";
  if (status === 401) return "Your sign-in has ended. Please sign in again, then upload your files.";
  if (status === 403) return "You don't have permission to upload for this person.";
  if (status === 429) return "Too many uploads in a short time. Please wait a minute and try again.";
  return apiErrorMessage(err, "Upload failed, try again.");
}

/** One file to upload — built straight from a picked file or a camera shot, already on disk. */
export type UploadCandidate = { name: string; mimeType: string; size: number; uri: string };
export type SkippedFile = { name: string; reason: string };

// What the server accepts per request (apps/documents/serializers.py); the numbers live in utils/uploadLimits.
const MAX_FILES_PER_REQUEST = MAX_FILES;
const MAX_BYTES_PER_REQUEST = MAX_TOTAL_BYTES;

/** The server re-checks everything; this just gives an obviously bad file an instant, specific message. `discarded` are the
 * files themselves: they are never sent, so their copies on the phone are deleted by the caller. */
function partition(files: UploadCandidate[]): { valid: UploadCandidate[]; skipped: SkippedFile[]; discarded: UploadCandidate[] } {
  const valid: UploadCandidate[] = [];
  const skipped: SkippedFile[] = [];
  const discarded: UploadCandidate[] = [];
  for (const f of files) {
    const problem = fileProblem(f);
    if (problem) {
      skipped.push({ name: f.name, reason: problem });
      discarded.push(f);
    } else valid.push(f);
  }
  return { valid, skipped, discarded };
}

/** Candidates are always our own staged copies (fileHelpers / CaptureScreen), never a path the picker still owns. */
const deleteCopies = (files: UploadCandidate[]) => files.forEach((f) => FileSystem.deleteAsync(f.uri, { idempotent: true }).catch(() => {}));

/** Splits the files into requests the server will take: at most the file count and total size it allows per request. */
function toRequests(files: UploadCandidate[]): UploadCandidate[][] {
  const requests: UploadCandidate[][] = [];
  let current: UploadCandidate[] = [];
  let bytes = 0;
  for (const f of files) {
    if (current.length && (current.length >= MAX_FILES_PER_REQUEST || bytes + f.size > MAX_BYTES_PER_REQUEST)) {
      requests.push(current);
      current = [];
      bytes = 0;
    }
    current.push(f);
    bytes += f.size;
  }
  if (current.length) requests.push(current);
  return requests;
}

const BUSY = { status: "busy" as const, reason: "Still uploading your last files — wait a moment." };

/** The quick checks that need no network: either the files are refused outright, or here are the ones to send. */
function prepare(
  allFiles: UploadCandidate[],
  mode: UploadMode,
): { refused: { status: "rejected"; reason: string } } | { valid: UploadCandidate[]; skipped: SkippedFile[]; discarded: UploadCandidate[] } {
  const { valid, skipped, discarded } = partition(allFiles);
  deleteCopies(discarded);          // a file that will not be sent has no use on the phone
  if (valid.length === 0) {
    if (allFiles.length === 0) return { refused: { status: "rejected", reason: "No files selected." } };
    return {
      refused: {
        status: "rejected",
        reason: allFiles.length === 1
          ? `${skipped[0].name}\n${skipped[0].reason}`
          : `None of these files can be uploaded.\n\n${skipped.map((s) => `${s.name} — ${s.reason}`).join("\n")}`,
      },
    };
  }
  const together = batchProblem(valid);
  if (together) {
    deleteCopies(valid);
    return { refused: { status: "rejected", reason: `${together} Upload fewer files at a time.` } };
  }
  if (mode === "instant" && valid.length !== 1) {
    deleteCopies(valid);
    return { refused: { status: "rejected", reason: "Add Document takes one file at a time. Use Bulk Upload for several." } };
  }
  return { valid, skipped, discarded };
}

const IN_PROGRESS = new Set(["queued", "extracting", "classifying"]);
const WATCH_GIVE_UP_MS = 10 * 60 * 1000;      // stop following files that never finish; the lists still show them

/** How far the server has got with the files just sent. */
export type ReadingState = { total: number; finished: number };
/** The files just sent have all been read: some are ready to review, some may have failed. */
export type ReadyState = { ids: number[]; failed: number; patientAwpid?: string };

export type StartUploadOutcome =
  | { status: "rejected"; reason: string }
  | { status: "busy"; reason: string }
  | { status: "started"; mode: UploadMode; documentIds: number[]; skipped: SkippedFile[] };

/** What `queueUpload` says at once: it is on its way, or it was refused before sending anything. */
export type QueueOutcome =
  | { status: "queued"; skipped: SkippedFile[] }
  | { status: "rejected" | "busy"; reason: string };

/** An upload that did not get through; the unsent files are kept on the phone so it can be tried again. */
type FailedUpload = { files: UploadCandidate[]; mode: UploadMode; patientAwpid?: string; message: string };

interface DocumentUploadContextValue {
  uploading: boolean;
  /** 0..100 — how much of the files has reached the server (reading them happens afterwards, on the server). */
  uploadPct: number;
  fileCount: number;
  /** "instant" is exactly one file on the fast lane; "bulk" is any number of files on the bulk lane. */
  startUpload: (files: UploadCandidate[], mode: UploadMode, patientAwpid?: string) => Promise<StartUploadOutcome>;
  /** Starts the upload and returns immediately; it carries on in the background (see UploadStatusBar). */
  queueUpload: (files: UploadCandidate[], mode: UploadMode, patientAwpid?: string) => QueueOutcome;
  /** A background upload that failed, with the reason; null when there is none. */
  failedUpload: { message: string; count: number } | null;
  retryFailedUpload: () => void;
  clearFailedUpload: () => void;
  /** Files left out of the last upload (over the size limit, wrong kind, empty) with why; shown until dismissed. */
  skippedFiles: SkippedFile[];
  clearSkippedFiles: () => void;
  /** The files sent and still being read, or null. */
  reading: ReadingState | null;
  /** Set when everything just sent has been read, until the patient dismisses it or opens the review. */
  ready: ReadyState | null;
  clearReady: () => void;
}

const DocumentUploadContext = createContext<DocumentUploadContextValue | null>(null);

export function DocumentUploadProvider({ children }: { children: React.ReactNode }) {
  const [uploading, setUploading] = useState(false);
  // The window shown while files go up ("keep the app open") and, for a few seconds, once the server has them.
  const [uploadDone, setUploadDone] = useState(false);
  const [modalHidden, setModalHidden] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [fileCount, setFileCount] = useState(0);
  const queryClient = useQueryClient();
  // `startedAt`: a poll result older than this was fetched before these files existed, so it says nothing about them.
  const [watch, setWatch] = useState<{ ids: number[]; patientAwpid?: string; startedAt: number } | null>(null);
  const [ready, setReady] = useState<ReadyState | null>(null);
  const [failedUpload, setFailedUpload] = useState<FailedUpload | null>(null);
  const [skippedFiles, setSkippedFiles] = useState<SkippedFile[]>([]);
  // setState is async — two quick taps could both read a stale "not busy" and start two uploads.
  const busyRef = useRef(false);
  // Counts sign-outs: an upload that started before one must not touch the screens of whoever signs in next.
  const sessionRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const [failureNotice, setFailureNotice] = useState<string | null>(null);

  // Signing out (or an expired session) ends this person's upload tracking: the next account must not see the previous
  // one's "reading" bar, "ready to review" bar or retry bar, and an upload still on its way is stopped.
  const { isAuthenticated } = useAuth();
  useEffect(() => {
    if (!isAuthenticated) {
      sessionRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
      busyRef.current = false;
      setUploading(false);
      setUploadDone(false);
      setFailureNotice(null);
      setWatch(null);
      setReady(null);
      setFailedUpload(null);
      setSkippedFiles([]);
    }
  }, [isAuthenticated]);

  // An upload cut off by the app closing, a crash or the phone switching off left its files and a note behind: offer
  // them again with the same "try again" bar a failed upload gets.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    loadPending().then((p) => {
      if (cancelled || !p || busyRef.current) return;
      const message = p.files.length === 1
        ? "1 file was waiting to be sent when the app closed."
        : `${p.files.length} files were waiting to be sent when the app closed.`;
      setFailedUpload((current) => current ?? { files: p.files, mode: p.mode, patientAwpid: p.patientAwpid, message });
    });
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  /** Sends the files. Resolves when the server has them (or has refused them); nothing is read yet at that point. */
  const runUpload = useCallback(
    async (valid: UploadCandidate[], skipped: SkippedFile[], mode: UploadMode, patientAwpid?: string, announce = false): Promise<StartUploadOutcome & { unsent?: UploadCandidate[] }> => {
      const session = sessionRef.current;
      const stale = () => session !== sessionRef.current;      // signed out since this upload began
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      busyRef.current = true;
      setFailureNotice(null);
      setUploadDone(false);
      setModalHidden(false);
      setUploading(true);
      setUploadPct(0);
      setFileCount(valid.length);
      let sent = 0;
      try {
        await savePending({ files: valid, mode, patientAwpid });      // so a cut-off upload can be offered again after a restart
        const requests = toRequests(valid);
        const documentIds: number[] = [];
        const leftOut: SkippedFile[] = [];          // files the server itself refused (it checks the limits again)
        for (const group of requests) {
          const result = await uploadDocuments(group, mode, patientAwpid, (fraction) => {
            if (!stale()) setUploadPct(Math.round(((sent + group.length * fraction) / valid.length) * 100));
          }, ctrl.signal);
          if (stale()) return { status: "rejected", reason: "You were signed out.", unsent: [] };
          result.documents.forEach((d) => documentIds.push(d.id));
          leftOut.push(...(result.skipped ?? []));
          sent += group.length;
          // Candidates are always our own staged copies (fileHelpers / CaptureScreen), never a path the picker still
          // owns — safe to delete now that the server has the bytes.
          group.forEach((f) => FileSystem.deleteAsync(f.uri, { idempotent: true }).catch(() => {}));
        }
        await clearPending();
        setUploadDone(true);
        if (leftOut.length) setSkippedFiles((prev) => [...prev, ...leftOut]);
        queryClient.invalidateQueries({ queryKey: ["documents"] });
        queryClient.invalidateQueries({ queryKey: ["documentCounts"] });
        // Follow these files until they have been read, so any screen can show it and the patient can be told.
        setReady(null);
        setWatch((prev) => (prev && prev.patientAwpid === patientAwpid
          ? { ids: [...prev.ids, ...documentIds], patientAwpid, startedAt: Date.now() }
          : { ids: documentIds, patientAwpid, startedAt: Date.now() }));
        return { status: "started", mode, documentIds, skipped: [...skipped, ...leftOut] };
      } catch (err) {
        // Signed out meanwhile: the upload was stopped on purpose, and nothing of it is shown to the next person.
        if (stale()) return { status: "rejected", reason: "You were signed out.", unsent: [] };
        const reason = uploadReason(err);
        // Earlier parts of a big upload may already be on the server; say so, so the patient does not send them twice.
        const unsent = valid.slice(sent);
        const message = sent ? `${sent} of ${valid.length} files were uploaded. The rest could not be: ${reason}` : reason;
        if (unsent.length) {
          setFailedUpload({ files: unsent, mode, patientAwpid, message });      // the "try again" bar, from any screen
          if (announce) setFailureNotice(message);      // an upload that went on in the background: say so wherever the patient is
          await savePending({ files: unsent, mode, patientAwpid });
        }
        return { status: "rejected", reason: message, unsent };
      } finally {
        if (!stale()) {
          busyRef.current = false;
          setUploading(false);
        }
      }
    },
    [queryClient],
  );

  /** Uploads and waits for the result: for a screen that shows the upload itself or needs the new ids. */
  const startUpload = useCallback(
    async (files: UploadCandidate[], mode: UploadMode, patientAwpid?: string): Promise<StartUploadOutcome> => {
      const prepared = prepare(files, mode);
      if ("refused" in prepared) return prepared.refused;
      if (busyRef.current) return BUSY;
      setFailedUpload(null);
      setSkippedFiles(prepared.skipped);
      return runUpload(prepared.valid, prepared.skipped, mode, patientAwpid);
    },
    [runUpload],
  );

  /**
   * Starts the upload and returns at once, so a screen (the camera) can close straight away: the upload carries on in
   * the background, the status bar shows it, and if it fails the files are kept so the patient can try again.
   */
  const queueUpload = useCallback(
    (files: UploadCandidate[], mode: UploadMode, patientAwpid?: string, keepSkipped = false): QueueOutcome => {
      const prepared = prepare(files, mode);
      if ("refused" in prepared) return prepared.refused;
      if (busyRef.current) return BUSY;
      setFailedUpload(null);
      if (!keepSkipped) setSkippedFiles(prepared.skipped);      // a retry sends files already checked: what was skipped before still stands
      runUpload(prepared.valid, prepared.skipped, mode, patientAwpid, true);      // a failure puts up the "try again" bar and a notice itself
      return { status: "queued", skipped: prepared.skipped };
    },
    [runUpload],
  );

  const retryFailedUpload = useCallback(() => {
    if (!failedUpload) return;
    const { files, mode, patientAwpid } = failedUpload;
    queueUpload(files, mode, patientAwpid, true);
  }, [failedUpload, queueUpload]);
  const clearSkippedFiles = useCallback(() => setSkippedFiles([]), []);
  const clearFailedUpload = useCallback(() => {
    failedUpload?.files.forEach((f) => FileSystem.deleteAsync(f.uri, { idempotent: true }).catch(() => {}));
    clearPending();
    setFailedUpload(null);
  }, [failedUpload]);

  const watchQ = useQuery({
    queryKey: ["uploadWatch", watch?.patientAwpid ?? "self"],
    queryFn: () => getMyDocuments(1, watch?.patientAwpid, { review: "pending", pageSize: 100 }),
    enabled: !!watch,
    refetchInterval: 2500,
  });
  const reading = useMemo<ReadingState | null>(() => {
    if (!watch) return null;
    if (!watchQ.data || watchQ.dataUpdatedAt < watch.startedAt) return { total: watch.ids.length, finished: 0 };
    const byId = new Map(watchQ.data.results.map((d) => [d.id, d]));
    const finished = watch.ids.filter((id) => {
      const d = byId.get(id);
      return !d || !IN_PROGRESS.has(d.processing_status);          // a file no longer waiting counts as done
    }).length;
    return { total: watch.ids.length, finished };
  }, [watch, watchQ.data, watchQ.dataUpdatedAt]);

  // Everything read: say so, once. A notification only when the app is not in front.
  useEffect(() => {
    if (!watch || !reading || !watchQ.data || watchQ.dataUpdatedAt < watch.startedAt || reading.finished < reading.total) return;
    const docs = watchQ.data.results.filter((d) => watch.ids.includes(d.id));
    const ids = docs.filter(isReviewable).map((d) => d.id);
    const failed = docs.filter((d) => d.processing_status === "failed").length;
    setWatch(null);
    queryClient.invalidateQueries({ queryKey: ["documents"] });
    queryClient.invalidateQueries({ queryKey: ["documentCounts"] });
    if (ids.length || failed) {
      setReady({ ids, failed, patientAwpid: watch.patientAwpid });
      if (AppState.currentState !== "active") notifyDocumentsReady(ids.length, failed);
    }
  }, [watch, reading, watchQ.data, watchQ.dataUpdatedAt, queryClient]);

  useEffect(() => {
    if (!watch) return;
    const t = setTimeout(() => setWatch(null), WATCH_GIVE_UP_MS);
    return () => clearTimeout(t);
  }, [watch]);

  // The "upload complete" note closes by itself after a few seconds.
  useEffect(() => {
    if (!uploadDone) return;
    const t = setTimeout(() => setUploadDone(false), 5000);
    return () => clearTimeout(t);
  }, [uploadDone]);

  const clearReady = useCallback(() => setReady(null), []);

  return (
    <DocumentUploadContext.Provider
      value={{
        uploading, uploadPct, fileCount, startUpload, queueUpload, reading, ready, clearReady,
        failedUpload: failedUpload ? { message: failedUpload.message, count: failedUpload.files.length } : null,
        retryFailedUpload, clearFailedUpload, skippedFiles, clearSkippedFiles,
      }}
    >
      {children}
      <UploadFailedModal
        visible={!!failureNotice}
        message={failureNotice ?? ""}
        onRetry={() => { setFailureNotice(null); retryFailedUpload(); }}
        onClose={() => setFailureNotice(null)}
      />
      <UploadingModal
        visible={(uploading || uploadDone) && !modalHidden}
        stage={uploading ? "sending" : "done"}
        pct={uploadPct}
        count={fileCount}
        onHide={() => setModalHidden(true)}
      />

    </DocumentUploadContext.Provider>
  );
}

export function useDocumentUpload() {
  const ctx = useContext(DocumentUploadContext);
  if (!ctx) throw new Error("useDocumentUpload must be used within DocumentUploadProvider");
  return ctx;
}
