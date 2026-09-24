import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal, ActivityIndicator, TextInput, Share } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Clock, Check, ShieldCheck, ShieldAlert, ScanLine, X, Download, Link2 } from "lucide-react-native";
import { Screen, BackHeader, ErrorBanner } from "@/components/Layout";
import { Card } from "@/components/Card";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import {
  createRecordsShare, recordsShareDecision, getRecordsShareMine,
  endRecordsShare, recordsShareDownloadDecision,
} from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { RecordsShareCreated, RecordsShareDecision, RecordsShareGrant, RecordsShareScope } from "@/api/types";
import { AppStackParamList } from "@/navigation/types";

// The doctor's laptop QR encodes …/share-records/<token>?p=<pairing>. Pull
// both out: the token so we can check it's this patient's own session, the
// pairing so we can approve without the patient re-typing it.
function parseScan(raw: string): { token: string; pairing: string } {
  const s = (raw || "").trim();
  const tok = s.match(/share-records\/([A-Za-z0-9]+)/i);
  const pair = s.match(/[?&#]p=([A-Za-z0-9]+)/i);
  if (tok) return { token: tok[1], pairing: (pair?.[1] || "").toUpperCase() };
  if (/^[a-f0-9]{16,}$/i.test(s)) return { token: s, pairing: "" };
  return { token: s, pairing: "" };
}
const mmss = (secs: number) => {
  const s = Math.max(0, Math.floor(secs));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

// The doctor's entry page is always FRONTEND_URL + "/share" — same origin the
// backend just handed back in `created.link` (…/share-records/<token>).
// Deriving it from there instead of hardcoding the production domain means
// this instruction is correct in dev (LAN IP) without ever needing a revert.
function shareEntryHost(link?: string): string {
  if (!link) return "clinic.atomwalk.com";
  return link.replace(/^https?:\/\//, "").split("/")[0];
}

export function ShareRecordsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { theme } = useAppTheme();
  const [permission, requestPermission] = useCameraPermissions();

  const [phase, setPhase] = useState<"home" | "link" | "manual" | "consent" | "done">("home");
  const [note, setNote] = useState("");
  const [created, setCreated] = useState<RecordsShareCreated | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanHint, setScanHint] = useState("");
  const scannedRef = useRef(false);
  // The pairing lifted off the scanned QR; the typed field is the fallback.
  const pairingRef = useRef("");
  const [pairingInput, setPairingInput] = useState("");
  const [pairingErr, setPairingErr] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [privateCount, setPrivateCount] = useState(0);
  // The one-time bulk choice made on the consent screen — defaults to
  // respecting the patient's standing privacy, same as every share before
  // this existed. "all" is an explicit opt-in, never the default.
  const [shareScope, setShareScope] = useState<RecordsShareScope>("default");
  const [grantedUntil, setGrantedUntil] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // refetchInterval replaces the old manual setInterval(loadGrants, 5000) —
  // same 5s live polling, no interval/cleanup code to hand-manage.
  const grantsQ = useQuery({
    queryKey: ["recordsShareMine"],
    queryFn: () => getRecordsShareMine().catch(() => [] as RecordsShareGrant[]),
    refetchInterval: 5000,
  });
  useRefreshOnFocus(grantsQ);
  const grants = grantsQ.data ?? [];
  const loadGrants = grantsQ.refetch;

  async function createLink() {
    setBusy(true); setError("");
    try {
      const c = await createRecordsShare(note.trim() || undefined);
      setCreated(c);
      setPhase("link");
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't create a link. Try again."));
    } finally { setBusy(false); }
  }

  async function onShareLink() {
    if (!created) return;
    try { await Share.share({ message: `Open this to view my medical records (I'll approve on my phone): ${created.link}` }); }
    catch { /* dismissed */ }
  }

  function startScan() {
    setScanHint(""); setError("");
    if (permission?.granted) { scannedRef.current = false; setScanning(true); }
    else requestPermission().then((p) => { if (p.granted) { scannedRef.current = false; setScanning(true); } });
  }

  function onBarcode({ data }: { data: string }) {
    if (scannedRef.current || !created) return;
    const { token: t, pairing } = parseScan(data);
    if (t !== created.token) {
      setScanHint("That's not this share — point at the screen showing the code you gave the doctor.");
      return;
    }
    scannedRef.current = true;
    setScanning(false);
    if (pairing) {
      // Normal path — the QR carried the pairing, go straight to consent.
      pairingRef.current = pairing;
      decide(true, false);
    } else {
      // Old-style QR with no pairing — fall back to typing it.
      setPairingInput(""); setPairingErr("");
      setPhase("manual");
    }
  }

  // Fallback: the patient reads the 6-character code under the QR and types
  // it. A wrong one is a 400 (with tries left); too many locks it (423); the
  // doctor not having opened the link yet is 409.
  async function submitManual() {
    if (!created || pairingInput.length < 6) return;
    pairingRef.current = pairingInput.toUpperCase();
    setBusy(true); setPairingErr("");
    try {
      const r = await recordsShareDecision(created.token, true, false, pairingRef.current);
      if ("consent_required" in r) {
        setCategories(r.share_categories);
        setPrivateCount(r.private_count);
        setPhase("consent");
      } else {
        setGrantedUntil((r as any).expires_at || null);
        setPhase("done");
        loadGrants();
      }
    } catch (e: any) {
      const st = e?.response?.status;
      if (st === 423) {
        setError("Too many wrong tries — this link is locked. Ask the doctor to open a new one.");
        reset();
      } else if (st === 409) {
        setPairingErr("The doctor hasn't opened the link yet. Wait for the code to show on their screen.");
      } else if (st === 400) {
        const leftN = e?.response?.data?.errors?.attempts_left;
        setPairingErr(leftN != null ? `Wrong code — ${leftN} ${leftN === 1 ? "try" : "tries"} left.` : "That doesn't match the doctor's screen.");
        setPairingInput("");
      } else {
        setPairingErr(apiErrorMessage(e, "Couldn't check that code."));
      }
    } finally { setBusy(false); }
  }

  async function decide(approve: boolean, consent: boolean) {
    if (!created) return;
    setBusy(true); setError("");
    try {
      const r = await recordsShareDecision(created.token, approve, consent, pairingRef.current || pairingInput, shareScope);
      if ("consent_required" in r) {
        setCategories(r.share_categories);
        setPrivateCount(r.private_count);
        setPhase("consent");
      } else if (!approve) {
        reset();
      } else {
        setGrantedUntil((r as RecordsShareDecision).expires_at);
        setPhase("done");
        loadGrants();
      }
    } catch (e: any) {
      const st = e?.response?.status;
      scannedRef.current = false;
      if (st === 423) {
        setError("Too many wrong tries — this link is locked. Ask the doctor to open a new one.");
        reset();
      } else if (st === 409 || st === 400) {
        // Doctor hasn't opened it yet, or the scanned code was stale — let
        // the patient read it off the screen and type it.
        pairingRef.current = "";
        setPairingInput(""); setPairingErr(
          st === 409
            ? "The doctor hasn't opened the link yet. Once the code shows on their screen, enter it here."
            : "That code was out of date. Enter the one on the doctor's screen now.",
        );
        setPhase("manual");
      } else {
        setError(apiErrorMessage(e, "Couldn't complete that."));
      }
    } finally { setBusy(false); }
  }

  function reset() {
    setPhase("home"); setCreated(null); setNote(""); setCategories([]);
    setPrivateCount(0); setShareScope("default");
    setGrantedUntil(null); scannedRef.current = false; setError("");
    pairingRef.current = ""; setPairingInput(""); setPairingErr("");
  }

  async function onEnd(token: string) {
    setBusy(true);
    try { await endRecordsShare(token); await loadGrants(); }
    catch (e) { setError(apiErrorMessage(e, "Couldn't end access.")); }
    finally { setBusy(false); }
  }
  async function onDownloadDecision(token: string, approve: boolean) {
    setBusy(true);
    try { await recordsShareDownloadDecision(token, approve); await loadGrants(); }
    catch (e) { setError(apiErrorMessage(e, "Couldn't respond.")); }
    finally { setBusy(false); }
  }

  return (
    <Screen>
      <BackHeader title="Share Records" onBack={() => navigation.goBack()} />

      <View style={styles.noticeRow}>
        <ShieldCheck size={14} color={NEUTRAL.success} style={styles.noticeIcon} />
        <Text style={styles.noticeText}>
          Create a code and read it to the doctor. They open clinic.atomwalk.com/share on their computer and type it,
          you scan what appears and confirm — then they can view your records for 2 hours. End it any time.
        </Text>
      </View>

      {!!error && <ErrorBanner message={error} />}

      {phase === "home" && (
        <Card style={styles.card}>
          <Text style={styles.label}>Who is this for? (optional)</Text>
          <TextInput
            value={note} onChangeText={setNote}
            placeholder="e.g. Dr. Rao, City Clinic"
            placeholderTextColor={NEUTRAL.textMuted}
            style={styles.input}
          />
          <PrimaryButton label="Create a share code" onPress={createLink} loading={busy} style={{ marginTop: 12 }} />
        </Card>
      )}

      {phase === "link" && created && (
        <Card style={styles.card}>
          <Text style={styles.h}>1. Read this code to the doctor</Text>
          <View style={styles.codePanel}>
            <Text style={styles.codeBig} selectable>
              {created.code.replace(/(\d{3})(\d{3})/, "$1 $2")}
            </Text>
            <Text style={styles.codePanelHint}>
              They open <Text style={{ fontWeight: "700" }}>{shareEntryHost(created.link)}/share</Text> on a computer and type it.
            </Text>
          </View>
          <Pressable onPress={onShareLink} style={styles.linkInstead}>
            <Link2 size={13} color={NEUTRAL.textSecondary} />
            <Text style={styles.linkInsteadText}>Send a link instead</Text>
          </Pressable>

          <Text style={[styles.h, { marginTop: 18 }]}>2. Scan their screen &amp; confirm</Text>
          <Text style={styles.body}>A QR appears on the doctor's screen. Scan it and approve — no code to type.</Text>
          <Pressable style={[styles.scanBtn, { backgroundColor: theme.fill }]} onPress={startScan}>
            <ScanLine size={18} color={theme.on} />
            <Text style={[styles.scanBtnText, { color: theme.on }]}>Scan to approve</Text>
          </Pressable>
          <Pressable onPress={() => { setPairingInput(""); setPairingErr(""); setPhase("manual"); }} style={{ alignItems: "center", paddingVertical: 8 }}>
            <Text style={styles.cancel}>Can't scan? Enter the code from their screen</Text>
          </Pressable>
          <Pressable onPress={reset} style={{ alignItems: "center", paddingVertical: 6 }}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </Card>
      )}

      {phase === "manual" && (
        <Card style={styles.card}>
          <Text style={styles.h}>Enter the code on the doctor's screen</Text>
          <Text style={styles.body}>The 6 characters shown under the QR. This confirms you're looking at their screen.</Text>
          <TextInput
            value={pairingInput}
            onChangeText={(t) => { setPairingErr(""); setPairingInput(t.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6)); }}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            placeholder="••••••"
            placeholderTextColor={NEUTRAL.textMuted}
            style={styles.codeField}
          />
          {!!pairingErr && <Text style={styles.codeErr}>{pairingErr}</Text>}
          <PrimaryButton label="Confirm" onPress={submitManual} loading={busy} disabled={pairingInput.length < 6} style={{ marginTop: 4, marginBottom: 8 }} />
          <SecondaryButton label="Scan instead" onPress={startScan} disabled={busy} />
        </Card>
      )}

      {phase === "consent" && (
        <Card style={styles.card}>
          <Text style={styles.h}>Share your records for 2 hours?</Text>
          <Text style={styles.body}>
            {created?.link ? "This doctor" : "They"} will be able to see:
          </Text>
          <View style={styles.checkList}>
            {categories.map((c) => (
              <View key={c} style={styles.checkRow}>
                <Check size={13} color={theme.text} strokeWidth={2.6} style={styles.checkIcon} />
                <Text style={styles.checkText}>{c}</Text>
              </View>
            ))}
          </View>

          {privateCount > 0 && (
            <>
              <Text style={styles.scopeLabel}>
                You've marked {privateCount} {privateCount === 1 ? "record" : "records"} private. Include {privateCount === 1 ? "it" : "them"} for this doctor?
              </Text>
              <Pressable
                onPress={() => setShareScope("default")}
                style={[styles.scopeOption, shareScope === "default" && { borderColor: theme.fill }]}
              >
                <View style={[styles.radio, shareScope === "default" && { borderColor: theme.fill }]}>
                  {shareScope === "default" && <View style={[styles.radioDot, { backgroundColor: theme.fill }]} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.scopeTitle}>Share as usual</Text>
                  <Text style={styles.scopeBody}>Records you've marked private stay hidden, same as always.</Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => setShareScope("all")}
                style={[styles.scopeOption, shareScope === "all" && { borderColor: theme.fill }]}
              >
                <View style={[styles.radio, shareScope === "all" && { borderColor: theme.fill }]}>
                  {shareScope === "all" && <View style={[styles.radioDot, { backgroundColor: theme.fill }]} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.scopeTitle}>Share everything</Text>
                  <Text style={styles.scopeBody}>
                    Also show this doctor the {privateCount} private {privateCount === 1 ? "record" : "records"}, for this visit only.
                  </Text>
                </View>
              </Pressable>
            </>
          )}

          <PrimaryButton label="Allow access" onPress={() => decide(true, true)} loading={busy} style={{ marginTop: 14, marginBottom: 8 }} />
          <SecondaryButton label="Cancel" onPress={reset} disabled={busy} />
        </Card>
      )}

      {phase === "done" && (
        <Card style={styles.card}>
          <View style={styles.doneRow}>
            <ShieldCheck size={18} color={NEUTRAL.success} />
            <Text style={styles.doneTitle}>Access granted</Text>
          </View>
          <Text style={styles.body}>
            They can view your records{grantedUntil ? ` until ${new Date(grantedUntil).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}` : " for 2 hours"}. Manage it below.
          </Text>
          <SecondaryButton label="Done" onPress={reset} style={{ marginTop: 12 }} />
        </Card>
      )}

      {grants.length > 0 && (
        <View style={{ marginTop: 6 }}>
          <Text style={styles.sectionLabel}>Who can see your records now</Text>
          {grants.map((g) => {
            const left = g.expires_at ? (new Date(g.expires_at).getTime() - now) / 1000 : 0;
            return (
              <Card key={g.token} style={styles.grantCard}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={styles.grantWho} numberOfLines={1}>{g.requester_label || "A doctor"}</Text>
                      {g.share_all && (
                        <View style={styles.fullAccessTag}>
                          <Text style={styles.fullAccessTagText}>Full access</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <Clock size={11} color={left < 300 ? NEUTRAL.danger : NEUTRAL.textMuted} />
                      <Text style={[styles.grantTime, left < 300 && { color: NEUTRAL.danger, fontWeight: "700" }]}>
                        ends in {mmss(left)}
                      </Text>
                    </View>
                  </View>
                  <SecondaryButton label="End" compact danger disabled={busy} onPress={() => onEnd(g.token)} />
                </View>
                {g.pending_download && (
                  <View style={styles.dlBox}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <Download size={13} color={NEUTRAL.warning} />
                      <Text style={styles.dlText} numberOfLines={2}>
                        They want to download <Text style={{ fontWeight: "700" }}>{g.pending_download.title}</Text>
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <PrimaryButton label="Allow" compact disabled={busy} onPress={() => onDownloadDecision(g.token, true)} />
                      <SecondaryButton label="Deny" compact disabled={busy} onPress={() => onDownloadDecision(g.token, false)} />
                    </View>
                  </View>
                )}
              </Card>
            );
          })}
        </View>
      )}

      {phase === "home" && grants.length === 0 && (
        <View style={styles.emptyRow}>
          <ShieldAlert size={13} color={NEUTRAL.textMuted} />
          <Text style={styles.emptyText}>No one has access to your records right now.</Text>
        </View>
      )}

      <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)}>
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          {permission?.granted ? (
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={onBarcode}
            />
          ) : (
            <View style={styles.permWrap}>
              <Text style={styles.permText}>Camera access is needed to scan the code.</Text>
              <PrimaryButton label="Allow camera" onPress={() => requestPermission()} />
            </View>
          )}
          <View style={styles.scanOverlay} pointerEvents="none">
            <View style={styles.reticle} />
            <Text style={styles.scanOverlayHint}>Point at the QR on the doctor's screen</Text>
            {!!scanHint && <Text style={styles.scanWarn}>{scanHint}</Text>}
          </View>
          <Pressable style={styles.scanClose} onPress={() => setScanning(false)}>
            <X size={22} color="#fff" strokeWidth={2.4} />
          </Pressable>
        </View>
      </Modal>

      {busy && phase !== "home" && phase !== "link" && (
        <View style={{ alignItems: "center", marginTop: 12 }}><ActivityIndicator color={theme.fill} /></View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  noticeRow: { flexDirection: "row", gap: 6, marginBottom: 16, paddingHorizontal: 2 },
  noticeIcon: { marginTop: 1, flexShrink: 0 },
  noticeText: { flex: 1, fontSize: 11.5, color: NEUTRAL.textSecondary, lineHeight: 16 },
  card: { padding: 16, marginBottom: 12 },
  h: { fontSize: 13.5, fontWeight: "700", color: NEUTRAL.textPrimary, marginBottom: 6 },
  body: { fontSize: 12.5, color: NEUTRAL.textSecondary, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: "600", color: NEUTRAL.textPrimary, marginBottom: 6 },
  input: { borderWidth: 0.5, borderColor: NEUTRAL.border, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13.5, color: NEUTRAL.textPrimary },

  linkRow: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: NEUTRAL.surfaceAlt, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9 },
  linkText: { flex: 1, fontSize: 11.5, color: NEUTRAL.textSecondary },
  codeHint: { fontSize: 11.5, color: NEUTRAL.textMuted, alignSelf: "center" },
  code: { fontFamily: "monospace", fontWeight: "800", color: NEUTRAL.textPrimary, letterSpacing: 1 },

  codePanel: { backgroundColor: NEUTRAL.surfaceAlt, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 14, alignItems: "center", marginTop: 6 },
  codeBig: { fontFamily: "monospace", fontSize: 34, fontWeight: "800", letterSpacing: 6, color: NEUTRAL.textPrimary },
  codePanelHint: { fontSize: 11.5, color: NEUTRAL.textSecondary, textAlign: "center", marginTop: 8, lineHeight: 16 },
  linkInstead: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingVertical: 8 },
  linkInsteadText: { fontSize: 12, fontWeight: "600", color: NEUTRAL.textSecondary },
  codeField: {
    borderWidth: 1, borderColor: NEUTRAL.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, marginTop: 12, marginBottom: 4,
    fontFamily: "monospace", fontSize: 22, fontWeight: "700", letterSpacing: 8,
    textAlign: "center", color: NEUTRAL.textPrimary,
  },
  codeErr: { fontSize: 11.5, color: NEUTRAL.danger, marginBottom: 6, textAlign: "center" },

  scanBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 10, paddingVertical: 13, marginTop: 10 },
  scanBtnText: { fontSize: 14, fontWeight: "700" },
  cancel: { fontSize: 12.5, fontWeight: "600", color: NEUTRAL.textSecondary },

  checkList: { gap: 6, marginTop: 10, marginBottom: 16 },
  checkRow: { flexDirection: "row", gap: 6 },
  checkIcon: { marginTop: 2, flexShrink: 0 },
  checkText: { flex: 1, fontSize: 12, color: NEUTRAL.textPrimary, lineHeight: 17 },

  scopeLabel: { fontSize: 11.5, fontWeight: "600", color: NEUTRAL.textSecondary, marginBottom: 8 },
  scopeOption: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    borderWidth: 1, borderColor: NEUTRAL.border, borderRadius: 10,
    padding: 11, marginBottom: 8,
  },
  radio: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: NEUTRAL.border,
    alignItems: "center", justifyContent: "center", marginTop: 1, flexShrink: 0,
  },
  radioDot: { width: 9, height: 9, borderRadius: 4.5 },
  scopeTitle: { fontSize: 12.5, fontWeight: "700", color: NEUTRAL.textPrimary },
  scopeBody: { fontSize: 11, color: NEUTRAL.textSecondary, lineHeight: 15, marginTop: 2 },

  doneRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  doneTitle: { fontSize: 15, fontWeight: "700", color: NEUTRAL.success },

  sectionLabel: { fontSize: 10.5, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase", color: NEUTRAL.textMuted, marginBottom: 8, marginLeft: 2 },
  grantCard: { padding: 13, marginBottom: 8 },
  grantWho: { fontSize: 13, fontWeight: "600", color: NEUTRAL.textPrimary },
  grantTime: { fontSize: 11, color: NEUTRAL.textMuted },
  fullAccessTag: { backgroundColor: NEUTRAL.surfaceAlt, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  fullAccessTagText: { fontSize: 9.5, fontWeight: "700", color: NEUTRAL.warning, textTransform: "uppercase", letterSpacing: 0.3 },
  dlBox: { marginTop: 10, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: NEUTRAL.border },
  dlText: { flex: 1, fontSize: 11.5, color: NEUTRAL.textSecondary, lineHeight: 16 },

  emptyRow: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 8 },
  emptyText: { fontSize: 11.5, color: NEUTRAL.textMuted },

  permWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30, gap: 14 },
  permText: { color: "#fff", fontSize: 13, textAlign: "center" },
  scanOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  reticle: { width: "64%", aspectRatio: 1, borderWidth: 3, borderColor: "rgba(255,255,255,0.9)", borderRadius: 20 },
  scanOverlayHint: { color: "#fff", fontSize: 12.5, marginTop: 16, textAlign: "center", paddingHorizontal: 40 },
  scanWarn: { color: "#fecaca", fontSize: 12, marginTop: 10, textAlign: "center", paddingHorizontal: 40 },
  scanClose: { position: "absolute", top: 44, left: 18, width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
});
