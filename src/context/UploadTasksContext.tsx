import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { uploadDocuments, getMyDocuments, UploadResultDoc } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { PatientDocument } from "@/api/types";

/** One file to upload — built straight from a picked file or a camera shot, already on disk. */
export type UploadCandidate = {
  name: string;
  mimeType: string;
  size: number;
  uri: string;
};

const MAX_FILE_BYTES = 12 * 1024 * 1024;      // core/file_validation.py + apps/records/serializers.py
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;
const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png"]);

export type SkippedFile = { name: string; reason: string };

/**
 * Same caps the server enforces (apps/records/serializers.py::UploadSerializer) applied
 * BEFORE the request, so an obviously bad file gets an instant, specific message instead of
 * a doomed round-trip. The server re-validates everything regardless.
 */
function partitionUploadable(files: UploadCandidate[]): { valid: UploadCandidate[]; skipped: SkippedFile[] } {
  const valid: UploadCandidate[] = [];
  const skipped: SkippedFile[] = [];
  let totalSoFar = 0;
  for (const f of files) {
    if (!ALLOWED_MIME.has(f.mimeType)) {
      skipped.push({ name: f.name, reason: "Only PDF, JPG and PNG files are supported." });
    } else if (f.size > MAX_FILE_BYTES) {
      skipped.push({ name: f.name, reason: `${f.name} is over 12 MB.` });
    } else if (totalSoFar + f.size > MAX_TOTAL_BYTES) {
      skipped.push({ name: f.name, reason: "The upload is over 200 MB in total." });
    } else {
      totalSoFar += f.size;
      valid.push(f);
    }
  }
  return { valid, skipped };
}

/** A tracked document from the last upload — refreshed from the normal My Reports list. */
export type TrackedDoc = Pick<
  PatientDocument,
  "id" | "file_name" | "processing_status" | "doc_type" | "score" | "method" | "error"
>;

const IN_PROGRESS = new Set(["queued", "ocr", "classifying"]);

type StartUploadOutcome =
  | { status: "rejected"; reason: string }
  | { status: "busy"; reason: string }
  | { status: "started"; skipped: SkippedFile[] };

interface UploadTasksContextValue {
  uploading: boolean;
  /** 0..100 while the multipart request is in flight (byte progress of the whole batch). */
  uploadPct: number;
  /** How many files the current/last upload covers. */
  fileCount: number;
  /** The files from the last upload, refreshed from the server until every one settles. */
  trackedDocs: TrackedDoc[];
  /** True once every tracked doc is completed or failed and the settle delay has passed — the
   *  card can go away. Reset to false as soon as a new upload starts. */
  settled: boolean;
  clearTracked: () => void;
  startUpload: (files: UploadCandidate[], patientAwpid?: string) => Promise<StartUploadOutcome>;
}

const UploadTasksContext = createContext<UploadTasksContextValue | null>(null);

export function UploadTasksProvider({ children }: { children: React.ReactNode }) {
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [fileCount, setFileCount] = useState(0);
  const [trackedIds, setTrackedIds] = useState<number[]>([]);
  const [trackedPatient, setTrackedPatient] = useState<string | undefined>(undefined);
  const [settled, setSettled] = useState(true);
  const queryClient = useQueryClient();
  // setState is async — two quick taps could both read a stale "not busy" and start two uploads.
  const busyRef = useRef(false);

  // Poll the normal documents list (a handful of just-uploaded rows always sort to the top,
  // newest first) while any tracked id is still queued/ocr/classifying.
  const statusQ = useQuery({
    queryKey: ["uploadTracking", trackedIds],
    queryFn: () => getMyDocuments(1, trackedPatient, { pageSize: Math.max(20, trackedIds.length) }),
    enabled: trackedIds.length > 0,
    refetchInterval: (query) => {
      const rows = query.state.data?.results ?? [];
      const byId = new Map(rows.map((d) => [d.id, d]));
      const stillGoing = trackedIds.some((id) => IN_PROGRESS.has(byId.get(id)?.processing_status ?? "queued"));
      return stillGoing ? 3000 : false;
    },
  });

  const trackedDocs: TrackedDoc[] = trackedIds.map((id) => {
    const row = statusQ.data?.results.find((d) => d.id === id);
    return row ?? { id, file_name: "", processing_status: "queued", doc_type: "other" };
  });

  const allDone = trackedIds.length > 0 && trackedDocs.every((d) => !IN_PROGRESS.has(d.processing_status));

  // Once every tracked doc is completed/failed, refresh My Reports (the new rows are already
  // filed there) and clear the tracking card a few seconds later.
  useEffect(() => {
    if (!allDone) return;
    setSettled(false);
    queryClient.invalidateQueries({ queryKey: ["documents"] });
    const t = setTimeout(() => {
      setSettled(true);
      setTrackedIds([]);
    }, 4000);
    return () => clearTimeout(t);
  }, [allDone]);

  const clearTracked = useCallback(() => {
    setTrackedIds([]);
    setSettled(true);
  }, []);

  const startUpload = useCallback(
    async (allFiles: UploadCandidate[], patientAwpid?: string): Promise<StartUploadOutcome> => {
      const { valid: files, skipped } = partitionUploadable(allFiles);
      if (files.length === 0) {
        if (allFiles.length === 0) return { status: "rejected", reason: "No files selected." };
        return {
          status: "rejected",
          reason: allFiles.length === 1
            ? `${skipped[0].name}\n${skipped[0].reason}`
            : `None of these files can be uploaded.\n\n${skipped.map((s) => `${s.name} — ${s.reason}`).join("\n")}`,
        };
      }
      if (busyRef.current) {
        return { status: "busy", reason: "Still uploading your last batch — wait a moment." };
      }
      busyRef.current = true;
      setUploading(true);
      setUploadPct(0);
      setFileCount(files.length);
      setTrackedPatient(patientAwpid);
      setSettled(true);
      setTrackedIds([]);
      try {
        const result = await uploadDocuments(
          files.map((f) => ({ uri: f.uri, name: f.name, mimeType: f.mimeType })),
          patientAwpid,
          (loaded, total) => {
            if (total > 0) setUploadPct(Math.min(100, Math.round((loaded / total) * 100)));
          },
        );
        setTrackedIds(result.documents.map((d: UploadResultDoc) => d.id));
        setSettled(false);
        queryClient.invalidateQueries({ queryKey: ["documents"] });
      } catch (err) {
        busyRef.current = false;
        setUploading(false);
        return { status: "rejected", reason: apiErrorMessage(err, "Upload failed, try again.") };
      }
      busyRef.current = false;
      setUploading(false);
      return { status: "started", skipped };
    },
    [queryClient],
  );

  return (
    <UploadTasksContext.Provider
      value={{ uploading, uploadPct, fileCount, trackedDocs, settled, clearTracked, startUpload }}
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
