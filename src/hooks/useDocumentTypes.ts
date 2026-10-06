import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDocumentTypes } from "@/api/portal";

const prettify = (code: string) => code.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/**
 * The categories a document can be filed under, from the server (GET /records/types/), so a new category needs no app
 * update. Cached for the whole session — the list only changes when the server's rules do.
 */
export function useDocumentTypes() {
  const q = useQuery({ queryKey: ["documentTypes"], queryFn: getDocumentTypes, staleTime: Infinity, gcTime: Infinity });
  const types = q.data ?? [];
  const labelOf = useCallback(
    (code?: string | null): string => {
      if (!code || code === "not_classified") return "Not classified";
      return types.find((t) => t.code === code)?.label ?? prettify(code);
    },
    [types],
  );
  return { types, labelOf, isLoading: q.isLoading };
}
