import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { getMyDocuments, uploadDocuments, UploadMode } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { notifyDocumentsReady } from "@/utils/pushNotifications";
import { isReviewable } from "@/utils/reviewDraft";

/** One file to upload — built straight from a picked file or a camera shot, already on disk. */
export type UploadCandidate = { name: string; mimeType: string; size: number; uri: string };
export type SkippedFile = { name: string; reason: string };

// What the server accepts per request (apps/records/serializers.py): 50 files and 250 MB in total.
const MAX_FILES_PER_REQUEST = 50;
const MAX_BYTES_PER_REQUEST = 240 * 1024 * 1024;
const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png"]);

/** The server re-checks everything; this just gives an obviously bad file an instant, specific message. */
function partition(files: UploadCandidate[]): { valid: UploadCandidate[]; skipped: SkippedFile[] } {
  const valid: UploadCandidate[] = [];
  const skipped: SkippedFile[] = [];
  for (const f of files) {
    if (!ALLOWED_MIME.has(f.mimeType)) skipped.push({ name: f.name, reason: "Only PDF, JPG and PNG files are supported." });
    else if (f.size > MAX_BYTES_PER_REQUEST) skipped.push({ name: f.name, reason: `${f.name} is too large to upload.` });
    else valid.push(f);
  }
  return { valid, skipped };
}

/** Splits the files into requests the server will take: at most 50 files and 240 MB each. */
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

interface DocumentUploadContextValue {
  uploading: boolean;
  /** 0..100 — how much of the files has reached the server (reading them happens afterwards, on the server). */
  uploadPct: number;
  fileCount: number;
  /** "instant" is exactly one file on the fast lane; "bulk" is any number of files on the bulk lane. */
  startUpload: (files: UploadCandidate[], mode: UploadMode, patientAwpid?: string) => Promise<StartUploadOutcome>;
  /** The files sent and still being read, or null. */
  reading: ReadingState | null;
  /** Set when everything just sent has been read, until the patient dismisses it or opens the review. */
  ready: ReadyState | null;
  clearReady: () => void;
}

const DocumentUploadContext = createContext<DocumentUploadContextValue | null>(null);

export function DocumentUploadProvider({ children }: { children: React.ReactNode }) {
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [fileCount, setFileCount] = useState(0);
  const queryClient = useQueryClient();
  const [watch, setWatch] = useState<{ ids: number[]; patientAwpid?: string } | null>(null);
  const [ready, setReady] = useState<ReadyState | null>(null);
  // setState is async — two quick taps could both read a stale "not busy" and start two uploads.
  const busyRef = useRef(false);

  const startUpload = useCallback(
    async (allFiles: UploadCandidate[], mode: UploadMode, patientAwpid?: string): Promise<StartUploadOutcome> => {
      const { valid, skipped } = partition(allFiles);
      if (valid.length === 0) {
        if (allFiles.length === 0) return { status: "rejected", reason: "No files selected." };
        return {
          status: "rejected",
          reason: allFiles.length === 1
            ? `${skipped[0].name}\n${skipped[0].reason}`
            : `None of these files can be uploaded.\n\n${skipped.map((s) => `${s.name} — ${s.reason}`).join("\n")}`,
        };
      }
      if (mode === "instant" && valid.length !== 1) {
        return { status: "rejected", reason: "Add Document takes one file at a time. Use Bulk Upload for several." };
      }
      if (busyRef.current) return { status: "busy", reason: "Still uploading your last files — wait a moment." };

      busyRef.current = true;
      setUploading(true);
      setUploadPct(0);
      setFileCount(valid.length);
      try {
        const requests = toRequests(valid);
        const documentIds: number[] = [];
        let sent = 0;
        for (const group of requests) {
          const result = await uploadDocuments(group, mode, patientAwpid, (fraction) =>
            setUploadPct(Math.round(((sent + group.length * fraction) / valid.length) * 100)),
          );
          result.documents.forEach((d) => documentIds.push(d.id));
          sent += group.length;
          // Candidates are always our own staged copies (fileHelpers / CaptureScreen), never a path the picker still
          // owns — safe to delete now that the server has the bytes.
          group.forEach((f) => FileSystem.deleteAsync(f.uri, { idempotent: true }).catch(() => {}));
        }
        queryClient.invalidateQueries({ queryKey: ["documents"] });
        queryClient.invalidateQueries({ queryKey: ["documentCounts"] });
        // Follow these files until they have been read, so any screen can show it and the patient can be told.
        setReady(null);
        setWatch((prev) => (prev && prev.patientAwpid === patientAwpid
          ? { ids: [...prev.ids, ...documentIds], patientAwpid }
          : { ids: documentIds, patientAwpid }));
        return { status: "started", mode, documentIds, skipped };
      } catch (err) {
        return { status: "rejected", reason: apiErrorMessage(err, "Upload failed, try again.") };
      } finally {
        busyRef.current = false;
        setUploading(false);
      }
    },
    [queryClient],
  );

  const watchQ = useQuery({
    queryKey: ["uploadWatch", watch?.patientAwpid ?? "self"],
    queryFn: () => getMyDocuments(1, watch?.patientAwpid, { review: "pending", pageSize: 100 }),
    enabled: !!watch,
    refetchInterval: 2500,
  });
  const reading = useMemo<ReadingState | null>(() => {
    if (!watch) return null;
    if (!watchQ.data) return { total: watch.ids.length, finished: 0 };
    const byId = new Map(watchQ.data.results.map((d) => [d.id, d]));
    const finished = watch.ids.filter((id) => {
      const d = byId.get(id);
      return !d || !IN_PROGRESS.has(d.processing_status);          // a file no longer waiting counts as done
    }).length;
    return { total: watch.ids.length, finished };
  }, [watch, watchQ.data]);

  // Everything read: say so, once. A notification only when the app is not in front.
  useEffect(() => {
    if (!watch || !reading || !watchQ.data || reading.finished < reading.total) return;
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
  }, [watch, reading, watchQ.data, queryClient]);

  useEffect(() => {
    if (!watch) return;
    const t = setTimeout(() => setWatch(null), WATCH_GIVE_UP_MS);
    return () => clearTimeout(t);
  }, [watch]);

  const clearReady = useCallback(() => setReady(null), []);

  return (
    <DocumentUploadContext.Provider value={{ uploading, uploadPct, fileCount, startUpload, reading, ready, clearReady }}>
      {children}
    </DocumentUploadContext.Provider>
  );
}

export function useDocumentUpload() {
  const ctx = useContext(DocumentUploadContext);
  if (!ctx) throw new Error("useDocumentUpload must be used within DocumentUploadProvider");
  return ctx;
}
