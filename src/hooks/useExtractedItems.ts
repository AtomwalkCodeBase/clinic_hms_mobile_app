import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dismissExtractedItems, getExtractedItems, ExtractedItems } from "@/api/portal";

export const extractedItemsKey = (patientAwpid?: string) => ["extractedItems", patientAwpid ?? "self"] as const;

const AI_POLL_MS = 4000;

/** Finished extractions the patient hasn't dismissed. Refreshed by UploadTasksContext when an upload finishes, and every few seconds while any AI check is still queued or running. */
export function useExtractedItems(patientAwpid?: string, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: extractedItemsKey(patientAwpid),
    queryFn: () => getExtractedItems(patientAwpid),
    enabled: opts?.enabled ?? true,
    refetchInterval: (query) => {
      const data = query.state.data as ExtractedItems | undefined;
      return (data?.counts.ai_pending ?? 0) > 0 ? AI_POLL_MS : false;
    },
  });
}

function without(data: ExtractedItems, ids: Set<string> | "all"): ExtractedItems {
  const groups = data.groups
    .map((g) => ({ ...g, items: ids === "all" ? [] : g.items.filter((i) => !ids.has(i.id)) }))
    .filter((g) => g.items.length);
  let ready = 0;
  let failed = 0;
  let aiPending = 0;
  groups.forEach((g) =>
    g.items.forEach((i) => {
      if (i.status === "done") ready++;
      else failed++;
      if (i.ai?.status === "queued" || i.ai?.status === "running") aiPending++;
    })
  );
  return { counts: { ready, failed, ai_pending: aiPending }, groups };
}

/** Dismiss with an instant local update, rolled back if the server call fails. */
export function useDismissExtracted(patientAwpid?: string) {
  const qc = useQueryClient();
  const key = extractedItemsKey(patientAwpid);
  return useMutation({
    mutationFn: (target: { itemIds: string[] } | { all: true }) => dismissExtractedItems(target, patientAwpid),
    onMutate: async (target) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<ExtractedItems>(key);
      if (prev) qc.setQueryData(key, without(prev, "all" in target ? "all" : new Set(target.itemIds)));
      return { prev };
    },
    onError: (_e, _t, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
