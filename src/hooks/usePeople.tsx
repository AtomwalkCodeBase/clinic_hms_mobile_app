import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChoiceSheet, ChoiceAction } from "@/components/ChoiceSheet";
import { getFamily, getProfile } from "@/api/portal";
import type { FamilyMember } from "@/api/types";
import { familyAccentFor } from "@/theme/familyColors";

export interface Person {
  awpid: string;
  full_name: string;
  gender: string;
  date_of_birth: string | null;
  isSelf: boolean;
  relationship?: string;
}

/**
 * The signed-in patient and the family members they have added. ["profile"] and ["family"] are the same shared keys
 * Home, Profile, Personal details, Family members and Booking use, so an edit made anywhere updates this list too.
 */
export function usePeople() {
  const profileQ = useQuery({ queryKey: ["profile"], queryFn: getProfile });
  const familyQ = useQuery({ queryKey: ["family"], queryFn: getFamily });
  const people: Person[] = profileQ.data
    ? [
        { awpid: profileQ.data.awpid, full_name: profileQ.data.full_name, gender: profileQ.data.gender, date_of_birth: profileQ.data.date_of_birth, isSelf: true },
        ...(familyQ.data ?? []).map((f: FamilyMember) => ({ ...f, isSelf: false })),
      ]
    : [];
  return { people, profileQ, familyQ };
}

/** The route params a Health screen takes for one person: who it is about, and the header colour of a family member. */
export function paramsFor(p: Person) {
  const accent = p.isSelf ? null : familyAccentFor(p);
  return { patientAwpid: p.isSelf ? undefined : p.awpid, patientName: p.full_name, headerColor: accent?.fill, headerOn: accent?.on };
}

/** "Whose health records?" sheet. Call `open()` from an edit button and render `sheet` once in the screen. */
export function usePersonSwitcher(people: Person[], selectedAwpid: string | undefined, onSelect: (p: Person) => void) {
  const [visible, setVisible] = useState(false);
  const actions: ChoiceAction[] = [
    ...people.map((p): ChoiceAction => ({
      label: p.isSelf ? `${p.full_name} (Self)` : p.full_name,
      sub: p.isSelf ? "Your own records" : p.relationship ? p.relationship.charAt(0).toUpperCase() + p.relationship.slice(1) : undefined,
      primary: p.awpid === selectedAwpid,
      onPress: () => onSelect(p),
    })),
    { label: "Cancel", cancel: true },
  ];
  const sheet = (
    <ChoiceSheet visible={visible} title="Whose health records?" message="Choose whose records to show." actions={actions} onClose={() => setVisible(false)} />
  );
  return { open: () => setVisible(true), sheet };
}
