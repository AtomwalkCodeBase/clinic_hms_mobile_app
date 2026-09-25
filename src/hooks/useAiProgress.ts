import { useEffect, useState } from "react";
import { useExtractedItems } from "@/hooks/useExtractedItems";

/**
 * How far the AI check (the step after "Read") has got for one upload's files.
 * `ids` are the finished files of that upload; the answer comes from the Uploads list, which the
 * server fills in per file and which is re-fetched every few seconds while anything is pending.
 *
 * A check that stays queued for a very long time (the AI server is down) stops holding the progress
 * card open after AI_WAIT_MAX_MS: it counts as settled here, and each file's own chip in the Uploads
 * list keeps saying "AI check queued".
 */
export type AiProgress = {
  total: number;
  queued: number;
  running: number;
  /** Finished or not needed. */
  done: number;
  failed: number;
  /** Still queued or running. */
  pending: number;
  /** total - pending: the "3 of 5" number. */
  checked: number;
};

const AI_WAIT_MAX_MS = 10 * 60 * 1000;

export function useAiProgress(ids: string[], patientAwpid?: string): AiProgress | null {
  const key = ids.join(",");
  const q = useExtractedItems(patientAwpid, { enabled: ids.length > 0 });
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    setExpired(false);
    if (!ids.length) return;
    const t = setTimeout(() => setExpired(true), AI_WAIT_MAX_MS);
    return () => clearTimeout(t);
  }, [key]);

  if (!ids.length) return null;

  const byId = new Map<string, string>();
  (q.data?.groups ?? []).forEach((g) => g.items.forEach((i) => byId.set(i.id, i.ai?.status ?? "none")));

  const p: AiProgress = { total: ids.length, queued: 0, running: 0, done: 0, failed: 0, pending: 0, checked: 0 };
  for (const id of ids) {
    const s = byId.get(id);
    // Not in the list yet while it is still loading: assume queued, so the card never flashes "all done" early.
    if (s === undefined) {
      if (q.isFetching) p.queued++;
      else p.done++;                      // dismissed meanwhile
    } else if (s === "queued") p.queued++;
    else if (s === "running") p.running++;
    else if (s === "failed") p.failed++;
    else p.done++;                        // done | skipped | none
  }
  p.pending = expired ? 0 : p.queued + p.running;
  p.checked = p.total - p.pending;
  return p;
}
