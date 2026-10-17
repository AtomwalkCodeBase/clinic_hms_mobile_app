import { ReactNode, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Download, Eye, Lock, Stethoscope, Trash2, Unlock } from "lucide-react-native";
import { ChoiceSheet, ChoiceAction } from "@/components/ChoiceSheet";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MessageDialog } from "@/components/MessageDialog";
import { DoctorNameSheet } from "@/components/DoctorNameSheet";
import { FileItem, SourceFooter, ViewButton } from "@/components/FileItem";
import type { MenuItem } from "@/components/CardMenu";
import { NEUTRAL } from "@/theme/themes";
import { familyAccentFor } from "@/theme/familyColors";
import { useAppTheme } from "@/context/ThemeContext";
import { apiErrorMessage } from "@/api/client";
import {
  getDocumentDetail, getFamily, dismissDocument, updateDoctorName,
  getAllRecordsPrivacy, toggleRecordPrivacy, revealForShare,
} from "@/api/portal";
import { useDocumentTypes } from "@/hooks/useDocumentTypes";
import { downloadDataUri } from "@/utils/fileHelpers";
import { cardDate, isIssuedByHospital } from "@/utils/documentLabels";
import type { PatientDocument } from "@/api/types";
import type { AppStackParamList } from "@/navigation/types";

type Notice = { title: string; message: string; tone: "success" | "error" };

/**
 * Everything a document card can do, shared by the two places that list documents: the My Documents screen (All files)
 * and one day of the By-date view. A card is drawn by `cardFor`; its three-dots menu (View, Download, privacy lock,
 * Delete), the doctor-name sheet, the delete confirmation and the privacy sheets all live here, so a card behaves the
 * same wherever it is. Put `dialogs` somewhere inside the screen.
 *
 * `patientAwpid` is whose documents are showing (undefined = the patient themself).
 */
export function useDocumentActions(patientAwpid?: string) {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const queryClient = useQueryClient();
  const { labelOf } = useDocumentTypes();

  // Whose documents these are: the patient or a linked family member (their name goes on every card).
  const familyQ = useQuery({ queryKey: ["family"], queryFn: getFamily });
  const members = familyQ.data ?? [];
  const member = members.find((m) => m.awpid === patientAwpid);
  const personName = member ? member.full_name : "Myself";
  // The colour of the person's name (header and "Records for"): the app's green for the patient themself, a family
  // member's own colour (by age and gender) for them.
  const { theme } = useAppTheme();
  const memberAccent = member ? familyAccentFor({ gender: member.gender, date_of_birth: member.date_of_birth }) : null;
  const nameColor = memberAccent?.text ?? theme.text;
  // The small tag next to the name: how the person relates to the patient ("Child"), or "You".
  const personTag = member ? member.relationship.charAt(0).toUpperCase() + member.relationship.slice(1) : "You";

  // Failures of an action (privacy toggle, choosing a pharmacy/lab option...) - separate from a list's own load error.
  const [actionError, setActionError] = useState("");
  // What happened to a file the patient just picked, downloaded or deleted. A dialog: an error banner's Retry re-loads
  // the list, which can never fix those.
  const [notice, setNotice] = useState<Notice | null>(null);
  // Several things start from a card's menu: which document each of them is about.
  const [busyId, setBusyId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<PatientDocument | null>(null);
  const [removing, setRemoving] = useState(false);
  const [doctorFor, setDoctorFor] = useState<PatientDocument | null>(null);

  // ── shared-records privacy: the per-report lock (self only) ─────────────
  const privEnabled = !patientAwpid;
  // Distinct key from SharedRecordsPrivacyScreen's ["recordsPrivacy", page, ...] - same endpoint, but called here with
  // no pagination/filter params for a different shape (the full unfiltered map), so it stays its own cache entry.
  const privacyQ = useQuery({
    queryKey: ["recordsPrivacyDocs"],
    queryFn: () => getAllRecordsPrivacy().catch(() => null),
    enabled: !patientAwpid,
  });
  const privMap = useMemo(
    () => new Map((privacyQ.data?.documents ?? []).map((x) => [x.id, x])),
    [privacyQ.data],
  );
  const privSession = privacyQ.data?.active_session ?? null;
  const [lockSheet, setLockSheet] = useState<{ title: string; message?: string; actions: ChoiceAction[] } | null>(null);

  async function privToggle(docId: number, makePrivate: boolean) {
    try {
      await toggleRecordPrivacy(docId, makePrivate);
      privacyQ.refetch();
    } catch (err) {
      setActionError(apiErrorMessage(err, "Couldn't update."));
    }
  }
  async function privReveal(docId: number, scope: "visit" | "always" | "conceal") {
    if (!privSession) return;
    try {
      await revealForShare(privSession.token, [docId], scope);
      privacyQ.refetch();
    } catch (err) {
      setActionError(apiErrorMessage(err, "Couldn't update."));
    }
  }
  function onLock(d: PatientDocument) {
    const p = privMap.get(d.id);
    const name = labelOf(d.doc_type);
    if (!p) return;
    if (p.revealed_for_visit) {
      setLockSheet({
        title: "Hide this again now?",
        message: `${name} would hide by itself when the visit ends.`,
        actions: [
          { label: "Cancel", cancel: true },
          { label: "Hide now", primary: true, onPress: () => privReveal(d.id, "conceal") },
        ],
      });
    } else if (p.private_by_rule) {
      setLockSheet({
        title: "Hidden by a rule",
        message: `${name} is hidden by a category, kind or "hide everything" rule. Change those in Shared records privacy.`,
        actions: [
          ...(privSession
            ? [{ label: "Just this visit", sub: "Reveal only for the doctor viewing now", primary: true, onPress: () => privReveal(d.id, "visit") } as ChoiceAction]
            : []),
          { label: "Close", cancel: true },
        ],
      });
    } else if (!p.private) {
      setLockSheet({
        title: "Make this private?",
        message: `${name} won't be shown to doctors when you share your records. You'll still see it here.`,
        actions: [
          { label: "Cancel", cancel: true },
          { label: "Make private", cancel: true, onPress: () => privToggle(d.id, true) },
        ],
      });
    } else if (privSession) {
      setLockSheet({
        title: "A doctor is viewing now",
        message: `Show ${name} to ${privSession.requester_label || "the doctor"} —`,
        actions: [
          { label: "Just this visit", sub: "Hides again when the visit ends", primary: true, onPress: () => privReveal(d.id, "visit") },
          { label: "Always", sub: "Stays visible for future visits too", onPress: () => privToggle(d.id, false) },
          { label: "Cancel", cancel: true },
        ],
      });
    } else {
      setLockSheet({
        title: "Show this to doctors again?",
        message: `Doctors you share with will be able to see ${name}.`,
        actions: [
          { label: "Cancel", cancel: true },
          { label: "Show", primary: true, onPress: () => privToggle(d.id, false) },
        ],
      });
    }
  }

  // ── actions ──────────────────────────────────────────────────────────────
  // View opens the file inside the app (the full-screen viewer), with the other files of the list it was opened from
  // in its strip.
  function openViewer(id: number, ids: number[]) {
    navigation.navigate("DocumentViewer", {
      ids: ids.includes(id) ? ids : [id],
      index: Math.max(0, ids.indexOf(id)),
      ...(patientAwpid ? { patientAwpid } : {}),
    });
  }

  // Download: the server gives a short-lived link only when asked, so this is the one request (see getDocumentDetail).
  async function downloadFile(id: number) {
    setBusyId(id);
    try {
      const full = await getDocumentDetail(id, { download: true, patientAwpid });
      const src = (full as any).file_data as string;
      if (!src) {
        setNotice({ title: "Can't download", message: "This document doesn't have a file to download.", tone: "error" });
        return;
      }
      const outcome = await downloadDataUri(full.file_name || full.title || "document", src);
      setNotice({ title: outcome === "saved" ? "Downloaded" : "Shared", message: outcome === "saved" ? "Saved to your device." : "Shared from your phone.", tone: "success" });
    } catch (err) {
      setNotice({ title: "Can't download", message: apiErrorMessage(err, "Couldn't download the file."), tone: "error" });
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setRemoving(true);
    try {
      await dismissDocument(deleting.id, patientAwpid);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["documentDays"] });
      queryClient.invalidateQueries({ queryKey: ["documentCounts"] });
      queryClient.invalidateQueries({ queryKey: ["recordsPrivacyDocs"] });
      setDeleting(null);
    } catch (err) {
      setDeleting(null);
      setNotice({ title: "Can't delete", message: apiErrorMessage(err, "Couldn't delete this document."), tone: "error" });
    } finally {
      setRemoving(false);
    }
  }

  async function saveDoctor(name: string) {
    if (!doctorFor) return;
    try {
      await updateDoctorName(doctorFor.id, name, patientAwpid);
    } catch (err) {
      throw new Error(apiErrorMessage(err, "Couldn't save the name."));
    }
    queryClient.invalidateQueries({ queryKey: ["documents"] });
    setDoctorFor(null);
  }

  // What the three dots on a card offer. Everything here has been read and submitted (a file still being read or
  // failed stays in Bulk Upload), so it can be viewed and downloaded; Delete is offered when the server says it may be.
  function menuFor(d: PatientDocument): MenuItem[] {
    const items: MenuItem[] = [
      { key: "download", label: d.handwritten_doc_id ? "Download prescription" : "Download", icon: Download, busy: busyId === d.id, onPress: () => downloadFile(d.id) },
    ];
    if (d.handwritten_doc_id) {
      const hw = d.handwritten_doc_id;
      items.push({
        key: "viewhw", label: "View handwritten", icon: Eye,
        onPress: () => navigation.navigate("DocumentViewer", { ids: [hw], index: 0, ...(patientAwpid ? { patientAwpid } : {}) }),
      });
      items.push({ key: "downloadhw", label: "Download handwritten", icon: Download, busy: busyId === hw, onPress: () => downloadFile(hw) });
    }
    // Only the patient's own uploads: a hospital's document keeps the doctor it was issued with.
    if (!isIssuedByHospital(d)) {
      items.push({ key: "doctor", label: d.doctor_name ? "Edit doctor's name" : "Add doctor's name", icon: Stethoscope, onPress: () => setDoctorFor(d) });
    }
    const p = privEnabled ? privMap.get(d.id) : undefined;
    if (p) {
      const hidden = p.private || p.private_by_rule;
      items.push({
        key: "privacy", label: hidden ? "Hidden from doctors" : "Visible to doctors",
        icon: hidden ? Lock : Unlock, onPress: () => onLock(d),
      });
    }
    if (d.deletable) items.push({ key: "delete", label: "Delete", icon: Trash2, danger: true, onPress: () => setDeleting(d) });
    return items;
  }

  /** One document's card. `ids` are the files of the list it is in, in order (the viewer's strip). */
  function cardFor(d: PatientDocument, ids: number[]) {
    const hospital = isIssuedByHospital(d);

    const typeLabel = labelOf(d.doc_type);
    const p = privEnabled ? privMap.get(d.id) : undefined;
    const pState = p ? (p.revealed_for_visit ? "visit" : p.private ? "private" : "shared") : null;
    const extra = pState === "private" || pState === "visit" ? (
      <View style={{ alignItems: "flex-start", marginTop: 6 }}>
        {pState === "private" && <Text style={styles.privTag}>PRIVATE{p?.private_by_rule ? " · BY RULE" : ""}</Text>}
        {pState === "visit" && (
          <View style={styles.visTag}>
            <Clock size={9} color={NEUTRAL.success} strokeWidth={2.6} />
            <Text style={styles.visTagT}>SHOWN THIS VISIT</Text>
          </View>
        )}
      </View>
    ) : undefined;
    return (
      <FileItem
        key={d.id}
        title={typeLabel}
        date={cardDate(d)}
        forName={personName}
        nameColor={nameColor}
        doctorName={d.doctor_name}
        onEditDoctor={hospital ? undefined : () => setDoctorFor(d)}
        extra={extra}
        footerLeft={<SourceFooter hospital={hospital} />}
        footerRight={<ViewButton onPress={() => openViewer(d.id, ids)} />}
        typeCode={d.doc_type}
        menu={menuFor(d)}
      />
    );
  }

  const dialogs: ReactNode = (
    <>
      <ChoiceSheet
        visible={!!lockSheet}
        title={lockSheet?.title || ""}
        message={lockSheet?.message}
        actions={lockSheet?.actions || []}
        onClose={() => setLockSheet(null)}
      />
      <DoctorNameSheet
        visible={!!doctorFor}
        initial={doctorFor?.doctor_name ?? ""}
        onSave={saveDoctor}
        onClose={() => setDoctorFor(null)}
      />
      <ConfirmDialog
        visible={!!deleting}
        danger
        title="Delete this document?"
        message="This removes the file for good. It can't be recovered."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loading={removing}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
      <MessageDialog
        visible={!!notice}
        title={notice?.title ?? ""}
        message={notice?.message}
        buttonLabel="OK"
        tone={notice?.tone ?? "error"}
        onDismiss={() => setNotice(null)}
      />
    </>
  );

  return {
    cardFor, dialogs,
    actionError, setActionError, setNotice,
    privacyQ, privSession, privEnabled,
    familyQ, members, member, personName, personTag, nameColor,
    labelOf,
  };
}

const styles = StyleSheet.create({
  privTag: { fontSize: 9, fontWeight: "800", letterSpacing: 0.4, color: "#4A3489", backgroundColor: "#ECE7F7", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  visTag: { flexDirection: "row", alignItems: "center", gap: 3 },
  visTagT: { fontSize: 9, fontWeight: "800", letterSpacing: 0.4, color: NEUTRAL.success },
});
