import { useQuery } from "@tanstack/react-query";
import { extractBulkStatus, ExtractBatchStatus } from "@/api/portal";

const ACTIVE_STATUSES = new Set(["pending", "queued", "processing"]);

/**
 * Polls a bulk extraction batch's status while it's still running — same
 * refetchInterval pattern as ShareRecordsScreen's live-polling query.
 * Stops polling once the batch reaches a terminal state (done/partial).
 */
export function useExtractionBatchStatus(batchId: string | null) {
  return useQuery({
    queryKey: ["extractionBatchStatus", batchId],
    queryFn: () => extractBulkStatus(batchId as string),
    enabled: !!batchId,
    refetchInterval: (query) => {
      const data = query.state.data as ExtractBatchStatus | undefined;
      if (!data) return 2500;
      return ACTIVE_STATUSES.has(data.batch.status) ? 2500 : false;
    },
  });
}
