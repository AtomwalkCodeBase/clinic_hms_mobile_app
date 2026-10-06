import { useCallback, useEffect, useState } from "react";
import type { PatientDocument } from "@/api/types";
import { loadDraft, prune, ReviewDraft, saveDraft, withSelectedType, withStage } from "@/utils/reviewDraft";

/**
 * The patient's unsaved choices on the review screen (which files they confirmed, which types they changed), kept on
 * the phone so closing the app doesn't lose them. Nothing is sent to the server until they submit.
 */
export function useReviewDraft(owner: string) {
  const [draft, setDraft] = useState<ReviewDraft>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    loadDraft(owner).then((d) => {
      if (!alive) return;
      setDraft(d);
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [owner]);

  const update = useCallback(
    (change: (d: ReviewDraft) => ReviewDraft) => {
      setDraft((prev) => {
        const next = change(prev);
        saveDraft(owner, next);
        return next;
      });
    },
    [owner],
  );

  return {
    draft,
    loaded,
    setType: useCallback((doc: PatientDocument, type: string) => update((d) => withSelectedType(d, doc, type)), [update]),
    confirm: useCallback((id: number) => update((d) => withStage(d, id, "ready")), [update]),
    moveBack: useCallback((id: number) => update((d) => withStage(d, id, "review")), [update]),
    keepOnly: useCallback((pendingIds: number[]) => update((d) => prune(d, pendingIds)), [update]),
  };
}
