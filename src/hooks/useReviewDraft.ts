import { useCallback, useEffect, useState } from "react";
import type { PatientDocument } from "@/api/types";
import { loadDraft, prune, ReviewDraft, saveDraft, withSelectedType, withStage } from "@/utils/reviewDraft";

const EMPTY: ReviewDraft = {};

/**
 * The patient's unsaved choices on the review screen (which files they confirmed, which types they changed), kept on
 * the phone so closing the app doesn't lose them. Nothing is sent to the server until they submit.
 *
 * `owner` is whose files these are. The loaded draft remembers its owner, so the moment the owner changes the old
 * person's draft is no longer shown or acted on (`loaded` is false until the new one has been read): otherwise a screen
 * that switches person could prune the new person's saved choices against the old person's list.
 */
export function useReviewDraft(owner: string) {
  const [state, setState] = useState<{ owner: string; draft: ReviewDraft } | null>(null);
  const loaded = state?.owner === owner;
  const draft = loaded ? state.draft : EMPTY;

  useEffect(() => {
    let alive = true;
    loadDraft(owner).then((d) => {
      if (alive) setState({ owner, draft: d });
    });
    return () => { alive = false; };
  }, [owner]);

  const update = useCallback(
    (change: (d: ReviewDraft) => ReviewDraft) => {
      setState((prev) => {
        const next = change(prev?.owner === owner ? prev.draft : EMPTY);
        saveDraft(owner, next);
        return { owner, draft: next };
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
