import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChoiceSheet, ChoiceAction } from "@/components/ChoiceSheet";
import { getFamily } from "@/api/portal";
import type { FamilyMember } from "@/api/types";

/** Whose records an upload goes to. `awpid` is undefined for the patient's own account. */
export type UploadTarget = { awpid?: string; name: string };

/**
 * "Who is this for?" — asked every time a document is about to be uploaded, like booking an appointment: the patient's
 * own account or one of the family members they have added. Call `ask()` before uploading; it resolves with the choice,
 * or null if they cancel. With nobody added there is nothing to choose between, so it does not ask and resolves with
 * `current` (the person the screen is already about). Render `sheet` once in the screen.
 */
export function useWhoIsThisFor(current?: string) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<FamilyMember[] | null>(null);
  const resolveRef = useRef<((t: UploadTarget | null) => void) | null>(null);
  const settled = useRef(false);

  const settle = useCallback((target: UploadTarget | null) => {
    if (settled.current) return;
    settled.current = true;
    setOpen(null);
    resolveRef.current?.(target);
  }, []);

  const ask = useCallback(async (): Promise<UploadTarget | null> => {
    let members: FamilyMember[] = [];
    try {
      members = await queryClient.fetchQuery({ queryKey: ["family"], queryFn: getFamily, staleTime: 60_000 });
    } catch {
      /* can't load the family: upload for the person the screen is about, rather than blocking */
    }
    if (!members.length) return { awpid: current, name: "" };
    return new Promise<UploadTarget | null>((resolve) => {
      settled.current = false;
      resolveRef.current = resolve;
      setOpen(members);
    });
  }, [current, queryClient]);

  const actions: ChoiceAction[] = [
    { label: "Myself", sub: "Your own account", primary: !current, onPress: () => settle({ awpid: undefined, name: "Myself" }) },
    ...(open ?? []).map((m) => ({
      label: m.full_name,
      sub: m.relationship,
      primary: m.awpid === current,
      onPress: () => settle({ awpid: m.awpid, name: m.full_name }),
    })),
    { label: "Cancel", cancel: true, onPress: () => settle(null) },
  ];

  const sheet = (
    <ChoiceSheet
      visible={!!open}
      title="Who is this for?"
      message="Choose whose records this should go to."
      actions={actions}
      // The sheet calls onClose and then the tapped action; a tap outside only calls onClose. Wait a tick so a real
      // choice wins over this "closed without choosing".
      onClose={() => { setTimeout(() => settle(null), 0); }}
    />
  );

  return { ask, sheet };
}
