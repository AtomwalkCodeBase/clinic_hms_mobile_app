import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Check, ChevronRight, CircleAlert, CircleCheckBig, CloudUpload, FileSearch, Bell, Info, Sparkles } from "lucide-react-native";
import { useUploadTasks } from "@/context/UploadTasksContext";
import { useAppTheme } from "@/context/ThemeContext";
import { useExtractedItems } from "@/hooks/useExtractedItems";
import { AiProgress } from "@/hooks/useAiProgress";
import { NEUTRAL } from "@/theme/themes";

/**
 * The patient's journey for an upload, as a list of steps:
 *   1. Upload  2. Read (text extraction)  3. AI check (the keyword rules + the AI queue on the server)
 * A later step (the patient's own Review) is added by appending to the step list built in
 * useUploadModels — the stepper, the entry row and the Home ring all draw whatever steps they are
 * given, so nothing else changes.
 */
export type StepState = "done" | "current" | "todo" | "warn";
export type UploadStep = {
  key: "upload" | "read" | "ai";
  label: string;
  state: StepState;
  /** Small text under the step's circle: "20 files", "15 of 20", "Next". */
  caption: string;
  /** This step's own progress, 0..1 (drives the ring / segment fill). */
  frac: number;
};

export type UploadModel = {
  key: "instant" | "bulk";
  kind: "run" | "done" | "warn";
  title: string;
  steps: UploadStep[];
  /** Progress of the CURRENT step only, 0..100 — each step's bar starts from zero. */
  pct: number;
  /** No honest percentage exists yet — show a sweeping bar instead. */
  indeterminate: boolean;
  showBar: boolean;
  /** Line under the bar: bold count, then the rest ("15 of 20" + "read"), and the time left on the right. */
  barCount: string;
  barUnit: string;
  eta: string;
  /** Small explanatory line ("keep the app open…" / "runs in the background…"). */
  note: string;
  noteIcon: "info" | "bell";
  /** Files still queued (bulk only) — the Waiting tab. */
  waiting: number;
};

const DEFAULT_MS_PER_FILE = 8000;   // measured: phone photos take ~6-14 s each to read (median ~8 s)

const plural = (n: number) => `${n} report${n === 1 ? "" : "s"}`;
const files = (n: number) => `${n} file${n === 1 ? "" : "s"}`;

/**
 * "about 25 sec left" / "about 4 min left", from how fast files have actually been finishing
 * (8 s/file until there is data). "almost done" is kept for the last few files only, so it never
 * over-promises while many are still waiting.
 */
export function etaText(waiting: number, processed: number, startedAt?: string | null): string {
  let perFile = DEFAULT_MS_PER_FILE;
  if (processed >= 2 && startedAt) {
    const elapsed = Date.now() - Date.parse(startedAt);
    if (elapsed > 0) perFile = Math.min(20_000, Math.max(800, elapsed / processed));
  }
  if (waiting <= 3) return "almost done";
  const secs = (waiting * perFile) / 1000;
  if (secs < 60) return `about ${Math.max(10, Math.round(secs / 5) * 5)} sec left`;
  return `about ${Math.max(1, Math.round(secs / 60))} min left`;
}

const NOTE_LEAVE = "Runs in the background. You can leave this screen. We'll notify you when it's done.";
const NOTE_STAY = "Keep the app open until the upload finishes. After that you can leave.";

const step = (key: UploadStep["key"], state: StepState, caption: string, frac: number): UploadStep => ({
  key, label: key === "upload" ? "Upload" : key === "read" ? "Read" : "AI check", state, caption, frac,
});

const BASE: Omit<UploadModel, "key" | "kind" | "title" | "steps"> = {
  pct: 0, indeterminate: false, showBar: false, barCount: "", barUnit: "", eta: "", note: "", noteIcon: "info", waiting: 0,
};

const NOTE_AI = "The AI check runs on our server, one report at a time. You can leave this screen.";

/** The third step, from how far the AI check has got. `readOk` = how many files were read (nothing to check if none). */
function aiStep(ai: AiProgress | null, readOk: number): UploadStep {
  if (!readOk || !ai || ai.total === 0) return step("ai", "todo", "Later", 0);
  if (ai.pending > 0) {
    return step("ai", "current", ai.running > 0 || ai.checked > 0 ? `${ai.checked} of ${ai.total}` : "Queued", ai.checked / ai.total);
  }
  // Settled — or we stopped waiting because the AI server has been busy/offline for a long time.
  if (ai.queued + ai.running > 0) return step("ai", "todo", "Still queued", 0);
  if (ai.failed > 0) return step("ai", "warn", `${ai.failed} unchecked`, 1);
  return step("ai", "done", `${ai.total} of ${ai.total}`, 1);
}

/**
 * Reading has finished: `ok` of `total` files were read, `failedN` were not. While the AI check is still
 * queued or running the card stays a "run" card with the third step current; once it settles it turns green
 * (amber if some files couldn't be read).
 */
function afterRead(key: "instant" | "bulk", total: number, ok: number, failedN: number, firstFail: string, ai: AiProgress | null): UploadModel {
  const a = aiStep(ai, ok);
  const steps = [
    step("upload", "done", files(total), 1),
    failedN ? step("read", "warn", `${ok} of ${total}`, 1) : step("read", "done", `${total} of ${total}`, 1),
    a,
  ];
  const failTail = failedN ? `${failedN} couldn't be read${firstFail ? " — " + firstFail : ""}` : "";
  if (ai && ai.pending > 0 && ok > 0) {
    const queuedOnly = ai.running === 0 && ai.checked === 0;
    return {
      ...BASE, key, kind: "run", title: queuedOnly ? "AI check queued" : "Running the AI check", steps,
      pct: Math.round(a.frac * 100), showBar: true, barCount: `${ai.checked} of ${ai.total}`,
      barUnit: "checked" + (failTail ? ` · ${failTail}` : ""), note: NOTE_AI, noteIcon: "bell",
    };
  }
  if (failedN) {
    return {
      ...BASE, key, kind: "warn", title: "Finished", steps,
      barCount: `${ok} read`, barUnit: `· ${failTail}`,
    };
  }
  return {
    ...BASE, key, kind: "done", title: a.state === "todo" ? "Finished reading" : "All done", steps,
    barCount: `${ok} of ${total}`,
    barUnit: a.state === "warn" ? "read · the AI check couldn't run for some" : a.state === "todo" ? "read · the AI check is still queued" : "read · checked · ready to view",
  };
}

/** Turns the upload context (instant + bulk tasks) into what the UI draws. */
export function useUploadModels(): UploadModel[] {
  const {
    instantBusy, lastInstantResult, instantFileCount, instantPhase, instantUploadPct, instantAi,
    bulkStarting, bulkStartError, bulkStatus, bulkUploadProgress, bulkAi,
  } = useUploadTasks();
  const models: UploadModel[] = [];

  // ── instant (a small upload, one request: first sent, then read, then the AI check) ──
  if (instantBusy) {
    const n = instantFileCount;
    if (instantPhase === "upload") {
      models.push({
        ...BASE, key: "instant", kind: "run", title: n > 1 ? "Sending your files" : "Sending your file",
        steps: [step("upload", "current", "Sending", instantUploadPct / 100), step("read", "todo", "Next", 0), step("ai", "todo", "Later", 0)],
        pct: instantUploadPct, indeterminate: instantUploadPct === 0, showBar: true,
        barCount: instantUploadPct ? `${instantUploadPct}%` : "", barUnit: "sent", note: NOTE_STAY, noteIcon: "info",
      });
    } else {
      models.push({
        ...BASE, key: "instant", kind: "run", title: n > 1 ? `Reading ${n} reports` : "Reading your report",
        steps: [step("upload", "done", files(n), 1), step("read", "current", "Reading", 0), step("ai", "todo", "Later", 0)],
        indeterminate: true, showBar: true, barCount: "", barUnit: "Usually takes a few seconds", note: NOTE_STAY, noteIcon: "info",
      });
    }
  } else if (lastInstantResult) {
    const { extracted, failed, lines } = lastInstantResult;
    const n = extracted + failed;
    models.push(
      extracted === 0
        ? {
            ...BASE, key: "instant", kind: "warn", title: "Couldn't read your report",
            steps: [step("upload", "done", files(n), 1), step("read", "warn", `0 of ${n}`, 1), step("ai", "todo", "Later", 0)],
            barCount: "", barUnit: `${failed} failed${lines[0] ? " — " + lines[0] : ""}`,
          }
        : afterRead("instant", n, extracted, failed, lines[0] ?? "", instantAi)
    );
  }

  // ── bulk (a bigger upload: sent to storage, read in the background, then the AI check) ──
  if (bulkStartError && !bulkStatus) {
    models.push({
      ...BASE, key: "bulk", kind: "warn", title: "Upload didn't start",
      steps: [step("upload", "warn", "Didn't start", 0), step("read", "todo", "Next", 0), step("ai", "todo", "Later", 0)],
      barUnit: bulkStartError,
    });
  } else if (bulkStatus) {
    const total = bulkStatus.total_files;
    const processed = bulkStatus.processed ?? bulkStatus.completed + bulkStatus.failed;
    const active = ["pending", "queued", "processing"].includes(bulkStatus.status);
    if (active) {
      const started = bulkStatus.status === "processing";
      const waiting = Math.max(0, total - processed);
      const frac = total ? processed / total : 0;
      models.push({
        ...BASE, key: "bulk", kind: "run", title: started ? "Reading your reports" : "Waiting to start",
        steps: [step("upload", "done", files(total), 1), step("read", "current", started ? `${processed} of ${total}` : "Waiting", frac), step("ai", "todo", "Later", 0)],
        pct: Math.round(frac * 100), showBar: true, waiting,
        barCount: `${processed} of ${total}`, barUnit: "read",
        eta: started ? etaText(waiting, processed, bulkStatus.started_at) : "",
        note: NOTE_LEAVE, noteIcon: "bell",
      });
    } else {
      const { completed, failed, status } = bulkStatus;
      if (status === "done" || status === "partial") {
        models.push(afterRead("bulk", total, completed, failed, "", bulkAi));
      } else {
        models.push({
          ...BASE, key: "bulk", kind: "warn",
          title: status === "cancelled" ? "Upload was cancelled" : "None of your files could be read",
          steps: [step("upload", "done", files(total), 1), step("read", "warn", "0 read", 0), step("ai", "todo", "Later", 0)],
          barUnit: "Please try uploading again.",
        });
      }
    }
  } else if (bulkUploadProgress || bulkStarting) {
    const { done, total } = bulkUploadProgress ?? { done: 0, total: 0 };
    const frac = total ? done / total : 0;
    models.push({
      ...BASE, key: "bulk", kind: "run", title: total ? "Uploading your files" : "Preparing upload…",
      steps: [step("upload", "current", total ? `${done} of ${total}` : "Preparing", frac), step("read", "todo", "Next", 0), step("ai", "todo", "Later", 0)],
      pct: Math.round(frac * 100), indeterminate: !total, showBar: true, waiting: total,
      barCount: total ? `${done} of ${total}` : "", barUnit: total ? "uploaded" : "", note: NOTE_STAY, noteIcon: "info",
    });
  }
  return models;
}

// ── the bar (Material 3 linear style: rounded, small gap, stop dot) ─────────────

export function Bar({ pct, indeterminate, color, track, height = 8 }: { pct: number; indeterminate: boolean; color: string; track: string; height?: number }) {
  const width = useRef(new Animated.Value(pct)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(0);

  useEffect(() => {
    Animated.timing(width, { toValue: pct, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct, width]);

  useEffect(() => {
    if (!indeterminate) return;
    const loop = Animated.loop(Animated.timing(sweep, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [indeterminate, sweep]);

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const r = height / 2;

  if (indeterminate) {
    const seg = w * 0.38;
    return (
      <View onLayout={onLayout} style={{ height, borderRadius: r, backgroundColor: track, overflow: "hidden" }}>
        <Animated.View
          style={{
            width: seg, height, borderRadius: r, backgroundColor: color,
            transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-seg, w] }) }],
          }}
        />
      </View>
    );
  }
  const GAP = 3;
  return (
    <View onLayout={onLayout} style={{ height, flexDirection: "row", alignItems: "center" }}>
      <Animated.View style={{ height, borderRadius: r, backgroundColor: color, width: width.interpolate({ inputRange: [0, 100], outputRange: [0, Math.max(0, w - (pct >= 100 ? 0 : GAP))], extrapolate: "clamp" }) }} />
      {pct < 100 && (
        <View style={{ flex: 1, height, marginLeft: GAP, borderRadius: r, backgroundColor: track, justifyContent: "center", alignItems: "flex-end" }}>
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color, marginRight: 2 }} />
        </View>
      )}
    </View>
  );
}

// ── shared helpers ────────────────────────────────────────────────────────────

export type Accent = { fill: string; bg: string; text: string };

const WARN = "#E0A33A";

function toneFor(kind: UploadModel["kind"], accent: Accent) {
  return kind === "done"
    ? { border: "#B7DCC3", bg: "#F4FAF6", fg: NEUTRAL.success, bar: NEUTRAL.success, track: "rgba(22,101,52,0.14)" }
    : kind === "warn"
      ? { border: WARN, bg: "#FFF9EC", fg: NEUTRAL.warning, bar: WARN, track: "rgba(133,79,11,0.14)" }
      : { border: NEUTRAL.border, bg: "#FFFFFF", fg: accent.text, bar: accent.fill, track: accent.bg };
}

// ── the stepper: check circles joined by lines (solid once done, dotted while ahead) ──

const NODE = 28;

function Dotted() {
  return (
    <View style={styles.dotted}>
      {Array.from({ length: 9 }).map((_, i) => <View key={i} style={styles.dot} />)}
    </View>
  );
}

function Half({ done, hidden }: { done: boolean; hidden: boolean }) {
  if (hidden) return <View style={{ flex: 1 }} />;
  return <View style={{ flex: 1, marginHorizontal: 4 }}>{done ? <View style={styles.solid} /> : <Dotted />}</View>;
}

function Node({ s, accent, n }: { s: UploadStep; accent: Accent; n: number }) {
  const base = { width: NODE, height: NODE, borderRadius: NODE / 2, alignItems: "center" as const, justifyContent: "center" as const };
  if (s.state === "done") return <View style={[base, { backgroundColor: accent.fill }]}><Check size={15} color="#FFFFFF" strokeWidth={3} /></View>;
  if (s.state === "warn") return <View style={[base, { backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: WARN }]}><Text style={styles.bang}>!</Text></View>;
  if (s.state === "current") {
    return (
      <View style={{ width: NODE + 8, height: NODE + 8, borderRadius: (NODE + 8) / 2, backgroundColor: accent.bg, alignItems: "center", justifyContent: "center", margin: -4 }}>
        <View style={[base, { backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: accent.fill }]}>
          <ActivityIndicator size={14} color={accent.fill} />
        </View>
      </View>
    );
  }
  return <View style={[base, { backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: "#CDD6DC" }]}><Text style={styles.todoN}>{n}</Text></View>;
}

export function Stepper({ steps, accent }: { steps: UploadStep[]; accent: Accent }) {
  return (
    <View style={{ flexDirection: "row" }}>
      {steps.map((s, i) => {
        const prevDone = i > 0 && steps[i - 1].state === "done";
        const thisDone = s.state === "done";
        return (
          <View key={s.key} style={{ flex: 1, alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", height: NODE }}>
              <Half done={prevDone} hidden={i === 0} />
              <Node s={s} accent={accent} n={i + 1} />
              <Half done={thisDone} hidden={i === steps.length - 1} />
            </View>
            <Text style={[styles.stepLabel, s.state === "todo" && { color: NEUTRAL.textMuted, fontWeight: "400" }]}>{s.label}</Text>
            <Text style={[styles.stepCap, s.state === "warn" && { color: NEUTRAL.warning }]}>{s.caption}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** The progress header at the top of the Uploads screen. */
export function UploadStatusCard({ model, accent }: { model: UploadModel; accent: Accent }) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 240, useNativeDriver: true }).start();
  }, [fade]);
  const tone = toneFor(model.kind, accent);
  const running = model.kind === "run";

  return (
    <Animated.View style={[styles.card, { backgroundColor: tone.bg, borderColor: tone.border, opacity: fade }]}>
      <View style={styles.topRow}>
        <Text style={styles.title} numberOfLines={2}>{model.title}</Text>
        {running && !model.indeterminate && model.showBar && <Text style={[styles.pct, { color: tone.fg }]}>{Math.round(model.pct)}%</Text>}
      </View>
      <Stepper steps={model.steps} accent={accent} />
      {model.showBar && (
        <View style={{ marginTop: 14 }}>
          <Bar pct={model.pct} indeterminate={model.indeterminate} color={tone.bar} track={tone.track} />
        </View>
      )}
      {(!!model.barCount || !!model.barUnit || !!model.eta) && (
        <View style={styles.capRow}>
          <Text style={styles.capL} numberOfLines={2}>
            {!!model.barCount && <Text style={styles.capB}>{model.barCount}</Text>}
            {!!model.barCount && !!model.barUnit ? " " : ""}{model.barUnit}
          </Text>
          {!!model.eta && <Text style={styles.capR}>{model.eta}</Text>}
        </View>
      )}
      {!!model.note && (
        <View style={styles.note}>
          {model.noteIcon === "bell" ? <Bell size={13} color={NEUTRAL.textSecondary} strokeWidth={2.2} /> : <Info size={13} color={NEUTRAL.textSecondary} strokeWidth={2.2} />}
          <Text style={styles.noteT}>{model.note}</Text>
        </View>
      )}
    </Animated.View>
  );
}

// ── slim entry row on Rx & Reports ───────────────────────────────────────────

const currentIndex = (m: UploadModel) => Math.max(0, m.steps.findIndex((s) => s.state === "current" || s.state === "warn"));

/** One tiny bar per step (each fills on its own), the Rx entry row's version of the stepper. */
function SegBar({ steps, accent, kind }: { steps: UploadStep[]; accent: Accent; kind: UploadModel["kind"] }) {
  const tone = toneFor(kind === "done" ? "run" : kind, accent);
  return (
    <View style={{ flexDirection: "row", gap: 3 }}>
      {steps.map((s) => (
        <View key={s.key} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: tone.track, overflow: "hidden" }}>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: tone.bar, width: `${s.state === "done" || s.state === "warn" ? 100 : Math.round((s.frac || (s.state === "current" ? 0.35 : 0)) * 100)}%` }} />
        </View>
      ))}
    </View>
  );
}

/**
 * One quiet line under the Rx & Reports header that opens the Uploads screen.
 * "Step 2 of 3 · Reading" with one tiny bar per step while something runs, otherwise how
 * many reports are waiting to be viewed. Renders nothing when there's nothing to show.
 */
export function UploadsEntryRow({ patientAwpid, accent, onOpen }: { patientAwpid?: string; accent?: Accent; onOpen: () => void }) {
  const { theme } = useAppTheme();
  const models = useUploadModels();
  const q = useExtractedItems(patientAwpid);
  const a = accent ?? { fill: theme.fill, bg: theme.bg, text: theme.text };
  const counts = q.data?.counts ?? { ready: 0, failed: 0 };

  const m = models.find((x) => x.kind === "run") ?? models.find((x) => x.kind === "warn" && !x.showBar);
  let title: string;
  let sub: string;
  let kind: UploadModel["kind"] = "run";
  let Icon = FileSearch;
  let steps: UploadStep[] | null = null;

  if (m) {
    kind = m.kind;
    const i = currentIndex(m);
    if (m.kind === "run") {
      const k = m.steps[i].key;
      const verb = k === "upload" ? "Uploading" : k === "read" ? "Reading" : "AI check";
      title = `Step ${i + 1} of ${m.steps.length} · ${verb}`;
      const progress = m.barCount ? `${m.barCount} ${m.barUnit}`.trim() : m.barUnit;
      sub = counts.ready ? `${counts.ready} ready to view${m.eta ? " · " + m.eta : ""}` : [progress, m.eta].filter(Boolean).join(" · ");
      steps = m.steps;
      Icon = k === "upload" ? CloudUpload : k === "read" ? FileSearch : Sparkles;
    } else {
      title = m.title;
      sub = m.barUnit;
      Icon = CircleAlert;
    }
  } else if (counts.ready || counts.failed) {
    kind = counts.ready ? "done" : "warn";
    title = counts.ready ? `${plural(counts.ready)} ready to view` : `${counts.failed} couldn't be read`;
    sub = counts.ready && counts.failed ? `${counts.failed} couldn't be read · tap to open` : "Tap to open";
    Icon = counts.ready ? CircleCheckBig : CircleAlert;
  } else {
    return null;
  }

  const tone = toneFor(kind === "done" ? "run" : kind, a);
  const tile = kind === "warn" ? "#FCEBC8" : kind === "done" ? "#CDEBD6" : a.bg;
  const fg = kind === "warn" ? NEUTRAL.warning : kind === "done" ? NEUTRAL.success : a.text;
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.entry, pressed && { opacity: 0.9 }]}>
      <View style={styles.row}>
        <View style={[styles.entryTile, { backgroundColor: tile }]}>
          <Icon size={16} color={fg} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.entryT} numberOfLines={1}>{title}</Text>
          {!!sub && <Text style={styles.entryS} numberOfLines={1}>{sub}</Text>}
        </View>
        <ChevronRight size={18} color={NEUTRAL.textMuted} strokeWidth={2.2} />
      </View>
      {steps && (
        <View style={{ marginTop: 9 }}>
          <SegBar steps={steps} accent={a} kind={kind} />
        </View>
      )}
    </Pressable>
  );
}

// ── ring for the Home header: one arc per step ───────────────────────────────

const RING = 34;
const R = RING / 2 - 3;
const CIRC = 2 * Math.PI * R;

/**
 * A compact ring beside the bell, split into one arc per step, each filling on its own. When
 * nothing is running it shows how many reports are waiting to be viewed (amber if only failures
 * are left). Renders nothing when there's nothing to show.
 */
export function UploadRing({ onOpen }: { onOpen: () => void }) {
  const models = useUploadModels();
  const q = useExtractedItems();
  const spin = useRef(new Animated.Value(0)).current;
  const running = models.find((m) => m.kind === "run");
  const indeterminate = !!running?.indeterminate;

  useEffect(() => {
    if (!indeterminate) return;
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [indeterminate, spin]);

  const counts = q.data?.counts;
  if (!running && !(counts && (counts.ready || counts.failed))) return null;

  const warnOnly = !running && !!counts && !counts.ready && counts.failed > 0;
  const color = warnOnly ? "#F6C36B" : "#5FD48F";
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const count = counts ? (warnOnly ? counts.failed : counts.ready) : 0;
  // While running: one arc per step. Otherwise a single full ring.
  const stepFracs = running
    ? running.steps.map((s) => (s.state === "done" || s.state === "warn" ? 1 : s.frac || (s.state === "current" ? 0.3 : 0)))
    : [1];
  const n = stepFracs.length;
  const seg = CIRC / n;
  const gap = n > 1 ? 3 : 0;

  return (
    <Pressable onPress={onOpen} hitSlop={8} style={styles.ring}>
      <View style={StyleSheet.absoluteFill}>
        <Svg width={RING} height={RING}>
          {stepFracs.map((f, i) => {
            const len = seg - gap;
            const off = -(i * seg);
            return (
              <React.Fragment key={i}>
                <Circle
                  cx={RING / 2} cy={RING / 2} r={R} stroke="rgba(255,255,255,0.28)" strokeWidth={3} fill="none" strokeLinecap="round"
                  strokeDasharray={`${len} ${CIRC}`} strokeDashoffset={off} rotation={-90} origin={`${RING / 2}, ${RING / 2}`}
                />
                {f > 0.02 && (
                  <Circle
                    cx={RING / 2} cy={RING / 2} r={R} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round"
                    strokeDasharray={`${len * Math.min(1, f)} ${CIRC}`} strokeDashoffset={off} rotation={-90} origin={`${RING / 2}, ${RING / 2}`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </Svg>
      </View>
      {running ? (
        <Animated.View style={indeterminate ? { transform: [{ rotate }] } : undefined}>
          {(() => {
            const k = running.steps[currentIndex(running)].key;
            return k === "upload"
              ? <CloudUpload size={13} color="#FFFFFF" strokeWidth={2.4} />
              : k === "read"
                ? <FileSearch size={13} color="#FFFFFF" strokeWidth={2.4} />
                : <Sparkles size={13} color="#FFFFFF" strokeWidth={2.4} />;
          })()}
        </Animated.View>
      ) : (
        <Text style={styles.ringT}>{warnOnly ? "!" : count > 99 ? "99+" : count}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 11 },
  topRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 4, marginBottom: 14 },
  title: { flex: 1, fontSize: 14.5, fontWeight: "700", color: NEUTRAL.textPrimary },
  pct: { fontSize: 14, fontWeight: "800", fontVariant: ["tabular-nums"] },
  stepLabel: { fontSize: 11.5, fontWeight: "700", color: NEUTRAL.textPrimary, marginTop: 6 },
  stepCap: { fontSize: 10, color: NEUTRAL.textSecondary, marginTop: 1, fontVariant: ["tabular-nums"] },
  bang: { fontSize: 15, fontWeight: "800", color: NEUTRAL.warning },
  todoN: { fontSize: 13, fontWeight: "700", color: "#9AA8B3" },
  solid: { height: 2, borderRadius: 1, backgroundColor: NEUTRAL.success },
  dotted: { height: 2, flexDirection: "row", justifyContent: "space-between", overflow: "hidden", alignItems: "center" },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "#B9C5CD" },
  capRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 8, paddingHorizontal: 4, gap: 8 },
  capL: { flex: 1, fontSize: 11.5, color: NEUTRAL.textSecondary },
  capB: { fontWeight: "700", color: NEUTRAL.textPrimary },
  capR: { fontSize: 11.5, color: NEUTRAL.textSecondary },
  note: { flexDirection: "row", gap: 7, marginTop: 11, paddingHorizontal: 4, alignItems: "flex-start" },
  noteT: { flex: 1, fontSize: 10.5, color: NEUTRAL.textSecondary, lineHeight: 14.5 },
  entry: { backgroundColor: "#FFFFFF", borderWidth: 0.5, borderColor: NEUTRAL.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10 },
  entryTile: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  entryT: { fontSize: 12.5, fontWeight: "700", color: NEUTRAL.textPrimary },
  entryS: { fontSize: 11, color: NEUTRAL.textSecondary, marginTop: 1 },
  ring: { width: RING, height: RING, borderRadius: RING / 2, backgroundColor: "rgba(0,0,0,0.18)", alignItems: "center", justifyContent: "center" },
  ringT: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
});
