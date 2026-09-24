import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dismissExtractedItems, getExtractedItems, ExtractedItems } from "@/api/portal";

export const extractedItemsKey = (patientAwpid?: string) => ["extractedItems", patientAwpid ?? "self"] as const;

/** Finished extractions the patient hasn't dismissed. Refreshed by UploadTasksContext when an upload finishes. */
export function useExtractedItems(patientAwpid?: string) {
  return useQuery({
    queryKey: extractedItemsKey(patientAwpid),
    queryFn: () => getExtractedItems(patientAwpid),
  });
}

function without(data: ExtractedItems, ids: Set<string> | "all"): ExtractedItems {
  const groups = data.groups
    .map((g) => ({ ...g, items: ids === "all" ? [] : g.items.filter((i) => !ids.has(i.id)) }))
    .filter((g) => g.items.length);
  let ready = 0;
  let failed = 0;
  groups.forEach((g) => g.items.forEach((i) => (i.status === "done" ? ready++ : failed++)));
  return { counts: { ready, failed }, groups };
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
