import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Image, Share } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Clock, Check, ShieldAlert } from "lucide-react-native";
import { Screen, BackHeader, ErrorBanner } from "@/components/Layout";
import { Card } from "@/components/Card";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { NEUTRAL } from "@/theme/themes";
import { useAppTheme } from "@/context/ThemeContext";
import { generateEmergencyToken, getFamily } from "@/api/portal";
import { apiErrorMessage } from "@/api/client";
import { FamilyMember, EmergencyTokenResult, EmergencyConsentPrompt } from "@/api/types";
import { AppStackParamList } from "@/navigation/types";

function TargetChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: theme.bg, borderColor: theme.fill }]}
    >
      <Text style={[styles.chipText, selected && { color: theme.text, fontWeight: "700" }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function EmergencyQRScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { theme } = useAppTheme();

  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [targetAwpid, setTargetAwpid] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<EmergencyTokenResult | null>(null);
  const [consentPrompt, setConsentPrompt] = useState<EmergencyConsentPrompt | null>(null);
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      getFamily()
        .then(setFamily)
        .catch(() => {
          // Non-fatal — "Myself" still works without the family list; a
          // failed fetch here shouldn't block someone generating their own
          // emergency code.
        });
    }, [])
  );

  // Mirrors the web app's useCountdown — ticks off of expires_at (an
  // absolute timestamp) rather than a local counter, so it stays correct
  // even if the screen was backgrounded for a while.
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!result?.expires_at) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.floor((new Date(result.expires_at).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [result?.expires_at]);

  const expired = !!result && secondsLeft === 0;
  const targetLabel = targetAwpid ? family.find((f) => f.awpid === targetAwpid)?.full_name || "this family member" : "yourself";

  function selectTarget(awpid: string) {
    setTargetAwpid(awpid);
    setResult(null);
    setConsentPrompt(null);
    setError("");
  }

  const requestToken = useCallback(
    async (consentConfirmed: boolean) => {
      setGenerating(true);
      setError("");
      try {
        const res = await generateEmergencyToken({ patient_awpid: targetAwpid || undefined, consent_confirmed: consentConfirmed });
        if ("consent_required" in res) {
          setConsentPrompt(res);
        } else {
          setResult(res);
          setConsentPrompt(null);
        }
      } catch (err) {
        setError(apiErrorMessage(err, "Could not generate an emergency QR code."));
      } finally {
        setGenerating(false);
      }
    },
    [targetAwpid]
  );

  const startGenerate = useCallback(() => requestToken(false), [requestToken]);
  const confirmAndGenerate = useCallback(() => requestToken(true), [requestToken]);

  async function onShare() {
    if (!result) return;
    try {
      await Share.share({ message: `Emergency medical access link (expires in ${result.ttl_minutes} minutes): ${result.view_url}` });
    } catch {
      // User dismissed the share sheet — nothing to do.
    }
  }

  const mm = String(Math.floor((secondsLeft || 0) / 60)).padStart(2, "0");
  const ss = String((secondsLeft || 0) % 60).padStart(2, "0");
  const lowTime = secondsLeft !== null && secondsLeft <= 60;

  return (
    <Screen>
      <BackHeader title="Emergency QR" onBack={() => navigation.goBack()} />

      <View style={styles.noticeRow}>
        <ShieldAlert size={14} color={NEUTRAL.warning} style={styles.noticeIcon} />
        <Text style={styles.noticeText}>
          For emergencies at a hospital outside our network. Generate a code, show it on this screen, and let the
          treating doctor scan it — no login or app needed on their end. Each code expires in 20 minutes.
        </Text>
      </View>

      {!!error && <ErrorBanner message={error} />}

      <Card style={styles.card}>
        {consentPrompt ? (
          <View>
            <Text style={styles.consentTitle}>Confirm what you're sharing</Text>
            <Text style={styles.consentMsg}>{consentPrompt.message}</Text>
            <View style={styles.checkList}>
              {consentPrompt.share_categories.map((c) => (
                <View key={c} style={styles.checkRow}>
                  <Check size={13} color={theme.text} strokeWidth={2.6} style={styles.checkIcon} />
                  <Text style={styles.checkText}>{c}</Text>
                </View>
              ))}
            </View>
            <PrimaryButton
              label={generating ? "Generating…" : "Yes, share and generate"}
              onPress={confirmAndGenerate}
              loading={generating}
              style={{ marginBottom: 8 }}
            />
            <SecondaryButton label="Cancel" onPress={() => setConsentPrompt(null)} disabled={generating} />
          </View>
        ) : !result || expired ? (
          <View>
            <Text style={styles.label}>Who is this for?</Text>
            <View style={styles.chipRow}>
              <TargetChip label="Myself" selected={targetAwpid === ""} onPress={() => selectTarget("")} />
              {family.map((f) => (
                <TargetChip key={f.awpid} label={f.full_name} selected={targetAwpid === f.awpid} onPress={() => selectTarget(f.awpid)} />
              ))}
            </View>
            <PrimaryButton
              label={generating ? "Generating…" : expired ? "Generate a new code" : `Generate QR for ${targetLabel}`}
              onPress={startGenerate}
              loading={generating}
            />
            {expired && <Text style={styles.expiredNote}>This code has expired. Generate a new one to show it again.</Text>}
          </View>
        ) : (
          <View style={styles.qrState}>
            <View style={styles.qrBox}>
              <Image source={{ uri: result.qr_image }} style={styles.qrImage} />
            </View>
            <Text style={styles.forLabel}>For {targetLabel}</Text>
            <View style={styles.countdownRow}>
              <Clock size={13} color={lowTime ? NEUTRAL.danger : NEUTRAL.textMuted} strokeWidth={2.4} />
              <Text style={[styles.countdownText, lowTime && styles.countdownLow]}>
                Expires in {mm}:{ss}
              </Text>
            </View>
            <View style={styles.actionRow}>
              <SecondaryButton label="New code" onPress={startGenerate} disabled={generating} compact />
              <View style={styles.actionGap} />
              <SecondaryButton label="Share link" onPress={onShare} compact />
            </View>
          </View>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  noticeRow: { flexDirection: "row", gap: 6, marginBottom: 16, paddingHorizontal: 2 },
  noticeIcon: { marginTop: 1, flexShrink: 0 },
  noticeText: { flex: 1, fontSize: 11.5, color: NEUTRAL.textSecondary, lineHeight: 16 },
  card: { padding: 16 },
  label: { fontSize: 12, fontWeight: "600", color: NEUTRAL.textPrimary, marginBottom: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: NEUTRAL.border,
    backgroundColor: NEUTRAL.surfaceAlt,
    maxWidth: "100%",
  },
  chipText: { fontSize: 12.5, color: NEUTRAL.textSecondary, fontWeight: "600" },
  consentTitle: { fontSize: 13, fontWeight: "700", color: NEUTRAL.textPrimary, marginBottom: 8 },
  consentMsg: { fontSize: 12.5, color: NEUTRAL.textSecondary, lineHeight: 18, marginBottom: 12 },
  checkList: { gap: 6, marginBottom: 16 },
  checkRow: { flexDirection: "row", gap: 6 },
  checkIcon: { marginTop: 2, flexShrink: 0 },
  checkText: { flex: 1, fontSize: 12, color: NEUTRAL.textPrimary, lineHeight: 17 },
  expiredNote: { fontSize: 11.5, color: NEUTRAL.danger, marginTop: 10, textAlign: "center" },
  qrState: { alignItems: "center" },
  qrBox: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: NEUTRAL.border,
    marginBottom: 12,
  },
  qrImage: { width: 200, height: 200 },
  forLabel: { fontSize: 13, fontWeight: "600", color: NEUTRAL.textPrimary, marginBottom: 8 },
  countdownRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 14 },
  countdownText: { fontSize: 12.5, color: NEUTRAL.textMuted },
  countdownLow: { color: NEUTRAL.danger, fontWeight: "700" },
  actionRow: { flexDirection: "row" },
  actionGap: { width: 10 },
});
